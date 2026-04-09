# Master Plan — Dashboard Quản Lý Lead Bất Động Sản

> Tài liệu hướng dẫn thiết kế & triển khai toàn bộ dashboard. Viết cho người đọc lần đầu — có thể đọc từ trên xuống dưới là hiểu.

---

## Mục lục

1. [Mục tiêu dự án](#1-mục-tiêu-dự-án)
2. [Stack công nghệ và lý do chọn](#2-stack-công-nghệ-và-lý-do-chọn)
3. [Người dùng và phân quyền](#3-người-dùng-và-phân-quyền)
4. [Luồng dữ liệu tổng quan](#4-luồng-dữ-liệu-tổng-quan)
5. [Chi tiết layout & các trang](#5-chi-tiết-layout--các-trang)
   - 5.0 Layout chung (sidebar + topbar)
   - 5.1 Trang Dashboard Overview (landing sau login)
   - 5.2 Trang Quản lý dự án (list + detail)
   - 5.3 Trang Report Data (split UX theo role)
   - 5.4 Trang Settings (5 sub-tab, bao gồm Quản lý team = Phân quyền)
   - 5.5 Modal/Trang Đăng dự án mới (mở từ nút "+ Tạo mới" topbar)
6. [Data schema (Drizzle)](#6-data-schema-drizzle)
7. [File tree](#7-file-tree)
8. [Luồng nghiệp vụ chi tiết](#8-luồng-nghiệp-vụ-chi-tiết)
9. [API & Server Actions](#9-api--server-actions)
10. [Task breakdown theo phase](#10-task-breakdown-theo-phase)
11. [Rủi ro & mitigation](#11-rủi-ro--mitigation)
12. [Hook để sẵn cho Phase 2](#12-hook-để-sẵn-cho-phase-2-webhook-realtime)

---

## 1. Mục tiêu dự án

Xây dashboard nội bộ giúp team quản lý **lead bất động sản** đồng bộ từ 2 nguồn:

- **Facebook Ads Manager** — nơi sinh ra lead ban đầu (từ form quảng cáo)
- **Bitrix24** — nơi nhân viên sale cập nhật trạng thái chăm sóc lead

**Giai đoạn 1 (phạm vi plan này)**: user tự export CSV từ 2 nguồn và upload lên dashboard mỗi ngày. Dashboard hợp nhất 2 file, hiển thị thành:
- List dự án với chỉ số hiệu quả
- Report lead theo nhiều chiều (ngày, nhân viên, fanpage)
- Phân tích campaign/adset/ads theo từng dự án

**Giai đoạn 2 (chưa code, chỉ để hook sẵn)**: khi được Meta duyệt App Review và có quyền Bitrix webhook → chuyển sang realtime tự động, không cần upload CSV nữa.

**Con số vận hành:**
- ~2000 lead/ngày tổng cộng
- ~500 dự án active
- ~30 user digital + vài admin + vài GDDA
- ~30 ads/dự án

---

## 2. Stack công nghệ và lý do chọn

| Thành phần | Chọn | Lý do |
|---|---|---|
| **Framework** | Next.js 15 App Router | Vercel native, Server Components giảm JS client, Server Actions đơn giản hóa form/mutation |
| **UI library** | shadcn/ui + TailwindCSS | Copy code vào repo (không phải dependency), full control, match frontend mẫu |
| **Database** | Neon Postgres | Free tier đủ cho Phase 1, tích hợp Vercel Marketplace 1-click, database branching cho preview, `LISTEN/NOTIFY` cho realtime sau này |
| **ORM** | Drizzle | TypeScript-first, SQL-sát, bundle nhỏ (cold start nhanh hơn Prisma), aggregate query dễ viết |
| **Auth** | Auth.js v5 (NextAuth) + **Google OAuth** (Workspace domain-restricted) | Miễn phí, tích hợp App Router, Drizzle adapter sẵn có. Chỉ cho phép email thuộc domain công ty đăng nhập |
| **Background jobs** | Inngest Cloud | Durable execution — nếu step fail tự retry, crash giữa chừng resume được. Cần cho việc parse CSV lớn và Phase 2 webhook. Free tier 50k step/tháng đủ dùng |
| **CSV parsing** | papaparse | Streaming, xử lý encoding UTF-8 tốt, battle-tested |
| **Form validation** | Zod + react-hook-form | Schema-first, tương thích Server Actions |
| **Deploy** | Vercel Free → Pro khi cần | Phase 1 Free đủ; upgrade khi vượt cron quota hoặc cần Inngest paid |

**Không dùng:** Prisma (cold start nặng), Supabase (bundle thừa nếu không dùng Auth/Realtime/Storage của họ), Clerk (trả phí theo MAU), Pusher/Ably (thừa vì SSE + Neon đủ).

---

## 3. Người dùng và phân quyền

### Cơ chế đăng nhập

**Đăng nhập bằng Google Workspace (tài khoản công ty)** — không có username/password.

- Provider: Google OAuth 2.0 qua Auth.js v5
- **Hạn chế domain**: chỉ chấp nhận email thuộc `@company.com` (domain cụ thể sẽ config trong `.env`). User ngoài domain → reject login kèm thông báo "Vui lòng dùng email công ty"
- **Hạn chế user đã được admin tạo trước**: user login lần đầu nhưng email chưa có trong bảng `users` (do admin tạo sẵn) → reject với thông báo "Tài khoản chưa được cấp quyền, liên hệ admin". Không tự động tạo user mới từ OAuth callback (chống leak)
- Flow lần đầu: admin vào tab Phân quyền → tạo user với email `a@company.com` + role + gán dự án → user đó mở dashboard → click "Đăng nhập với Google" → Google OAuth → callback match email → đăng nhập thành công
- Session: JWT trong cookie (chuẩn Auth.js), expire 7 ngày, refresh khi user active
- Logout: clear session, không revoke Google token

**Cấu hình cần:**
- Google Cloud Console: tạo OAuth 2.0 Client ID (Web application)
- Authorized redirect URI: `https://dashboard.company.com/api/auth/callback/google` (prod) + `http://localhost:3000/api/auth/callback/google` (dev)
- `.env`:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `ALLOWED_EMAIL_DOMAIN=company.com` (có thể multi-domain, comma-separated)
  - `AUTH_SECRET` (Auth.js)

**Auth.js callback logic:**
```typescript
// lib/auth/config.ts
callbacks: {
  async signIn({ user, account, profile }) {
    // 1. Check domain
    const email = profile?.email;
    const domain = email?.split('@')[1];
    const allowedDomains = process.env.ALLOWED_EMAIL_DOMAIN!.split(',');
    if (!domain || !allowedDomains.includes(domain)) {
      return '/login?error=domain';
    }
    // 2. Check email đã được admin tạo trước chưa
    const dbUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!dbUser || !dbUser.active) {
      return '/login?error=not-provisioned';
    }
    // 3. Update last login, image từ Google
    await db.update(users).set({
      image: profile?.picture,
      lastLoginAt: new Date()
    }).where(eq(users.id, dbUser.id));
    return true;
  },
  async session({ session, token }) {
    // attach role vào session
    session.user.role = token.role;
    session.user.id = token.sub;
    return session;
  },
  async jwt({ token, user }) {
    if (user) {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, user.email!),
      });
      token.role = dbUser?.role;
      token.sub = dbUser?.id;
    }
    return token;
  }
}
```

**Trang `/login`**:
```
┌────────────────────────────────────────┐
│         Dashboard Quản Lý Lead         │
│                                        │
│  [🔐 Đăng nhập với Google Workspace]   │
│                                        │
│  Chỉ tài khoản @company.com được phép  │
│                                        │
│  Lỗi (nếu có):                         │
│  • Email ngoài domain công ty          │
│  • Tài khoản chưa được cấp quyền       │
└────────────────────────────────────────┘
```

### 3 Role

**admin** — full quyền
- Tạo/xoá/sửa user
- Gán user vào dự án với quyền view/edit riêng biệt
- Đăng dự án mới
- Upload CSV mọi dự án
- Xem mọi report, quản lý stage alias

**digital** (nhân viên marketing)
- **Xem** dự án được gán `can_view=true`
- **Sửa** dự án được gán `can_view=true` + `can_edit=true` (sửa metadata, upload CSV, gán campaign)
- **Đăng dự án mới** (tự động thành người gán `can_edit` cho dự án mình tạo)
- Xem Report Data của các dự án có `can_view`

**GDDA** (Giám Đốc Dự Án)
- **Chỉ xem tab Report Data** của dự án được gán
- Xem được nhân viên đang chăm lead (responsible từ Bitrix) trong dự án đó
- Không upload CSV, không sửa dự án, không tạo user
- Có filter nhân viên trong phạm vi dự án của mình

### Cơ chế phân quyền (cực quan trọng)

Phân quyền chia **2 tầng**:

1. **Tầng role** (`users.role`): quyết định user thấy menu nào, được gọi action nào.
2. **Tầng project** (`project_users` table): quyết định user thấy *dự án nào cụ thể* và làm gì với dự án đó.

```
users.role = 'digital'  ──┐
                          ├──► thấy menu "Quản lý dự án"
                          └──► chỉ thấy project có (project_users.user_id = me AND can_view=true)
                               và chỉ sửa được project có can_edit=true
```

**Nguyên tắc vàng:** `projectId` mà FE gửi lên server **không bao giờ được tin**. Mọi query server-side đều phải gọi guard `getAccessibleProjectIds(user)` và intersect với filter FE gửi.

---

## 4. Luồng dữ liệu tổng quan

### Giai đoạn 1 (phạm vi hiện tại)

```
┌─────────────────────────────────────────────────────────────┐
│ USER (Admin / Digital) upload 2 file CSV mỗi ngày:          │
│   - raw_leads_facebook.csv (từ Facebook Ads Manager)        │
│   - bitrix_status.csv (từ Bitrix24 — user chuyển từ ảnh)    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/upload/csv                                        │
│   - Validate quyền can_edit trên project_id                 │
│   - Validate size, header signature (reject nếu sai loại)   │
│   - Ghi csv_uploads (status=pending) làm audit log          │
│   - Enqueue Inngest event "csv/uploaded"                    │
│   - Trả về {uploadId} để UI poll                            │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Inngest function: process-csv-upload                        │
│ (chạy ngoài request cycle, có retry tự động nếu fail)       │
│                                                             │
│  Step 1: Stream parse (papaparse)                           │
│  Step 2: Adapter FB / Bitrix chuyển thành DTO chuẩn         │
│  Step 3: Stage mapper (Bitrix raw → stage_aliases → stages) │
│  Step 4: Matcher (name + phone fallback → flag conflict)    │
│  Step 5: Upsert transaction:                                │
│          - UPDATE leads (current state)                     │
│          - INSERT lead_stage_events (nếu stage đổi)         │
│          - UPSERT lead_snapshots (daily full copy)          │
│  Step 6: Cập nhật csv_uploads status=done                   │
│  Step 7: Phát event "aggregate/rebuild" cho (project, date) │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ daily_aggregates — bảng pre-computed cho report nhanh       │
│ (group theo ngày × dự án × stage × nhân viên × fanpage)     │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js Server Components + Server Actions                  │
│   - Query với RBAC scope (accessibleProjectIds)             │
│   - Render 4 tab dashboard                                  │
└─────────────────────────────────────────────────────────────┘
```

### Giai đoạn 2 (chưa code — đã plan hook)

Thay thế bước upload CSV bằng 2 webhook:

```
Facebook Lead Ads ──webhook──► /api/webhooks/facebook ──┐
                                                         ├──► Inngest "lead/ingested"
Bitrix24 outbound ──webhook──► /api/webhooks/bitrix ─────┘              │
                                                                         ▼
                                            (cùng Upsert Service, Matcher, Aggregate)
                                                                         │
                                                                         ▼
                                                 Neon pg_notify('leads_changed')
                                                                         │
                                                                         ▼
                                                       SSE /api/sse/leads
                                                                         │
                                                                         ▼
                                                   UI update realtime
```

Nhờ dùng **adapter pattern** (`LeadSource` interface), Phase 2 chỉ cần viết 2 adapter webhook mới — toàn bộ pipeline parse → match → upsert → aggregate **không phải rewrite dòng nào**.

---

## 5. Chi tiết layout & các trang

> **Revision 2 (sau khi phân tích frontend mẫu readdy bằng Chrome DevTools)**: cấu trúc sidebar và phân bổ trang đã điều chỉnh để khớp frontend mẫu. Các feature doanh thu/funnel 5-bước/AI Analytic — ĐÃ HOÃN sang Phase 2+.

### 5.0 Layout chung

```
┌─────────────┬──────────────────────────────────────────────────────┐
│             │ [🔍 Tìm kiếm dự án, chiến dịch, lead...]  [📅 30d ▾]│
│   LOGO      │                              [+ Tạo mới] [🔔] [👤]  │
│             ├──────────────────────────────────────────────────────┤
│ 📊 Dashboard│                                                      │
│ 📁 Quản lý  │                                                      │
│    dự án    │           (nội dung trang tại đây)                  │
│ 📈 Report   │                                                      │
│    Data     │                                                      │
│ ⚙  Settings │                                                      │
│             │                                                      │
├─────────────┤                                                      │
│ 👤 User     │                                                      │
│ name@co.com │                                                      │
└─────────────┴──────────────────────────────────────────────────────┘
```

**Sidebar 4 items** (tuỳ role):
| Item | admin | digital | gdda |
|---|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | — |
| Quản lý dự án | ✅ | ✅ | — |
| Report Data | ✅ | ✅ | ✅ (landing) |
| Settings | ✅ (full) | ✅ (Thông tin + Tích hợp xem) | ✅ (Thông tin tài khoản only) |

**Topbar**:
- Ô tìm kiếm global
- Date range picker (ảnh hưởng stats toàn trang)
- **Nút `+ Tạo mới`** — dropdown:
  - "Dự án mới" (admin/digital) → mở trang `/projects/new`
  - "Lead thủ công" (admin/digital+can_edit) → modal nhập 1 lead riêng
- Notification bell
- User avatar → dropdown (profile, logout)

**Redirect sau login theo role**:
- admin → `/` (Dashboard Overview)
- digital → `/` (Dashboard Overview, scope các dự án được gán)
- gdda → `/report` (Report Data, scope các dự án được gán)

---

### 5.1 Trang Dashboard Overview

**Route**: `/` — landing page sau khi login.

**Mục đích**: xem nhanh tình trạng mọi dự án trong scope trong khoảng thời gian (30d mặc định).

**Layout**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Dashboard Tổng quan                                [30 ngày qua ▾]  │
│ Theo dõi hiệu quả marketing                                          │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ Tổng dự  │ │ Tổng chi │ │ Tổng     │ │ Tổng F1  │ │ Tổng     │  │
│ │ án đang  │ │ phí MKT  │ │ Lead     │ │          │ │ Booking  │  │
│ │ chạy     │ │          │ │          │ │          │ │          │  │
│ │    6     │ │  2.4 tỷ  │ │  4,575   │ │  1,529   │ │   510    │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ Tổng hợp hiệu quả các dự án                         [Xem chi tiết →]│
│                                                                      │
│ Dự án          │Chi phí│Booking│ F1 │Lead │CP/Booking│CP/F1│CP/Lead │
├──────────────────────────────────────────────────────────────────────┤
│ Vinhomes GP    │ 850M  │ 142   │418 │1247 │  5.99M   │2.03M│  682K  │
│ Masteri WF     │ 620M  │ 98    │298 │892  │  6.33M   │2.08M│  695K  │
│ The Metropole  │ 480M  │ 68    │215 │654  │  7.06M   │2.23M│  734K  │
│ Eco Green SG   │ 320M  │ 62    │178 │512  │  5.16M   │1.80M│  625K  │
│ Sunshine City  │ 280M  │ 58    │175 │542  │  4.83M   │1.60M│  516K  │
│ The Manor      │ 450M  │ 82    │245 │728  │  5.49M   │1.84M│  618K  │
│ ─────────────────────────────────────────────────────────────────── │
│ TỔNG CỘNG      │ 3,000 │ 510   │1529│4575 │    —     │  —  │   —    │
└──────────────────────────────────────────────────────────────────────┘
```

**Stat cards** (5 card, bỏ cột doanh thu vì không có dữ liệu):
- Tổng dự án đang chạy
- Tổng chi phí MKT (sum của `project_costs.amount` trong range)
- Tổng Lead
- Tổng F1
- Tổng Booking

**Bảng tổng hợp**:
- Mỗi row 1 dự án (chỉ scope user có `can_view`)
- Cột: Chi phí / Booking / F1 / Lead / CP/Booking / CP/F1 / CP/Lead
- **Bỏ các cột** Doanh số, %CP/DS, CP/Deal (không có dữ liệu doanh thu)
- Row cuối TỔNG CỘNG
- Click tên dự án → `/projects/[slug]` (detail)

**Query**: dùng `daily_aggregates` để mở nhanh kể cả 500 dự án.

---

### 5.2 Trang Quản lý dự án (list + detail)

Chia làm **3 view con**:

#### View 1: List tất cả dự án (trang `/projects`)

**Layout**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ [🔍 Tìm kiếm dự án, chiến dịch, lead...]   [📅 Last 30 days ▾]  [+]│
├──────────────────────────────────────────────────────────────────────┤
│ Quản lý dự án                               [+ Thêm dự án mới]      │
│ Theo dõi và quản lý tất cả dự án bất động sản                       │
│                                                                      │
│ [Tất cả (6)] [Đang chạy] [Cảnh báo] [Tạm dừng]   [🔍 Tìm dự án...]  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌──────────────────────────┐           │
│ │ Vinhomes Grand Park      │ │ Masteri Waterfront       │           │
│ │ Quận 9, TP.HCM [Đang chạy]│ │ Quận 2, TP.HCM [Đang chạy]│          │
│ │                          │ │                          │           │
│ │ Ngân sách  Tổng Lead  CPL│ │ Ngân sách  Tổng Lead  CPL│           │
│ │ 850M       1,247     682K│ │ 620M       892       695K│           │
│ │                          │ │                          │           │
│ │ Lead F1   Conv.  Booking │ │ Lead F1   Conv.  Booking │           │
│ │ 418       33.5%   142    │ │ 298       33.4%   98     │           │
│ │                          │ │                          │           │
│ │ 👤 Nguyễn Văn A [FB][G]  │ │ 👤 Trần Thị B  [TT][FB]  │           │
│ └──────────────────────────┘ └──────────────────────────┘           │
│ ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Filter bar**:
- Tab trạng thái: `Tất cả | Đang chạy | Cảnh báo | Tạm dừng`
  - Cảnh báo = dự án có CPL vượt ngưỡng, hoặc F1 rate < X%
  - Tạm dừng = user manual set
- Ô tìm kiếm: filter theo tên dự án (debounce 300ms)
- Date range picker (ảnh hưởng tới metric: lead trong khoảng đó)

**Mỗi card hiển thị 8 chỉ số + 4 thông tin meta**:

| Field | Nguồn dữ liệu | Ghi chú |
|---|---|---|
| Tên dự án | `projects.name` | |
| Vị trí | `projects.location` | |
| Trạng thái badge | `projects.status` | Enum running/warning/paused |
| Ngân sách | `project_costs.amount` (sum theo khoảng date) | Giai đoạn 1 nhập tay |
| Tổng Lead | COUNT(leads) where project_id & created_at in range | |
| CPL | Ngân sách / Tổng Lead | Tính trên-the-fly |
| Lead F1 | COUNT(leads) where stage.code='F1' | |
| Conversion | Lead F1 / Tổng Lead × 100% | |
| Booking | COUNT(leads) where stage.code='BOOKING' | |
| Nhân viên quản lý dự án | `project_users` role='digital' primary | Hiển thị avatar + tên |
| Badge nguồn | `project_fanpages` join sources | FB / Google / Zalo / TikTok |

**Query backend**: dùng `daily_aggregates` để card render nhanh, không query trực tiếp `leads`. Lợi: mở 500 dự án vẫn < 200ms.

**Query function** (pseudo):
```typescript
getProjectsForUser({
  userId,
  dateFrom,
  dateTo,
  statusFilter,
  search
}) → ProjectCardData[]
```

#### View 2: Detail dự án (trang `/projects/[slug]`)

Khi user **click vào 1 card** → mở trang detail theo route `/projects/[slug]`. Trang này có **4 phần xếp dọc** (đã bỏ Báo cáo doanh thu, Funnel 5 bước, Danh sách căn hộ, AI Analytic — hoãn Phase 2+):

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Quay lại  │  Vinhomes Grand Park  [Đang chạy]   [Xuất] [Chỉnh sửa]│
│ Phụ trách: Nguyễn Văn A                                              │
├──────────────────────────────────────────────────────────────────────┤
│ PHẦN 1: 4 STAT CARD                                                 │
│                                                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│ │  850M    │ │  1,247   │ │   682K   │ │  33.5%   │                │
│ │ Tổng     │ │ Tổng     │ │   CPL    │ │ F1 Rate  │                │
│ │ ngân sách│ │  Lead    │ │          │ │          │                │
│ │ +12% MoM │ │ +18% MoM │ │ -5% MoM  │ │ +8% MoM  │                │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                │
├──────────────────────────────────────────────────────────────────────┤
│ PHẦN 2: CHIẾN DỊCH ĐANG HOẠT ĐỘNG                                   │
│ (stat bar + bảng campaign)                                          │
├──────────────────────────────────────────────────────────────────────┤
│ PHẦN 3: MẪU QUẢNG CÁO HIỆU QUẢ                                      │
│ (stat bar + bảng ads rank)                                          │
├──────────────────────────────────────────────────────────────────────┤
│ PHẦN 4: UPLOAD CSV (chỉ admin/digital có can_edit)                  │
│ [📤 Upload CSV Facebook]  [📤 Upload CSV Bitrix]  [Lịch sử upload]  │
└──────────────────────────────────────────────────────────────────────┘
```

**Đã HOÃN sang Phase 2+** (không có trong Phase 1):
- ~~Báo cáo doanh thu (Tổng DT, căn bán)~~
- ~~Chart doanh thu theo tháng~~
- ~~Funnel chuyển đổi 5 bước~~ (Contacted/Visit không có trong Bitrix)
- ~~Danh sách căn hộ & Doanh thu từng căn~~
- ~~AI Analytic (auto insight + đề xuất)~~

#### View 2 — Phần 2: Section CHIẾN DỊCH

Đây là section hiển thị **dữ liệu level Campaign** từ Facebook. Có 2 lớp:

**Lớp A: Stat bar tổng quan**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Chiến dịch đang hoạt động         [⚠ Chưa kết nối ads account][🔗] │
│ Dữ liệu được đồng bộ từ tài khoản quảng cáo                         │
│                                                                     │
│ [Facebook Ads (1)] [Google Ads (1)]            [📅 30 ngày qua ▾]  │
│                                                                     │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│ │  320M      │ │  2.4M      │ │  540       │ │  720       │       │
│ │ Tổng chi   │ │ Tổng hiển  │ │ Tổng F1    │ │ Tổng Lead  │       │
│ │ tiêu       │ │ thị        │ │            │ │            │       │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

**Lớp B: Bảng chi tiết campaign** (giống ảnh đỏ/xanh trong PDF plan của bạn)
```
┌──────────────────────────────────────────────────────────────────────┐
│ CAMPAIGN                        │F1│ĐANG CHĂM│TỔNG LEAD│TỈ LỆ│TRẠNG │
├──────────────────────────────────────────────────────────────────────┤
│ ● SUN HÀ NAM-THAP TANG FA_...1  │71│    73   │   195   │ 36% │ OFF  │
│ ● SUN HÀ NAM-THAP TANG FA_...2  │ 5│     2   │    14   │ 36% │ OFF  │
│ ● SUN HÀ NAM-THAP TANG FA_...3  │55│    34   │   103   │ 53% │ ON   │
│ ● SUN_HN_TT_LF_28022026_LINH    │17│    19   │    40   │ 43% │ ON   │
│ ● 170326 | Lead | SUN HÀ NAM-01 │ 1│     7   │     8   │ 13% │ ON   │
│ ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Data mapping từ CSV Facebook → bảng này:**
- Mỗi dòng trong CSV có cột `Campaign` → group theo giá trị này
- `F1` = COUNT lead trong campaign đó có stage.code='F1'
- `ĐANG CHĂM` = COUNT lead có stage.code IN ('DANG_CHAM', 'DANG_CHAM_2H')
- `TỔNG LEAD` = COUNT lead trong campaign
- `TỈ LỆ` = F1 / Tổng Lead × 100%
- `TRẠNG THÁI ON/OFF` = **label tĩnh** lưu trong `campaigns.status_label`, user set manual. **KHÔNG** gọi API Facebook bật/tắt (theo yêu cầu bạn — chỉ là label).
- Chấm màu trước tên campaign: đỏ nếu tỉ lệ F1 < 30%, vàng 30-50%, xanh > 50% (rule này có thể config)

**⚠️ Cột KHÔNG có trong Phase 1** (hiển thị "—" placeholder):
- `Chi tiêu`, `Hiển thị`, `CTR`, `CPL`, `Hiệu quả` — CSV Facebook export không bao gồm các số liệu này (chỉ có lead data)
- Phase 2 sẽ fill từ Facebook Insights API
- Giai đoạn 1 user có thể nhập chi phí thủ công qua `setProjectCost` (level dự án, không phải level campaign)

**Sort mặc định**: theo tỉ lệ F1 giảm dần.

**Click vào 1 dòng campaign** → mở dialog hoặc drawer hiển thị list Adset của campaign đó (nested drill-down).

**Component**: `<CampaignTable projectId={id} dateRange={range} />`
- Fetch qua Server Component, không cần client state
- Skeleton khi loading

#### View 2 — Phần 3: Section MẪU QUẢNG CÁO

Hiển thị **level Ad** (quảng cáo cụ thể), rank theo hiệu quả. Khác với section Campaign ở chỗ: mỗi row là 1 **Ad** (không phải Campaign), và có **ảnh thumbnail + loại ad + score**.

**Layout**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Mẫu quảng cáo hiệu quả                  [Sắp xếp theo: Nhiều F1 ▾] │
│ Phân tích và xếp hạng các mẫu quảng cáo theo F1 và Booking         │
│                                                                     │
│ [Facebook Ads (4)] [Google Ads (4)]                                │
│                                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │  645     │ │   85     │ │   918    │ │  320M    │              │
│ │ Tổng F1  │ │ Booking  │ │ Tổng Lead│ │ Tổng chi │              │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                                                                     │
│ 🏆 Mẫu quảng cáo hiệu quả nhất                                     │
│ Lead Form - Nhận báo giá ngay    193 F1 - 28 Booking - 276 Leads   │
├──────────────────────────────────────────────────────────────────────┤
│ #│[ảnh]│TÊN MẪU QUẢNG CÁO     │LOẠI   │F1 │BOOK│LEAD│CTR │CPL│SCORE│
├──────────────────────────────────────────────────────────────────────┤
│ 1│ 🏠  │Lead Form - Nhận báo  │LeadForm│193│ 28 │276 │2.5%│ 0 │91⭐ │
│  │     │giá ngay              │        │   │    │    │    │   │Xuất │
│  │     │Nhận báo giá và ưu đãi│        │   │    │    │    │   │sắc  │
│ 2│ 🏠  │Video Tour 360° - Căn │Video   │186│ 24 │248 │3%  │ 0 │85⭐ │
│  │     │hộ mẫu 2PN            │        │   │    │    │    │   │Xuất │
│  │     │                      │        │   │    │    │    │   │sắc  │
│ 3│ 🏠  │Carousel - Tiện ích   │Carousel│137│ 18 │196 │2.7%│ 0 │88⭐ │
│  │     │nội khu               │        │   │    │    │    │   │Tốt  │
│ 4│ 🏠  │Retargeting - Khách đã│Single  │129│ 15 │198 │3.4%│ 0 │82⭐ │
│  │     │xem website           │Image   │   │    │    │    │   │Tốt  │
└──────────────────────────────────────────────────────────────────────┘
```

**Data mapping từ CSV Facebook → bảng này:**
- Group theo cột `Ad` (tên ad cụ thể)
- `Loại` = parse từ `Form Name` hoặc từ một convention đặt tên (VD: chứa "Video" → Video, "Carousel" → Carousel)
- `F1` = COUNT lead với ad_name đó có stage F1
- `Booking` = COUNT stage BOOKING
- `Lead` = COUNT tổng
- `CTR` = **Phase 1 không có**, để "—" (vì CSV FB không export CTR level). Phase 2 lấy từ Insights API.
- `CPL` = **Phase 1 không có**, để "—". Phase 2 lấy từ Insights API.
- `Score` = công thức tự tính: `(F1 × 3 + Booking × 10) / Lead` normalize về 0-100
  - > 90: Xuất sắc
  - 75-90: Tốt
  - 60-75: Khá
  - < 60: Cần cải thiện
- **Ảnh thumbnail**: Phase 1 **không có** (CSV FB không export creative URL) → hiển thị placeholder icon theo loại ad. Phase 2 lấy từ Marketing API `creative.thumbnail_url`.

**Controls**:
- Tab toggle Facebook Ads / Google Ads (Phase 1 chỉ Facebook)
- Dropdown sort: Nhiều F1 nhất / Nhiều Booking / CTR cao / CPL thấp / Score
- Nút rank #1, #2, #3, #4 — ranking theo sort hiện tại

**Component**: `<AdCreativeTable projectId={id} dateRange={range} sort={sort} platform={platform} />`

#### View 3: Edit dự án (trang `/projects/[slug]/edit`)

- Chỉ digital có `can_edit` hoặc admin mới thấy nút "Sửa"
- Form reuse component từ Tab 4 (Đăng dự án mới)
- Có thêm nút "Xoá dự án" (chỉ admin)

#### Tổng kết Tab Quản lý dự án

**Routes**:
- `/projects` — List view
- `/projects/[slug]` — Detail view (3 phần)
- `/projects/[slug]/edit` — Edit form
- `/projects/new` → route Tab 4

**Components chính**:
- `ProjectListPage` (Server Component)
- `ProjectFilterBar` (Client — state date/status/search)
- `ProjectCard` (Server Component nhận props)
- `ProjectDetailPage` (Server Component)
- `ProjectInfoHeader` (Server)
- `CampaignSection` = wrapper
  - `CampaignStatsBar` (4 stat cards)
  - `CampaignTable` (bảng main)
  - `AdsetDialog` (drill-down)
- `AdCreativeSection` = wrapper
  - `AdCreativeStatsBar`
  - `TopAdHighlight` (card "Mẫu hiệu quả nhất")
  - `AdCreativeTable`

---

### 5.3 Trang Report Data (split UX theo role)

**Route**: `/report`

**Chia UX theo role**:
- **admin / digital**: xem **1 bảng chi tiết** đầy đủ (như frontend mẫu) + filter + stat cards
- **GDDA**: xem **4 sub-tabs tái tạo format Excel** (filter đặc biệt) + filter tự động lock vào dự án được gán

---

#### 5.3.1 View cho admin / digital

**Layout**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Report Data — CRM                       [🔗 Kết nối nguồn] [+ Lead] │
│ Quản lý toàn bộ data lead từ các kênh quảng cáo                     │
│                                                                      │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│ │ Tổng   │ │  F1    │ │ Đang   │ │Booking │ │  Deal  │            │
│ │ lead   │ │        │ │ chăm   │ │        │ │        │            │
│ │  15    │ │   5    │ │   4    │ │   3    │ │   3    │            │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘            │
│                                                                      │
│ LỌC: [📅 Thời gian ▾] [Dự án ▾] [Fanpage ▾] [Nguồn ▾] [Tình trạng ▾]│
│                                                                      │
│ [Tóm tắt] [Theo Nhân Viên] [Theo Nguồn Fanpage] [Chi Tiết Leads]    │
├──────────────────────────────────────────────────────────────────────┤
│ (nội dung tab theo sub-tab đang chọn)                               │
└──────────────────────────────────────────────────────────────────────┘
```

**Stat cards**:
- Lấy từ `daily_aggregates` để nhanh
- Scope theo filter hiện tại

**Filter bar** (client state, sync với URL query):
- **Thời gian**: date range picker
- **Dự án**: multi-select dropdown, chỉ liệt kê dự án user có `can_view`
- **Fanpage**: multi-select
- **Nguồn**: multi-select (Facebook, Google, Zalo, TikTok, …)
- **Tình trạng**: multi-select các stage

**4 sub-tabs tái tạo đúng format Excel báo cáo (theo PDF plan):**

#### Sub-tab 1: Tóm tắt
Giống sheet "Tóm tắt" trong Excel mẫu. Bảng phân tích theo ngày:

| Ngày | Tổng Leads | F1 | Đang chăm | Không bắt máy | Thuê bao | Chào DA khác | Môi giới | Khác | F1 Rate |
|---|---|---|---|---|---|---|---|---|---|
| 4/3 | 28 | 13 | 13 | 1 | 1 | 0 | 0 | 0 | 46% |
| 5/3 | 35 | 16 | 14 | 0 | 4 | 1 | 0 | 0 | 46% |
| ... | | | | | | | | | |
| **TỔNG** | **868** | **349** | **437** | **21** | **49** | **7** | **2** | **2** | **40.2%** |

Có header phía trên: `Tổng Leads | Số Nhân Viên | Leads F1 | F1 Rate | Leads DC | Non-F1`.

#### Sub-tab 2: Theo Nhân Viên
Giống sheet "Theo nhân viên":

| Nhân Viên | Tổng Leads | F1 (Quan tâm DA) | Đang Chăm (2h) | Thuê bao KLL được | Không Bắt Máy | Môi giới | Chào DA khác | Khác |
|---|---|---|---|---|---|---|---|---|
| Nguyễn Duy Tiệp | 32 | 8 | 9 | 15 | 0 | 0 | 0 | 0 |
| Nguyễn Thị Thúy Trang | 29 | 23 | 6 | 0 | 0 | 0 | 0 | 0 |
| ... | | | | | | | | |

- Rows = distinct employees trong `leads` của scope hiện tại
- Sort mặc định: Tổng Leads giảm dần

#### Sub-tab 3: Theo Nguồn Fanpage
Giống sheet "Theo nguồn fanpage":

| Nguồn / Fanpage | Số Leads | Tỷ lệ % |
|---|---|---|
| Facebook - Sun Urban City (KĐT vệ tinh Hà Nội 50 phút) | 247 | 34.9% |
| Facebook - Sun Urban City | 197 | 27.8% |
| ... | | |
| **TỔNG CỘNG** | **708** | **100%** |

#### Sub-tab 4: Chi Tiết Leads
Giống sheet "Chi tiết leads" — bảng raw lead với pagination server-side:

| STT | Tên Lead | Giai đoạn | Ngày | Nhân viên phụ trách | Nguồn |
|---|---|---|---|---|---|
| 1 | Thiên Kim Chánh | Thuê bao KLL được | 4/3 | Lã Thị Ngà | Facebook - Sun Urban City |
| 2 | Cối Bê | Đang Chăm (2h) | 4/3 | Đức Thiện | Facebook - Sun Urban City (KĐT vệ tinh…) |
| ... | | | | | |

- Pagination 50 rows/page, server-side
- Stage có badge màu theo category
- Nhân viên có avatar
- Click row → dialog hiện full info lead (bao gồm form_answers JSON)

**RBAC scope cho GDDA**:
- Filter "Dự án" auto-lock vào các dự án GDDA được gán, không thấy dự án khác
- Có thêm filter "Nhân viên" (distinct employee của các dự án đó)
- Không thấy button "Kết nối nguồn" hay "Thêm lead thủ công"

---

### 5.4 Trang Settings (5 sub-tab, bao gồm Quản lý team = Phân quyền)

**Route**: `/settings` — mọi role đều vào được, nhưng sub-tab hiển thị khác nhau.

**Layout** (khớp frontend mẫu):
```
┌──────────────────────────────────────────────────────────────────────┐
│ Settings                                                             │
│ Quản lý cài đặt hệ thống và tài khoản                                │
├──────────────┬───────────────────────────────────────────────────────┤
│ ● Thông tin  │                                                       │
│   tài khoản  │                                                       │
│              │        (nội dung sub-tab được chọn)                  │
│ ○ Quản lý    │                                                       │
│   team       │                                                       │
│              │                                                       │
│ ○ Thông báo  │                                                       │
│              │                                                       │
│ ○ Tích hợp   │                                                       │
│              │                                                       │
│ ○ Bảo mật    │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

**5 sub-tab** với visibility theo role:

| Sub-tab | admin | digital | gdda |
|---|:-:|:-:|:-:|
| Thông tin tài khoản | ✅ | ✅ | ✅ |
| **Quản lý team** (= Phân quyền user) | ✅ full | — | — |
| Thông báo | ✅ | ✅ | ✅ |
| Tích hợp quảng cáo | ✅ | ✅ xem | — |
| Bảo mật | ✅ | ✅ | ✅ |

#### 5.4.1 Sub-tab "Thông tin tài khoản"

Form cá nhân (tự sửa info của mình):
- Avatar (đồng bộ từ Google OAuth, user có thể upload tùy chỉnh sau)
- Họ và tên
- Email (read-only, đổi email = tạo user mới)
- Số điện thoại
- Vai trò (read-only, chỉ admin ở sub-tab khác đổi được)
- Nút [Huỷ] [Lưu thay đổi]

#### 5.4.2 Sub-tab "Quản lý team" (chỉ admin)

**Đây là phần Phân quyền user** — gộp vào Settings theo cấu trúc frontend mẫu.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Quản lý team                                    [+ Thêm thành viên] │
│                                                                      │
│ [Tất cả] [Admin] [Digital] [GDDA]         [🔍 Tìm user...]          │
├──────────────────────────────────────────────────────────────────────┤
│ Họ tên          │Email              │Role    │Dự án được gán │Actions│
├──────────────────────────────────────────────────────────────────────┤
│ Nguyễn Văn A    │a@company.com      │Digital │5 dự án         │[...] │
│ Trần Thị B      │b@company.com      │GDDA    │2 dự án         │[...] │
│ Phạm Quản Trị   │admin@company.com  │Admin   │—               │[...] │
└──────────────────────────────────────────────────────────────────────┘
```

**Action menu mỗi row**:
- Sửa thông tin (name, role)
- Gán dự án → mở dialog `AssignProjectDialog`
- Vô hiệu hoá (soft delete — `active=false`, user login next request bị kick)

**Dialog `AssignProjectDialog`**:
```
┌───────────────────────────────────────────────────┐
│ Gán dự án cho Nguyễn Văn A                  [×]  │
├───────────────────────────────────────────────────┤
│ Tìm dự án: [🔍                              ]    │
│                                                   │
│ ☑ Vinhomes Grand Park   [☑ View] [☑ Edit] [GDDA ▾]│
│ ☑ Masteri Waterfront    [☑ View] [☐ Edit] [Digi ▾]│
│ ☐ Eco Green Saigon      [☐ View] [☐ Edit] [  ▾]  │
│ ...                                               │
│                                                   │
│                       [Huỷ]  [Lưu thay đổi]      │
└───────────────────────────────────────────────────┘
```
- Mỗi dự án có 2 checkbox riêng: `can_view`, `can_edit`
- Dropdown `role_in_project`: digital hoặc gdda
- Save → `assignUserToProject` action, bulk upsert

**Form "Thêm thành viên mới"** (admin tạo user trước, user mới login qua Google sau):
- Họ tên
- Email (validate phải thuộc `ALLOWED_EMAIL_DOMAIN`, không cho email ngoài domain)
- Role: admin / digital / gdda
- (Không có password — auth qua Google OAuth)

#### 5.4.3 Sub-tab "Thông báo" (Phase 1 skeleton)

Placeholder — Phase 1 chưa có hệ thống notification. Hiển thị dashed card "Coming soon".

Phase 2+ sẽ có: notification khi upload CSV done/fail, match conflict cần review, lead mới realtime.

#### 5.4.4 Sub-tab "Tích hợp quảng cáo"

UI theo frontend mẫu — list các platform với trạng thái Kết nối / Ngắt kết nối:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Tích hợp quảng cáo                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ [f] Facebook Ads            Đã kết nối           [Ngắt kết nối]     │
│ [G] Google Ads              Chưa kết nối         [Kết nối]          │
│ [T] TikTok Ads              Chưa kết nối         [Kết nối]          │
│ [Z] Zalo Ads                Chưa kết nối         [Kết nối]          │
│ [Y] YouTube Ads             Chưa kết nối         [Kết nối]          │
└──────────────────────────────────────────────────────────────────────┘
```

**Phase 1**: chỉ UI placeholder, nút "Kết nối" disable với tooltip "Khả dụng ở Phase 2 — đang chờ Meta App Review".

**Phase 2**: click Kết nối → OAuth flow:
- Facebook → Meta OAuth → lấy Page Access Token + Ads Account
- Google → Google Ads OAuth → lấy refresh token
- TikTok, Zalo, YouTube tương tự

Token lưu mã hoá trong bảng `ad_integrations` (sẽ add schema Phase 2).

#### 5.4.5 Sub-tab "Bảo mật"

- Active sessions list (Auth.js session table) với nút "Revoke" từng session
- Login history (last 10 lần login, lấy từ `users.lastLoginAt` + mở rộng thêm `login_history` nếu cần audit chi tiết)
- Phase 2+: 2FA optional qua TOTP

---

### 5.5 Modal/Trang Đăng dự án mới

**Trigger**: nút `+ Tạo mới` ở topbar → dropdown → "Dự án mới".
**Route**: `/projects/new` (full page form, không phải modal — vì form dài). Admin + digital có quyền vào.

**Form fields**:
```
Tên dự án *              [_______________________]
Vị trí *                 [_______________________]
Ngân sách (VND) *        [_______________________]

Fanpages gán *           [Multi-select: FB Vinhomes, FB Sun Group ...]
Facebook Ad Account *    [_______________________] (ví dụ: act_1234567890)
Google Ads Account       [_______________________] (optional)

Digital phụ trách *      [Multi-select user role=digital]
  Với mỗi user: [☑ View] [☑ Edit]

GDDA phụ trách           [Multi-select user role=gdda]
  Với mỗi user: auto View only
  
Trạng thái ban đầu       [● Đang chạy  ○ Tạm dừng]

                              [Huỷ]  [Tạo dự án]
```

**Submit**:
- `createProject` Server Action (Zod validate)
- Insert `projects` → lấy id
- Bulk insert `project_fanpages`, `project_ad_accounts`
- Bulk insert `project_users` (creator auto `can_edit`, các user khác theo checkbox)
- Redirect về `/projects/[slug]`

**Không** có upload file creative (theo clarify). Không có start/end date.

---

## 6. Data schema (Drizzle)

### 6.1 Auth (chuẩn Auth.js adapter)
```typescript
users: {
  id: uuid pk
  name: text
  email: text unique              // PHẢI thuộc domain công ty
  emailVerified: timestamp
  image: text                     // lấy từ Google profile picture
  role: enum('admin', 'digital', 'gdda')
  active: boolean default true    // admin có thể vô hiệu hoá
  lastLoginAt: timestamptz nullable
  createdAt, updatedAt
}
// Note: user được admin tạo trước (pre-provisioned). OAuth callback từ chối
// nếu email không có trong bảng này.

accounts, sessions, verificationTokens  // chuẩn Auth.js
```

### 6.2 Project domain
```typescript
projects: {
  id: uuid pk
  name: text
  slug: text unique          // dùng cho URL
  location: text
  budget: numeric
  fbAdAccountId: text        // ví dụ "act_1234567890"
  googleAdsId: text nullable
  status: enum('running', 'warning', 'paused')
  createdBy: uuid → users.id
  createdAt, updatedAt
}
// index: (status), (slug)

project_users: {              // ← BẢNG RBAC LÕI
  id: uuid
  projectId: uuid → projects.id
  userId: uuid → users.id
  canView: boolean
  canEdit: boolean
  roleInProject: enum('digital', 'gdda')
  createdAt
}
// unique (projectId, userId)
// index (userId) — query "dự án của tôi"

project_fanpages: {
  projectId, fanpageId
}
// unique (projectId, fanpageId)

project_ad_accounts: {
  id, projectId, adAccountExternalId, platform: enum('facebook','google')
}

fanpages: {
  id, name, externalId unique nullable, createdAt
}

sources: {
  id, name unique               // Facebook, Google, Zalo, TikTok, ...
}
```

### 6.3 Lead domain
```typescript
leads: {                        // current state, 1 row/lead
  id: uuid pk
  projectId: uuid → projects.id
  fanpageId: uuid → fanpages.id nullable
  sourceId: uuid → sources.id nullable
  fullName: text
  fullNameNormalized: text      // NFD fold + bỏ dấu, lowercase
  phone: text nullable
  phoneNormalized: text nullable // bỏ ký tự, +84 → 0
  email: text nullable
  fbLeadId: text unique nullable // để sẵn cho Phase 2
  formName: text
  formAnswers: jsonb             // custom fields động
  currentStageId: uuid → stages.id nullable
  currentEmployeeId: uuid → employees.id nullable
  campaignId, adsetId, adId: uuid nullable
  fbCreatedAt: timestamptz
  bitrixUpdatedAt: timestamptz nullable
  lastComment: text nullable
  needsReview: boolean default false
  reviewReason: text nullable
  createdAt, updatedAt
}
// index: (projectId, fbCreatedAt desc)     ← Report Data pagination
// index: (projectId, currentStageId)
// index: (fullNameNormalized, phoneNormalized)  ← matcher
// partial index: (needsReview) WHERE needsReview=true
// GIN (formAnswers) — nếu cần search dynamic

lead_snapshots: {               // daily full snapshot, rolling 90 ngày
  id: uuid
  snapshotDate: date
  leadId: uuid → leads.id
  projectId, stageId, employeeId, fanpageId
  raw: jsonb                     // full snapshot để query history
}
// unique (snapshotDate, leadId)
// index (snapshotDate, projectId)

lead_stage_events: {            // delta khi stage đổi
  id, leadId, fromStageId, toStageId, employeeId, changedAt
  source: enum('csv_facebook', 'csv_bitrix', 'manual', 'webhook')
}
// index (leadId, changedAt), (projectId, changedAt)

stages: {                       // 16 stage chuẩn hoá
  id
  code: text unique              // F1, DANG_CHAM, KHONG_BAT_MAY, THUE_BAO_KLL,
                                 // CHAO_DA_KHAC, MOI_GIOI, DA_MUA, BOOKING, DEAL,
                                 // SPAM, NEW, MKT_CU, KHONG_SDT, SALE_PHONE,
                                 // DATA_THO, FLASH
  labelVi: text
  category: enum('new', 'nurturing', 'converted', 'dead')
  color: text                    // hex để UI hiển thị badge
  displayOrder: int
}

stage_aliases: {                // MAPPING RUNTIME Bitrix → stage
  id
  raw: text unique              // "F1 (QT dự án cụ thể)", "Đang Chăm (2h)", ...
  stageId: uuid → stages.id nullable  // null = pending, admin map
  createdAt
}

employees: {                    // từ Bitrix Responsible
  id
  fullName: text
  fullNameNormalized: text unique
  bitrixTeam: text nullable     // lưu nhưng không dùng (Juno/Neptune/Aura/Virgo)
  active: boolean
}
```

### 6.4 Ads (denormalized từ CSV Facebook)
```typescript
campaigns: {
  id, projectId, externalId nullable, name
  statusLabel: enum('on', 'off')  // LABEL, không phải toggle thật
  createdAt
}
// unique (projectId, name)

adsets: {
  id, campaignId, name
}
// unique (campaignId, name)

ads: {
  id, adsetId, projectId, name, formName nullable
  thumbnailUrl: text nullable   // Phase 2 fill từ Marketing API
}
// unique (adsetId, name)
```

### 6.5 Audit & Ops
```typescript
csv_uploads: {
  id, uploadedBy, projectId, type: enum('facebook','bitrix')
  filename, rowCount, parsedCount, errorCount
  status: enum('pending','processing','done','failed')
  errorLog: jsonb
  createdAt, finishedAt
}

match_conflicts: {
  id, csvUploadId, leadId nullable
  candidates: jsonb              // list các lead trùng
  reason: text
  resolved: boolean
  resolvedBy, resolvedAt
}

daily_aggregates: {              // pre-computed cho report
  id, snapshotDate, projectId
  stageId, employeeId, fanpageId, campaignId
  leadCount: int
  computedAt
}
// unique composite (snapshotDate, projectId, stageId, employeeId, fanpageId, campaignId)
// index (projectId, snapshotDate)

monthly_aggregates: {            // archive sau 90 ngày
  yearMonth: date, projectId, stageId, employeeId, leadCount
}

project_costs: {
  id, projectId
  periodDate: date
  amount: numeric
  source: enum('manual', 'fb_api')  // Phase 1 manual, Phase 2 fb_api
}
```

---

## 7. File tree

```
dashboard-v2/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # sidebar + topbar RBAC
│   │   ├── page.tsx                        # Dashboard Overview (landing, RBAC-aware redirect cho GDDA → /report)
│   │   ├── _components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   ├── GlobalSearch.tsx
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── CreateNewDropdown.tsx        # nút "+ Tạo mới" dropdown
│   │   │   └── dashboard/
│   │   │       ├── OverviewStatCards.tsx
│   │   │       └── ProjectSummaryTable.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx                    # list card
│   │   │   ├── [slug]/
│   │   │   │   ├── page.tsx                # detail 4 section
│   │   │   │   ├── edit/page.tsx
│   │   │   │   └── _components/
│   │   │   │       ├── ProjectStatCards.tsx
│   │   │   │       ├── CampaignSection.tsx
│   │   │   │       ├── CampaignStatsBar.tsx
│   │   │   │       ├── CampaignTable.tsx
│   │   │   │       ├── AdsetDrillDown.tsx
│   │   │   │       ├── AdCreativeSection.tsx
│   │   │   │       ├── AdCreativeStatsBar.tsx
│   │   │   │       ├── TopAdHighlight.tsx
│   │   │   │       ├── AdCreativeTable.tsx
│   │   │   │       └── UploadCsvSection.tsx
│   │   │   ├── new/page.tsx                # Đăng dự án mới (form full page)
│   │   │   └── _components/
│   │   │       ├── ProjectListFilters.tsx
│   │   │       ├── ProjectCard.tsx
│   │   │       └── ProjectForm.tsx
│   │   ├── report/
│   │   │   ├── page.tsx                    # split theo role
│   │   │   └── _components/
│   │   │       ├── ReportFilters.tsx
│   │   │       ├── ReportStatCards.tsx
│   │   │       ├── LeadDetailTable.tsx         # admin/digital view
│   │   │       ├── LeadDetailDialog.tsx
│   │   │       ├── GddaReportTabs.tsx          # wrapper 4 sub-tabs cho GDDA
│   │   │       ├── SummaryByDateTab.tsx
│   │   │       ├── ByEmployeeTab.tsx
│   │   │       └── ByFanpageTab.tsx
│   │   └── settings/
│   │       ├── page.tsx                    # tab Settings với 5 sub-tab
│   │       ├── account/page.tsx            # Thông tin tài khoản
│   │       ├── team/page.tsx               # Quản lý team (admin only, = Phân quyền)
│   │       ├── notifications/page.tsx      # Thông báo (skeleton)
│   │       ├── integrations/page.tsx       # Tích hợp quảng cáo (Phase 1 placeholder)
│   │       ├── security/page.tsx           # Bảo mật
│   │       └── _components/
│   │           ├── SettingsSidebar.tsx
│   │           ├── AccountForm.tsx
│   │           ├── UserTable.tsx           # dùng trong team/
│   │           ├── UserForm.tsx
│   │           ├── AssignProjectDialog.tsx
│   │           ├── IntegrationCard.tsx
│   │           └── ActiveSessionsList.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── upload/csv/route.ts
│       ├── uploads/[id]/route.ts           # poll status
│       ├── inngest/route.ts
│       └── sse/leads/route.ts              # Phase 2 stub
│
├── db/
│   ├── index.ts                            # Drizzle client (Neon)
│   ├── schema/
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   ├── leads.ts
│   │   ├── ads.ts
│   │   ├── ops.ts
│   │   └── index.ts                        # re-export
│   ├── seed.ts                             # seed stages, sources
│   └── migrations/
│
├── lib/
│   ├── auth/
│   │   ├── config.ts                       # Auth.js config
│   │   ├── session.ts                      # getSessionUser helper
│   │   └── guards.ts                       # assertRole, assertCanViewProject,
│   │                                       # assertCanEditProject, getAccessibleProjectIds
│   ├── csv/
│   │   ├── parser-facebook.ts
│   │   ├── parser-bitrix.ts
│   │   ├── normalizer.ts                   # unicode fold, phone normalize
│   │   ├── stage-mapper.ts
│   │   ├── matcher.ts
│   │   └── upsert-service.ts
│   ├── adapters/
│   │   └── lead-source.ts                  # interface cho Phase 2
│   ├── aggregates/
│   │   ├── builder.ts                      # rebuild daily_aggregates
│   │   └── archiver.ts                     # > 90 ngày → monthly
│   ├── queries/
│   │   ├── projects.ts                     # getProjectsForUser, getProjectBySlug
│   │   ├── leads.ts
│   │   ├── campaigns.ts
│   │   ├── ads-creative.ts
│   │   ├── report.ts                       # getSummaryByDate, getByEmployee, getByFanpage
│   │   └── users.ts
│   ├── actions/
│   │   ├── projects.ts                     # createProject, updateProject
│   │   ├── users.ts                        # createUser, assignUserToProject
│   │   ├── uploads.ts                      # initiate upload
│   │   ├── conflicts.ts                    # resolveMatchConflict
│   │   └── stages.ts                       # upsertStageAlias
│   ├── validation/
│   │   └── schemas.ts                      # Zod schemas dùng chung
│   ├── realtime/
│   │   └── notify.ts                       # Phase 2 stub pg_notify
│   └── utils/
│       ├── format.ts                       # formatNumberVN, formatCurrency, formatDate
│       └── unicode.ts                      # NFD fold
│
├── inngest/
│   ├── client.ts
│   └── functions/
│       ├── process-csv-upload.ts
│       ├── rebuild-aggregates.ts
│       ├── nightly-snapshot.ts
│       ├── nightly-archive.ts
│       └── phase2-webhook-stub.ts          # no-op
│
├── components/
│   └── ui/                                 # shadcn primitives
│       ├── button.tsx, card.tsx, table.tsx, dialog.tsx, ...
│
├── docs/
│   ├── master-plan.md                      # ← file này
│   ├── phase-2.md                          # checklist Meta App Review + Bitrix
│   └── stage-catalog.md                    # bảng 16 stage chuẩn + alias mẫu
│
├── drizzle.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 8. Luồng nghiệp vụ chi tiết

### 8.1 Upload CSV (luồng chính)

**Bước 1 — FE**: User mở trang `/projects/[slug]`, thấy nút "📤 Upload CSV" (chỉ hiện nếu `can_edit`). Click → dialog chọn file + loại (Facebook / Bitrix).

**Bước 2 — Submit**:
```
POST /api/upload/csv
Content-Type: multipart/form-data
Body: { file, projectId, type }
```

**Bước 3 — Server validate**:
1. `assertCanEditProject(userId, projectId)` — fail → 403
2. File size ≤ 4MB (Vercel limit) — nếu lớn hơn → upload qua presigned Vercel Blob rồi chỉ gửi URL
3. MIME type phải là `text/csv`
4. Đọc 5 dòng đầu, check header signature:
   - FB: phải có `Created Time, Full Name, Campaign, Ad, Form Name, Lead ID`
   - Bitrix: phải có `Lead, Stage, Responsible` (tuỳ format CSV bạn chuyển từ ảnh — sẽ confirm khi có file mẫu)
   - Sai → reject 400 "File không đúng loại"
5. Insert `csv_uploads` row (status=pending, uploadedBy, filename, type)
6. Gửi Inngest event:
   ```typescript
   inngest.send({
     name: 'csv/uploaded',
     data: { uploadId, projectId, type, fileContent: base64 }
   })
   ```
7. Trả về `{ uploadId, status: 'pending' }`

**Bước 4 — Inngest function xử lý** (`process-csv-upload.ts`):

```typescript
inngest.createFunction(
  { id: 'process-csv-upload', retries: 3 },
  { event: 'csv/uploaded' },
  async ({ event, step }) => {
    const { uploadId, projectId, type, fileContent } = event.data;

    await step.run('mark-processing', async () => {
      await db.update(csvUploads).set({ status: 'processing' }).where(...);
    });

    const rows = await step.run('parse', async () => {
      // papaparse stream từ fileContent
      return parseCSV(type, fileContent);
    });

    const normalized = await step.run('normalize', async () => {
      return rows.map(row => {
        if (type === 'facebook') return normalizeFacebookRow(row);
        return normalizeBitrixRow(row);
      });
    });

    const stageMap = await step.run('map-stages', async () => {
      // chỉ cho Bitrix: lookup stage_aliases
      if (type !== 'bitrix') return normalized;
      return Promise.all(normalized.map(async r => {
        const stage = await lookupStage(r.rawStage);
        if (!stage) await flagPendingAlias(r.rawStage, uploadId);
        return { ...r, stageId: stage?.id };
      }));
    });

    const matched = await step.run('match', async () => {
      return matchLeadsByName(stageMap, projectId, uploadId);
      // trả về { toUpsert, conflicts }
    });

    await step.run('upsert', async () => {
      // TRANSACTION:
      await db.transaction(async tx => {
        for (const lead of matched.toUpsert) {
          const prev = await tx.select().from(leads).where(...);
          await tx.insert(leads).values(lead).onConflictDoUpdate(...);
          if (prev && prev.currentStageId !== lead.stageId) {
            await tx.insert(leadStageEvents).values({
              leadId: lead.id,
              fromStageId: prev.currentStageId,
              toStageId: lead.stageId,
              source: `csv_${type}`,
              changedAt: now()
            });
          }
          // snapshot hôm nay
          await tx.insert(leadSnapshots).values({
            snapshotDate: today(),
            leadId: lead.id,
            ...
          }).onConflictDoUpdate({ target: [snapshotDate, leadId], set: {...} });
        }
      });
    });

    await step.run('finish', async () => {
      await db.update(csvUploads).set({
        status: 'done',
        parsedCount: matched.toUpsert.length,
        errorCount: matched.conflicts.length,
        finishedAt: now()
      });
    });

    await step.sendEvent('trigger-aggregate', {
      name: 'aggregate/rebuild',
      data: { projectId, dates: [today()] }
    });
  }
);
```

**Bước 5 — FE poll**: dialog hiển thị progress bar, poll `GET /api/uploads/:id` mỗi 2s cho đến `status=done|failed`. Done → refresh data, đóng dialog. Failed → hiện error_log.

### 8.2 Matching name + phone

**Input**: 1 row CSV (VD Bitrix: `{name: "Nguyễn Văn An", phone: "0912345678"}`)

**Algorithm**:
```
1. normalize name → "nguyen van an"
2. normalize phone → "0912345678"
3. Query:
   SELECT * FROM leads
   WHERE project_id = $projectId
     AND full_name_normalized = 'nguyen van an'
4. Nếu 0 kết quả:
   - Nếu row đến từ CSV Bitrix → lead này có ở Bitrix mà không có ở FB?
     → Insert lead mới với source='bitrix_only' + flag "không tìm thấy trong FB"
5. Nếu 1 kết quả → MATCH, upsert
6. Nếu > 1 kết quả:
   - Filter thêm theo phone_normalized
   - Còn đúng 1 → MATCH
   - Còn > 1 → ghi match_conflicts với candidates, KHÔNG auto-merge
   - Còn 0 (phone không khớp ai) → ghi match_conflicts
```

**Dialog resolve conflict** (admin/digital click vào badge "Có xung đột"):
```
┌───────────────────────────────────────────────────┐
│ Xung đột matching — file "bitrix_06042026.csv"   │
├───────────────────────────────────────────────────┤
│ Dòng Bitrix: "Nguyễn Văn A - F1 - Lã Thị Ngà"    │
│                                                   │
│ Khớp với các lead:                                │
│ ○ Nguyễn Văn A - 0912... - created 05/04/2026    │
│ ○ Nguyễn Văn A - 0987... - created 06/04/2026    │
│ ○ Tạo lead mới                                   │
│ ○ Bỏ qua dòng này                                │
│                                                   │
│                       [Huỷ]  [Xác nhận]          │
└───────────────────────────────────────────────────┘
```

### 8.3 Daily snapshot (chạy mỗi đêm)

Inngest cron `0 17 * * *` UTC (= 0h VN):

```typescript
inngest.createFunction(
  { id: 'nightly-snapshot' },
  { cron: '0 17 * * *' },
  async ({ step }) => {
    const yesterday = subDays(today(), 1);
    await step.run('snapshot', async () => {
      await db.execute(sql`
        INSERT INTO lead_snapshots (snapshot_date, lead_id, project_id, stage_id, employee_id, fanpage_id, raw)
        SELECT ${yesterday}, id, project_id, current_stage_id, current_employee_id, fanpage_id, to_jsonb(leads.*)
        FROM leads
        WHERE updated_at >= ${yesterday}
        ON CONFLICT (snapshot_date, lead_id) DO UPDATE SET raw = EXCLUDED.raw;
      `);
    });
  }
);
```

### 8.4 Archive > 90 ngày

```typescript
inngest.createFunction(
  { id: 'nightly-archive' },
  { cron: '30 17 * * *' },
  async ({ step }) => {
    const cutoff = subDays(today(), 90);
    await step.run('rollup-monthly', async () => {
      await db.execute(sql`
        INSERT INTO monthly_aggregates (year_month, project_id, stage_id, employee_id, lead_count)
        SELECT date_trunc('month', snapshot_date)::date, project_id, stage_id, employee_id, COUNT(*)
        FROM lead_snapshots
        WHERE snapshot_date < ${cutoff}
        GROUP BY 1,2,3,4
        ON CONFLICT ... DO UPDATE ...;
      `);
    });
    await step.run('delete-old-snapshots', async () => {
      await db.delete(leadSnapshots).where(lt(leadSnapshots.snapshotDate, cutoff));
    });
  }
);
```

---

## 9. API & Server Actions

### Route Handlers

| Method | Path | Role | Input | Output |
|---|---|---|---|---|
| POST | `/api/upload/csv` | admin, digital+can_edit | multipart `{file, projectId, type}` | `{uploadId, status}` |
| GET | `/api/uploads/:id` | uploader hoặc admin | — | `{status, parsedCount, errorCount, errorLog}` |
| POST | `/api/inngest` | internal | (Inngest signature) | — |
| GET | `/api/sse/leads` | authenticated | — | SSE stream (Phase 2 stub) |
| GET/POST | `/api/auth/[...nextauth]` | — | Auth.js | — |

### Server Actions

```typescript
// projects.ts
createProject(input: CreateProjectInput): Promise<{ slug: string }>
  // Role: admin hoặc digital
  
updateProject(id: string, patch: UpdateProjectInput): Promise<void>
  // Role: admin hoặc digital+can_edit

setProjectStatus(id: string, status: 'running'|'warning'|'paused'): Promise<void>
  // Role: admin hoặc digital+can_edit

setProjectCost(projectId: string, periodDate: Date, amount: number): Promise<void>
  // Role: admin hoặc digital+can_edit

// users.ts
createUser(input: { name, email, role }): Promise<{ id }>
  // Role: admin only

updateUser(id: string, patch): Promise<void>
  // Role: admin only

assignUserToProject(input: {
  userId, projectId, canView, canEdit, roleInProject
}): Promise<void>
  // Role: admin only

// uploads.ts — thực ra route handler, không phải action (vì dùng multipart)

// conflicts.ts
resolveMatchConflict(
  conflictId: string,
  action: 'merge-with' | 'create-new' | 'discard',
  targetLeadId?: string
): Promise<void>
  // Role: admin hoặc digital+can_edit

// stages.ts
upsertStageAlias(raw: string, stageId: string): Promise<void>
  // Role: admin only
```

### Query functions (không phải action, dùng trong RSC)

```typescript
// queries/projects.ts
getProjectsForUser(params: {
  userId, dateFrom, dateTo, status?, search?
}): Promise<ProjectCardData[]>

getProjectBySlug(slug: string, userId: string): Promise<ProjectDetail | null>
  // throws nếu không có can_view

// queries/campaigns.ts
getCampaignStats(projectId, dateRange): Promise<CampaignRow[]>
getCampaignDetail(projectId, campaignName, dateRange): Promise<AdsetRow[]>

// queries/ads-creative.ts
getAdCreativeStats(projectId, dateRange, sort): Promise<AdRow[]>

// queries/report.ts
getReportStatCards(filters): Promise<StatCards>
getSummaryByDate(filters): Promise<SummaryRow[]>
getByEmployee(filters): Promise<EmployeeRow[]>
getByFanpage(filters): Promise<FanpageRow[]>
getLeadDetail(filters, pagination): Promise<{rows, total}>

// queries/users.ts
listUsers(filters): Promise<UserRow[]>
getUserProjects(userId): Promise<UserProjectAssignment[]>
```

---

## 10. Task breakdown theo phase

> **STATUS (cập nhật 09/04/2026)** — xem `docs/HANDOFF.md` để biết chi tiết
>
> - ✅ Phase 0 Setup
> - ✅ Phase 1 Schema + Auth + RBAC
> - ✅ Phase 2 CSV pipeline (53 unit tests + integration test pass)
> - ✅ Phase 3 UI 8 routes (Login + Dashboard + Projects list/detail/new + Report split + Settings)
> - ✅ Phase 4 CRUD bonus (Upload CSV + User mgmt + AssignProject + Conflicts + DEV SwitchUserWidget)
> - ⏸ Phase 5 Edit project — TODO
> - ⏸ Phase 6 Snapshot/Aggregate cron — TODO
> - ⏸ Phase 7 Polish — TODO
> - ⏸ Phase 8 Phase 2 webhook hook — TODO

### Phase 0 — Setup (nền tảng) ✅
- [ ] `pnpm create next-app dashboard-v2 --typescript --tailwind --app`
- [ ] Init shadcn/ui, add primitives: button, card, table, dialog, form, input, select, tabs, badge, dropdown-menu, date-range-picker, sonner
- [ ] Link Vercel project, tạo Neon DB qua Vercel Marketplace
- [ ] `pnpm add drizzle-orm @neondatabase/serverless`, `pnpm add -D drizzle-kit`
- [ ] Config `drizzle.config.ts`, tạo `db/index.ts`
- [ ] `pnpm add next-auth@beta @auth/drizzle-adapter`
- [ ] Google Cloud Console: tạo OAuth Client ID (Web application), lấy `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- [ ] Cấu hình redirect URI: `http://localhost:3000/api/auth/callback/google` (dev) + prod URL
- [ ] `pnpm add inngest`, mount `/api/inngest/route.ts`
- [ ] `pnpm add papaparse zod react-hook-form @hookform/resolvers`
- [ ] `.env.local`: `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL_DOMAIN`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

**Acceptance**: `pnpm dev` chạy trang blank, ping `/api/inngest` OK, query Neon OK.

### Phase 1 — Schema + Auth + RBAC
- [ ] Viết toàn bộ Drizzle schema (Section 6)
- [ ] `pnpm drizzle-kit generate`, chạy migration
- [ ] Seed `stages` (16 stage), seed `stage_aliases` sample, seed `sources` (Facebook, Google, Zalo, TikTok), seed 1 admin user với email công ty thật (để login lần đầu)
- [ ] Cấu hình Auth.js: **Google OAuth provider duy nhất** + Drizzle adapter
- [ ] Implement signIn callback: check domain + check user đã provision
- [ ] Implement jwt/session callback: attach role + userId vào session
- [ ] Trang `/login` với nút "Đăng nhập với Google" + error handling (domain/not-provisioned)
- [ ] `lib/auth/guards.ts`:
  - [ ] `getSessionUser()`
  - [ ] `assertRole(user, roles[])`
  - [ ] `getAccessibleProjectIds(userId)` (join project_users)
  - [ ] `assertCanViewProject(userId, projectId)`
  - [ ] `assertCanEditProject(userId, projectId)`
- [ ] Layout `(dashboard)/layout.tsx` với sidebar render menu theo role
- [ ] Middleware redirect `/` → `/projects` (digital/admin) hoặc `/report` (gdda)

**Acceptance**:
- Login bằng Google Workspace OK với email `@company.com` đã provision
- Reject với email ngoài domain
- Reject với email chưa được admin tạo trong DB
- 3 user mẫu (admin/digital/gdda) login thấy menu khác nhau
- Digital không query được project của người khác (test bypass RBAC)

### Phase 2 — CSV pipeline
- [ ] `lib/utils/unicode.ts`: `foldUnicode(str)` NFD + bỏ dấu
- [ ] `lib/csv/normalizer.ts`: `normalizeName`, `normalizePhone`
- [ ] `lib/csv/parser-facebook.ts`: stream papaparse, validate header signature, map cột → DTO, custom fields → `formAnswers` JSON
- [ ] `lib/csv/parser-bitrix.ts`: tương tự cho Bitrix
- [ ] `lib/csv/stage-mapper.ts`: cache stage_aliases in-memory, lookup, insert pending nếu chưa có
- [ ] `lib/csv/matcher.ts`: name → phone fallback → conflict (Section 8.2)
- [ ] `lib/csv/upsert-service.ts`: transaction logic (Section 8.1 bước 4)
- [ ] `inngest/functions/process-csv-upload.ts`
- [ ] `inngest/functions/rebuild-aggregates.ts`
- [ ] Route `/api/upload/csv/route.ts` + `/api/uploads/[id]/route.ts`
- [ ] Component `CsvUploader` (dialog + progress polling)
- [ ] Component `ConflictResolverDialog`
- [ ] Trang `/projects/[slug]/uploads` hiển thị history + status

**Acceptance**: Upload 2 CSV sample của user (`_THẤP TẦNG SUN HÀ NAM.csv` + 1 file Bitrix sample). Kiểm tra: DB có lead đúng, stage map đúng, conflict flag đúng, snapshot tạo.

### Phase 3 — Layout chung + Dashboard Overview + Quản lý dự án + Đăng dự án mới

**3a. Layout chung**
- [ ] `app/(dashboard)/layout.tsx` với `Sidebar` + `Topbar`
- [ ] `Sidebar.tsx` render menu theo role (admin/digital thấy 4 item, gdda chỉ Report + Settings)
- [ ] `Topbar.tsx`: global search, date range picker (URL state), `CreateNewDropdown`, notification bell stub, user avatar
- [ ] `CreateNewDropdown.tsx`: dropdown với options "Dự án mới" / "Lead thủ công"
- [ ] Middleware redirect root `/` theo role

**3b. Dashboard Overview**
- [ ] `app/(dashboard)/page.tsx` (Server Component)
- [ ] Query `getOverviewStats(userId, dateRange)` → 5 stat numbers
- [ ] Query `getProjectSummaryTable(userId, dateRange)` → list project với metrics
- [ ] `OverviewStatCards.tsx` (5 cards)
- [ ] `ProjectSummaryTable.tsx` với row click → `/projects/[slug]`

**3c. Quản lý dự án list + detail**
- [ ] Query `getProjectsForUser` — join `daily_aggregates`
- [ ] `/projects/page.tsx` — list card + filter bar + search
- [ ] `ProjectCard.tsx`
- [ ] `/projects/[slug]/page.tsx` — 4 section:
  - [ ] `ProjectStatCards.tsx` (4 cards: Ngân sách, Tổng Lead, CPL, F1 Rate)
  - [ ] `CampaignSection.tsx` + sub-components
  - [ ] `AdCreativeSection.tsx` + sub-components
  - [ ] `UploadCsvSection.tsx` (chỉ hiện nếu can_edit)
- [ ] Query `getCampaignStats`, `getAdCreativeStats`
- [ ] Cột CTR/CPL/Chi tiêu/Hiển thị render "—" với tooltip "Khả dụng Phase 2"

**3d. Đăng dự án mới + Edit**
- [ ] `/projects/new/page.tsx` form (react-hook-form + Zod + `createProject` action)
- [ ] `/projects/[slug]/edit/page.tsx` reuse form
- [ ] Action `setProjectCost` (nhập chi phí tháng thủ công)

**Acceptance**:
- Dashboard hiển thị số liệu đúng theo scope user
- Tạo dự án mới từ dropdown topbar → hiển thị ngay trong list + dashboard
- Click card → mở detail 4 section đúng
- Upload CSV → số liệu Campaign/Mẫu QC cập nhật

### Phase 4 — Report Data (split theo role)
- [ ] Query `getReportStatCards`, `getLeadDetail`, `getSummaryByDate`, `getByEmployee`, `getByFanpage`
- [ ] `ReportFilters.tsx` (client, URL state)
- [ ] `ReportStatCards.tsx`
- [ ] **Admin/Digital view**: `LeadDetailTable.tsx` — 1 bảng đầy đủ cột (Created Time, Name, Email, Tình trạng, Dự án, Fanpage, Campaign, Adset, Ad, Form Name, Lead ID, Nguồn), server-side pagination
- [ ] `LeadDetailDialog.tsx` — click row hiện full lead + form_answers
- [ ] **GDDA view**: `GddaReportTabs.tsx` wrapper shadcn Tabs với 4 sub-tab:
  - [ ] `SummaryByDateTab.tsx` — bảng theo ngày (Tổng/F1/Đang chăm/Không bắt máy/Thuê bao/Chào DA khác/Môi giới/Khác/F1 Rate)
  - [ ] `ByEmployeeTab.tsx`
  - [ ] `ByFanpageTab.tsx`
  - [ ] `LeadDetailTable.tsx` (reuse)
- [ ] Logic detect role ở `/report/page.tsx`: render view khác nhau
- [ ] GDDA filter auto-lock dự án được gán, thêm filter nhân viên

**Acceptance**:
- Admin/digital thấy 1 bảng chi tiết, filter combo đúng
- GDDA thấy 4 sub-tab format Excel, số khớp với bảng báo cáo Excel mẫu
- 50k row pagination OK
- RBAC test: digital không query được lead của dự án không có can_view

### Phase 5 — Trang Settings (bao gồm Quản lý team)
- [ ] `app/(dashboard)/settings/layout.tsx` với `SettingsSidebar` (5 sub-tab)
- [ ] `SettingsSidebar.tsx` hide sub-tab theo role (digital/gdda không thấy "Quản lý team")
- [ ] **Sub-tab "Thông tin tài khoản"**: `AccountForm.tsx` (sửa name, phone)
- [ ] **Sub-tab "Quản lý team"** (admin only):
  - [ ] `/settings/team/page.tsx`
  - [ ] `UserTable.tsx` + filter role + search
  - [ ] `UserForm.tsx` dialog — email validate domain công ty, role dropdown, không password
  - [ ] `AssignProjectDialog.tsx` — bulk set can_view/can_edit/role_in_project
  - [ ] Actions `createUser`, `updateUser`, `deactivateUser`, `assignUserToProject`
- [ ] **Sub-tab "Thông báo"**: placeholder "Coming soon"
- [ ] **Sub-tab "Tích hợp quảng cáo"**:
  - [ ] `IntegrationCard.tsx` cho FB/Google/TikTok/Zalo/YouTube
  - [ ] Nút Kết nối disable + tooltip "Khả dụng Phase 2"
- [ ] **Sub-tab "Bảo mật"**:
  - [ ] `ActiveSessionsList.tsx` — list sessions Auth.js + revoke button
  - [ ] Login history (last 10 từ `lastLoginAt`)

**Acceptance**:
- Admin gán user vào dự án → user đó login thấy đúng scope
- Digital/gdda vào Settings không thấy sub-tab "Quản lý team"
- Deactivate user → session bị kick next request

### Phase 6 — Aggregate + Snapshot + Archive
- [ ] `lib/aggregates/builder.ts`: rebuild daily_aggregates theo (project, date) list
- [ ] Inngest function `rebuild-aggregates` lắng nghe event `aggregate/rebuild`
- [ ] Inngest cron `nightly-snapshot` (Section 8.3)
- [ ] Inngest cron `nightly-archive` (Section 8.4)
- [ ] Admin page "Database health": hiển thị quota Neon, row count, archive status

**Acceptance**: Cron chạy đủ. Sau 95 ngày snapshot cũ được archive. Neon quota < 80%.

### Phase 7 — Polish
- [ ] `loading.tsx` skeleton cho mọi route
- [ ] `error.tsx` error boundary
- [ ] Empty state cho từng tab (component `EmptyState`)
- [ ] Toast (sonner) cho mọi action
- [ ] i18n tiếng Việt toàn bộ label
- [ ] Format số VN (`1,247`, `850M`, `682K`), format ngày (`04/04/2026`)
- [ ] Mobile responsive (ít nhất Report Data xem được trên tablet)
- [ ] Accessibility: keyboard nav, aria-label, focus visible

**Acceptance**: Lighthouse > 90. Không console error. Pass manual QA checklist.

### Phase 8 — Hook Phase 2 (stub, không enable)
- [ ] Define interface `LeadSource` trong `lib/adapters/lead-source.ts` (nếu Phase 2 chưa dùng, vẫn viết)
- [ ] `app/api/sse/leads/route.ts` — stub trả 501 hoặc SSE rỗng
- [ ] `lib/realtime/notify.ts` — helper `publishLeadChange()` stub
- [ ] Inngest function `phase2-webhook-stub.ts` — no-op
- [ ] Viết `docs/phase-2.md`:
  - Checklist Meta App Review (permissions cần: `leads_retrieval`, `ads_read`, `pages_manage_metadata`)
  - Setup Bitrix custom field `UF_FB_LEAD_ID`
  - Vercel upgrade plan
  - Inngest paid plan khi cần

---

## 11. Rủi ro & Mitigation

| # | Rủi ro | Tác động | Mitigation |
|---|---|---|---|
| 1 | CSV Facebook đổi schema form fields (thêm/bớt câu hỏi) | Parser crash, data mất | `form_answers JSONB` — không cố định cột. Parser map theo tên header, log header lạ. |
| 2 | Trùng tên lead nhiều (~2000 lead/ngày dễ có trùng) | Merge sai stage | Phone fallback → conflict flag → manual resolve, không auto-merge |
| 3 | Bitrix thêm/đổi tên stage mới | Stage không nhận ra | `stage_aliases` runtime, admin map qua UI, không cần deploy |
| 4 | Neon Free hết quota (0.5GB) | App down | Rolling 90 ngày + archive monthly + monitor `pg_total_relation_size` weekly |
| 5 | Vercel Free timeout 10s cho route handler | Upload lớn fail | Upload file chỉ enqueue Inngest, parse trong Inngest function (timeout 5 phút) |
| 6 | Upload > 4.5MB | Route handler reject | Dùng Vercel Blob presigned URL cho file lớn |
| 7 | RBAC bypass (user đổi projectId trong request) | Data leak | Server **không bao giờ** tin `projectId` từ FE — luôn intersect với `getAccessibleProjectIds()` |
| 8 | Snapshot job chạy trùng | Data duplicate | Inngest step idempotency key `snapshot-${date}` + unique constraint DB |
| 9 | Meta App Review fail (Phase 2) | Không có realtime | CSV pipeline là fallback vĩnh viễn. Adapter cho phép 2 nguồn chạy song song |
| 10 | Bitrix thiếu Facebook Lead ID | Match by name rủi ro cao | Phase 1: accept rủi ro. Phase 2: prerequisite setup custom field `UF_FB_LEAD_ID` trước khi bật webhook |
| 11 | Timezone lệch (FB UTC vs Bitrix VN) | Lead "lạc ngày" | Chuẩn hoá `Asia/Ho_Chi_Minh` lúc parse, lưu `timestamptz` |
| 12 | User upload nhầm loại file | Data sai nguồn | Detect header signature, reject với thông báo rõ "File không phải định dạng [Facebook/Bitrix]" |
| 13 | CSV có row bị BOM, encoding UTF-16 | Parse lỗi ký tự Việt | papaparse có option `encoding`, detect BOM, fallback thử UTF-16 |
| 14 | User xoá dự án có 100k lead | Query timeout | Soft delete (`projects.deleted_at`) + background cleanup |
| 15 | Nhiều user upload CSV cùng lúc cho cùng 1 dự án | Race condition upsert | Inngest concurrency key theo `projectId`, process tuần tự |
| 16 | User nghỉ việc vẫn còn session Google active | Data leak | Admin `active=false` → signIn callback check → kick session ngay lần request tiếp theo. Không dựa Google revoke (admin công ty revoke Google account là bước song song) |
| 17 | Google OAuth client secret leak | Ai cũng login được | Secret chỉ trong Vercel env, không commit. Rotate secret 6 tháng/lần |
| 18 | Phishing domain giả `company-login.com` | User nhập tài khoản Google vào site giả | Google OAuth redirect URI whitelist chỉ domain thật → phishing không callback được. Hướng dẫn user chỉ login qua bookmark chính thức |

---

## 12. Hook để sẵn cho Phase 2 (webhook realtime)

Plan Phase 1 đã "để sẵn cửa" cho Phase 2 nhằm **không phải rewrite**:

### Code-level
- ✅ **Interface `LeadSource`** trong `lib/adapters/lead-source.ts` — CSV parser + future webhook đều implement cùng interface
- ✅ **Column `fb_lead_id`** có sẵn trong `leads` từ Phase 1. Phase 2 matcher ưu tiên key này trước khi fallback name
- ✅ **Inngest event `lead/ingested`** (phát ra từ CSV hoặc webhook đều được). Downstream (aggregate, notify) không cần sửa
- ✅ **`lib/realtime/notify.ts`** stub — Phase 2 chỉ cần enable `pg_notify('leads_changed', payload)` sau mỗi upsert
- ✅ **`app/api/sse/leads/route.ts`** stub — Phase 2 implement `LISTEN leads_changed`, stream SSE
- ✅ **`campaigns.status_label`** giữ là label tĩnh → Phase 2 nâng thành toggle thật qua Marketing API không phải đổi schema
- ✅ **`project_costs.source`** enum có sẵn `'fb_api'` cho Insights API fetch
- ✅ **`leads.campaign_id/adset_id/ad_id`** nullable → Phase 2 Webhook sẽ fill đầy đủ (CSV Phase 1 có thể thiếu)

### Operation-level (cần làm trước khi enable Phase 2)
- [ ] Meta Business verification
- [ ] Meta App Review: xin permissions `leads_retrieval`, `ads_read`, `pages_manage_metadata`
- [ ] Bitrix24: tạo custom field `UF_FB_LEAD_ID` cho CRM Lead entity
- [ ] Bitrix24: tạo outbound webhook gọi `/api/webhooks/bitrix`
- [ ] Meta: setup Lead Ads webhook subscription vào `/api/webhooks/facebook`
- [ ] Vercel: upgrade Pro nếu vượt function invocation limit
- [ ] Inngest: upgrade Paid nếu vượt 50k step/tháng
- [ ] Neon: upgrade Pro ($19/tháng, 10GB) nếu DB > 400MB

Tất cả lưu trong `docs/phase-2.md`.

---

## Kết

Plan này đủ chi tiết để bắt tay vào code Phase 0 ngay. Mỗi phase có acceptance criteria rõ ràng, có thể verify từng bước. Tab Quản lý dự án — phần phức tạp nhất — đã mô tả đầy đủ 3 view, 2 section con (Campaign & Mẫu QC), data mapping, component tree.

**Khi muốn sửa plan**: chỉnh trực tiếp file này, đó là source of truth duy nhất.
