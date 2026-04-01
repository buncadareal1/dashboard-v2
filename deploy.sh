#!/bin/bash
# SmartLand AI Dashboard — Deploy Script
# Chạy: chmod +x deploy.sh && ./deploy.sh

set -e

echo "========================================="
echo "  SmartLand AI Dashboard — Deploy"
echo "========================================="

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker chưa được cài. Vui lòng cài Docker trước."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose chưa được cài."
    exit 1
fi

# Kiểm tra .env backend
if [ ! -f backend/.env ]; then
    echo "⚠️  Chưa có backend/.env — tạo từ .env.example..."
    cp backend/.env.example backend/.env
    # Tạo SECRET_KEY ngẫu nhiên
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    sed -i "s/^SECRET_KEY=$/SECRET_KEY=$SECRET/" backend/.env
    echo "✅ Đã tạo backend/.env với SECRET_KEY mới"
    echo "⚠️  Hãy sửa backend/.env để thêm GOOGLE_CLIENT_ID, GEMINI_API_KEY, v.v."
fi

# Tạo thư mục uploads
mkdir -p backend/uploads

# Cập nhật ALLOWED_ORIGINS với IP hiện tại
CURRENT_IP=$(hostname -I | awk '{print $1}')
echo "📡 IP hiện tại: $CURRENT_IP"

# Build và chạy
echo ""
echo "🔨 Building Docker images..."
docker compose build

echo ""
echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "========================================="
echo "  ✅ Deploy thành công!"
echo "========================================="
echo ""
echo "  Frontend: http://$CURRENT_IP"
echo "  Backend:  http://$CURRENT_IP:8000"
echo "  API Docs: http://$CURRENT_IP:8000/docs"
echo ""
echo "  Xem logs: docker compose logs -f"
echo "  Dừng:     docker compose down"
echo "========================================="
