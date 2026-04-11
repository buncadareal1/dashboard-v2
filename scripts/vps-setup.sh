#!/bin/bash
##############################################
# VPS Setup Script cho Dashboard Lead BĐS
# Run: ssh root@103.116.52.54
#       curl -sSL https://raw.githubusercontent.com/buncadareal1/dashboard-v2/main/scripts/vps-setup.sh | bash
# Hoặc: copy paste toàn bộ script này vào terminal VPS
##############################################

set -e
echo "=== Dashboard VPS Setup ==="
echo "VPS: $(uname -n) | OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo ""

# 1. Install Node.js 22 LTS
echo "=== 1. Installing Node.js 22 ==="
if command -v node &>/dev/null; then
  echo "Node.js already installed: $(node -v)"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  echo "Node.js installed: $(node -v)"
fi

# 2. Install PostgreSQL
echo ""
echo "=== 2. Installing PostgreSQL ==="
if command -v psql &>/dev/null; then
  echo "PostgreSQL already installed: $(psql --version)"
else
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  echo "PostgreSQL installed: $(psql --version)"
fi

# Setup DB user + database
echo "Setting up database..."
sudo -u postgres psql -c "CREATE USER dashboard WITH PASSWORD 'dashboard_2026';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE dashboard_v2 OWNER dashboard;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dashboard_v2 TO dashboard;" 2>/dev/null || true
echo "Database: dashboard_v2 | User: dashboard"

# 3. Install Redis
echo ""
echo "=== 3. Installing Redis ==="
if command -v redis-cli &>/dev/null; then
  echo "Redis already installed: $(redis-cli --version)"
else
  apt-get install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
  echo "Redis installed: $(redis-cli --version)"
fi

# 4. Install PM2
echo ""
echo "=== 4. Installing PM2 ==="
if command -v pm2 &>/dev/null; then
  echo "PM2 already installed: $(pm2 -v)"
else
  npm install -g pm2
  pm2 startup
  echo "PM2 installed: $(pm2 -v)"
fi

# 5. Install Nginx
echo ""
echo "=== 5. Installing Nginx ==="
if command -v nginx &>/dev/null; then
  echo "Nginx already installed: $(nginx -v 2>&1)"
else
  apt-get install -y nginx
  systemctl enable nginx
  systemctl start nginx
  echo "Nginx installed"
fi

# 6. Install Git
echo ""
echo "=== 6. Installing Git ==="
apt-get install -y git build-essential

# 7. Clone repo
echo ""
echo "=== 7. Cloning repository ==="
APP_DIR="/opt/dashboard-v2"
if [ -d "$APP_DIR" ]; then
  echo "Directory exists, pulling latest..."
  cd "$APP_DIR"
  git pull origin main
else
  git clone https://github.com/buncadareal1/dashboard-v2.git "$APP_DIR"
  cd "$APP_DIR"
fi

# 8. Install dependencies
echo ""
echo "=== 8. Installing dependencies ==="
npm install

# 9. Create .env for API
echo ""
echo "=== 9. Creating .env files ==="
if [ ! -f "$APP_DIR/apps/api/.env" ]; then
  cp "$APP_DIR/apps/api/.env.example" "$APP_DIR/apps/api/.env"
  # Update with local postgres
  sed -i 's|postgresql://dashboard:password@localhost:5432/dashboard_v2|postgresql://dashboard:dashboard_2026@localhost:5432/dashboard_v2|' "$APP_DIR/apps/api/.env"
  echo "Created apps/api/.env — EDIT THIS FILE to add AUTH_SECRET and FB tokens"
else
  echo "apps/api/.env already exists"
fi

# 10. Build API
echo ""
echo "=== 10. Building API ==="
cd "$APP_DIR/apps/api"
npx tsup

# 11. Run DB indexes
echo ""
echo "=== 11. Creating DB indexes ==="
PGPASSWORD=dashboard_2026 psql -h localhost -U dashboard -d dashboard_v2 -f "$APP_DIR/apps/api/src/services/indexes.sql" 2>/dev/null || echo "Indexes may already exist"

# 12. Setup Nginx reverse proxy
echo ""
echo "=== 12. Configuring Nginx ==="
cat > /etc/nginx/sites-available/dashboard-api << 'NGINX'
server {
    listen 80;
    server_name _;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        client_max_body_size 10M;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001;
    }

    # Webhooks (no auth)
    location /api/webhooks/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/dashboard-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "Nginx configured"

# 13. Create PM2 logs directory
mkdir -p "$APP_DIR/apps/api/logs"

echo ""
echo "============================================"
echo "=== SETUP COMPLETE ==="
echo "============================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Edit API env file:"
echo "   nano /opt/dashboard-v2/apps/api/.env"
echo "   → Set AUTH_SECRET (same as Next.js)"
echo "   → Set FB_SYSTEM_USER_TOKEN"
echo "   → Set FB_APP_ID, FB_APP_SECRET, FB_AD_ACCOUNT_ID"
echo ""
echo "2. Start API with PM2:"
echo "   cd /opt/dashboard-v2/apps/api"
echo "   pm2 start ecosystem.config.cjs"
echo "   pm2 save"
echo ""
echo "3. Test:"
echo "   curl http://localhost:3001/health"
echo "   curl http://103.116.52.54/health"
echo ""
echo "4. Set HONO_API_URL on Vercel:"
echo "   vercel env add HONO_API_URL production"
echo "   → http://103.116.52.54"
echo ""
echo "DB: postgresql://dashboard:dashboard_2026@localhost:5432/dashboard_v2"
echo "Redis: redis://localhost:6379"
echo "API: http://103.116.52.54:3001"
echo "Nginx: http://103.116.52.54 (proxy → 3001)"
