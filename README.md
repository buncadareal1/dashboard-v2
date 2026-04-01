# SmartLand AI — Marketing Dashboard

Hệ thống quản lý và phân tích chiến dịch quảng cáo Facebook Ads, tích hợp Bitrix24 CRM và AI Gemini.

## Tính năng chính

- **Bảng điều khiển** — KPIs, biểu đồ, phễu chuyển đổi, đồng bộ Facebook + Bitrix24
- **Chiến dịch** — Phễu drop-off, bảng chi tiết, drill-down từng campaign
- **Báo cáo** — Charts từ dữ liệu thật, so sánh kỳ, xuất CSV
- **Khách hàng** — Kéo leads từ Bitrix24 CRM, thống kê theo campaign, tỷ lệ chốt
- **Quản lý người dùng** — CRUD, phân quyền tài khoản/bảng tính
- **Kết nối API** — Facebook Ads + upload CSV
- **AI phân tích** — Gemini/Claude/GPT nhận xét chiến dịch, fallback rule-based
- **Quy tắc AI** — Tạo rules tự động pause/scale campaigns
- **Nhật ký hoạt động** — Ghi lại mọi thao tác
- **Google OAuth** — Đăng nhập bằng email công ty (@smartland.vn, @smartrealtors.vn)

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Vue 3, Pinia, Vue Router, Tailwind CSS, PrimeVue, ApexCharts |
| Backend | Python, FastAPI, SQLAlchemy, JWT, bcrypt |
| CRM | Bitrix24 REST API |
| AI | Google Gemini / OpenAI GPT / Anthropic Claude |
| Database | SQLite (dev) / PostgreSQL (production) |
| Deploy | Docker, Nginx, Gunicorn |

## Cài đặt Local

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Sửa .env: thêm GOOGLE_CLIENT_ID, GEMINI_API_KEY, SECRET_KEY
python main.py
```

Backend chạy tại `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:5173`

## Deploy Production (Docker)

```bash
# Sửa backend/.env trước
chmod +x deploy.sh
./deploy.sh
```

Truy cập: `http://YOUR_VPS_IP`

## Cấu hình .env

| Biến | Mô tả |
|------|-------|
| `SECRET_KEY` | JWT signing key (tạo: `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_ALLOWED_DOMAINS` | Domain email cho phép đăng nhập |
| `GEMINI_API_KEY` | Google Gemini API key |
| `DATABASE_URL` | SQLite hoặc PostgreSQL URL |
| `ALLOWED_ORIGINS` | CORS origins |
| `AVG_ORDER_VALUE` | Giá trị đơn hàng trung bình (VNĐ) |

## Cấu trúc thư mục

```
├── backend/
│   ├── main.py              # FastAPI app + 30+ endpoints
│   ├── models.py            # SQLAlchemy models
│   ├── security.py          # JWT + Google OAuth
│   ├── bitrix24.py          # Bitrix24 CRM integration
│   ├── ai_analyzer.py       # AI analysis (Gemini/GPT/Claude)
│   ├── sheets_api.py        # CSV parser (multi-format)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── views/           # 14 trang
│   │   ├── stores/          # Pinia state (auth, appData, ui)
│   │   ├── layouts/         # MainLayout (sidebar, header)
│   │   └── router/          # Routes + auth guard
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── deploy.sh
```

## License

Private — SmartLand & SmartRealtors © 2026
