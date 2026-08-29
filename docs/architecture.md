# System Architecture Specification

## Smart Food Delivery + IoT + ML Monitoring System

### 1. High-Level Architecture

The system is constructed with a decoupled, modern three-tier architecture:
1. **Frontend**: React + Vite + TypeScript + Tailwind CSS Single Page Application (SPA).
2. **Backend**: Cloudflare Workers REST API (TypeScript + Hono) running on the edge runtime (zero PHP).
3. **Database Layer**: MySQL / MariaDB (hosted via XAMPP for local development, or Cloudflare Hyperdrive / Managed Cloud MySQL in production).

```text
┌─────────────────────────────────────────────────────────────┐
│                      React Application                      │
│ - React Router DOM, Custom Contexts, Reusable Hooks         │
│ - Reusable UI Component System (Atomic Design)              │
│ - Telemetry Visualizations (Recharts) & GPS Map (Leaflet)   │
│ - Portals: Admin, Sender (Merchant), Driver (Mobile Fleet)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST API
┌──────────────────────────────▼──────────────────────────────┐
│                  Cloudflare Worker REST API                 │
│ - Hono Lightweight Edge Framework                           │
│ - WebCrypto PBKDF2 Password Hashing & HS256 JWT Auth        │
│ - Role Guarding & Security Audit Logging                    │
│ - Sensor & Driver GPS Telemetry Ingestion Engine            │
│ - Real-Time Risk & Spoilage ML Inference Service            │
└──────────────────────────────┬──────────────────────────────┘
                               │ Database Abstraction Layer
┌──────────────────────────────▼──────────────────────────────┐
│                    MySQL / MariaDB Database                 │
│ - 11 Production Tables with Indices and Foreign Keys        │
│ - Sensor Readings, Model Predictions, GPS Locations         │
│ - XAMPP (Local Dev) / Managed Cloud MySQL (Production)      │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. Database Schema Model (11 Tables)

1. **`users`**: User identity, roles (`admin`, `sender`, `driver`), credentials (`password_hash`), activation state, `first_login` flag, soft delete timestamp.
2. **`password_setup_tokens`**: Secure tokens for user verification and onboarding flows.
3. **`sensor_modules`**: IoT devices deployed in delivery containers. Stores `device_id` (`SFM-XXXXXXXX`), `api_key_hash`, `status` (`available`, `assigned`, `offline`, `removed`), `last_seen_at`.
4. **`deliveries`**: Delivery lifecycle state machine (`pending`, `assigned`, `accepted`, `in_transit`, `completed`, `cancelled`), food cargo details, pickup origin, destination, timestamps.
5. **`delivery_sensor_assignments`**: Sensor module association history allowing hardware re-use across multiple shipments.
6. **`sensor_logs`**: High-frequency telemetry log containing temperature, humidity, methane decomposition gas, CO2 concentration, storage days, and calculated risk level.
7. **`model_predictions`**: Distinct ML inference storage storing model version (`v1.0.0-spoilage-rf`), spoilage risk score (0–100), risk tier (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and prediction timestamp.
8. **`notifications`**: In-app database alerts for assignments, risk threshold warnings, and milestones.
9. **`security_logs`**: Immutable audit logs capturing logins, mutations, key renewals, and authorization events with IP and user-agent.
10. **`driver_locations`**: Historical GPS coordinate points (`latitude`, `longitude`, `accuracy`, `speed`, `heading`).
11. **`system_settings`**: Global thresholds, cooldowns, and ML parameters.

---

### 3. Delivery Lifecycle State Machine

Valid transitions enforced by the Worker backend:
```text
pending  ──(Admin Assign)──►  assigned  ──(Driver Accept)──►  accepted  ──(Driver Start)──►  in_transit  ──(Driver Complete)──►  completed
   │                             │
   └───(Cancel)──► cancelled ◄───┘
```

When a delivery transitions to `completed` or `cancelled`, the associated sensor module is automatically released and returned to `available` status in an atomic transaction.

---

### 4. Spoilage ML & Anomaly Detection Pipeline

```text
IoT Sensor Device
       │
       ▼ (X-DEVICE-ID & X-API-KEY)
POST /api/v1/sensors/data
       │
       ├─► Store in `sensor_logs` (Raw Telemetry)
       │
       ├─► Risk Engine / ML Model (`RiskService.ts`)
       │     - Evaluates temperature (>10°C warning, >15°C critical)
       │     - Evaluates humidity (>80% warning, >88% critical)
       │     - Evaluates methane gas (>0.02 ppm trace, >0.05 ppm critical)
       │     - Evaluates CO2 concentration (>800 ppm elevated, >1200 ppm critical)
       │     - Storage elapsed days multiplier
       │
       ├─► Store in `model_predictions` (Score: 0 - 100, Level: LOW/MEDIUM/HIGH/CRITICAL)
       │
       └─► Deduplication & Escalation Check
             - Dispatches in-app `SPOILAGE_ALERT` notifications to Admin, Sender, and Driver
```
