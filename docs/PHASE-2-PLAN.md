# Phase 2 — Dashboard Lead BĐS Smartland

> **Tài liệu duy nhất** cho Phase 2. Cập nhật checkbox khi hoàn thành.
> Timeline: 6 tuần (13/04/2026 → 25/05/2026)
> GitHub: https://github.com/buncadareal1/dashboard-v2
> Production: https://dashboard-v2-one-vert.vercel.app
> VPS: 103.116.52.54:3001 (Hono API + BullMQ)

---

## Kiến trúc

```
Vercel (Next.js 16 + Neon DB)     ← Frontend + Auth + DB queries
VPS (Hono API + BullMQ + Redis)   ← Background jobs: FB sync, leads pull, cron
Khi có domain → chuyển tất cả sang VPS
```

## Quyết định đã thống nhất

| Câu hỏi | Quyết định |
|---|---|
| Kiến trúc | Vercel + Neon (bây giờ), VPS-only khi có domain |
| Meta Login | Có — submit App Review |
| Ai login Meta | Digital (quản lý ad account) + Admin |
| Data đổ vào project nào | Digital chọn project khi kết nối |
| CSV upload | Giữ cả 3 (Facebook, Bitrix, Cost) — không bỏ gì |
| FB insights sync | Daily incremental (time_range + time_increment=1) |
| Timeline | 6 tuần, 2 ngày dev/tuần |

## Trạng thái hiện tại (đã DONE)

- ✅ Hono API 12 routes + BullMQ + PM2 trên VPS
- ✅ FB API: campaign sync, insights sync, lead pull (script thủ công)
- ✅ Campaign Analysis page: Excel layout, auto-rating, inline edit, date filter, project selector
- ✅ Per-project FB credentials trong DB (fbAppId, fbAppSecret, fbAccessToken)
- ✅ Auto-register pending users (Google login → pending → admin duyệt)
- ✅ Role toggle dropdown trong Settings
- ✅ Hướng dẫn sử dụng page + CSV templates
- ✅ Timezone Asia/Ho_Chi_Minh
- ✅ 220 API tests, dual-mode queries
- ✅ Data: 2,928 leads, 251 campaigns, 195 insight rows
- ✅ Project selector cards cho Report Data + Campaign Analysis

---

## Tuần 1: FB Sync + Monitoring (13-19/04)

### 1.1 Daily incremental FB insights [Dev] — 1 ngày

**Vấn đề**: Sync dùng `date_preset=maximum` → 1 row lifetime. Cần daily data cho charts.

**Files sửa:**
- `apps/api/src/services/fb/client.ts`
  - [ ] Thêm `getCampaignInsightsRange(campaignId, since, until)` — dùng `time_range` + `time_increment=1`
- `apps/api/src/services/fb/sync-insights.ts`
  - [ ] Thêm `syncCampaignInsightsIncremental(client, adAccountId, since, until)`
  - [ ] Mỗi call trả về 1 row/ngày thay vì 1 row lifetime
- `apps/api/src/jobs/scheduler.ts`
  - [ ] Đổi FB sync: daily lúc 06:00 VN, sync 7 ngày gần nhất (backfill)
- `apps/api/src/jobs/sync-fb-insights.ts`
  - [ ] Worker gọi incremental sync thay vì lifetime

**Verify**: `SELECT date, COUNT(*) FROM campaign_insights GROUP BY date ORDER BY date DESC LIMIT 10;` → nhiều ngày khác nhau

### 1.2 Auto-pull leads mỗi 15 phút [Dev] — 0.5 ngày

**Vấn đề**: Pull leads bằng script thủ công. Cần tự động.

**Files mới:**
- `apps/api/src/services/fb/sync-leads.ts`
  - [ ] `syncLeadsFromAds(client, adAccountId, projectId, sinceMinutes=15)`
  - [ ] Reuse logic từ `scripts/pull-fb-leads.ts` — normalize tên/SĐT VN, upsert by fbLeadId

**Files sửa:**
- `apps/api/src/jobs/scheduler.ts`
  - [ ] Thêm job `fb-pull-leads`: pattern `*/15 * * * *`

**Verify**: Leads mới từ FB tự xuất hiện trong Report Data không cần chạy script

### 1.3 Token expiry monitor [Dev] — 0.5 ngày

**Files mới:**
- `app/(dashboard)/_components/TokenExpiryAlert.tsx` — banner cảnh báo admin khi token < 7 ngày

**Files sửa:**
- `apps/api/src/services/fb/client.ts` — thêm `debugToken(token)`
- `apps/api/src/routes/campaigns.ts` — thêm `GET /api/fb/token-status`
- `apps/api/src/jobs/scheduler.ts` — daily job check token 07:00 VN
- `app/(dashboard)/layout.tsx` — mount `<TokenExpiryAlert />` cho admin

**Verify**: Dashboard hiện banner vàng/đỏ khi token sắp hết

### 1.4 Submit FB App Review [Admin]

- [ ] Business Verification: upload giấy phép kinh doanh Smartland
- [ ] Privacy Policy page (Task 2.3)
- [ ] Request permissions: `ads_read`, `leads_retrieval`, `pages_read_engagement`, `pages_manage_ads`
- [ ] Video demo cách app sử dụng permissions
- [ ] Submit review

**Verify**: App status = "In Review" trên developers.facebook.com

---

## Tuần 2: Export + Charts (20-26/04)

### 2.1 Export Campaign Analysis ra Excel [Dev] — 1 ngày

**Files mới:**
- `lib/actions/export-campaign.ts` — server action tạo .xlsx bằng `exceljs`
- `app/(dashboard)/report/campaigns/_components/ExportButton.tsx` — nút "Xuất Excel"

**Files sửa:**
- `app/(dashboard)/report/campaigns/page.tsx` — thêm ExportButton vào header
- `package.json` — thêm `exceljs`

**Format Excel:**
- Sheet "Phân tích Campaign" — tất cả cột từ CampaignAnalysisRow
- Header bold, freeze row đầu
- Currency VND, percent CTR, conditional color cho HQ rating

**Verify**: Click "Xuất Excel" → file .xlsx download, mở bằng Excel/Google Sheets OK

### 2.2 Dashboard charts [Dev] — 1.5 ngày

**Cần**: Daily insights data từ Task 1.1

**Files mới:**
- `lib/queries/db/dashboard-charts.ts`
  - `getSpendTrendData(projectId, days=30)` — SUM spend theo ngày
  - `getLeadFunnelData(projectId)` — COUNT leads theo stage
- `lib/queries/dashboard-charts.ts` — dual-mode wrapper
- `app/(dashboard)/_components/SpendTrendChart.tsx` — line chart (recharts)
- `app/(dashboard)/_components/LeadFunnelChart.tsx` — bar chart ngang

**Files sửa:**
- `app/(dashboard)/page.tsx` — thêm charts section (sau stat cards)
- `package.json` — thêm `recharts`

**Verify**: Dashboard → chọn project → thấy 2 charts với data thật

### 2.3 Privacy Policy page [Admin] — 0.5 ngày

**Files mới:**
- `app/(public)/privacy/page.tsx` — trang public không cần auth
- `app/(public)/layout.tsx` — layout đơn giản

**Verify**: `/privacy` truy cập được không cần đăng nhập

---

## Tuần 3: Meta Login — OAuth Flow (27/04-03/05)

**Điều kiện**: FB App Review đã APPROVED (hoặc test trong Development mode)

### 3.1 Meta Login backend [Dev] — 1 ngày

**Flow:**
```
Digital click "Kết nối Facebook"
  → Redirect: facebook.com/dialog/oauth?scope=ads_read,leads_retrieval,...
  → User login FB + chấp nhận permissions
  → FB redirect callback URL với ?code=xxx
  → Server exchange code → short-lived token
  → Exchange → long-lived token (60 ngày)
  → Lưu token vào projects.fbAccessToken
```

**Files mới:**
- `apps/api/src/routes/fb-oauth.ts`
  - `GET /api/fb/oauth/start?projectId=xxx` — build FB OAuth URL, redirect
  - `GET /api/fb/oauth/callback` — exchange code → token → save to project
  - `GET /api/fb/oauth/accounts` — list ad accounts user có quyền (sau login)
  - `POST /api/fb/oauth/connect` — gán ad account đã chọn vào project
  - `POST /api/fb/oauth/disconnect` — xóa token khỏi project

**Files sửa:**
- `apps/api/src/index.ts` — mount `app.route("/api/fb/oauth", fbOauthRoutes)`
- `packages/db/schema/projects.ts` — thêm cột `fbTokenExpiresAt` (timestamp)

**Verify**: Test OAuth flow end-to-end trong Development mode

### 3.2 Meta Login frontend [Dev] — 1 ngày

**Flow UI:**
```
Project Detail → section "Facebook"
  → Chưa kết nối: nút "Kết nối Facebook" (xanh)
  → Click → redirect FB → login → callback
  → Hiện danh sách Ad Accounts → digital chọn 1
  → Gán ad account vào project
  → Hiện: "Đã kết nối: act_xxxxx · Hết hạn: 12/06/2026"
```

**Files mới:**
- `app/(dashboard)/projects/[slug]/_components/FacebookConnectSection.tsx`
  - Trạng thái: "Chưa kết nối" / "Đã kết nối" / "Token sắp hết"
  - Button: "Kết nối Facebook" / "Đổi tài khoản" / "Ngắt kết nối"
  - Dropdown: chọn Ad Account từ danh sách
- `app/(dashboard)/projects/[slug]/_components/AdAccountSelector.tsx`
  - List ad accounts sau khi OAuth thành công
  - Mỗi account hiện: tên, ID, currency

**Files sửa:**
- `app/(dashboard)/projects/[slug]/page.tsx` — thêm `<FacebookConnectSection />`

**Verify**: Digital vào project → click "Kết nối Facebook" → login → chọn ad account → data sync tự động

---

## Tuần 4: Multi-project + CI/CD (04-10/05)

### 4.1 Per-project token sync [Dev] — 0.5 ngày

**Vấn đề**: Sync worker dùng `process.env.FB_SYSTEM_USER_TOKEN` global. Cần per-project.

**Files sửa:**
- `apps/api/src/jobs/sync-fb-insights.ts`
  - [ ] Đổi: query `projects.fbAccessToken` cho từng project
  - [ ] Fallback: dùng env nếu project không có token
- `apps/api/src/jobs/scheduler.ts`
  - [ ] Loop tất cả projects có `fbAdAccountId` + `fbAccessToken`
  - [ ] Schedule sync riêng cho mỗi project

**Verify**: 2 projects dùng 2 FB accounts khác nhau, sync đúng data

### 4.2 CI/CD GitHub Actions [Dev] — 0.5 ngày

**Files mới:**
- `.github/workflows/ci.yml`
  ```yaml
  on: [push, pull_request]
  jobs:
    test:
      steps: checkout → setup-node 22 → npm ci → tsc --noEmit → npm test
  ```
- `.github/workflows/deploy-vps.yml`
  ```yaml
  on: push main (paths: apps/api/**)
  jobs:
    deploy: SSH → git pull → npm ci → npm run build → pm2 restart
  ```

**GitHub Secrets [Admin]:**
- [ ] `VPS_SSH_KEY` — SSH private key cho VPS
- [ ] `VPS_USER` — root
- [ ] `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

**Verify**: Push commit → GitHub Actions tab chạy xanh → VPS tự update

### 4.3 Vercel auto-deploy [Dev] — đã có

Vercel Git integration đã hoạt động — push main → auto deploy. Chỉ cần verify.

---

## Tuần 5: Mobile + Export PDF (11-17/05)

### 5.1 Mobile responsive [Dev] — 1.5 ngày

**Files sửa:**
- `app/(dashboard)/_components/Sidebar.tsx`
  - [ ] Mobile: ẩn sidebar, hamburger menu icon
  - [ ] Slide-in overlay trên mobile
- `app/(dashboard)/_components/Topbar.tsx`
  - [ ] Thêm hamburger button (`md:hidden`)
- `app/(dashboard)/report/campaigns/_components/CampaignAnalysisTable.tsx`
  - [ ] `overflow-x-auto` wrapper
  - [ ] Ẩn cột phụ trên mobile: `hidden md:table-cell`
- `app/(dashboard)/projects/page.tsx`
  - [ ] Grid: `grid-cols-1 sm:grid-cols-2`

**Verify**: Chrome DevTools → iPhone 14 viewport → tất cả trang OK

### 5.2 Export PDF [Dev] — 0.5 ngày

**Files mới:**
- `lib/actions/export-campaign-pdf.ts` — server action tạo PDF
  - Layout: landscape A4, logo Smartland, bảng data, tổng cộng

**Files sửa:**
- `app/(dashboard)/report/campaigns/_components/ExportButton.tsx`
  - Thêm dropdown: "Xuất Excel" / "Xuất PDF"
- `package.json` — thêm `jspdf` + `jspdf-autotable`

**Verify**: Click "Xuất PDF" → file download, mở OK

---

## Tuần 6: Polish + Infrastructure (18-25/05)

### 6.1 SSE realtime notifications [Dev] — 0.5 ngày

**Files mới:**
- `apps/api/src/routes/sse.ts` — SSE endpoint `/api/sse/notifications`
- `app/(dashboard)/_components/NotificationBell.tsx` — bell icon + dropdown

**Files sửa:**
- `apps/api/src/services/fb/process-webhook-lead.ts` — emit event khi có lead mới
- `app/(dashboard)/_components/Topbar.tsx` — thêm `<NotificationBell />`

**Verify**: Lead mới từ FB → toast notification < 5s

### 6.2 Dark mode [Dev] — 0.5 ngày

**Files sửa:**
- `app/layout.tsx` — ThemeProvider (next-themes đã có)
- `app/(dashboard)/_components/Topbar.tsx` — toggle Sun/Moon
- Components: thêm `dark:` variants

**Verify**: Toggle dark/light, tất cả trang đọc được

### 6.3 Sentry error monitoring [Dev] — 0.5 ngày

- [ ] `npm install @sentry/nextjs` + wizard setup
- [ ] `apps/api/src/index.ts` — Sentry.init() + captureException trong onError
- [ ] Env: `SENTRY_DSN` trên Vercel + VPS

**Verify**: Trigger lỗi → event trên Sentry dashboard

### 6.4 DB backup + VPS monitoring [Dev] — 0.5 ngày

**Files mới:**
- `scripts/backup-db.sh` — pg_dump + gzip + auto-delete 30 ngày
- `scripts/health-check.sh` — check API + Redis + disk

**Cron trên VPS:**
```
0 3 * * *    /opt/dashboard-v2/scripts/backup-db.sh
*/5 * * * *  /opt/dashboard-v2/scripts/health-check.sh
```

**Verify**: Backup file tạo mỗi sáng. Health check chạy mỗi 5 phút.

---

## Tổng hợp theo vai trò

### [Admin] cần làm:
- [ ] Tuần 1: Business Verification trên Meta Business Suite
- [ ] Tuần 2: Tạo Privacy Policy page (nội dung bảo mật)
- [ ] Tuần 1-2: Submit FB App Review
- [ ] Tuần 4: Thêm GitHub Secrets (VPS_SSH_KEY, VERCEL_TOKEN)
- [ ] Tuần 6: Tạo Sentry project + UptimeRobot

### [Dev] cần làm:
- [ ] Tuần 1: Daily sync + auto-pull leads + token monitor
- [ ] Tuần 2: Export Excel + charts
- [ ] Tuần 3: Meta Login OAuth (backend + frontend)
- [ ] Tuần 4: Per-project sync + CI/CD
- [ ] Tuần 5: Mobile responsive + Export PDF
- [ ] Tuần 6: SSE notifications + dark mode + Sentry + backup

---

## Dependencies

```
App Review submit (tuần 1) → chờ Meta → OAuth flow (tuần 3)
Daily insights (tuần 1) → Charts (tuần 2)
Auto-pull leads (tuần 1) → SSE notifications (tuần 6)
OAuth flow (tuần 3) → Per-project sync (tuần 4)
```

## Risks

| Risk | Xác suất | Impact | Giải pháp |
|------|----------|--------|-----------|
| FB App Review reject/chậm | Trung bình | Block OAuth flow | Test Development mode trước. Giữ token thủ công làm fallback |
| Token 60 ngày hết hạn | Thấp | Sync ngừng | Task 1.3: monitor + alert 7 ngày trước |
| FB rate limit 200 calls/hr | Thấp | Data chậm | Daily sync thay vì 30 phút. Concurrency=1 |
| VPS 4GB RAM không đủ | Thấp | OOM crash | PM2 max_memory_restart. Postgres shared_buffers 512MB |

## Tiêu chí hoàn thành Phase 2

- [ ] Digital login Meta → chọn Ad Account → data tự sync
- [ ] Leads từ FB Lead Forms tự xuất hiện mỗi 15 phút
- [ ] Campaign insights có data theo ngày (30 ngày history)
- [ ] Export Excel/PDF hoạt động
- [ ] Dashboard có charts (spend trend + lead funnel)
- [ ] Mobile responsive trên iPhone
- [ ] Dark mode toggle
- [ ] CI/CD: push → auto test + deploy
- [ ] Sentry bắt errors
- [ ] DB backup tự động
- [ ] Token monitor cảnh báo trước 7 ngày
