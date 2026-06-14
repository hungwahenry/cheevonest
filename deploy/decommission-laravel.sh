#!/usr/bin/env bash
set -euo pipefail

# Run as root once the NestJS app is up and seeded. Stops the Laravel stack and
# points the domain at the Node process. Run certbot afterwards to attach TLS.

PHP_VER="8.4"

[[ $EUID -eq 0 ]] || { echo "Run as root."; exit 1; }

echo "== stop Laravel queue workers =="
supervisorctl stop 'cheevo-worker:*' 2>/dev/null || true
rm -f /etc/supervisor/conf.d/cheevo-worker.conf
supervisorctl reread 2>/dev/null || true
supervisorctl update 2>/dev/null || true

echo "== remove Laravel scheduler cron =="
( crontab -l 2>/dev/null | grep -v 'cheevo-api' || true ) | crontab -

echo "== stop php-fpm =="
systemctl disable --now "php${PHP_VER}-fpm" 2>/dev/null || true

echo "== swap nginx vhost: Laravel -> NestJS =="
rm -f /etc/nginx/sites-enabled/cheevo-api
ln -sf /etc/nginx/sites-available/cheevo /etc/nginx/sites-enabled/cheevo
nginx -t
systemctl reload nginx

cat <<'EOF'

✓ Laravel stopped, traffic now proxies to the Node app over HTTP.

  Finish the cutover:
    certbot --nginx -d api.cheevo.vip --redirect
    curl https://api.cheevo.vip/api/v1/health

  The old Laravel app dir and the 'cheevo' database are left untouched —
  drop them once you have verified the new backend.
EOF
