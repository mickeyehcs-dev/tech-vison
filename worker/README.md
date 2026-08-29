# ⚡ Smart Food Delivery Worker API

High-performance REST API built with Hono and Node.js (or Cloudflare Workers) backed by MySQL.

---

## 🛠️ Commands

### 1. Deploy Database Schema & Seed Data
```powershell
npm run db:deploy
```
Connects to MySQL using credentials in `.env`, creates `smart_food_delivery`, runs `schema.sql`, and creates demo records.

### 2. Start API Server (Development / Node Mode)
```powershell
npm run start
```
Starts the API server on `http://0.0.0.0:8787` (listening on all local and network interfaces).

### 3. Verify TypeScript Types
```powershell
npm run build
```

---

## 📡 Key REST Endpoints

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/login` - User login with JWT token generation
- `POST /api/v1/auth/logout` - Invalidate session
- `GET /api/v1/auth/me` - Fetch authenticated user profile

### Deliveries (`/api/v1/deliveries`)
- `GET /api/v1/deliveries` - List deliveries (filterable by role, status, search)
- `POST /api/v1/deliveries` - Create delivery (Sender)
- `GET /api/v1/deliveries/:id` - Delivery detail with latest sensor readings
- `PATCH /api/v1/deliveries/:id/assign` - Assign driver and IoT hardware (Admin)
- `PATCH /api/v1/deliveries/:id/status` - Transition delivery state (`accepted`, `in_transit`, `completed`, `cancelled`)

### IoT Sensor Telemetry (`/api/v1/sensors`)
- `POST /api/v1/sensors/data` - High-frequency telemetry ingestion from ESP32/Arduino hardware
- `GET /api/v1/sensors` - List sensor hardware inventory & live online status
- `POST /api/v1/sensors` - Register new sensor unit and generate API key

### Route & Weather Risk (`/api/v1/route-risk`)
- `POST /api/v1/route-risk/assess` - Proxy route weather risk analysis
- `GET /api/v1/route-risk/delivery/:id` - Dynamic route analysis for active consignment

### Public Tracking (`/api/v1/public/track/:code`)
- `GET /api/v1/public/track/:code` - Unauthenticated public tracking data
