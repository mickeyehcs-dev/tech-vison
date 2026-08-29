# Local Development Guide (React + Worker + XAMPP MySQL)

## 1. Prerequisites

1. **Node.js**: v18+ (tested with v24.18.0)
2. **XAMPP**: MySQL/MariaDB service installed and running on port `3306`

---

## 2. Database Setup (XAMPP MySQL)

1. Start **MySQL** from the XAMPP Control Panel.
2. Verify port `3306` is open:
   ```powershell
   Test-NetConnection -ComputerName 127.0.0.1 -Port 3306
   ```
3. Import the complete database schema and admin bootstrap:
   ```powershell
   & "C:\xampp\mysql\bin\mysql.exe" -u root -e "source database/schema.sql"
   ```
4. Verify all 11 tables are initialized:
   ```sql
   SHOW TABLES FROM smart_food_delivery;
   ```

---

## 3. Running the Worker API Backend

In development, the Cloudflare Worker connects to XAMPP MySQL running on `127.0.0.1:3306`.

1. Navigate to the `worker` directory:
   ```bash
   cd worker
   npm install
   ```
2. Start the Worker development server:
   ```bash
   npm run start
   ```
   *The backend starts at `http://localhost:8787`.*

3. Verify backend health endpoint:
   ```bash
   curl http://localhost:8787/health
   ```

---

## 4. Running the React Frontend

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend starts at `http://localhost:5173` with automatic `/api` proxying to `http://localhost:8787`.*

3. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```

---

## 5. Bootstrap Login Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **System Administrator** | `admin@smartdelivery.com` | `AdminPassword123!` |

*(Admins can create new Senders and Drivers from the Manage Users portal. New accounts will automatically trigger the onboarding setup flow upon first sign in).*
