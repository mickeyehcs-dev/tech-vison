# 🖥️ Smart Food Delivery Dashboard Frontend

React 18 + Vite + Tailwind CSS dashboard providing responsive, role-based real-time logistics monitoring, cold-chain telemetry graphs, route weather risk analysis, and public tracking.

---

## 🚀 Getting Started

### 1. Install Dependencies
```powershell
cd c:\hackthon\frontend
npm install
```

### 2. Run Development Server
```powershell
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🔑 Role-Based Dashboards & Routing

- **Admin Dashboard (`/admin/overview`)**:
  - Global consignment statistics, active fleet map, user management, and security audit log streams.
- **Sender (Producer) Dashboard (`/sender/overview`)**:
  - Create dispatches, view cold chain degradation metrics, set departure dates, and track assigned drivers.
- **Driver Mobile Dashboard (`/driver/overview`)**:
  - Live route guidance, IoT telemetry readouts (Temp, Humidity, Methane, CO2), GPS status, and trip completion controls.
- **Public Consignment Tracking (`/track/:code`)**:
  - Customer-facing live tracking page showing real-time freshness progress, remaining shelf-life, and route progress without requiring login.

---

## 🎨 Key Features & Charts
- **Recharts Data Visualization:** Real-time multi-metric plots and area charts for Temperature, Humidity, Methane, and CO2 PPM.
- **Vite Proxy:** Pre-configured in `vite.config.ts` to proxy all `/api` requests directly to `http://localhost:8787`.
- **JWT Auth Flow:** Token storage with automatic session verification and redirection.
