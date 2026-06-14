# Deploy

Single Hetzner box, single Node process under PM2 behind nginx, Postgres on the
same box, uploads on Cloudflare R2. This replaces the old Laravel stack in place.

```
internet ──▶ nginx (:443, TLS) ──▶ PM2: cheevo-api (node dist/main.js, :3000)
                                          ├─ Postgres (localhost)
                                          └─ R2 (uploads)  ·  Resend (email)
```

No Redis, no queue workers, no system cron — background jobs and the 5 scheduled
tasks run inside the one process (`@nestjs/event-emitter` + `@nestjs/schedule`).

## Files

| File | Runs as | When |
| --- | --- | --- |
| `provision.sh` | root | once — installs Node/PM2, fresh `cheevo` db, app dir, vhost |
| `deploy.sh` | deploy | every release — pull, build, migrate, reload |
| `decommission-laravel.sh` | root | once — stop Laravel, point nginx at Node |
| `ecosystem.config.js` | — | PM2 process definition |
| `nginx.conf` | — | vhost template (`__DOMAIN__`, `__PORT__`) |

## First deploy

1. **Provision** (root):
   ```bash
   sudo bash deploy/provision.sh
   ```
   Prints the generated `cheevo` Postgres password (also in
   `/root/.cheevo-db-password`). Laravel keeps serving traffic throughout.

2. **Configure** (`deploy` user, in `/var/www/cheevo`): `cp .env.example .env`
   and set at least:
   ```
   NODE_ENV=production
   APP_URL=https://api.cheevo.vip
   WEB_URL=https://cheevo.events
   DATABASE_URL=postgresql://cheevo:<password>@127.0.0.1:5432/cheevo
   APP_KEY=<openssl rand -hex 32>

   STORAGE_DISK=s3
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=cheevo
   S3_ACCESS_KEY_ID=<r2 token key>
   S3_SECRET_ACCESS_KEY=<r2 token secret>
   S3_PUBLIC_URL=https://<your r2 public domain>
   S3_FORCE_PATH_STYLE=true

   MAIL_DRIVER=resend
   RESEND_API_KEY=<key>
   RESEND_WEBHOOK_SECRET=<svix secret>

   PAYSTACK_SECRET_KEY=<live key>
   GIPHY_API_KEY=<key>
   GOOGLE_PLACES_API_KEY=<key>

   ADMIN_BOOTSTRAP_EMAIL=you@example.com
   ```
   `S3_PUBLIC_URL` must be a publicly reachable bucket URL (R2 public dev URL or a
   custom domain) — it's what the apps load images from.

3. **Deploy** (`deploy` user):
   ```bash
   ./deploy/deploy.sh
   ```

4. **Seed** (`deploy` user): reference data + the first admin:
   ```bash
   npm run db:seed
   npm run db:seed:admin
   ```
   The admin then signs in normally via OTP and reaches the web panel.

5. **Cut over** (root): stop Laravel and repoint nginx, then attach TLS:
   ```bash
   sudo bash deploy/decommission-laravel.sh
   sudo certbot --nginx -d api.cheevo.vip --redirect
   curl https://api.cheevo.vip/api/v1/health
   ```

## Redeploys

```bash
ssh deploy@<box> 'cd /var/www/cheevo && ./deploy/deploy.sh'
```

`pm2 startOrReload` restarts the process (brief blip — single instance by design).

## Operations

```bash
pm2 status                 # process state
pm2 logs cheevo-api        # tail logs
pm2 restart cheevo-api     # manual restart
npx prisma migrate status  # migration state
```

## Rollback

```bash
cd /var/www/cheevo
git checkout <previous-sha>
npm ci && npx prisma generate --sql && npm run build
pm2 reload deploy/ecosystem.config.js
```
Migrations are not auto-reverted — only roll code back to a SHA whose migrations
are already applied, or write a down migration.

## Notes

- Private repo: give the `deploy` user a read-only deploy key or token before
  `provision.sh` clones.
- `/docs` (Swagger) is disabled when `NODE_ENV=production`.
- nginx trusts the loopback proxy, so the app sees real client IPs (rate limiter
  + flag rollout depend on this).
- The old `cheevo` database and Laravel app dir are left in place — drop them
  once the new backend is verified.
