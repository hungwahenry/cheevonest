#!/usr/bin/env bash
set -euo pipefail

# One-time, run as root on the Hetzner box. Idempotent — safe to re-run.
# Sets up everything the NestJS API needs (Node, PM2, a fresh Postgres db, the
# app dir, the nginx vhost) WITHOUT touching the still-running Laravel stack.
# The actual cutover happens later via decommission-laravel.sh.

DOMAIN="api.cheevo.vip"
APP_DIR="/var/www/cheevo"
DEPLOY_USER="deploy"
DB_NAME="cheevo"
DB_USER="cheevo"
NODE_MAJOR="24"
PORT="3000"
REPO="https://github.com/hungwahenry/cheevonest.git"
BRANCH="main"

[[ $EUID -eq 0 ]] || { echo "Run as root."; exit 1; }

export DEBIAN_FRONTEND=noninteractive

echo "== base packages =="
apt-get update
apt-get install -y curl git ca-certificates gnupg ufw fail2ban openssl

echo "== Node ${NODE_MAJOR} (NodeSource) =="
if ! command -v node &>/dev/null || [[ "$(node -v | sed 's/v//;s/\..*//')" != "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo "== PM2 (global) =="
command -v pm2 &>/dev/null || npm install -g pm2

echo "== nginx =="
command -v nginx &>/dev/null || apt-get install -y nginx

echo "== Postgres (expected already installed by the Laravel box) =="
if ! command -v psql &>/dev/null; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
  echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update
  apt-get install -y postgresql-17
fi

echo "== Certbot =="
command -v certbot &>/dev/null || apt-get install -y certbot python3-certbot-nginx

echo "== deploy user =="
if ! id -u "$DEPLOY_USER" &>/dev/null; then
  echo "User '$DEPLOY_USER' is missing — create it (and add its SSH key) before re-running."
  exit 1
fi

install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

echo "== Postgres role + database (fresh, separate from Laravel's) =="
if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -c "CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASS';"
  sudo -u postgres psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
  printf "%s\n" "$DB_PASS" > /root/.cheevo-db-password
  chmod 0600 /root/.cheevo-db-password
fi

PG_CONF="$(sudo -u postgres psql -tA -c "SHOW config_file;")"
if ! grep -q "^timezone = 'UTC'" "$PG_CONF"; then
  echo "timezone = 'UTC'" >> "$PG_CONF"
  systemctl restart postgresql
fi

echo "== clone repo as $DEPLOY_USER =="
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u "$DEPLOY_USER" git clone -b "$BRANCH" "$REPO" "$APP_DIR" || {
    echo "Clone failed. If the repo is private, add a deploy key / token for '$DEPLOY_USER' and re-run."
    exit 1
  }
fi

echo "== nginx vhost (written but NOT enabled — enabled at cutover) =="
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PORT__|$PORT|g" \
    "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/cheevo

echo "== PM2 boot persistence for $DEPLOY_USER =="
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" >/dev/null

echo "== ufw =="
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

DB_PASS_DISPLAY="$(cat /root/.cheevo-db-password 2>/dev/null || echo '(already existed)')"

cat <<EOF

===========================================================
  Provisioning complete (Laravel still serving traffic).
===========================================================
  Postgres db:        $DB_NAME
  Postgres user:      $DB_USER
  Postgres password:  $DB_PASS_DISPLAY
  (also at: /root/.cheevo-db-password)

  Next:
   1. su - $DEPLOY_USER ; cd $APP_DIR
   2. cp .env.example .env && nano .env   (see deploy/README.md)
        DATABASE_URL=postgresql://$DB_USER:<password>@127.0.0.1:5432/$DB_NAME
        NODE_ENV=production  APP_URL=https://$DOMAIN
        STORAGE_DISK=s3 + the R2 keys ; MAIL_DRIVER=resend + RESEND_API_KEY
        ADMIN_BOOTSTRAP_EMAIL=<your email>
   3. ./deploy/deploy.sh
   4. npm run db:seed && npm run db:seed:admin
   5. (root) ./deploy/decommission-laravel.sh
   6. (root) certbot --nginx -d $DOMAIN --redirect
   7. curl https://$DOMAIN/api/v1/health
===========================================================
EOF
