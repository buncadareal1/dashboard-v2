# Phase 2 — Facebook API Integration + Báo cáo Realtime

> Ngày lập: 10/04/2026
> Dựa trên: file `SunUC_Active_RealTime_Analysis_13.xlsx` + grill session
> Kiến trúc tương lai: Hono API trên VPS + Postgres local (sau Phase 2)

---

## 1. Mục tiêu

Chuyển dashboard từ **CSV upload thủ công** sang **Facebook API realtime**:
- Auto-sync campaigns/ads/leads/spend/CTR/CPL mỗi 15 phút
- Webhook realtime khi có lead mới từ Facebook Lead Ads
- Bitrix CRM **giữ nguyên CSV upload thủ công** (user update stage bằng tay)
- Trang "Phân tích Campaign" mới giống layout file Excel báo cáo

---

## 2. Mapping chỉ số Excel → Facebook API

### Từ file `SunUC_Active_RealTime_Analysis_13.xlsx`:

| # | Cột Excel | Source | Facebook API field | Endpoint | Auto |
|---|---|---|---|---|---|
| 1 | **Loại** (LF/MESS) | FB API | `campaign.objective` (LEAD_GENERATION / MESSAGES) | `/campaigns?fields=objective` | ✅ |
| 2 | **Tên chiến dịch** | FB API | `campaign.name` | `/campaigns?fields=name` | ✅ |
| 3 | **Tổng chi tiêu** | FB API | `insights.spend` | `/insights?fields=spend` | ✅ |
| 4 | **Lead** | FB API | `insights.actions[type=lead]` | `/insights?fields=actions` | ✅ |
| 5 | **CPL** | Computed | `spend / leads` | — | ✅ |
| 6 | **CTR%** | FB API | `insights.ctr` | `/insights?fields=ctr` | ✅ |
| 7 | **Freq** | FB API | `insights.frequency` | `/insights?fields=frequency` | ✅ |
| 8 | **CPM** (trong nhận xét) | FB API | `insights.cpm` | `/insights?fields=cpm` | ✅ |
| 9 | **Impressions** (hiển thị) | FB API | `insights.impressions` | `/insights?fields=impressions` | ✅ |
| 10 | **F1** | Bitrix CSV | Manual upload | — | ❌ Manual |
| 11 | **Rate CRM%** | Computed | `F1 / Lead × 100` | — | ✅ (khi có F1) |
| 12 | **F1/Lead %** | Computed | Tương tự Rate | — | ✅ |
| 13 | **CPL/F1** | Computed | `Spend / F1` | — | ✅ (khi có F1) |
| 14 | **Hiệu quả** | Rule-based | Dựa CPL/F1 thresholds | — | ✅ Auto-rate |
| 15 | **Chất lượng Content** | Rule-based | Dựa CTR + CPM | — | ✅ Auto-rate |
| 16 | **Ưu tiên** | Manual | Admin set | — | ❌ Manual |
| 17 | **Kế hoạch** | Manual | Admin set | — | ❌ Manual |
| 18 | **Nhận xét Content** | Manual/AI | AI Analyst suggest | — | 🟡 AI assist |
| 19 | **Hành động hôm nay** | Manual/AI | AI Analyst suggest | — | 🟡 AI assist |
| 20 | **Người thực hiện** | Manual | Admin assign | — | ❌ Manual |
| 21 | **Deadline** | Manual | Admin set | — | ❌ Manual |

**Tổng: 9 cột FB API auto + 4 cột computed + 2 cột AI assist + 6 cột manual = 21 cột**

---

## 3. Prerequisites (bạn phải làm trước)

### 3.1 Facebook App Setup

```
1. Vào https://developers.facebook.com → Create App
2. App Type: Business
3. Add Product: Marketing API
4. Settings → Basic:
   - App Domains: dashboard-v2-one-vert.vercel.app, localhost
   - Privacy Policy URL: https://smartland.vn/privacy (tạo 1 trang đơn giản)
   - Terms of Service URL: https://smartland.vn/terms
5. App Review → Request Permissions:
   - ads_read (đọc campaigns, insights, spend)
   - leads_retrieval (đọc lead forms)
   - pages_read_engagement (đọc page info)
   - pages_manage_metadata (setup webhook)
6. Business Verification:
   - Upload giấy phép kinh doanh Smartland
   - Chờ Meta verify (1-3 ngày)
7. Sau khi duyệt:
   - Business Settings → System Users → New System User
   - Role: Admin
   - Generate Token với permissions trên
   - Copy token → giao cho dev
```

### 3.2 Thông tin cần giao cho dev

```env
FB_APP_ID=                    # App ID
FB_APP_SECRET=                # App Secret
FB_SYSTEM_USER_TOKEN=         # Long-lived token (không expire)
FB_AD_ACCOUNT_ID=act_xxxxx   # Ad Account ID(s) — có thể nhiều
FB_PAGE_ID=                   # Page ID(s) cho webhook
```

### 3.3 Webhook Setup (sau khi App Review pass)

```
1. Facebook App → Webhooks → Subscribe
2. Object: Page
3. Field: leadgen
4. Callback URL: https://dashboard-v2-one-vert.vercel.app/api/webhooks/facebook
5. Verify Token: <random string set trong env>
```

---

## 4. Schema mới cần thêm

```typescript
// db/schema/fb-insights.ts

// Campaign insights (poll mỗi 15 phút)
campaign_insights: {
  id: uuid pk
  campaignId: uuid → campaigns.id
  date: date                    // ngày của insight
  spend: numeric                // chi tiêu VND
  impressions: integer          // lượt hiển thị
  clicks: integer               // clicks
  leads: integer                // action_type=lead
  ctr: numeric                  // click-through rate %
  cpm: numeric                  // cost per 1000 impressions
  frequency: numeric            // tần suất
  cpl: numeric                  // computed: spend / leads
  fetchedAt: timestamptz        // lần fetch gần nhất
}
// unique (campaignId, date)

// Ad-level insights (cho mẫu quảng cáo)
ad_insights: {
  id: uuid pk
  adId: uuid → ads.id
  date: date
  spend: numeric
  impressions: integer
  clicks: integer
  leads: integer
  ctr: numeric
  cpm: numeric
  cpl: numeric
  fetchedAt: timestamptz
}
// unique (adId, date)

// Campaign action plan (manual columns từ Excel)
campaign_actions: {
  id: uuid pk
  campaignId: uuid → campaigns.id
  priority: enum('urgent','today','week','none')     // 🔴🟠🟡
  plan: text                                          // Kế hoạch
  contentNote: text                                   // Nhận xét Content
  todayAction: text                                   // Hành động hôm nay
  actionDetail: text                                  // Chi tiết thực hiện
  assignee: text                                      // Người thực hiện
  deadline: date                                      // Deadline
  updatedBy: uuid → users.id
  updatedAt: timestamptz
}
// unique (campaignId) — 1 action plan per campaign
```

---

## 5. API endpoints mới

```
# Facebook data sync (Inngest cron hoặc BullMQ trên VPS)
POST /api/fb/sync-insights        # Pull insights cho tất cả active campaigns
POST /api/fb/sync-campaigns       # Sync campaign list + status
POST /api/fb/sync-ads             # Sync ad creatives + thumbnails

# Webhook (Facebook push realtime)
GET  /api/webhooks/facebook       # Verify webhook (challenge response)
POST /api/webhooks/facebook       # Receive leadgen events

# Campaign action plan (manual CRUD)
GET  /api/campaigns/:id/action    # Get action plan
PUT  /api/campaigns/:id/action    # Update action plan (priority, plan, assignee...)

# New page: Phân tích Campaign Realtime
GET  /report/campaigns            # Trang mới — layout giống Excel
```

---

## 6. Trang UI mới: "Phân tích Campaign"

### Layout giống file Excel — sidebar menu mới

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 📊 PHÂN TÍCH ACTIVE CAMPAIGNS — [Tên dự án]  ·  Cập nhật: 10/04/2026  │
├──────────────────────────────────────────────────────────────────────────┤
│ ⭐ WINNER <300k  ✅ Tốt 300-500k  📊 TB 500-800k  ⚠️ Cao  🆕 Test    │
├──────────────────────────────────────────────────────────────────────────┤
│                    ← META API LIVE →       ← QUALIFY →    ← HIỆU QUẢ →│
│ Loại│Chiến dịch   │Chi tiêu│Lead│CPL│CTR%│Freq│F1│Rate│F1%│CPL/F1│HQ│CL│
├─────┼─────────────┼────────┼────┼───┼────┼────┼──┼────┼───┼──────┼──┼──┤
│ LF  │LINH 3       │23.2M đ │168 │138│1.30│1.33│52│39% │31%│446K  │✅│✅│
│ LF  │BAO_1        │11.5M đ │ 75 │153│1.97│1.68│24│33% │32%│479K  │✅│✅│
│ ...                                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                    ← KẾ HOẠCH & HÀNH ĐỘNG HÔM NAY →                    │
│ Ưu tiên │ Kế hoạch        │ Hành động hôm nay  │ Người │ Deadline      │
│ 🔴      │ Tăng budget +20%│ Tăng adset ×1.2    │ MBuyer│ Trước 12h     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tính năng:
- **Auto-rate Hiệu quả**: ⭐ (<300k) / ✅ (300-500k) / 📊 (500-800k) / ⚠️ (>800k)
- **Auto-rate Chất lượng Content**: dựa CTR + CPM thresholds
- **Inline edit**: click vào ô Ưu tiên/Kế hoạch/Hành động → edit trực tiếp
- **AI Suggest**: nút "🤖 AI đề xuất" → AI Analyst phân tích data → fill Nhận xét + Hành động
- **Filter**: Active / Paused / All
- **Sort**: CPL/F1 tăng dần (default giống Excel)

---

## 7. Facebook Insights Sync Flow

```
Mỗi 15 phút (Inngest cron hoặc BullMQ):

1. GET /act_{id}/campaigns?fields=id,name,status,objective
   → Upsert campaigns table (status ON/OFF/PAUSED)

2. Cho mỗi ACTIVE campaign:
   GET /{campaign_id}/insights?fields=spend,impressions,clicks,ctr,cpm,frequency,actions
   &date_preset=lifetime (hoặc time_range cho incremental)
   → Upsert campaign_insights

3. GET /act_{id}/ads?fields=id,name,creative{thumbnail_url}
   → Upsert ads table (thumbnail_url)

4. Cho mỗi ad:
   GET /{ad_id}/insights?fields=spend,impressions,clicks,ctr,cpm,actions
   → Upsert ad_insights

5. Rebuild daily_aggregates
6. Invalidate cache (revalidateTag)
```

### Rate Limits Facebook API
- 200 calls / hour / ad account (Graph API v21+)
- Với 50 campaigns × 2 calls (campaign + insights) = 100 calls / sync
- 4 syncs / hour = 400 calls → cần batch hoặc giảm frequency

### Giải pháp rate limit:
- Dùng batch endpoint: `/?ids=camp1,camp2&fields=insights{spend,ctr}`
- Hoặc: sync mỗi 30 phút thay 15 phút
- Insights API level=campaign aggregate → 1 call cho tất cả campaigns

---

## 8. Webhook Lead Realtime

```
Facebook leadgen webhook → POST /api/webhooks/facebook
  → Verify signature (X-Hub-Signature-256)
  → Extract: leadgen_id, page_id, form_id, created_time
  → GET /leadgen_id?fields=field_data (tên, SĐT, email)
  → Upsert vào leads table
  → Trigger aggregate rebuild
  → SSE notify dashboard (Phase 2.5)
```

---

## 9. Task breakdown

### Phase 2.0 — Schema + Config (1 ngày)
- [ ] Thêm `db/schema/fb-insights.ts` (campaign_insights, ad_insights, campaign_actions)
- [ ] Migration: `npm run db:push`
- [ ] Env vars: `FB_APP_ID`, `FB_APP_SECRET`, `FB_SYSTEM_USER_TOKEN`, `FB_AD_ACCOUNT_ID`
- [ ] `lib/fb/client.ts` — Facebook Graph API client wrapper

### Phase 2.1 — Insights Sync (2 ngày)
- [ ] `lib/fb/sync-campaigns.ts` — pull campaign list + objective + status
- [ ] `lib/fb/sync-insights.ts` — pull spend/CTR/CPL/CPM/Freq per campaign + ad
- [ ] `lib/fb/sync-creatives.ts` — pull ad thumbnail URLs
- [ ] Inngest function `fb-sync-insights` (cron mỗi 15-30 phút)
- [ ] Auto-rate hiệu quả + chất lượng content (rule engine)

### Phase 2.2 — Webhook Lead (1 ngày)
- [ ] `app/api/webhooks/facebook/route.ts` — GET verify + POST handler
- [ ] Signature verification (HMAC SHA-256)
- [ ] Leadgen data fetch + upsert lead + aggregate rebuild
- [ ] Test với Facebook Webhooks Test tool

### Phase 2.3 — Trang "Phân tích Campaign" (2 ngày)
- [ ] `app/(dashboard)/report/campaigns/page.tsx` — layout giống Excel
- [ ] `lib/queries/campaign-analysis.ts` — join campaigns + insights + F1 data
- [ ] Sidebar menu item mới: "Phân tích Campaign"
- [ ] Inline edit cho ô Ưu tiên / Kế hoạch / Hành động / Assignee / Deadline
- [ ] `lib/actions/campaign-actions.ts` — CRUD campaign_actions
- [ ] AI Suggest button → gọi AI Analyst với context campaign data

### Phase 2.4 — Fill cột trống hiện tại (0.5 ngày)
- [ ] Section Chiến dịch: fill Chi tiêu / Hiển thị / CTR / CPL / Hiệu quả từ campaign_insights
- [ ] Section Mẫu QC: fill CTR / CPL / thumbnail từ ad_insights
- [ ] Dashboard Overview: fill Tổng chi phí MKT từ insights (thay manual cost)

### Phase 2.5 — SSE Realtime (optional, 1 ngày)
- [ ] `app/api/sse/leads/route.ts` — Server-Sent Events
- [ ] `lib/realtime/notify.ts` — Neon LISTEN/NOTIFY hoặc polling
- [ ] Dashboard auto-refresh khi có lead mới

---

## 10. Kiến trúc tương lai (Hono + VPS)

```
Sau khi Phase 2 ổn định trên Vercel:

┌─────────────────────────────────────────────────┐
│                VPS (2 core Xeon, 4GB)            │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Hono API │  │ Postgres │  │ Redis+BullMQ │  │
│  │ port 3001│──│ local    │  │ background   │  │
│  │          │  │ pool=20  │  │ jobs         │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│       ↑ persistent conn (2-5ms/query)           │
│       ↑ thay HTTP driver (50-100ms/query)       │
└─────────────────────────────────────────────────┘
         ↕ HTTPS
┌──────────────────────┐
│ Vercel (Frontend)     │
│ Next.js Dashboard     │
│ gọi Hono API          │
└──────────────────────┘

Migration plan:
1. Setup Postgres + Redis trên VPS
2. Scaffold Hono project (share Drizzle schema)
3. Migrate API routes: /api/upload, /api/chat, /api/fb/*
4. Next.js chuyển từ query DB trực tiếp → fetch Hono API
5. Facebook webhook point tới VPS domain
6. Vercel chỉ còn SSR frontend
```

---

## 11. Timeline tổng

| Tuần | Task | Blocker |
|---|---|---|
| **Tuần 1** | Facebook App + Business Verification + Schema | Meta review |
| **Tuần 2** | Insights Sync + fill cột trống | Cần FB token |
| **Tuần 3** | Webhook Lead + trang Phân tích Campaign | Cần webhook verify |
| **Tuần 4** | AI Suggest + SSE Realtime + polish | — |
| **Tuần 5+** | Migrate Hono + VPS | Cần VPS ready |

---

## 12. Risk & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Meta App Review fail/chậm | Block toàn bộ Phase 2 | Giữ CSV upload fallback vĩnh viễn, adapter pattern sẵn |
| Facebook rate limit 200/hr | Insights sync timeout | Batch API calls, giảm frequency 30 phút |
| Token expire | Sync ngừng | System User token không expire; monitor + alert |
| VPS downtime | API unavailable | Giữ Vercel fallback, health check + PM2 restart |
| 75K+ leads query chậm | Dashboard lag | daily_aggregates + campaign_insights pre-computed |
