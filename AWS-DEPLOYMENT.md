# CloudSewa — AWS Deployment Guide (EC2, single always-on Ubuntu)

Targets: **EC2 (single Ubuntu, always-on) • S3 for uploads • MongoDB Atlas for the DB (already on AWS infra).**
This matches the app's architecture: the node-cron backup scheduler runs *inside* the backend
process, so a single always-on EC2 is the right fit (multi-instance or serverless would need the
scheduler re-architected).

> Note: this guide was written against the current source in `cloudsewa-src.zip`. After following
> it you'll have a working HTTPS site with S3-backed uploads, Atlas DB, and scheduled backups.

---

## 1. High-level layout

```
Browser
   │ https://<your-domain>
   ▼
CloudFront / ALB (optional) ───► EC2 (Ubuntu, nginx, Node 22 LTS)
                                     │
                                     ├─── backend  : node server.js  (Express :5000)
                                     ├─── frontend : served as static build by nginx (dist/)
                                     ├─── node-cron: backups + retention (inside backend)
                                     └─── local disk: backend/backups/  (backup zips)
                                                    backend/uploads/   (LEGACY local blobs ONLY)
                                     │
        MongoDB Atlas  ◄─────────────  (db `cloudsewa`, allowlist EC2 IP)
        S3 bucket  ◄────────────────  (STORAGE_MODE=s3 → uploads, per-user folder)
```

Decisions locked in for this guide:
- **Hosting:** EC2 single Ubuntu.
- **Storage:** switch to S3 (`STORAGE_MODE=s3`). Uploads go to S3 and survive instance replacement.
- **Database:** keep MongoDB Atlas (zero code change; runs on AWS infra).

---

## 2. What the app currently does vs. what S3 covers — READ THIS FIRST

Read by inspecting `backend/controllers/*.js` and `backend/utils/storageService.js`:

| Feature | Storage used | Survives EC2 replacement? |
|---|---|---|
| File **uploads / download / preview / versions** | `STORAGE_MODE=s3` → S3 bucket (`storageService.js`) | ✅ Yes (S3) |
| **Backup .zip files** (`performBackup`/`performUserBackup`) | written to local `backend/backups/*.zip`, **then mirrored to S3** (`backups/<name>.zip` via `uploadLocalFileToS3`) | ✅ Yes (S3 mirror) |
| **Restore / backup download** | pulls from S3 if the local archive is missing (fallback) | ✅ Yes (S3) |
| **Restore extraction temp dirs** | local disk `backend/backups/restore-*` | transient |
| Legacy blobs from earlier `local` runs | `backend/uploads/` | ❌ No (migrate or accept loss) |

**Backup durability:** since the last update, backup zips are mirrored to S3 as well. When
`STORAGE_MODE=s3` and `AWS_BUCKET_NAME` is set, every completed backup (manual + scheduled) pushes a
copy into the bucket under `backups/<name>.zip`. Restore and backup-download fall back to S3
automatically when the local copy is gone. The mirror is **non-blocking** — an S3 failure logs an
error and notifies admins but never fails the backup itself. So backups now survive instance
replacement. (Local `backend/backups/` is still used as the working copy.)

---

## 3. Prerequisites in AWS

1. **EC2 key pair** — created so you can SSH in.
2. **Security group** for the instance:
   - `22` SSH (from your IP only)
   - `80` HTTP→HTTPS redirect (nginx will handle; open `80`)
   - `443` HTTPS
   - Do **not** open `5000` publicly (nginx proxies to it).
3. **S3 bucket** (name like `cloudsewa-uploads`), **block public access ON**, and an **IAM user**
   with a policy allowing `s3:PutObject/GetObject/DeleteObject/ListBucket` + `GetObject` signed URLs
   on that bucket. Grab the user's **Access Key ID + Secret**.
4. **MongoDB Atlas** (already in use) — in Security → Network Access, **allow the EC2 public IP**
   (or 0.0.0.0/0 for a demo; better to allowlist the instance IP). Keep the connection URI.

---

## 4. Launch EC2

- AMI: **Ubuntu 24.04 LTS** (x86_64), free tier `t2.micro`/`t3.micro` is fine for a demo.
- Root volume: **30 GB gp3** (room for backups/ + logs).
- Security group per §3. Auto-assign public IP: yes.
- Note the **public IPv4** and your **key pair .pem**.

---

## 5. Put the code on the server

You zipped the source with `cloudsewa-src.zip` (excludes `.env`, node_modules, uploads, backups).

```bash
# from your machine, after `chmod 400 key.pem`
scp -i mykey.pem cloudsewa-src.zip ubuntu@<PUBLIC_IP>:~/

# on the server
sudo apt update && sudo apt install -y unzip
mkdir -p ~/app && cd ~/app
unzip -o ~/cloudsewa-src.zip
```

---

## 6. Install Node.js (LTS 22) and deps

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v22.x

# backend deps
cd ~/app/backend
npm ci --omit=dev          # prod deps only (installs nodemon? no — it's a dev dep, fine)

# build frontend
cd ~/app/frontend
npm ci
cp .env.example .env   # then set VITE_API_URL=https://your-domain.com/api BEFORE building
nano .env              # VITE_API_URL is baked into the bundle at build time
npm run build          # produces frontend/dist/
```

---

## 7. Configure the backend environment (`backend/.env`)

Copy `.env.example` to `.env` and fill in:

```bash
cd ~/app/backend
cp .env.example .env
nano .env
```

```dotenv
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/cloudsewa?retryWrites=true&w=majority
JWT_SECRET=<long random string>            # openssl rand -hex 64
JWT_EXPIRE=7d

# ---- storage: switch to S3 ----
STORAGE_MODE=s3
AWS_ACCESS_KEY_ID=<IAM access key>
AWS_SECRET_ACCESS_KEY=<IAM secret>
AWS_REGION=<us-east-1>
AWS_BUCKET_NAME=cloudsewa-uploads

# ---- email (required for backup-complete / password emails to actually send) ----
EMAIL_HOST=<smtp host, e.g. smtp.gmail.com>
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=<app password>
EMAIL_FROM=CloudSewa <your-email@example.com>
ADMIN_EMAIL=your-email@example.com

# ---- frontend origin for CORS ----
CLIENT_URL=https://cloudsewa.example.com
```

> **Never commit `.env`.** It's already excluded from the zip.
> `JWT_SECRET` must be a long random string; `EMAIL_PASS` should be an SMTP **app password**, not
> your login password.

---

## 8. Install & configure nginx (reverse proxy + static frontend + HTTPS)

```bash
sudo apt install -y nginx
```

`/etc/nginx/sites-available/cloudsewa`:

```nginx
server {
    listen 80;
    server_name cloudsewa.example.com;

    # frontend static build
    root /home/ubuntu/app/frontend/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API -> backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 100m;   # match multer 100MB limit
    }

    # health
    location = / { proxy_pass http://127.0.0.1:5000; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cloudsewa /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx
```

HTTPS with certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cloudsewa.example.com   # auto-edit config + schedule renew
```

(The `CLIENT_URL` and browser app should now hit `https://cloudsewa.example.com`.)

---

## 9. Run the backend as a service (systemd)

`/etc/systemd/system/cloudsewa.service`:

```ini
[Unit]
Description=CloudSewa backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/app/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
# Hardening (recommended)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/home/ubuntu/app/backend/uploads /home/ubuntu/app/backend/backups

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cloudsewa
sudo systemctl status cloudsewa        # should be active (running), connected to Mongo
journalctl -u cloudsewa -f             # watch logs
```

> `ProtectSystem=full` needs `ReadWritePaths` because the app writes `backups/*.zip` and
> `uploads/` at runtime.

---

## 10. Verify, end-to-end

1. `curl -s https://cloudsewa.example.com/` → `{"message":"CloudSewa API is running"}`.
2. Register a user in the UI, upload a file → confirm the blob appears in the S3 bucket
   (`aws s3 ls s3://cloudsewa-uploads/ --recursive`).
3. Trigger a manual backup from **Backup Manager** → `.zip` appears in `backend/backups/`.
4. Restore that backup → file versions increment.
5. Let an hourly/daily backup run (or set the cron) → confirmed in `journalctl`.

---

## 11. Scheduler note (cron inside the process)

The backup scheduler (`backend/scheduler/backupScheduler.js`) runs node-cron **inside** the backend.
Because you're on a **single always-on EC2**, this just works. If you later scale to multiple
instances, every box would run the same cron → duplicate backups; you'd then need a separate cron
service or AWS EventBridge → Lambda. Not needed for this single-instance deploy.

---

## 12. Security checklist

- [ ] `.env` never committed; secrets in it + AWS Parameter Store/Secrets Manager if you wire CI.
- [ ] Security group only exposes `22` (your IP), `80`, `443` — not `5000`.
- [ ] JWT_SECRET is long/random; users' files are encrypted with per-file keys (already in app).
- [ ] S3 bucket **block public access**; only the app's IAM keys can read/write.
- [ ] HTTPS enforced via certbot.
- [ ] Keep `npm install -g pm2`? Not required — systemd `Restart=always` handles it.

---

## 13. Database: Atlas vs AWS-native

Minimum-change path used here: **keep MongoDB Atlas** (runs on AWS infra, zero code change).
If the requirement demands the DB managed inside the AWS console, the alternative is
**AWS DocumentDB** (MongoDB-compatible) — but it is *not* 100% wire-compatible (transactions,
some operators/indexes differ), so you'd need to verify every query/aggregation and migrate the
data. For a demo, Atlas is lower risk. The only change vs. today is **allowlisting the EC2 IP** in
Atlas network access.

---

## 14. Datadog-free monitoring / ops

- Health: the `GET /` route responds 200.
- Logs: `journalctl -u cloudsewa -f`.
- Disk: `df -h /` (watch `backups/` growth); retention in the app already clears over-limit backups.
- If you want a heartbeat, add a CloudWatch alarm or a cron `curl` to the health route.
