# CloudSewa

CloudSewa is a full-stack business document management system. It lets an organization upload, organise, version, tag, share, trash/restore, and back up files with team authentication, per-user storage quotas, AES-256 at-rest encryption, SHA-256 integrity verification, notifications, and an admin panel.

## Tech Stack

- **Backend:** Node.js, Express 5, MongoDB (Mongoose 9), JSON Web Token auth, bcrypt, multer
- **Frontend:** React 18, Vite, vanilla CSS, react-router-dom 6, axios, react-dropzone
- **Storage:** local filesystem (`STORAGE_MODE=local`) or Amazon S3 (`STORAGE_MODE=s3`); backups mirrored to S3 when configured
- **File security:** AES-256 encryption at rest, SHA-256 integrity hashing, encrypted admin password storage (bcrypt cost 12)

## Features

- **Authentication & accounts** — self-registration with **admin approval workflow** (pending → approved/rejected with reason), forgot-password + reset flow with status tracking, account lockout after 5 failed attempts, JWT auth invalidated on password change, per-user storage quotas.
- **File management** — upload/download/preview, drag-and-drop with upload queue, rename, move between folders, per-file tags and tag filters, folder colours, folder tree with drive-style tiles, breadcrumb navigation.
- **Starred & Recent** views, plus search across files/folders.
- **Versions** — up to 3 versions per file, restore any version, delete individual versions, stable version numbers, identical-content dedup.
- **Sharing** — share files with team members, "Shared With Me" section.
- **Trash** — soft-delete, per-item restore, and permanent delete for files and whole folder trees; auto-purge after 30 days.
- **Backups** — ad-hoc + scheduled system/user backups (daily 03:00), retention policy, restore from archive with mimetype preservation, downloads, S3 mirror.
- **Admin panel** — user management (create/edit/deactivate/delete), pending & rejected registration handling, reset-password requests, storage overview per user, system statistics.
- **Audit trail** — full ActivityLog of user/system actions with filters.
- **Notifications** — in-app bell with unread counts, read/unread state, actionable links.
- **Responsive UI** — sidebar, dark/light theme, works from desktop down to mobile widths (verified no horizontal overflow at all breakpoints).

## Project Structure

```
backend/    Express API: routes, controllers, models, middleware, scheduler, utils
frontend/   React SPA: pages, components, contexts, hooks, utils
backend/uploads/   Uploaded file blobs (local storage mode)
backend/backups/   Backup archives (local storage mode)
```

## Environment

Copy `backend/.env.example` to `backend/.env` and set:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Token signing secret |
| `CLIENT_URL` | Frontend origin — used for CORS (required; app refuses to start without it) |
| `STORAGE_MODE` | `local` or `s3` |
| `AWS_*` | S3 credentials/bucket when `STORAGE_MODE=s3` |
| `EMAIL_HOST` | SMTP settings; leave blank for an Ethereal test inbox (logs preview URLs) |

Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL` (backend API base URL; baked into the bundle at build time).

The first registered user becomes the admin automatically. Subsequent registrations must be approved by an administrator before signing in.

## Run Locally

Prerequisites: Node.js 18+, MongoDB.

```bash
# Backend (port 5000)
cd backend
npm install
npm start          # production-style; avoids nodemon watching uploads/backups

# Frontend (port 5173)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Build the frontend for production:

```bash
cd frontend
npm run build      # outputs to frontend/dist
```

## Deployment

See [AWS-DEPLOYMENT.md](./AWS-DEPLOYMENT.md) for a full EC2 + S3 + nginx + systemd deployment guide, including backup durability and fail-fast configuration validation.