# Smart Food Delivery & Spoilage Prevention System
## Comprehensive Technical Study Guide & Architecture Reference

---

## 📌 Table of Contents
1. [Executive Overview & System Architecture](#1-executive-overview--system-architecture)
2. [Hardware & IoT Sensor Subsystem](#2-hardware--iot-sensor-subsystem)
3. [Backend API & Database Architecture](#3-backend-api--database-architecture)
4. [Machine Learning Spoilage Engine](#4-machine-learning-spoilage-engine)
5. [GIS, Navigation & Weather Routing Engine](#5-gis-navigation--weather-routing-engine)
6. [Frontend Dashboard & Visualization](#6-frontend-dashboard--visualization)
7. [Networking, Security & Cloudflare Tunnel](#7-networking-security--cloudflare-tunnel)
8. [Comprehensive Glossary of Technical Terms](#8-comprehensive-glossary-of-technical-terms)

---

## 1. Executive Overview & System Architecture

The **Smart Food Delivery & Spoilage Prevention System** is an end-to-end IoT, Machine Learning, and GIS-enabled logistics platform designed to monitor cold-chain integrity, predict perishable food spoilage in real time, and optimize transit routes against hazardous environmental conditions.

```
+-----------------------------------------------------------------------------------+
|                              SYSTEM ARCHITECTURE                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-------------------+       HTTP POST Telemetry       +-----------------------+  |
|  |   ESP32 IoT Node  | =============================>  | Backend Worker (Hono) |  |
|  |  DHT11, MQ4, MQ135|                                 |   Port 8787 / Node.js |  |
|  |  NEO-6M GPS Module|                                 +-----------+-----------+  |
|  +-------------------+                                             |              |
|                                                                    |              |
|             +----------------------+-------------------------------+              |
|             |                      |                               |              |
|             v                      v                               v              |
|   +-------------------+  +-------------------+           +-------------------+    |
|   |  MySQL Database   |  | ML Spoilage Model |           | Route Weather API |    |
|   |  Port 3306        |  | FastAPI (8001)    |           | FastAPI (8000)    |    |
|   |  Users,Deliveries |  | Random Forest/XGB |           | OSRM + Open-Meteo |    |
|   +-------------------+  +-------------------+           +-------------------+    |
|             ^                                                      |              |
|             |               REST API / JWT Session                 |              |
|             +----------------------+-------------------------------+              |
|                                    |                                              |
|                                    v                                              |
|                      +---------------------------+                                |
|                      |  React + Vite Frontend    |                                |
|                      |  Port 5173 / TailwindCSS  |                                |
|                      +-------------+-------------+                                |
|                                    |                                              |
|                                    v Cloudflare Tunnel (QUIC)                     |
|                      +---------------------------+                                |
|                      |   sfd.mickey.qzz.io       |                                |
|                      +---------------------------+                                |
+-----------------------------------------------------------------------------------+
```

---

## 2. Hardware & IoT Sensor Subsystem

### 2.1 Microcontroller Unit (MCU): ESP32
* **Architecture**: Dual-Core 32-bit Xtensa LX6 microprocessor operating up to 240 MHz.
* **Connectivity**: Built-in 802.11 b/g/n Wi-Fi ($2.4\text{ GHz}$) and Bluetooth v4.2 BR/EDR & BLE.
* **ADC (Analog-to-Digital Converter)**: 12-bit SAR ADC providing 4096 distinct voltage resolution steps ($0 - 3.3\text{V}$), converting raw sensor voltages into digital PPM readings.
* **Firmware Runtime**: Written in C++ using the Arduino Core framework with FreeRTOS multitasking support.

### 2.2 Environmental & Gas Sensors

#### A. DHT11 / DHT22 (Temperature & Humidity Sensor)
* **Principle**: Uses a capacitive humidity sensing element and a Negative Temperature Coefficient (NTC) thermistor.
* **Communication**: Single-bus bi-directional digital proprietary serial protocol (1-wire).
* **Role**: Continuously monitors the ambient thermal environment of the cargo container to detect cold-chain temperature abuse ($>8^\circ\text{C}$ for chilled foods, $>10^\circ\text{C}$ for meat/poultry).

#### B. MQ-4 (Methane $CH_4$ & Natural Gas Sensor)
* **Principle**: Metal Oxide Semiconductor (MOS) composed of Tin Dioxide ($SnO_2$). In clean air, conductivity is low. When combustible decomposition gases (methane) are present, conductivity increases proportionally to gas concentration.
* **Calibration**: Resistance ratio calculation $\frac{R_s}{R_0}$ mapped to PPM using logarithmic slope curves.
* **Role**: Primary chemical indicator of organic decay and anaerobic decomposition ($>25\text{ ppm}$ warning, $>45\text{ ppm}$ critical spoilage).

#### C. MQ-135 (Air Quality & Carbon Dioxide $CO_2$ Sensor)
* **Principle**: Wide-spectrum MOS gas sensor sensitive to Ammonia ($NH_3$), Carbon Dioxide ($CO_2$), Benzene, Alcohol, and Smoke.
* **Role**: Detects aerobic microbial respiration and package hermetic seal breaches ($>1000\text{ ppm}$ threshold).

#### D. NEO-6M GPS Module
* **Principle**: 50-channel u-blox 6 positioning engine with Time-To-First-Fix (TTFF) under 1 second.
* **Protocol**: Transmits standardized **NMEA-0183** sentences (`$GPRMC`, `$GPGGA`) over UART Serial at $9600\text{ baud}$.
* **Role**: Provides real-time latitude, longitude, transit speed, and UTC timestamp coordinates for breadcrumb route tracking and geofencing.

---

## 3. Backend API & Database Architecture

### 3.1 Framework: Hono & Node.js
* **Hono**: Ultrafast, lightweight, TypeScript-first web framework that supports web standards (`Fetch API`, `Request`, `Response`).
* **Middleware Pipeline**:
  * `authMiddleware`: Validates incoming JWT tokens from `Authorization: Bearer <token>` headers.
  * `roleMiddleware`: Enforces Role-Based Access Control (`admin`, `sender`, `driver`).
  * `auditLogger`: Records critical security events in the `security_logs` table.

### 3.2 Database Engine: MySQL 8.0
* **Storage Engine**: `InnoDB` supporting ACID transactions (Atomicity, Consistency, Isolation, Durability), foreign key constraints, row-level locking, and crash recovery.
* **Connection Pooling**: Managed via `mysql2/promise` with configurable pool limits (`10` connections) preventing connection exhaustion under heavy concurrent IoT traffic.
* **Database Tables**:
  1. `users`: Stores user credentials, email, hashed passwords, roles (`admin`, `sender`, `driver`), and status.
  2. `sensor_modules`: Registers IoT hardware modules, device IDs, status (`active`, `maintenance`, `removed`), and assigned drivers.
  3. `deliveries`: Tracks delivery lifecycle (`pending`, `assigned`, `in_transit`, `delivered`, `rejected`), cargo type, origin, destination, and the persistent `route_risk_data` JSON payload.
  4. `sensor_data`: High-volume time-series telemetry table storing temperature, humidity, methane PPM, CO2 PPM, GPS coordinates, and spoilage risk assessments.
  5. `spoilage_predictions`: Historical record of ML predictions, remaining shelf-life hours (`spoil_in`), and anomaly flags.
  6. `driver_locations`: Live breadcrumb location points recorded during transit.
  7. `system_settings`: Key-value pairs for global operational configurations.

### 3.3 Security & Cryptography
* **Password Hashing**: **PBKDF2** (Password-Based Key Derivation Function 2) using `HMAC-SHA256` with $100,000$ iterations and a cryptographically random 16-byte salt:
  $$\text{Hash} = \text{PBKDF2}(\text{PRF}=\text{HMAC-SHA256}, \text{Password}, \text{Salt}, c=100000, dkLen=32)$$
* **Authentication**: **JSON Web Tokens (JWT)** signed with `HS256` (HMAC-SHA256), encapsulating user identity, role, and expiration timestamp ($24\text{ hours}$).

---

## 4. Machine Learning Spoilage Engine

### 4.1 Architecture & Pipeline
Served via **FastAPI** (`http://127.0.0.1:8001/predict`) utilizing pre-trained scikit-learn and XGBoost pipelines.

```
+-----------------------------------------------------------------------------------+
|                             ML PREDICTION PIPELINE                                |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Input Features]                                                                 |
|  - Temperature (°C)       - CO2 Concentration (PPM)                               |
|  - Humidity (%)           - Elapsed Storage Duration (Days)                       |
|  - Methane Gas (PPM)      - Estimated Transit Time (Hours)                        |
|  - Food Category (Chicken, Apple, Fish, Milk, Meat, etc.)                         |
|                                                                                   |
|                                     │                                             |
|                                     ▼                                             |
|  [Feature Preprocessing]                                                          |
|  - One-Hot Categorical Encoding for Food Item                                     |
|  - Standard Scaling / Normalization for Telemetry Metrics                         |
|                                                                                   |
|                                     │                                             |
|                                     ▼                                             |
|  [Ensemble Model Classification: Random Forest & XGBoost]                         |
|  - 100+ Decision Trees evaluating non-linear temperature & gas cross-effects       |
|                                                                                   |
|                                     │                                             |
|                                     ▼                                             |
|  [Outputs Generated]                                                              |
|  1. Risk Classification: SAFE | LOW | MODERATE | CRITICAL                         |
|  2. Spoilage Probability: 0.00 to 1.00 (e.g. 0.85 -> 85%)                        |
|  3. Shelf-Life Remaining (spoil_in): Estimated hours before cargo reaches unsafe  |
|     bacterial/decomposition threshold                                             |
+-----------------------------------------------------------------------------------+
```

### 4.2 Spoilage Kinetics & Mathematical Modeling
Food spoilage rates follow the **Arrhenius Reaction Rate Law** and exponential bacterial growth kinetics:

$$k = A \cdot e^{-\frac{E_a}{R \cdot T}}$$

Where:
* $k$ = Spoilage reaction rate constant
* $A$ = Pre-exponential frequency factor
* $E_a$ = Activation energy of microbiological degradation
* $R$ = Universal gas constant ($8.314\text{ J/(mol}\cdot\text{K)}$)
* $T$ = Absolute temperature in Kelvin

When temperatures exceed the cold-chain limit ($4^\circ\text{C} - 8^\circ\text{C}$), reaction rate $k$ increases exponentially, accelerating protein denaturation and microbial gas emissions ($CH_4, CO_2$).

---

## 5. GIS, Navigation & Weather Routing Engine

### 5.1 Open Source Routing Machine (OSRM)
* **Algorithm**: Employs **Contraction Hierarchies (CH)** on OpenStreetMap road network graphs to compute optimal driving paths, distance in kilometers, and duration in seconds with sub-millisecond query performance.
* **Delay Buffer Factor**: Applies a $+20\%$ transit buffer multiplier to account for real-world heavy vehicle highway speed limits, toll delays, and driver rest halts:
  $$\text{Estimated Transit Time} = \text{OSRM Base Duration} \times 1.20$$

### 5.2 Open-Meteo High-Resolution NWP API
* **Data Sources**: Integrated meteorological models including ECMWF IFS ($9\text{ km}$), GFS ($13\text{ km}$), and ICON ($11\text{ km}$).
* **Hourly Interpolation**: For every sampled route waypoint, queries the arrival timestamp to extract:
  * Surface Temperature ($2\text{m}$)
  * Relative Humidity ($2\text{m}$)
  * Precipitation Probability ($0 - 100\%$)
  * Wind Speed at $10\text{m}$ ($km/h$)

### 5.3 High-Speed Village & Mandal Reverse Geocoding
* **Engine**: Queries high-speed reverse geocoding endpoints and parses administrative hierarchy levels:
  * `adminLevel >= 6`: Local Village, Town, or Mandal Name
  * `adminLevel 5`: Administrative District Name
* **Concurrency**: Utilizes Python `ThreadPoolExecutor` to reverse geocode and fetch weather forecasts for all waypoints concurrently in parallel ($<200\text{ms}$ total response time).
* **Single-Fetch Database Caching**: Persists the complete route risk payload inside `deliveries.route_risk_data` upon delivery creation, preventing redundant weather API calls during live delivery execution.

---

## 6. Frontend Dashboard & Visualization

### 6.1 React 18 & Vite 6
* **React 18**: Uses concurrent rendering, functional components, and strict state management (`useState`, `useEffect`, `useCallback`, `useMemo`).
* **Vite 6**: Fast frontend tooling powered by native ES modules (ESM) and Rollup bundling.

### 6.2 Styling: TailwindCSS & Modern UI Design
* **Design System**: Glassmorphism (`backdrop-blur-md`), dark mode slate palettes (`slate-900`, `slate-950`), custom responsive card grids, and semantic risk badges (`emerald` for safe, `amber` for moderate, `rose` for critical).
* **Visual Iconography**: Lucide React SVG icon set.

### 6.3 Real-Time Visualizations
* **Recharts / TelemetryMultiChart**: Synchronized multi-metric time-series area charts displaying live trends for Temperature, Humidity, Methane PPM, and CO2 PPM.
* **Leaflet & React-Leaflet**: Interactive map rendering live driver GPS positions, route polylines, departure origin, intermediate village waypoints, and final destination pins.

---

## 7. Networking, Security & Cloudflare Tunnel

### 7.1 Cloudflare Tunnel (`cloudflared`)
* **Mechanism**: Creates an encrypted outbound-only connection between the local machine and Cloudflare's global edge network via **QUIC (HTTP/3)** and **HTTP/2**.
* **Zero Trust Benefits**:
  * No need to open inbound firewall ports or configure router port forwarding.
  * Masks local server IP address behind Cloudflare DDoS protection and Anycast DNS (`sfd.mickey.qzz.io`).
  * Automatic SSL/TLS certificate termination.

### 7.2 Vite Development Proxy
* Configured in [`frontend/vite.config.ts`](file:///c:/hackthon/frontend/vite.config.ts) with `host: '0.0.0.0'` and `allowedHosts: ['sfd.mickey.qzz.io', '.qzz.io', 'localhost', '127.0.0.1']`.
* Automatically proxies all `/api/*` network requests arriving from the public internet to the local Hono backend running on port `8787`.

---

## 8. Comprehensive Glossary of Technical Terms

| Term | Category | Detailed Definition |
| :--- | :--- | :--- |
| **ADC** *(Analog-to-Digital Converter)* | Hardware | An electronic circuit inside the ESP32 that converts continuous analog voltage signals from gas sensors into discrete digital numerical values ($0 - 4095$). |
| **Arrhenius Equation** | Science/ML | A mathematical formula describing how chemical reaction rates and microbial food spoilage accelerate exponentially with increasing temperature. |
| **Cold Chain** | Logistics | A temperature-controlled supply chain that guarantees perishable goods are continuously kept within strict temperature ranges from origin to consumer. |
| **Contraction Hierarchies (CH)** | GIS/Routing | A graph preprocessing technique used by OSRM that accelerates shortest-path calculations on highway networks by thousands of times. |
| **FreeRTOS** | Hardware | A real-time operating system kernel designed for embedded microcontrollers that manages concurrent execution of sensor reading and Wi-Fi transmission tasks. |
| **Geofencing** | GIS | A virtual geographic boundary defined around a delivery route or location that triggers alerts when a driver enters or departs. |
| **Glassmorphism** | UI/UX | A modern UI design trend featuring translucent frosted-glass backgrounds (`backdrop-filter: blur`), subtle borders, and layered depth. |
| **Hono** | Backend | A lightweight, ultrafast TypeScript web framework built on web standard Fetch APIs, known for low memory footprint and sub-millisecond routing. |
| **InnoDB** | Database | The default transactional storage engine for MySQL that provides ACID compliance, foreign keys, row-level locking, and crash safety. |
| **JWT** *(JSON Web Token)* | Security | A compact, URL-safe standard (`RFC 7519`) for transmitting digitally signed claims (user ID, role) between client and server. |
| **MOS Sensor** | Hardware | Metal Oxide Semiconductor gas sensor (e.g. MQ-4, MQ-135) whose electrical resistance changes when exposed to reducing or oxidizing gases. |
| **NMEA-0183** | Hardware/GPS | A standardized ASCII serial communication specification used by GPS receivers (e.g. NEO-6M) to transmit positioning, speed, and time data. |
| **NWP** *(Numerical Weather Prediction)* | Weather/GIS | Mathematical atmospheric computer models (such as ECMWF, GFS, ICON) that simulate and forecast future weather variables. |
| **PBKDF2** | Security | A key derivation function that repeatedly hashes passwords with a salt and $100,000$ iterations to defend against dictionary and brute-force attacks. |
| **PPM** *(Parts Per Million)* | Chemistry | A unit of measurement representing the concentration of a gas (1 PPM = 1 milligram of substance per kilogram or $1\text{ ml}$ per $1\text{ m}^3$). |
| **QUIC** | Networking | A modern UDP-based transport protocol developed by Google that reduces latency and provides built-in TLS 1.3 encryption for Cloudflare Tunnels. |
| **Random Forest** | ML/AI | An ensemble learning algorithm that constructs dozens of decision trees during training and outputs the mode/mean class prediction to prevent overfitting. |
| **RBAC** *(Role-Based Access Control)* | Security | An authorization pattern that restricts system capabilities and API endpoints based on user roles (`admin`, `sender`, `driver`). |
| **Reverse Geocoding** | GIS | The process of converting geographic coordinates (latitude, longitude) into readable human addresses, village names, and administrative districts. |
| **SHAP** *(SHapley Additive exPlanations)* | ML/AI | A game-theoretic approach used to explain the output of machine learning models by calculating the exact contribution of each sensor feature to the spoilage risk score. |
| **Spoil In** | Domain Metric | The calculated remaining shelf-life window (in hours) before perishable food exceeds safe edible thresholds. |
| **UART** | Hardware | Universal Asynchronous Receiver-Transmitter; a hardware serial communication protocol used to transfer data between the GPS module and ESP32. |
| **Vite** | Frontend | A modern frontend build tool that leverages native ES modules for instant Hot Module Replacement (HMR) and optimized Rollup production builds. |
| **XGBoost** | ML/AI | Extreme Gradient Boosting; an optimized distributed gradient boosting library providing high predictive accuracy for tabular time-series data. |

---
*Created for the Smart Food Delivery & Spoilage Prevention System Hackathon Project.*
