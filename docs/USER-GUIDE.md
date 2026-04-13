# Hướng dẫn sử dụng Dashboard Quản lý Lead BĐS

**Đối tượng**: Đội ngũ Digital Marketing & Quản lý GDDA (Smartland)  
**Cập nhật**: 2026-04-13  
**Phiên bản**: 1.0

---

## Mục lục

1. [Giới thiệu chung](#giới-thiệu-chung)
2. [Đăng nhập](#đăng-nhập)
3. [Dashboard Tổng quan](#dashboard-tổng-quan)
4. [Quản lý Dự án](#quản-lý-dự-án)
5. [Upload CSV](#upload-csv)
6. [Report Data — CRM](#report-data--crm)
7. [Phân tích Campaign](#phân-tích-campaign)
8. [AI Analyst](#ai-analyst)
9. [Mẫu CSV](#mẫu-csv)
10. [FAQ & Lỗi thường gặp](#faq--lỗi-thường-gặp)

---

## Giới thiệu chung

**Dashboard Lead BĐS** là công cụ quản lý toàn vòng đời lead bất động sản của Smartland, tích hợp dữ liệu từ:
- **Facebook Ads Manager** (chiến dịch quảng cáo, form lead)
- **Bitrix24** (quản lý lead, ghi chú nhân viên, trạng thái)
- **Chi phí Marketing** (upload thủ công, theo dõi ROI)

### Lợi ích chính

✅ **Xem tất cả dữ liệu tập trung** — không cần vào nhiều tab/ứng dụng  
✅ **Theo dõi hiệu quả campaign** — biết campaign nào hiệu quả, campaign nào cần tối ưu  
✅ **Quản lý lead chi tiết** — tìm kiếm, lọc theo giai đoạn, ghi chú  
✅ **Báo cáo realtime** — cập nhật tự động sau mỗi upload CSV  
✅ **Hỏi AI Analyst** — trả lời các câu hỏi về số liệu, xu hướng

---

## Đăng nhập

### Bước 1: Truy cập Dashboard

Mở trình duyệt, đi tới:

```
https://dashboard-v2-one-vert.vercel.app
```

### Bước 2: Chọn "Đăng nhập với Google"

Màn hình sẽ hiển thị nút **"Đăng nhập với Google"** (màu xanh).

### Bước 3: Chọn tài khoản

Chọn email Smartland của bạn từ danh sách (ví dụ: `your-name@smartland.vn`).

> **Lưu ý**: Chỉ email sau được dùng:
> - `@smartland.vn`
> - `@smartrealtors.vn`
> - `@smartproperty.vn`

### Bước 4: Xác nhận quyền truy cập

Lần đầu đăng nhập, Google sẽ yêu cầu xác nhận. Click **"Tiếp tục"** để cho phép.

### Vai trò của bạn (Role)

Hệ thống tự động gán role dựa trên email:

| Vai trò | Quyền | Xem |
|---------|-------|-----|
| **Admin** | Toàn quyền: tạo/sửa dự án, quản lý người dùng, upload CSV | Tất cả dự án, report toàn công ty |
| **Digital** | Upload CSV, sửa dự án, đổi trạng thái campaign | Dự án được gán, report của các dự án đó |
| **GDDA** (Giai đoạn Giữ Digital After) | Xem lead chi tiết, báo cáo giai đoạn | Chỉ xem báo cáo lead (không có danh sách dự án) |

---

## Dashboard Tổng quan

Khi bạn đăng nhập lần đầu (nếu là Admin hoặc Digital), bạn sẽ thấy **Dashboard Tổng quan**.

### Các thông số chính (5 Stat Cards)

```
┌─────────────────────────────────────┐
│ 📁 Dự án đang chạy: 5              │
│ 💰 Tổng chi phí MKT: 125.5M đ      │
│ 👥 Tổng Lead: 2.850                │
│ 📈 Tổng F1: 420                    │
│ ✅ Tổng Booking: 85                │
└─────────────────────────────────────┘
```

**Giải thích**:
- **Dự án đang chạy**: Số dự án bạn có quyền quản lý
- **Tổng chi phí MKT**: Tổng ngân sách marketing upload
- **Tổng Lead**: Tất cả lead từ Facebook Ads
- **Tổng F1**: Số lead chuyển thành "quan tâm cụ thể" (F1 = First contact)
- **Tổng Booking**: Số khách đã book lịch

### Bảng tổng hợp hiệu quả dự án

Dưới 5 stat cards là **bảng tổng hợp** hiển thị từng dự án:

| Dự án | Chi phí | Booking | F1 | Lead | CP/Lead | CP/F1 | Trạng thái |
|-------|---------|---------|----|----|---------|-------|-----------|
| SUN Hà Nam | 2.5M | 8 | 42 | 285 | 8.8K | 59K | ✅ Đang chạy |
| Moonlight | 1.8M | 5 | 28 | 195 | 9.2K | 64K | ⚠️ Cảnh báo |

**Cách đọc**:
- **Chi phí**: Tổng tiền chi cho quảng cáo
- **CP/Lead**: Chi phí trung bình để có 1 lead (cost per lead)
- **CP/F1**: Chi phí trung bình để có 1 khách hàng quan tâm

**Tip**: Click vào tên dự án để xem chi tiết campaign, ad, upload history.

---

## Quản lý Dự án

### Danh sách dự án

Click **"Dự án"** ở menu bên trái để xem toàn bộ dự án.

Tại đây bạn sẽ thấy:
- ✅ Dự án đang hoạt động
- ⚠️ Dự án cảnh báo (hiệu quả thấp)
- ⏸️ Dự án tạm dừng

### Xem chi tiết dự án

Click vào card dự án, bạn sẽ thấy:

#### 1️⃣ Stat Cards (4 thông số)

```
Tổng ngân sách: 2.5M đ  |  Tổng Lead: 285  |  CPL: 8.8K đ  |  F1 Rate: 14.7%
```

#### 2️⃣ Bảng Campaign (Chiến dịch)

Liệt kê tất cả **chiến dịch quảng cáo** của dự án:

| Campaign | Ads | Lead | Spend | CPL | Trạng thái |
|----------|-----|------|-------|-----|-----------|
| Hè 2026 - ưu đãi | 8 | 142 | 1.2M | 8.5K | 🔴 ON |
| Hè 2026 - call | 5 | 98 | 1.0M | 10.2K | ⚪ OFF |

**Hành động**:
- Click biểu tượng 🟢/⚪ để **bật/tắt campaign** (chỉ có quyền Edit)

#### 3️⃣ Bảng Ad Creative (Quảng cáo cụ thể)

Liệt kê từng quảng cáo (ảnh/video) trong campaign:

| Ad | Adset | Campaign | Impressions | Clicks | Lead | Click Rate |
|----|-------|----------|-------------|--------|------|-----------|
| Ảnh SHP căn 1PN | Set 1 | Hè 2026 - ưu đãi | 12,500 | 245 | 28 | 1.96% |

#### 4️⃣ Upload History (Lịch sử upload)

Bảng ghi lại tất cả các lần upload CSV:

| Ngày upload | Loại | File | Hàng | Trạng thái |
|-------------|------|------|------|-----------|
| 2026-04-10 10:30 | Facebook CSV | fb-ads-2026-04-10.csv | 142 | ✅ Hoàn thành |
| 2026-04-10 14:15 | Bitrix CSV | bitrix-leads-2026-04.csv | 156 | ✅ Hoàn thành |
| 2026-04-08 09:45 | Chi phí CSV | costs-2026-04.csv | 8 | ✅ Hoàn thành |

---

## Upload CSV

Để dashboard có dữ liệu, bạn cần **upload CSV** định kỳ.

### 3 loại CSV cần upload

#### 1. Facebook CSV (Từ Ads Manager)

**Tần suất**: Hàng ngày hoặc hàng tuần  
**Nội dung**: Danh sách lead từ Facebook Ads, kèm campaign, form

**Cách export từ Facebook Ads Manager**:

1. Đăng nhập vào **Meta Ads Manager** (https://business.facebook.com)
2. Chọn **Dự án** → **Form leads** (hoặc Lead Ads)
3. Chọn **Thời gian** (tuần, tháng)
4. Click **⬇️ Download** → chọn **CSV**
5. File sẽ tên: `lead_export_YYYY-MM-DD.csv`

**Định dạng cần có**:
```
Created Time, DATE CLEAN, Full Name, Phone, Email, Campaign, Adset, Ad, Form Name, Lead ID
05/03/2026 10:30, 05/03/2026, Nguyễn Văn A, 0912345678, test@gmail.com, Campaign 1, Adset 1, Ad 1, Form 1, 123456789
```

**Các cột bắt buộc**:
- ✅ `Created Time` — Thời gian lead được tạo
- ✅ `Full Name` — Họ tên khách
- ✅ `Phone` — Số điện thoại
- ✅ `Email` — Email khách (có thể để trống)
- ✅ `Campaign` — Tên chiến dịch
- ✅ `Adset` — Tên adset
- ✅ `Ad` — Tên quảng cáo
- ✅ `Form Name` — Tên form lead
- ✅ `Lead ID` — ID lead trên Facebook (rất quan trọng!)

**Nếu thiếu cột nào**, dashboard sẽ báo lỗi: `"Thiếu cột: Lead ID"`.

---

#### 2. Bitrix CSV (Từ CRM)

**Tần suất**: Hàng tuần (sau khi nhân viên cập nhật trạng thái trong Bitrix)  
**Nội dung**: Danh sách lead, giai đoạn, nhân viên phụ trách, ghi chú

**Cách export từ Bitrix24**:

1. Đăng nhập **Bitrix24** (https://smartland.bitrix24.com)
2. Chọn **CRM** → **Deals** hoặc **Leads**
3. Chọn các cột: `Lead`, `Stage`, `Responsible`, `Updated Time`, `Comment`
4. Click **⬇️ Export** → chọn **CSV**

**Định dạng cần có**:
```
Lead, Stage, Responsible, Updated Time, Comment
Nguyen Van A, F1, Linh - Juno, 05/03/2026 10:30, Đã liên hệ
```

**Các cột bắt buộc**:
- ✅ `Lead` — Họ tên khách
- ✅ `Stage` — Giai đoạn (ví dụ: F1, Booking, Đang chăm, v.v.)
- ✅ `Responsible` — Nhân viên (định dạng: "Tên - Team", ví dụ: "Linh - Juno")
- ✅ `Updated Time` — Thời gian cập nhật gần nhất

**Ghi chú**:
- `Comment` — Ghi chú của nhân viên (tuỳ chọn)
- Nhân viên phải có định dạng `"Tên - Team"`. Nếu chỉ có tên, cũng được nhưng không lấy được team.
- Các team hợp lệ: **Juno, Neptune, Aura, Virgo**

---

#### 3. Chi phí CSV (Từ Excel Digital team)

**Tần suất**: Hàng tuần hoặc hàng tháng  
**Nội dung**: Chi phí quảng cáo theo ngày

**Định dạng cần có**:
```
STT, NGÀY, CHI TIÊU, LEAD, F1
1, 05/02/2026, "2.270.065 đ", 8, 4
```

**Các cột bắt buộc**:
- ✅ `NGÀY` — Ngày chi (định dạng: dd/MM/yyyy)
- ✅ `CHI TIÊU` — Số tiền VND (ví dụ: "2.270.065 đ" hoặc "2270065")

**Định dạng tiền**:
- `2.270.065` (dấu chấm ngăn cách)
- `2270065` (không dấu)
- `"2.270.065 đ"` (có đơn vị đ)

Tất cả đều được chấp nhận!

---

### Cách upload

1. **Vào chi tiết dự án** (click tên dự án)
2. **Cuộn xuống mục "Upload CSV"**
3. Bạn sẽ thấy **3 nút**:
   - 📤 **Upload Facebook CSV**
   - 📤 **Upload Bitrix CSV**
   - 📤 **Upload Chi phí CSV**

4. **Click nút tương ứng** → Chọn file từ máy tính
5. **Chờ xử lý** (thường 5-30 giây)
   - Nếu ✅ Thành công → bảng lead sẽ cập nhật
   - Nếu ❌ Lỗi → xem mục [FAQ & Lỗi thường gặp](#faq--lỗi-thường-gặp)

---

### Lỗi thường gặp khi upload

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|-----------|-----------------|
| "Thiếu cột Lead ID" | File FB CSV không có cột Lead ID | Export lại từ Meta Ads Manager, đảm bảo có cột Lead ID |
| "Thiếu cột Stage" | File Bitrix CSV thiếu cột Stage | Thêm cột Stage vào khi export từ Bitrix |
| "File trống" | Chọn nhầm file hoặc file CSV bị hỏng | Kiểm tra file CSV, mở bằng Excel để đảm bảo có dữ liệu |
| "Không thể đọc file" | File CSV có định dạng lạ (ví dụ: XLSX, TXT) | Lưu file dưới dạng CSV (Comma-separated values) |
| Stage hiện "pending" | Giai đoạn không nằm trong danh sách alias | Liên hệ Admin để thêm stage mới vào hệ thống |

---

## Report Data — CRM

Xem tất cả **lead chi tiết** từ các kênh quảng cáo.

### Dành cho Admin/Digital

#### Bước 1: Chọn dự án

Click **"Report Data"** ở menu → chọn dự án.

#### Bước 2: Lọc dữ liệu

Bạn có thể lọc theo:
- **Giai đoạn** (Lead, F1, Booking, Deal, Đang chăm, v.v.)
- **Thời gian** (7 ngày, 30 ngày, 90 ngày, tháng này, tháng trước, custom)

#### Bước 3: Xem bảng lead

| Cập nhật | Created Time | Họ tên | SĐT | Email | Campaign | Giai đoạn | Nhân viên |
|----------|--------------|--------|-----|-------|----------|-----------|-----------|
| 2026-04-10 | 2026-03-15 | Nguyễn Văn A | 0912345678 | a@gmail.com | Hè 2026 | F1 | Linh - Juno |
| 2026-04-09 | 2026-03-20 | Trần Thị B | 0987654321 | b@gmail.com | Hè 2026 | Booking | Minh - Neptune |

**Giải thích cột**:
- **Cập nhật**: Lần cuối cập nhật từ Bitrix (nếu có)
- **Created Time**: Khi lead được tạo trên Facebook
- **Giai đoạn**: Trạng thái hiện tại (Lead, F1, Booking, Deal, Spam, v.v.)
- **Nhân viên**: Người phụ trách

#### Bước 4: Phân trang

Cuối bảng có **nút Previous/Next** để xem trang khác.

---

### Dành cho GDDA

**GDDA** (Quản lý Giai đoạn Giữ Digital After) chỉ xem **báo cáo phân tích**, không có lọc.

Thay vào đó, bạn sẽ thấy **3 tab**:

1. **Theo ngày** — Lead tổng hợp by ngày
2. **Theo nhân viên** — Phân chia lead cho từng nhân viên
3. **Theo Fanpage** — Lead từ từng trang Facebook

---

## Phân tích Campaign

**Trang này giúp bạn tìm ra campaign nào hiệu quả, campaign nào cần tối ưu.**

### Truy cập

Click **"Report"** → **"Phân tích Campaign"** ở menu.

### Bước 1: Chọn dự án

Chọn dự án từ dropdown (chỉ thành phố quảng cáo đang chạy).

### Bước 2: Chọn thời gian

**Các tuỳ chọn**:
- 📊 7 ngày gần nhất
- 📊 30 ngày gần nhất
- 📊 90 ngày gần nhất
- 📊 Tháng này
- 📊 Tháng trước
- 📊 Custom (chọn ngày cụ thể)

### Bước 3: Đọc bảng phân tích

| Campaign | Ads | Chi tiêu (META) | Lead (META) | CPL | CTR% | F1 (CRM) | Rate F1% | Hiệu quả | Chất lượng | Hành động |
|----------|-----|-----------------|-------------|-----|------|----------|----------|----------|-----------|-----------|
| Hè 2026 - ưu đãi | 8 | 1.2M | 142 | 8.5K | 2.3% | 28 | 19.7% | ⭐ WINNER | ✅ Tốt | Sửa/Tắt |
| Hè 2026 - call | 5 | 1.0M | 98 | 10.2K | 1.2% | 14 | 14.3% | ✅ Tốt | 📊 TB | Sửa/Tắt |

**Giải thích**:

#### Phần META API (từ Facebook Ads Manager)
- **Chi tiêu**: Tổng tiền chi cho campaign
- **Lead**: Số lead từ form Facebook
- **CPL**: Chi phí per lead (Chi tiêu ÷ Lead)
- **CTR%**: Click-through rate = (Clicks ÷ Impressions) × 100

#### Phần CRM (từ Bitrix)
- **F1 (CRM)**: Số lead đã trở thành "quan tâm cụ thể"
- **Rate F1%**: Tỷ lệ F1 = (F1 ÷ Lead) × 100

#### Đánh giá Hiệu quả (HQ)

| Đánh giá | CPL | Ý nghĩa |
|---------|-----|---------|
| ⭐ **WINNER** | < 150K | Quá tốt! Chi phí rất thấp, lead chất lượng cao |
| ✅ **Tốt** | 150K - 300K | Bình thường, có lợi nhuận |
| 📊 **Trung bình** | 300K - 500K | Vừa vừa, có thể tối ưu được |
| ⚠️ **Cao** | > 500K | Chi phí quá cao, cần tắt hoặc cải thiện |

#### Đánh giá Chất lượng (CL)

| Đánh giá | CTR% | Ý nghĩa |
|---------|------|---------|
| ✅ **Tốt** | > 1.5% | Quảng cáo hấp dẫn, mọi người click nhiều |
| 📊 **Trung bình** | 0.8% - 1.5% | Bình thường |
| ⚠️ **Kém** | < 0.8% | Quảng cáo không hấp dẫn, cần thay ảnh/video |

### Bước 4: Chỉnh sửa kế hoạch hành động

Nếu bạn có quyền Edit (Admin/Digital):

1. Click vào cột **"Hành động"** → **"Sửa"**
2. Cập nhật kế hoạch (ví dụ: "Tăng ngân sách lên 500K", "Thay ảnh mới", v.v.)
3. Click **"Lưu"**

### Bước 5: Bật/Tắt campaign

Click biểu tượng 🟢/⚪ ở cột cuối để:
- 🟢 **ON** — Campaign đang chạy
- ⚪ **OFF** — Campaign tạm dừng

> **Tip**: Tắt campaign có CPL > 500K để tiết kiệm ngân sách, hoặc tối ưu ảnh/targeting.

---

## AI Analyst

**AI Analyst** giúp bạn hỏi câu hỏi về dữ liệu mà không cần biết SQL hay Excel.

### Cách sử dụng

1. **Click nút "🤖 AI Analyst"** ở sidebar (hoặc thanh trên cùng)
2. **Một panel trượt từ phải sang** (slide-out panel)
3. **Nhập câu hỏi** của bạn vào khung chat
4. **AI sẽ trả lời** dựa trên dữ liệu

### Ví dụ câu hỏi

```
❓ Campaign nào có CPL thấp nhất tuần này?
→ AI: "Campaign 'Hè 2026 - ưu đãi' có CPL 8.5K, thấp nhất."

❓ Có bao nhiêu lead chuyển thành F1 tháng trước?
→ AI: "2,150 lead chuyển thành F1 tháng trước (tỷ lệ 18.3%)."

❓ Nhân viên nào chăm sóc lead tốt nhất?
→ AI: "Linh (Juno team) với 94% lead chuyển F1."

❓ Dự án nào ROI cao nhất?
→ AI: "SUN Hà Nam với ROI 3.2x (booking 85, chi phí 2.5M)."
```

---

## Mẫu CSV

**Phần này cung cấp mẫu CSV** sẵn có để bạn copy và sửa.

### Mẫu Facebook CSV

**File**: `facebook-sample.csv`

```csv
Created Time,DATE CLEAN,Full Name,Phone,Email,Campaign,Adset,Ad,Form Name,Lead ID
05/03/2026 10:30,05/03/2026,Nguyen Van A,0912345678,test@gmail.com,Campaign 1,Adset 1,Ad 1,Form 1,123456789
05/03/2026 11:15,05/03/2026,Tran Thi B,0987654321,tran@gmail.com,Campaign 2,Adset 2,Ad 2,Form 1,234567890
05/03/2026 14:45,05/03/2026,Le Van C,0911223344,le@gmail.com,Campaign 1,Adset 3,Ad 3,Form 2,345678901
```

**Hướng dẫn**:
1. Mở file bằng **Excel** (hoặc Google Sheets)
2. Giữ nguyên header (dòng đầu)
3. Thêm dữ liệu từ hàng 2 trở đi
4. Lưu dưới dạng **CSV** (File → Save As → Comma-Separated Values)

---

### Mẫu Bitrix CSV

**File**: `bitrix-sample.csv`

```csv
Lead,Stage,Responsible,Updated Time,Comment
Nguyen Van A,F1,Linh - Juno,05/03/2026 10:30,Đã liên hệ
Tran Thi B,Booking,Minh - Neptune,05/03/2026 11:45,Đã book lịch xem nhà
Le Van C,Dang Cham,Anh - Aura,05/03/2026 13:20,Chờ phản hồi khách hàng
```

**Hướng dẫn**:
1. Mở file bằng **Excel**
2. Cột **Responsible** phải có định dạng: `"Tên - Team"` (ví dụ: `"Linh - Juno"`)
3. Cột **Stage** phải khớp với giai đoạn trong Bitrix
4. Lưu dưới dạng **CSV**

**Danh sách Stage hợp lệ**:
- Lead (mới tạo)
- F1 / F1 (QT dự án cụ thể)
- Booking
- Deal
- Đang chăm / Đang Chăm (2h)
- Spam Lead
- Chào dự án khác
- Không Bắt Máy
- Thuê bao KLL được
- v.v. (tuỳ setup Bitrix)

---

### Mẫu Chi phí CSV

**File**: `cost-sample.csv`

```csv
STT,NGÀY,CHI TIÊU,LEAD,F1
1,05/02/2026,"2.270.065 đ",8,4
2,06/02/2026,"1.500.000 đ",12,6
3,07/02/2026,"3.100.250 đ",18,9
```

**Hướng dẫn**:
1. Mở file bằng **Excel**
2. Cột **NGÀY**: định dạng `dd/MM/yyyy` (ví dụ: `05/02/2026`)
3. Cột **CHI TIÊU**: số tiền VND, có thể có dấu chấm (ví dụ: `"2.270.065"`) hoặc không (ví dụ: `2270065`)
4. Cột **LEAD**, **F1**: tùy chọn (chỉ cần NGÀY + CHI TIÊU)
5. Lưu dưới dạng **CSV**

---

## FAQ & Lỗi thường gặp

### Q1: Tôi upload CSV nhưng không thấy dữ liệu thay đổi?

**A**: Dashboard cập nhật trong 5-30 giây. Nếu chờ lâu:
1. **Kiểm tra trạng thái upload** — Scroll xuống mục "Upload CSV" xem có ✅ hay ❌
2. **Làm tươi trang** — Nhấn `F5` hoặc `Ctrl+R`
3. **Kiểm tra file CSV** — Mở file bằng Excel, đảm bảo có dữ liệu và header đúng

---

### Q2: Lỗi "Thiếu cột Lead ID"?

**A**: File CSV không có cột **Lead ID**. Cách khắc phục:

1. **Mở lại Meta Ads Manager** (https://business.facebook.com)
2. **Vào Form leads** → chọn dự án
3. **Chọn cột** → tìm "Lead ID" → đánh dấu ✅
4. **Export lại CSV**
5. **Upload vào dashboard**

---

### Q3: Lead không có Giai đoạn (hiện "pending")?

**A**: Stage không nằm trong danh sách alias (đã được map từ trước).

**Cách khắc phục**:
- Liên hệ **Admin** (webdev@smartland.vn) để thêm stage mới
- Ví dụ: "Lead Pending Review" → map thành "Lead"

---

### Q4: Không thấy dự án trong dropdown?

**A**: Bạn chưa được gán quyền truy cập dự án đó.

**Cách khắc phục**:
- Liên hệ **Admin** để được gán dự án
- Sau khi gán, làm tươi trang (Ctrl+R)

---

### Q5: Nút "Edit" (sửa campaign) bị ẩn?

**A**: Bạn không có quyền Edit. Chỉ **Admin** và **Digital** mới có.

**Giải pháp**:
- Nếu bạn là Digital, liên hệ Admin để kiểm tra quyền
- Nếu bạn là GDDA, bạn chỉ có quyền xem, không sửa

---

### Q6: File CSV không upload được (lỗi "Không thể đọc file")?

**A**: File không phải CSV hoặc bị hỏng.

**Cách khắc phục**:
1. **Kiểm tra định dạng file**:
   - ✅ Phải là `.csv` (không phải `.xlsx`, `.xls`, `.txt`)
   - Nếu dùng Excel, chọn **File** → **Save As** → **CSV (Comma-delimited)**

2. **Kiểm tra nội dung**:
   - Mở file bằng **Notepad** hoặc **Excel**
   - Đảm bảo có dữ liệu (không trống)
   - Đảm bảo header (dòng đầu) đúng

3. **Nếu vẫn lỗi**:
   - Copy dữ liệu sang file CSV mới
   - Thử upload lại

---

### Q7: Tôi là GDDA, tại sao không thấy danh sách dự án?

**A**: GDDA chỉ thấy báo cáo lead, không thấy quản lý dự án.

**Quyền GDDA**:
- ✅ Xem Report Data (báo cáo chi tiết lead)
- ❌ Không thấy danh sách dự án
- ❌ Không upload CSV
- ❌ Không sửa campaign

---

### Q8: Số Lead trên Dashboard tổng quan khác số Lead trên Report?

**A**: **Dashboard Tổng quan** show tổng tất cả lead, **Report** show lead đã match tên.

**Lý do**: Không phải lead nào cũng match được trong Bitrix (tên khác, tên viết tắt, v.v.).

---

### Q9: Làm sao để cập nhật ngân sách dự án?

**A**: 
1. **Vào dự án** → **Click nút "⚙️ Sửa"** (góc trên phải)
2. **Cập nhật trường "Ngân sách"**
3. **Click "Lưu"**

Hoặc upload **Chi phí CSV** để dashboard tự tổng hợp.

---

### Q10: Tôi muốn xóa một dự án?

**A**: Chỉ **Admin** mới có quyền xóa dự án (qua Database).

Liên hệ Admin nếu muốn xóa dự án test.

---

## Mẹo sử dụng

### ⚡ Mẹo 1: Upload theo thứ tự

Upload theo thứ tự này để dữ liệu đầy đủ:

1. **Facebook CSV** (lead source)
2. **Bitrix CSV** (cập nhật stage, nhân viên)
3. **Chi phí CSV** (track ROI)

---

### ⚡ Mẹo 2: Sắp xếp bảng

Hầu hết bảng đều có thể click header để **sắp xếp**:
- Click **"Chi phí"** → sắp xếp theo chi phí (tăng/giảm)
- Click **"Lead"** → sắp xếp theo số lead

---

### ⚡ Mẹo 3: Lọc Campaign

Ở **Phân tích Campaign**, bạn có thể:
- Chọn **thời gian khác nhau** để so sánh
- **Lọc theo dự án** (nếu có quyền)

---

### ⚡ Mẹo 4: Hỏi AI

Thay vì đọc bảng số liệu dài dòng, **hỏi AI** để có câu trả lời nhanh:
- "Campaign nào hiệu quả nhất tuần này?"
- "Có bao nhiêu lead chuyển thành deal?"
- "Nhân viên nào best performer?"

---

### ⚡ Mẹo 5: Đồng bộ định kỳ

**Cập nhật CSV định kỳ** (ít nhất tuần 1 lần):
- **Thứ Hai sáng**: Upload Facebook CSV (tóm tắt tuần)
- **Thứ Sáu tối**: Upload Bitrix CSV (giai đoạn được cập nhật)
- **Cuối tháng**: Upload Chi phí CSV

Dashboard sẽ luôn có dữ liệu mới nhất! 📊

---

## Liên hệ hỗ trợ

Nếu gặp vấn đề:

| Vấn đề | Liên hệ |
|--------|--------|
| Upload lỗi, dữ liệu không cập nhật | webdev@smartland.vn |
| Không truy cập được dashboard | webdev@smartland.vn |
| Cần tạo dự án mới | Admin (hoặc webdev@smartland.vn) |
| Cần gán quyền dự án | Admin (hoặc webdev@smartland.vn) |
| Câu hỏi về dữ liệu, báo cáo | Hỏi AI Analyst hoặc liên hệ Admin |

---

**Chúc bạn sử dụng dashboard vui vẻ! 🚀**
