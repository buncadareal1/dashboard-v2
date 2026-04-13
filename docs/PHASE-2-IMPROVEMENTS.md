# Phase 2 — Kế hoạch cải tiến Dashboard Lead BĐS

> Tài liệu làm việc cho team. Cập nhật checkbox khi hoàn thành.
> GitHub: https://github.com/buncadareal1/dashboard-v2
> Vercel: https://dashboard-v2-one-vert.vercel.app
> VPS: 103.116.52.54 (2 core Xeon, 4GB RAM)

---

## Kiến trúc hiện tại

```
Vercel (Next.js + Neon DB direct)  ←  Frontend + Auth
VPS (Hono API + BullMQ + Redis)    ←  Background jobs only
Khi có domain → chuyển tất cả sang VPS (Option B)
```

---

## Tuần 1: FB Sync + CI/CD (3 ngày)

### 1.1 Daily incremental FB insights sync [Dev] — 1 ngày
- [ ] Thêm `getCampaignInsightsRange()` vào `apps/api/src/services/fb/client.ts`
- [ ] Thêm `syncCampaignInsightsIncremental()` vào `apps/api/src/services/fb/sync-insights.ts`
- [ ] Đổi scheduler sang daily cron 06:00 VN (`apps/api/src/jobs/scheduler.ts`)
- [ ] Verify: `SELECT date, COUNT(*) FROM campaign_insights GROUP BY date ORDER BY date DESC`

### 1.2 Auto-pull leads từ FB mỗi 15 phút [Dev] — 0.5 ngày
- [ ] Tạo `apps/api/src/services/fb/sync-leads.ts` — pull leads qua `/act_{id}/ads → /{ad_id}/leads`
- [ ] Thêm scheduler: `*/15 * * * *` cho lead pull
- [ ] Verify: leads mới tự xuất hiện không cần chạy script thủ công

### 1.3 CI/CD GitHub Actions [Dev] — 0.5 ngày
- [ ] Tạo `.github/workflows/ci.yml` — test + typecheck on PR
- [ ] Tạo `.github/workflows/deploy-vps.yml` — auto deploy VPS khi push main
- [ ] GitHub Secrets: VPS_SSH_KEY, VPS_USER, VERCEL_TOKEN [Admin]
- [ ] Verify: push commit → Actions tab chạy xanh

### 1.4 Token expiry monitor [Dev] — 0.5 ngày
- [ ] Thêm `debugToken()` vào FB client
- [ ] Thêm `GET /api/fb/token-status` endpoint
- [ ] Tạo `TokenExpiryAlert.tsx` — banner cảnh báo cho admin
- [ ] Verify: dashboard hiện banner khi token < 7 ngày

### 1.5 Submit FB App Review [Admin] — 0.5 ngày
- [ ] Business Verification (giấy phép kinh doanh Smartland)
- [ ] Request permissions: ads_read, leads_retrieval, pages_read_engagement, pages_manage_ads
- [ ] Privacy Policy URL
- [ ] Verify: App status = "In Review"

---

## Tuần 2: Export + Charts (3 ngày)

### 2.1 Export Campaign Analysis ra Excel [Dev] — 1 ngày
- [ ] Install `exceljs`, tạo `lib/actions/export-campaign.ts`
- [ ] Tạo `ExportButton.tsx` trong campaign analysis page
- [ ] Format: currency VND, percent, conditional color
- [ ] Verify: click "Xuất Excel" → file .xlsx download đúng

### 2.2 Dashboard charts [Dev] — 1.5 ngày
- [ ] Install `recharts`, tạo `lib/queries/db/dashboard-charts.ts`
- [ ] `SpendTrendChart.tsx` — line chart spend 30 ngày
- [ ] `LeadFunnelChart.tsx` — bar chart stages
- [ ] Thêm charts vào Dashboard Overview page
- [ ] Verify: charts hiện đúng data, responsive

### 2.3 Privacy Policy page [Admin] — 0.5 ngày
- [ ] Tạo `app/(public)/privacy/page.tsx` — không cần auth
- [ ] Nội dung: chính sách bảo mật theo yêu cầu FB
- [ ] Verify: `/privacy` truy cập được không cần login

---

## Tuần 3-4: Facebook OAuth (sau App Review duyệt)

### 3.1 OAuth backend [Dev] — 1 ngày
- [ ] Tạo `apps/api/src/routes/fb-oauth.ts` — start + callback endpoints
- [ ] Exchange short-lived → long-lived token
- [ ] Lưu token + expiry vào projects table
- [ ] Verify: OAuth flow end-to-end

### 3.2 OAuth frontend [Dev] — 0.5 ngày
- [ ] Tạo `FacebookConnectSection.tsx` trong project detail
- [ ] Hiện trạng thái: "Chưa kết nối" / "Đã kết nối (hết hạn ngày X)"
- [ ] Button "Kết nối Facebook" / "Ngắt kết nối"

### 3.3 Per-project token [Dev] — 0.5 ngày
- [ ] Sửa sync worker dùng `project.fbAccessToken` thay vì env global
- [ ] Fallback: dùng env nếu project không có token riêng

### 3.4 Multi-project sync [Dev] — 1 ngày
- [ ] Scheduler loop tất cả projects có `fbAdAccountId`
- [ ] Mỗi project sync độc lập với token riêng
- [ ] Verify: 2 projects sync song song đúng data

---

## Tuần 5-6: UX Improvements

### 5.1 Mobile responsive [Dev] — 1.5 ngày
- [ ] Sidebar: collapse trên mobile, hamburger menu
- [ ] Tables: horizontal scroll, ẩn cột phụ
- [ ] Cards: 1 column trên mobile
- [ ] Verify: Chrome DevTools iPhone 14 viewport

### 5.2 Export PDF [Dev] — 1 ngày
- [ ] Install `@react-pdf/renderer`
- [ ] Layout: landscape A4, logo Smartland, bảng data
- [ ] Verify: file PDF download, mở OK

### 5.3 SSE realtime notifications [Dev] — 1 ngày
- [ ] Tạo `apps/api/src/routes/sse.ts` — SSE endpoint
- [ ] Emit event khi có lead mới từ webhook/pull
- [ ] `NotificationBell.tsx` trên Topbar
- [ ] Verify: webhook → toast notification < 5s

---

## Tuần 7-8: Infrastructure + Polish

### 7.1 Dark mode [Dev] — 0.5 ngày
- [ ] ThemeProvider + toggle button (next-themes đã có)
- [ ] Verify: toggle dark/light, tất cả trang đọc được

### 7.2 Notification system [Dev] — 0.5 ngày
- [ ] Tạo `db/schema/notifications.ts`
- [ ] API: GET/PUT notifications
- [ ] Verify: notification bell hiện số chưa đọc

### 7.3 Sentry [Dev] — 0.5 ngày
- [ ] Setup @sentry/nextjs + Hono
- [ ] Verify: trigger lỗi → event trên Sentry dashboard

### 7.4 DB backup [Dev] — 0.5 ngày
- [ ] Script `backup-db.sh` + cron 3h sáng
- [ ] Giữ 30 ngày, tự xóa cũ

### 7.5 VPS monitoring [Admin] — 0.5 ngày
- [ ] Health check script mỗi 5 phút
- [ ] UptimeRobot cho API endpoint
- [ ] PM2 auto-restart on crash

---

## Dependencies

```
1.5 (App Review submit) → chờ Meta 1-3 tuần → 3.1-3.4 (OAuth flow)
1.1 (Daily insights) → 2.2 (Charts — cần historical data)
1.2 (Auto-pull leads) → 5.3 (SSE — emit khi có lead mới)
```

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| FB App Review reject | Block OAuth | Giữ token thủ công, chỉ admin refresh |
| Token expire không biết | Sync ngừng | Task 1.4: monitor + alert trước 7 ngày |
| FB rate limit | Data chậm | Daily sync thay vì 30 phút, concurrency=1 |
| VPS disk full | Service down | Backup auto-delete 30 ngày, disk alert |
