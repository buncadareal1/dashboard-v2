# HANDOFF — Dashboard Lead BĐS

> **Ngày**: 2026-04-09
> **Mục đích**: tài liệu để session Claude Code mới có thể tiếp tục dự án mà không hiểu nhầm context.

---

## ⚡ Prompt khởi động cho session mới (copy-paste)

```
Đây là dự án Next.js 16 dashboard quản lý lead bất động sản, đồng bộ
từ Facebook Ads + Bitrix24 cho công ty Smartland.

Đọc trước khi làm bất kỳ việc gì:
1. docs/HANDOFF.md — context tổng + những gì đã làm + bước tiếp
2. docs/dashboard-v2-plan.md — master plan đầy đủ (~1700 dòng)
3. AGENTS.md + CLAUDE.md ở root — quy tắc dự án

Trạng thái hiện tại: Phase 0-4 đã code xong và verify trên DB thật.
Dev server có thể start bằng `npm run dev` (Inngest fallback inline khi
không có INNGEST_EVENT_KEY). Login Google OAuth dùng email
webdev@smartland.vn (admin role).

Tôi muốn tiếp tục: <ĐIỀN MỤC TIÊU CỤ THỂ — VD: "Phase 7 polish",
"Phase 6 cron jobs", "fix bug X", "deploy lên Vercel preview">.

Trước khi code: kiểm tra git log, đọc HANDOFF.md mục "Bước tiếp theo
được khuyến nghị", confirm với tôi plan trước khi thực thi nếu task
phức tạp.
```

---

## 📊 Trạng thái Phase

| Phase | Tên | Status | Verify method |
|---|---|---|---|
| **0** | Setup (Next.js 16 + Drizzle + Auth.js + Inngest + shadcn) | ✅ DONE | `npx tsc --noEmit` zero error |
| **1** | Schema (16 tables) + Auth Google OAuth + RBAC guards + seed (16 stages) | ✅ DONE | `npm run db:push` + `npm run db:seed` |
| **2** | CSV pipeline (parser FB/Bitrix + matcher + stage-mapper + upsert + Inngest fn) | ✅ DONE | `npm test` → 53/53 pass |
| **3** | UI 8 trang (Login + Layout + Dashboard + Projects list/detail/new + Report split admin/gdda + Settings 5 sub-tabs) | ✅ DONE | Browser test với webdev@smartland.vn |
| **4** | CRUD bonus (Upload CSV UI + UserFormDialog + AssignProjectDialog + Conflicts page + DEV SwitchUserWidget) | ✅ DONE | End-to-end browser test |
| **5** | Edit project (form chỉnh sửa metadata + reassign users) | ⏸ TODO | — |
| **6** | Inngest cron (snapshot nightly + archive > 90 ngày + auto rebuild aggregates) | ⏸ TODO | — |
| **7** | Polish (skeleton loading, empty states, error boundary, mobile responsive, i18n VN nhất quán) | ⏸ TODO | — |
| **8** | Phase 2 webhook hook (FB Lead Ads + Bitrix outbound webhook adapter stub) | ⏸ TODO | — |

> **Lưu ý mapping**: Phase trong code/commit khác Phase trong `dashboard-v2-plan.md`.
> Trong plan gốc: Phase 4 = Report Data, Phase 5 = Settings.
> Trong code thực tế: Phase 3 đã merge cả Report Data + Settings vào → Phase 4 thành "CRUD bonus".

---

## 🏗 Stack đã chọn (KHÔNG đổi)

- **Framework**: Next.js 16.2.3 App Router (proxy.ts không phải middleware.ts — không dùng cho auth)
- **React**: 19.2.4
- **Tailwind**: v4 (postcss config)
- **shadcn**: style `base-nova` với base-ui (KHÔNG phải Radix). Quan trọng: components dùng `render` prop, KHÔNG có `asChild`.
- **DB**: Neon Postgres (pooled URL trong `.env.local`, đã setup qua Vercel Marketplace)
- **ORM**: Drizzle 0.45 + drizzle-kit
- **Auth**: NextAuth v5 (next-auth@beta) + @auth/drizzle-adapter
  - Google OAuth provider production
  - Credentials provider "dev-switch" CHỈ enabled khi `NODE_ENV !== 'production'`
- **Background**: Inngest v4 — graceful fallback inline khi `INNGEST_EVENT_KEY` không set
- **CSV**: papaparse
- **Validation**: Zod v4
- **Testing**: vitest 4
- **State client**: native React useState/useTransition (không có Zustand/Redux)

---

## 📁 Cấu trúc thư mục thực tế

```
dashboard-v2/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                              # auth check + sidebar + topbar
│   │   ├── page.tsx                                # Dashboard Overview (admin/digital)
│   │   ├── _components/{Sidebar,Topbar,SwitchUserWidget}.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx                            # list card
│   │   │   ├── new/page.tsx                        # đăng dự án mới
│   │   │   ├── [slug]/page.tsx                     # detail 4 sections
│   │   │   ├── [slug]/_components/{ProjectStatCards,CampaignSection,AdCreativeSection,UploadCsvSection}.tsx
│   │   │   └── _components/{ProjectCard,ProjectListFilters,ProjectForm}.tsx
│   │   ├── report/
│   │   │   ├── page.tsx                            # split admin vs gdda
│   │   │   └── _components/{LeadDetailTable,GddaReportTabs}.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx                            # 5 sub-tabs
│   │   │   └── _components/{UserFormDialog,UserActionsMenu,AssignProjectDialog}.tsx
│   │   └── conflicts/
│   │       ├── page.tsx
│   │       └── _components/ConflictResolveButton.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── upload/csv/route.ts                     # POST multipart, fallback inline
│       ├── uploads/[id]/route.ts                   # GET poll status
│       └── inngest/route.ts                        # serve()
├── db/
│   ├── index.ts                                    # Neon HTTP + Drizzle client
│   ├── seed.ts                                     # 16 stages + sources + admin
│   ├── schema/
│   │   ├── auth.ts                                 # users, accounts, sessions, verificationTokens
│   │   ├── stages.ts                               # stages, stage_aliases, employees
│   │   ├── projects.ts                             # projects, project_users (RBAC), fanpages, sources, project_fanpages, project_ad_accounts
│   │   ├── ads.ts                                  # campaigns, adsets, ads
│   │   ├── leads.ts                                # leads, lead_snapshots, lead_stage_events
│   │   ├── ops.ts                                  # csv_uploads, match_conflicts, daily_aggregates, monthly_aggregates, project_costs
│   │   └── index.ts
│   └── migrations/                                 # drizzle-kit generated
├── lib/
│   ├── auth/{config,session,guards}.ts             # NextAuth config + RBAC
│   ├── csv/{parser-facebook,parser-bitrix,normalizer,stage-mapper,matcher,upsert-service}.ts
│   ├── adapters/lead-source.ts                     # interface cho Phase 2
│   ├── aggregates/builder.ts                       # rebuildAllAggregatesForProject + rebuildDailyAggregate
│   ├── queries/{projects,project-detail,report,uploads,conflicts}.ts
│   ├── actions/{projects,users,conflicts,dev-switch}.ts
│   └── utils/{unicode,format}.ts
├── inngest/
│   ├── client.ts
│   └── functions/process-csv-upload.ts             # KHÔNG run nếu INNGEST_EVENT_KEY chưa set
├── components/ui/                                  # shadcn 19 primitives + form viết tay
├── test-fixtures/bitrix-sample.csv                 # 21 rows test
├── scripts/
│   ├── test-pipeline.ts                            # integration test với Neon
│   ├── seed-test-users.ts                          # tạo digital + gdda test users
│   ├── check-users.ts
│   └── cleanup-stuck-uploads.ts
├── docs/
│   ├── dashboard-v2-plan.md                        # master plan ~1700 dòng
│   └── HANDOFF.md                                  # file này
└── types/next-auth.d.ts                            # type augmentation
```

---

## 🔑 Env vars (đã có trong `.env.local`, KHÔNG commit)

```bash
DATABASE_URL=postgresql://...neon...        # Neon pooled
DATABASE_URL_UNPOOLED=postgresql://...      # Neon unpooled
AUTH_SECRET=...                             # 32 bytes random
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...                        # Google Cloud OAuth
GOOGLE_CLIENT_SECRET=...
ALLOWED_EMAIL_DOMAIN=smartland.vn,smartrealtors.vn,smartproperty.vn
INNGEST_EVENT_KEY=                          # CHƯA SET → upload fallback inline
INNGEST_SIGNING_KEY=
```

> ⚠️ **Quan trọng**: nếu env file thiếu, chạy `vercel env pull .env.local --yes` (project đã link với Vercel).

---

## 🗄 DB state hiện tại trên Neon

- `users`: 4 rows
  - `webdev@smartland.vn` — admin (login Google), real
  - `admin@company.com` — admin placeholder (không login được vì domain)
  - `digital.test@smartland.vn` — digital test (chỉ dev switch)
  - `gdda.test@smartland.vn` — gdda test (chỉ dev switch)
- `projects`: 1 row — `sun-ha-nam-thap-tang-test` (slug)
  - 750+ leads, 17 leads matched stage từ Bitrix
  - 113 daily_aggregates rows
  - 21 employees từ Bitrix Responsible
- `match_conflicts`: 1 unresolved (Nam Tran), 1 resolved (Hoàng Minh)
- `stage_aliases`: 19 alias seed + 1 pending ("Lead Pending Review")

---

## 🚀 Cách start

```bash
# 1. Pull env vars (nếu chưa có)
vercel env pull .env.local --yes

# 2. Install deps (nếu fresh clone)
npm install

# 3. Push schema (nếu DB rỗng)
npm run db:push

# 4. Seed (nếu chưa có data)
npm run db:seed
npx dotenv -e .env.local -- npx tsx scripts/seed-test-users.ts
npx dotenv -e .env.local -- npx tsx scripts/test-pipeline.ts  # tạo project test với data thật

# 5. Run unit tests
npm test  # 53/53 pass

# 6. Type-check
npx tsc --noEmit  # 0 errors

# 7. Dev server
npm run dev
# → http://localhost:3000/login
# → click Đăng nhập với Google → chọn webdev@smartland.vn (Chromium profile Smartland)
```

---

## 🐛 Issues đã biết và fix

1. **shadcn base-nova KHÔNG có `asChild`** — phải dùng `render={<Component />}`. Áp dụng cho DropdownMenuTrigger, DropdownMenuItem, DialogTrigger, etc. Form `Button asChild` cũng không work — dùng `<Link className={buttonVariants()}>` thay thế.

2. **`requireSession()` throw thay vì redirect** — KHÔNG dùng trong Server Component pages. Dùng `getSessionUser() + redirect()` pattern.

3. **Auth.js OAuthAccountNotLinked** — đã fix bằng `allowDangerousEmailAccountLinking: true` (an toàn vì admin pre-provision user).

4. **`app/page.tsx` ngoài route group** — page phải nằm trong `app/(dashboard)/page.tsx` để inherit layout.

5. **proxy.ts KHÔNG dùng cho auth** (CVE-2025-29927). Auth check ở `(dashboard)/layout.tsx` Server Component.

6. **Drizzle `inArray` thay vì raw SQL `ANY`** — neon-http driver không serialize JS array đúng.

7. **Inngest v4 createFunction signature đổi** — `triggers` nằm trong options object, không phải arg riêng.

8. **Inngest serialize step output → Date thành string** — phải `new Date(value)` revive sau `step.run`.

9. **`INNGEST_EVENT_KEY` chưa set** — `app/api/upload/csv/route.ts` có graceful fallback inline. Production nên set key thật.

10. **GDDA truy cập URL trực tiếp** — sidebar ẩn nhưng page vẫn render. Đã add page-level guard `if (role === 'gdda') redirect('/report')` ở `/`, `/projects`, `/projects/[slug]`.

11. **`cookies()`/`headers()` đã async trong Next.js 16** — luôn `await`.

12. **`searchParams` đã async trong Next.js 16** — luôn `const params = await searchParams`.

13. **tdd-guard plugin** đã disable (file `~/.claude/plugins/cache/tdd-guard/tdd-guard/1.2.0/hooks/hooks.json` có hooks rỗng `{}`). Nếu vẫn fire → restart Claude Code session.

---

## 🎯 Bước tiếp theo được khuyến nghị

### Option 1: Phase 7 — Polish (recommend đầu tiên)
- [ ] `loading.tsx` cho mọi route (skeleton)
- [ ] `error.tsx` error boundary
- [ ] Empty state component dùng chung
- [ ] Mobile responsive: ít nhất Report Data + Settings xem được trên tablet
- [ ] i18n VN nhất quán: format số `1.247`, currency `850M`/`1.2B`, ngày `09/04/2026`
- [ ] Sửa hydration mismatch trong Topbar (đã thấy warning về `data-slot` mismatch)
- [ ] Accessibility: aria-label, focus visible, keyboard nav
- [ ] Stage badge trong LeadDetailTable dùng inline style — chuyển sang Badge variants

### Option 2: Phase 6 — Inngest cron (production maintenance)
- [ ] Cài Inngest Cloud account, set 2 env vars
- [ ] `inngest/functions/nightly-snapshot.ts` — copy leads → lead_snapshots cho ngày hôm qua
- [ ] `inngest/functions/nightly-archive.ts` — rollup snapshot > 90 ngày → monthly_aggregates, xoá raw
- [ ] `inngest/functions/rebuild-aggregates.ts` — listen event `aggregate/rebuild`, chạy `rebuildAllAggregatesForProject`
- [ ] Register cron schedules `0 17 * * *` (= 0h VN)
- [ ] Switch upload route sang async mode (xoá fallback inline) khi Inngest sẵn sàng

### Option 3: Phase 5 — Edit project + chỉnh sửa user
- [ ] `/projects/[slug]/edit/page.tsx` — reuse ProjectForm với `defaultValues`
- [ ] `updateProjectAction` — admin hoặc digital can_edit
- [ ] `setProjectStatus` — đổi running/warning/paused
- [ ] `setProjectCost` — nhập chi phí tháng
- [ ] Form Account Settings có Save button (hiện chỉ static)

### Option 4: Phase 8 — Hook Phase 2 webhook
- [ ] Stub `app/api/webhooks/facebook/route.ts` + `bitrix/route.ts`
- [ ] Implement `LeadSource` adapter pattern cho webhook payload
- [ ] SSE handler `app/api/sse/leads/route.ts`
- [ ] `lib/realtime/notify.ts` với Neon `LISTEN/NOTIFY`
- [ ] Document `docs/phase-2.md` với Meta App Review checklist

### Option 5: Deploy Vercel preview
- [ ] `vercel` link → preview deploy
- [ ] Set Google OAuth redirect URI cho preview domain
- [ ] Set env vars trong Vercel dashboard
- [ ] Test login + flow end-to-end trên preview URL

### Option 6: Fix các issue nhỏ deferred
- [ ] ProjectCard `manager` luôn null — join `project_users` lấy primary digital
- [ ] Form đăng dự án mới chưa có multi-select user (digitalUserIds, gddaUserIds)
- [ ] Sub-menu Conflicts trong Sidebar cho admin (hiện phải gõ URL `/conflicts`)
- [ ] Dropdown sort + Google Ads tab trong AdCreativeSection
- [ ] Click row trong campaign table → drill down adsets

---

## ⚠️ Những điều cần tránh hiểu nhầm

1. **Plan gốc `dashboard-v2-plan.md` đánh số phase khác code thực tế.** Plan có Phase 4 = Report Data; code có Phase 4 = CRUD bonus. Đọc HANDOFF này để biết mapping. Master plan đã được mark status đầu Section 10.

2. **shadcn KHÔNG có `asChild` prop** — đây là base-nova style với base-ui primitives. Dùng `render={<X />}` cho DropdownMenuTrigger/Item, hoặc inline buttonVariants cho Link.

3. **proxy.ts KHÔNG dùng cho auth** — đã xoá file proxy.ts. Auth check ở layout Server Component.

4. **`requireSession()` throw error 500** — chỉ dùng trong actions/route handlers, KHÔNG trong page. Page dùng `getSessionUser() + redirect()`.

5. **Inngest đang ở chế độ FALLBACK INLINE** — `app/api/upload/csv/route.ts` xử lý sync nếu `INNGEST_EVENT_KEY` thiếu. Khi bạn set key thật, nó sẽ tự switch sang async.

6. **DEV SwitchUserWidget chỉ enabled khi `NODE_ENV !== 'production'`** — production deploy sẽ tự ẩn. KHÔNG remove tính năng này khi deploy.

7. **`admin@company.com` user trong DB là placeholder**, không login được vì domain không whitelist. Đừng nhầm với admin thật.

8. **CSV inline test có 1 dòng test-upload.csv tạo lead "Test Upload User"** — có thể dọn dẹp nếu thấy phiền.

9. **`SUN Hà Nam Thấp Tầng (TEST)` project là data test thật** — 750 leads từ FB CSV thật của user, KHÔNG xoá nếu không cần làm sạch.

10. **2 commits chính trên master**:
    - `feat: Phase 0-3 dashboard scaffold + auth + CSV pipeline + UI`
    - `feat: dev SwitchUserWidget + role-based page guards`
    - `feat: Phase 4 CRUD actions + dialogs`

---

## 🧪 Verify nhanh trước khi tiếp tục

```bash
cd /home/docdang/Work/dashboard-v2

# 1. Type-check
npx tsc --noEmit
# expected: zero output

# 2. Unit tests
npm test
# expected: 6 files, 53 tests passed

# 3. Check DB connection
npx dotenv -e .env.local -- npx tsx scripts/check-users.ts
# expected: 4 users listed, webdev@smartland.vn ✅

# 4. Dev server
npm run dev
# expected: ✓ Ready at http://localhost:3000
```

Nếu cả 4 đều OK → môi trường sạch, bắt đầu coding tiếp được.

---

## 📞 Liên hệ context

- User: docdang (webdev@smartland.vn)
- Domain công ty: smartland.vn, smartrealtors.vn, smartproperty.vn
- Dự án trên Vercel: dashboard-v2 (đã link)
- Neon project ID: plain-wave-05434708
