# Mẫu CSV Templates

Thư mục này chứa **3 mẫu CSV** sẵn có để bạn copy và sửa cho phù hợp với dữ liệu của mình.

## 📋 Các file mẫu

### 1. `facebook-sample.csv`

**Dùng cho**: Upload Facebook Lead Ads từ Meta Ads Manager

**Cộc bắt buộc**:
- `Created Time` — Thời gian lead được tạo (dd/MM/yyyy HH:mm)
- `DATE CLEAN` — Ngày đơn giản (dd/MM/yyyy)
- `Full Name` — Họ tên khách hàng
- `Phone` — Số điện thoại
- `Email` — Email khách (tuỳ chọn)
- `Campaign` — Tên chiến dịch quảng cáo
- `Adset` — Tên adset
- `Ad` — Tên quảng cáo cụ thể
- `Form Name` — Tên form lead
- `Lead ID` — ID lead từ Facebook (RẤT QUAN TRỌNG!)

**Cách dùng**:
1. Mở file bằng **Excel** hoặc **Google Sheets**
2. Giữ nguyên header (dòng đầu)
3. Thay thế dữ liệu từ hàng 2 trở đi bằng dữ liệu thực tế
4. Lưu dưới dạng **CSV** (File → Save As → Comma-separated values .csv)
5. Upload vào Dashboard

---

### 2. `bitrix-sample.csv`

**Dùng cho**: Upload dữ liệu lead từ Bitrix CRM

**Cộc bắt buộc**:
- `Lead` — Họ tên khách hàng
- `Stage` — Giai đoạn (F1, Booking, Đang chăm, Deal, v.v.)
- `Responsible` — Nhân viên phụ trách (định dạng: "Tên - Team")
- `Updated Time` — Thời gian cập nhật gần nhất (dd/MM/yyyy HH:mm)
- `Comment` — Ghi chú (tuỳ chọn)

**Lưu ý về Responsible**:
- Phải có định dạng: `"Tên - Team"` (ví dụ: `"Linh - Juno"`)
- Team hợp lệ: **Juno, Neptune, Aura, Virgo**
- Nếu không có team, viết chỉ tên: `"Linh"`

**Cách dùng**:
1. Mở file bằng **Excel**
2. Cập nhật dữ liệu từ hàng 2 trở đi
3. Đảm bảo cột `Responsible` có định dạng `"Tên - Team"`
4. Đảm bảo cột `Stage` khớp với giai đoạn trong Bitrix
5. Lưu dưới dạng **CSV**
6. Upload vào Dashboard

---

### 3. `cost-sample.csv`

**Dùng cho**: Upload chi phí marketing theo ngày

**Cộc bắt buộc**:
- `NGÀY` — Ngày chi (dd/MM/yyyy)
- `CHI TIÊU` — Số tiền VND (ví dụ: `"2.270.065 đ"`)

**Tuỳ chọn**:
- `LEAD` — Số lead của ngày đó
- `F1` — Số F1 của ngày đó
- Các cộc khác bỏ qua

**Định dạng tiền chấp nhận**:
- `2270065` (không dấu)
- `2.270.065` (dấu chấm)
- `"2.270.065 đ"` (có đơn vị)
- `2,270,065` (dấu phẩy)

Dashboard sẽ tự nhận diện!

**Cách dùng**:
1. Mở file bằng **Excel**
2. Cập nhật dữ liệu từ hàng 2 trở đi
3. Cột `NGÀY` phải là `dd/MM/yyyy`
4. Cột `CHI TIÊU` có thể có dấu hoặc không
5. Lưu dưới dạng **CSV**
6. Upload vào Dashboard

---

## 🎯 Quy trình upload

1. **Chuẩn bị dữ liệu**: Copy dữ liệu từ Excel/Google Sheets sang file mẫu
2. **Lưu dưới dạng CSV**: File → Save As → Chọn CSV
3. **Truy cập Dashboard**: https://dashboard-v2-one-vert.vercel.app
4. **Vào chi tiết dự án**: Click tên dự án
5. **Cuộn xuống "Upload CSV"**
6. **Click nút tương ứng**:
   - 📤 Upload Facebook CSV
   - 📤 Upload Bitrix CSV
   - 📤 Upload Chi phí CSV
7. **Chọn file** và **upload**

---

## ⚠️ Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|-----------|-----------------|
| "Thiếu cột Lead ID" | File FB không có Lead ID | Thêm cột Lead ID vào header |
| "Thiếu cột Stage" | File Bitrix không có Stage | Thêm cột Stage vào header |
| "File trống" | CSV không có dữ liệu | Kiểm tra file, đảm bảo có header + ít nhất 1 dòng dữ liệu |
| "Không thể đọc file" | File không phải CSV hoặc bị hỏng | Lưu lại dưới dạng CSV mới |

---

## 💡 Tips

✅ **Giữ header nguyên** — Không sửa tên cộc  
✅ **Kiểm tra định dạng date** — Phải là `dd/MM/yyyy`  
✅ **Không có dòng trống** — Xoá hết dòng trống giữa dữ liệu  
✅ **Upload định kỳ** — Ít nhất 1 lần/tuần để dashboard có dữ liệu mới  
✅ **Kiểm tra lại trước upload** — Mở file CSV bằng Excel để xem lại  

---

## 📖 Tài liệu đầy đủ

Xem file `/USER-GUIDE.md` để hiểu đầy đủ hơn về cách upload và sử dụng Dashboard.

---

**Chúc bạn sử dụng Dashboard vui vẻ! 🚀**
