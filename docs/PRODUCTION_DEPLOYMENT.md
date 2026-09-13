# Production Deployment — Render

## Topology

```
Render Static Site          Render Web Service
┌─────────────────┐         ┌──────────────────────────────┐
│  Frontend       │         │  Backend (Docker)            │
│  Vite build     │ ──API──▶│  Express :3000               │
│  dist/          │ ──SSE──▶│  SSE /notifications/stream   │
└─────────────────┘         └──────────┬───────────────────┘
                                       │
                                ┌──────┴──────────┐
                                │  Render Postgres │
                                └─────────────────┘
                                       │
                           ┌───────────┴────────────┐
                           │  AWS S3 + CloudFront   │
                           └────────────────────────┘
```

Two Render services: one Static Site (frontend), one Web Service (backend Docker).

---

## Critical: Vite proxy is dev-only

`vite.config.ts` proxy only activates during `pnpm dev`. The production build (`pnpm build`) compiles static HTML/JS/CSS — no proxy, no server.

In dev, relative `/api/...` URLs go through the Vite proxy to `localhost:3000`.
In production, the same relative URL would hit `https://your-frontend.onrender.com/api/...` — the frontend static site, which returns 404.

**Fix**: use `VITE_API_URL` env var in every API call and EventSource.

```typescript
// src/lib/api.ts (or wherever you set up fetch/axios base URL)
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

// Usage:
fetch(`${API_BASE}/api/questions/generate`, { credentials: "include" });
new EventSource(`${API_BASE}/api/notifications/stream`, { withCredentials: true });
```

| Environment | `VITE_API_URL` value | Result |
|-------------|----------------------|--------|
| Dev (localhost) | `` (empty / unset) | relative URL → Vite proxy → `localhost:3000` |
| Production | `https://your-backend.onrender.com` | absolute URL → Render backend |

No changes to `vite.config.ts` needed for production. The proxy config is harmless — it simply never runs.

---

## SSE on Render — known issues

### Issue 1: Request timeout cuts SSE connections

Render's reverse proxy enforces a **55-second idle timeout** on all HTTP connections (free and paid plans). An SSE connection that receives no data for 55 seconds is terminated by Render — not by the browser or Express.

**Fix already in place**: `SseNotificationService` sends a `: ping` comment every **25 seconds**, well under the 55-second limit. The `X-Accel-Buffering: no` header is also set to prevent nginx from buffering the stream.

The client (`EventSource`) automatically reconnects when the server closes the connection. This is expected behavior on Render.

### Issue 2: CORS with credentials (cross-origin SSE)

Because the frontend and backend are on different `.onrender.com` subdomains, all requests are cross-origin. `EventSource` with `withCredentials: true` requires:

1. `Access-Control-Allow-Origin` set to the **exact** frontend URL (not `*`)
2. `Access-Control-Allow-Credentials: true`
3. Auth cookie with `SameSite=None; Secure` (already done per `auth controller` commit)

**Backend `CORS_ORIGIN` must be set** to the exact frontend URL. Multiple origins → comma-separated list.

```
CORS_ORIGIN=https://your-frontend.onrender.com
```

### Issue 3: Free plan sleep

Render free Web Services sleep after 15 minutes of inactivity. An SSE connection does NOT count as activity — the heartbeat pings go outbound, but Render looks at inbound requests. Upgrade to a paid instance to avoid spin-down.

---

## Backend env vars — Render Web Service

Set these in **Render → your service → Environment**.

### Required (no defaults)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Use Render Postgres internal URL for same-region |
| `JWT_SEED` | random 64-char string | `openssl rand -hex 32` |
| `GEMINI_API_KEY` | your Gemini key | Google AI Studio |
| `CORS_ORIGIN` | `https://your-frontend.onrender.com` | exact match, no trailing slash; comma-separated list allowed |

### Image storage (optional — question images are skipped when unset)

| Variable | Value | Notes |
|----------|-------|-------|
| `AWS_ACCESS_KEY_ID` | IAM long-term key (AKIA…) | NOT session key (ASIA…) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret | |
| `AWS_BUCKET` | `material-engagement-images` | |
| `CLOUDFRONT_DOMAIN` | `https://d3f9588bi29pky.cloudfront.net` | must include `https://`, no trailing slash |

### Optional (safe defaults built in)

| Variable | Default | Override when |
|----------|---------|---------------|
| `PORT` | `3000` | Render sets this automatically — do NOT set manually |
| `GEMINI_CHAT_MODEL` | `gemini-3.6-flash` | switching model |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` | switching model |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | |
| `GEMINI_EMBEDDING_DIMENSIONS` | `768` | must match stored vectors |
| `SESSION_TTL_HOURS` | `24` | JWT expiry and auth cookie Max-Age |
| `QUESTION_MAX_GENERATION_ATTEMPTS` | `3` | lower = faster fail; higher = more retry cost |
| `QUESTION_GENERATION_CONCURRENCY` | `2` | parallel Gemini generations per batch |
| `LAMBDA_TIMEOUT_MS` | `7000` | Lambda + feedback run inside `PATCH /complete` |
| `GEMINI_FEEDBACK_TIMEOUT_MS` | `8000` | |
| `GEMINI_CHAT_TIMEOUT_MS` | `30000` | |
| `GEMINI_EMBEDDING_TIMEOUT_MS` | `15000` | |
| `GEMINI_IMAGE_TIMEOUT_MS` | `60000` | |
| `AWS_REGION` | `us-east-1` | if bucket is in a different region |
| `LAMBDA_URL` | `` (empty) | when Lambda integration is active |
| `RUN_SEED` | `false` | set `true` to run `prisma db seed` on boot (failure does not block startup) |

### Admin bootstrap (needed once — public registration can never create admins)

| Variable | Default | Notes |
|----------|---------|-------|
| `ADMIN_EMAIL` | unset | admin login email |
| `ADMIN_PASSWORD` | unset | ≥ 8 chars, letters and digits only, at least one letter and one digit |
| `ADMIN_NAME` | unset | display name |
| `ADMIN_RESET_PASSWORD` | `false` | `true` overwrites the password of an existing user with `ADMIN_EMAIL` |

The seed skips the admin step (with a log line) when any of the first three is unset. See [Create the first admin](#5-create-the-first-admin).

> **Do NOT set `PORT`** on Render. Render injects it automatically and the app reads it from `envs.PORT`. Setting it manually to a fixed value can cause port mismatch on restarts.

---

## Frontend env vars — Render Static Site

Set these in **Render → your static site → Environment**.

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-backend.onrender.com` |

Vite bakes env vars starting with `VITE_` into the bundle at build time. Changing this value requires a redeploy of the static site.

---

## Render setup — step by step

### 1. Render Postgres

- Dashboard → New → PostgreSQL
- Copy the **Internal Database URL** (starts with `postgresql://`)
- Use it for `DATABASE_URL` on the backend service

### 2. Backend Web Service

- New → Web Service → Connect repo → select backend repo
- **Environment**: Docker
- **Dockerfile path**: `Dockerfile` (root)
- **Region**: same as Postgres
- Add all required env vars from the table above
- Health check path: `/api/health` (returns 200 `{ status: "ok", db: "up" }`, 503 when the database is down)

Render will:
1. Build the Docker image
2. Run `start.sh` which runs `prisma migrate deploy`, runs the seed only when `RUN_SEED=true`, then `node dist/app.js`

> **Data migration `20260913120000_merge_schools_by_institution` is irreversible.** It merges per-level school rows into one row per real school (repointing users and questions) and adds `Question.schoolId`. Take a database backup (Render → Postgres → Backups, or `pg_dump`) **before** deploying a build that contains it. It runs automatically via `prisma migrate deploy`; no manual step is needed. `RUN_SEED=true` afterwards is optional and only refreshes school data.

### 3. Frontend Static Site

- New → Static Site → Connect repo → select frontend repo
- **Build command**: `pnpm install && pnpm build`
- **Publish directory**: `dist`
- Add env var: `VITE_API_URL=https://your-backend.onrender.com`

### 4. Backend CORS

After the frontend is deployed and you have its URL, update `CORS_ORIGIN` on the backend service. Multiple origins (if you have staging + prod):

```
CORS_ORIGIN=https://your-frontend.onrender.com,https://your-staging-frontend.onrender.com
```

### 5. Create the first admin

A fresh database has no admin, and only admins can approve (activate) teacher accounts. Students are active on registration and need no approval.

1. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` on the backend service.
2. Render → backend service → **Shell**, then run:

```
pnpm db:bootstrap-admin
```

This runs only the admin step (no schools re-seed) and is idempotent:

- Unknown email → creates an active ADMIN (birthDate `1970-01-01`, no phone/school/grade).
- Existing email → promotes that user to ADMIN, activates and restores it, and updates the name. The password is kept unless `ADMIN_RESET_PASSWORD=true` (run it once with that, then set it back to `false`).

Alternatively, `RUN_SEED=true` runs the same step at the end of the full seed on boot.

---

## Checklist before first deploy

- [ ] `DATABASE_URL` uses Render internal URL (not external — internal has no egress charges)
- [ ] `CORS_ORIGIN` matches frontend URL exactly (no trailing slash, exact protocol)
- [ ] `CLOUDFRONT_DOMAIN` starts with `https://` and has no trailing slash
- [ ] `AWS_ACCESS_KEY_ID` starts with `AKIA` (long-term), not `ASIA` (session key)
- [ ] `JWT_SEED` is set and matches any existing sessions you want to preserve
- [ ] First admin created with `pnpm db:bootstrap-admin` (Render Shell)
- [ ] Frontend `VITE_API_URL` is set to backend URL (no trailing slash)
- [ ] Auth cookie in frontend code: `credentials: "include"` on all fetch calls
- [ ] `EventSource` uses `${API_BASE}/api/notifications/stream` (not hardcoded localhost)
- [ ] `EventSource` uses `addEventListener("notification", ...)` not `onmessage`

---

## Vite.config — no changes needed for production

For reference, the dev proxy config is safe to keep as-is:

```typescript
// vite.config.ts — this section only runs during `pnpm dev`
server: {
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on("proxyReq", (req) => req.removeHeader("accept-encoding"));
      },
    },
  },
},
```

Nothing in this config is included in the production bundle. You do NOT need a separate `vite.config.prod.ts`.

---

## Quick reference — what breaks in production if missed

| Missed step | Symptom |
|-------------|---------|
| `VITE_API_URL` not set | All API calls return 404 (hitting static site) |
| `CORS_ORIGIN` wrong | 401/CORS error on every API call; SSE never connects |
| `CLOUDFRONT_DOMAIN` without `https://` | `mediaUrl` returns `null` or malformed URL |
| `AWS_ACCESS_KEY_ID` is session key (ASIA…) | S3 uploads fail silently; `mediaUrl` stays null |
| `EventSource` uses `onmessage` | Notifications never appear (named events ignored) |
| `EventSource` URL is `localhost` in prod build | SSE connection refused in browser |
| Cookie without `SameSite=None; Secure` | Auth cookie not sent on cross-origin SSE request |
