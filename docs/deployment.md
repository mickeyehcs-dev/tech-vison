# Production Deployment Guide

## 1. Production Architecture Overview

In production, the application is deployed to modern cloud infrastructure:

```text
React SPA ──► Cloudflare Pages / Static CDN
                 │
                 ▼ (REST API)
Cloudflare Worker ──► Cloudflare Hyperdrive / Managed Cloud MySQL (e.g. PlanetScale, AWS RDS, TiDB, Aiven)
```

Because the database repository pattern abstracts all SQL queries in `worker/src/db/repositories/`, migrating from local XAMPP MySQL to a managed cloud MySQL requires **only environment variable changes**, with zero alterations to business logic or route controllers.

---

## 2. Deploying Cloudflare Worker

### Step 1: Configure Production Database Connection
Set your cloud database credentials in Cloudflare environment secrets:

```bash
cd worker
npx wrangler secret put DB_HOST
npx wrangler secret put DB_PORT
npx wrangler secret put DB_NAME
npx wrangler secret put DB_USER
npx wrangler secret put DB_PASSWORD
npx wrangler secret put JWT_SECRET
npx wrangler secret put CORS_ORIGIN
```

### Step 2: Deploy Worker
```bash
npx wrangler deploy
```

---

## 3. Deploying React Frontend to Cloudflare Pages

### Step 1: Build the Static Production Bundle
```bash
cd frontend
npm run build
```
*The compiled assets will be in `frontend/dist/`.*

### Step 2: Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name=smart-food-delivery-ui
```

Set the frontend environment variable:
```text
VITE_API_BASE_URL=https://your-worker.your-subdomain.workers.dev/api/v1
```

---

## 4. Production Security Best Practices

1. **HTTPS Enforcement**: Ensure all traffic runs over TLS 1.3.
2. **SameSite Cookies**: Use `SameSite=Lax; Secure; HttpOnly` session tokens.
3. **Database Firewall**: Restrict cloud database access to Cloudflare Workers IP ranges or Hyperdrive endpoints.
4. **IoT API Key Rotation**: Regularly rotate sensor module keys from the Admin Console (`/admin/sensor-modules`).
