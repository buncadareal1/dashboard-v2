# Documentation Index — Dashboard Lead BĐS

**Cập nhật**: 2026-04-13  
**Mục đích**: Hướng dẫn nhanh chóng tìm kiếm tài liệu phù hợp

---

## 📚 Tài liệu chính

### Dành cho Người dùng (Non-Technical)

| Tài liệu | Mục đích | Đối tượng |
|---------|---------|----------|
| **[USER-GUIDE.md](USER-GUIDE.md)** | Hướng dẫn sử dụng toàn bộ Dashboard | Digital Marketing, GDDA Manager |
| **[templates/README.md](templates/README.md)** | Cách chuẩn bị và upload CSV | Digital Team, CSV preparer |

### Sample CSV Templates

Sẵn có 3 mẫu CSV để copy:

| File | Loại | Cột bắt buộc | Tần suất upload |
|------|------|-------------|-----------------|
| **[facebook-sample.csv](templates/facebook-sample.csv)** | Facebook Ads | Created Time, Full Name, Phone, Lead ID | Hàng ngày/tuần |
| **[bitrix-sample.csv](templates/bitrix-sample.csv)** | Bitrix CRM | Lead, Stage, Responsible, Updated Time | Hàng tuần |
| **[cost-sample.csv](templates/cost-sample.csv)** | Chi phí MKT | NGÀY, CHI TIÊU | Hàng tuần/tháng |

---

### Dành cho Developer/Admin

| Tài liệu | Mục đích |
|---------|---------|
| **[HANDOFF.md](HANDOFF.md)** | Context dự án, stack, DB state, issues đã biết |
| **[PHASE-2-PLAN.md](PHASE-2-PLAN.md)** | Kế hoạch Phase 2 (Facebook API integration) |
| **[HONO-MIGRATION-PLAN.md](HONO-MIGRATION-PLAN.md)** | Hono API migration + VPS setup |
| **[dashboard-v2-plan.md](dashboard-v2-plan.md)** | Master plan đầy đủ (~1700 dòng) |

---

## 🎯 Quick Navigation

### "Tôi cần..."

#### ...sử dụng Dashboard lần đầu?
👉 Đọc **[USER-GUIDE.md](USER-GUIDE.md)** phần:
- [Đăng nhập](#đăng-nhập)
- [Dashboard Tổng quan](#dashboard-tổng-quan)

#### ...upload CSV?
👉 Đọc **[USER-GUIDE.md](USER-GUIDE.md)** phần [Upload CSV](#upload-csv)  
👉 Hoặc xem mẫu trong **[templates/](templates/)**

#### ...xem báo cáo lead?
👉 Đọc **[USER-GUIDE.md](USER-GUIDE.md)** phần [Report Data — CRM](#report-data--crm)

#### ...phân tích campaign?
👉 Đọc **[USER-GUIDE.md](USER-GUIDE.md)** phần [Phân tích Campaign](#phân-tích-campaign)

#### ...giải quyết lỗi?
👉 Đọc **[USER-GUIDE.md](USER-GUIDE.md)** phần [FAQ & Lỗi thường gặp](#faq--lỗi-thường-gặp)

#### ...tiếp tục phát triển Dashboard?
👉 Đọc **[HANDOFF.md](HANDOFF.md)** toàn bộ  
👉 Sau đó xem **[PHASE-2-PLAN.md](PHASE-2-PLAN.md)** hoặc **[HONO-MIGRATION-PLAN.md](HONO-MIGRATION-PLAN.md)**

#### ...hiểu tổng thể dự án?
👉 Đọc **[dashboard-v2-plan.md](dashboard-v2-plan.md)** (master plan)

---

## 📊 Cấu trúc tài liệu

```
docs/
├── USER-GUIDE.md                  ← Bắt đầu từ đây (người dùng)
├── INDEX.md                       ← File này
├── HANDOFF.md                     ← Context dự án (developer)
├── PHASE-2-PLAN.md               ← Phase 2 planning
├── HONO-MIGRATION-PLAN.md        ← VPS migration
├── dashboard-v2-plan.md           ← Master plan (developer)
├── FIX-PLAN.md                    ← Issues đã biết
└── templates/
    ├── README.md                  ← Hướng dẫn CSV
    ├── facebook-sample.csv        ← Mẫu Facebook CSV
    ├── bitrix-sample.csv          ← Mẫu Bitrix CSV
    └── cost-sample.csv            ← Mẫu Chi phí CSV
```

---

## 🚀 Getting Started

### Cho người dùng mới

1. **Đọc**: [USER-GUIDE.md](USER-GUIDE.md) (20 phút)
2. **Đăng nhập**: https://dashboard-v2-one-vert.vercel.app
3. **Upload CSV**: Sử dụng mẫu trong [templates/](templates/)
4. **Khám phá**: Dashboard Tổng quan, Report Data, Campaign Analysis

### Cho developer

1. **Đọc**: [HANDOFF.md](HANDOFF.md) toàn bộ (30 phút)
2. **Chạy**: `npm install && npm run db:push && npm run db:seed`
3. **Verify**: `npm test` (53/53 pass expected)
4. **Dev server**: `npm run dev` → http://localhost:3000

---

## 📞 Support

| Vấn đề | Liên hệ |
|--------|--------|
| Không thể đăng nhập | webdev@smartland.vn |
| Upload CSV lỗi | [USER-GUIDE.md FAQ](#faq--lỗi-thường-gặp) hoặc webdev@smartland.vn |
| Dữ liệu sai/mất | webdev@smartland.vn |
| Tính năng mới | [PHASE-2-PLAN.md](PHASE-2-PLAN.md) |
| Dev issues | [HANDOFF.md — Issues đã biết](HANDOFF.md#-issues-đã-biết-và-fix) |

---

**Happy learning! 🎉**
