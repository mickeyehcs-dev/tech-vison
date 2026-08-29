# Food Transport Spoilage & Risk Tracking System
## Real-Time Cold-Chain Telemetry, Route Weather Hazards & ML Spoilage Intelligence

A production-grade, accessible web platform built with **React (Vite + TypeScript)**, **High-Performance REST API Server (TypeScript / Hono / Express)**, and **XAMPP MySQL / MariaDB Database**.

---

## 🌟 System Overview & Core Capabilities

- **Role-Based Portals & Dashboards**:
  - 🛡️ **Admin Portal**: Global logistics metrics, pending shipment assignments, user management (create user with email, activate/deactivate, delete), IoT sensor module management (generate/renew API keys, assign sensors to drivers), and chronological security login audit logs.
  - 📦 **Sender Portal**: Dispatch creation (food name, origin, destination, scheduled departure date/time, optional driver assignment), live active shipment monitoring with driver contact card (phone number, click-to-call), and scrollable delivery history.
  - 🚚 **Driver Portal**: One-touch mobile trip actions (**Accept / Reject Assignment**, **Start Trip** -> initiates transit timer counting elapsed hours, **Complete Delivery**), real-time village-level Leaflet map tracking, and live sensor monitors.
  - 🌐 **Public Live Tracking View (`/track/:code`)**: Shareable link/ID for recipients, clients, or inspectors to view live food temperature, humidity, respiration gases, spoilage risk, driver info, and route weather without logging in.
- **Illiterate-Friendly & Accessible UI**:
  - Color-coded high-contrast safety badges (**Green = Safe / Fresh**, **Amber = Moderate Risk**, **Red = High Spoilage Risk / Critical**).
  - Built-in **Voice Speech Assistant** (`window.speechSynthesis`) to read out food safety status, temperatures, and driver recommendations aloud.
- **Elapsed Storage Duration**:
  - Live timer starts upon driver clicking **"Start Delivery"** (`status = in_transit`).
  - Stored in **Hours** for the user dashboard and converted to **Days** (`hours / 24.0`) when querying the Machine Learning model.
- **Route Travel Risk API Integration**:
  - Replaces old telemetry charts with live route analysis calling `POST /api/analyze`.
  - Displays driving distance (km), travel duration, sampled waypoint weather (temperature, humidity, rain probability, wind speed, risk factors), and overall travel risk score (0-100).
- **Mandatory First-Time Onboarding**:
  - Newly created accounts are prompted on first login to set their permanent password and enter their full name and contact phone number before accessing features.

---

## 🔑 Default Accounts (Ready to Test)

| Role | Email | Default Password | Features Available |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@smartdelivery.com` | `AdminPassword123!` | Global metrics, all deliveries, user management, sensor API keys, security logs |
| **Sender** | `sender@agrofarms.com` | `Sender@123` | Create deliveries, assign drivers, view driver phone, live tracking |
| **Driver** | `driver@fastlogistics.com` | `Driver@123` | Accept/reject deliveries, Start (Transit timer in hours), Complete, Village map |
| **New User** | `newuser@transport.com` | `Welcome@123` | First-time login onboarding flow (prompts name, phone, password) |

---

## 🚀 Quick Start Guide

### 1. Database Setup (XAMPP MySQL)
1. Open **XAMPP Control Panel** and click **Start** next to **MySQL** (port 3306).
2. The backend server **automatically creates the database `smart_food_delivery` and initializes all tables and seed data on startup**!
3. Alternatively, you can import `database/schema.sql` directly into phpMyAdmin (`http://localhost/phpmyadmin`).

### 2. Run the Backend API Server
```powershell
cd c:\hackthon\worker
npm install
npm run start:node
```
*The API runs at `http://localhost:8787` with endpoints for Auth, Deliveries, Route Risk (`/api/analyze`), Public Tracking, and Sensor Ingestion (`/api/v1/sensors/data`).*

### 3. Run the React Frontend
```powershell
cd c:\hackthon\frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

---

## 📡 Sensor Integration Guide (For Hardware / IoT Department)

### Sensor Module Authentication & Telemetry Ingestion
Sensors are assigned directly to **Drivers**. When hardware sends readings, the backend automatically pairs the data to the driver's active `in_transit` delivery.

- **Endpoint**: `POST http://<server-ip>:8787/api/v1/sensors/data`
- **HTTP Headers Required**:
  - `Content-Type: application/json`
  - `X-DEVICE-ID: SFM-7C81A19D` (Device ID generated in Admin Portal)
  - `X-API-KEY: sfm_your_secret_api_key` (API Key generated in Admin Portal)

### Telemetry JSON Payload Format
```json
{
  "temperature": 4.8,
  "humidity": 68.5,
  "methane": 0.015,
  "co2": 480.0,
  "storage_hours": 7.5,
  "storage_days": 0.3125,
  "device_recorded_at": "2026-08-29T14:30:00Z"
}
```

### Successful Response Format (HTTP 200)
```json
{
  "success": true,
  "data": {
    "message": "Telemetry ingested successfully",
    "logId": 48,
    "riskLevel": "LOW",
    "score": 14,
    "status": "Safe",
    "spoilIn": 72.0,
    "deliveryId": 1,
    "violations": []
  }
}
```

### Sample ESP32 / Arduino C++ Code
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://192.168.1.100:8787/api/v1/sensors/data";

const char* deviceId = "SFM-7C81A19D";
const char* apiKey = "sfm_your_secret_api_key";

#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-DEVICE-ID", deviceId);
    http.addHeader("X-API-KEY", apiKey);

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    float methane = (analogRead(34) / 4095.0) * 0.05; // MQ-4 proxy
    float co2 = 400.0 + (analogRead(35) / 4095.0) * 600.0; // MQ-135 proxy

    String payload = "{\"temperature\":" + String(temp) + 
                     ",\"humidity\":" + String(hum) + 
                     ",\"methane\":" + String(methane) + 
                     ",\"co2\":" + String(co2) + "}";

    int httpCode = http.POST(payload);
    Serial.printf("Telemetry sent. Response: %d\n", httpCode);
    http.end();
  }
  delay(5000); // 5-second sampling interval
}
```

---

## 🧠 Machine Learning Model Integration (For ML Department)

The system communicates with your Machine Learning Spoilage Prediction microservice (e.g. Python FastAPI / Flask) by sending real-time environmental telemetry and transit duration in **Days** (`storage_days = hours / 24.0`).

### 1. Request Format (Sent to ML Model)
- **Method**: `POST /api/predict` (or configured `ML_MODEL_URL` in `.env`)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "food_name": "Fresh Cow Milk (Pasteurized 500L)",
  "temperature": 18.2,
  "humidity": 78.5,
  "methane": 0.042,
  "co2": 820.0,
  "storage_days": 0.5208
}
```

### 2. Expected JSON Response Format (Returned by ML Model)
```json
{
  "score": 76.0,
  "risk_level": "HIGH",
  "status": "High Spoilage Risk",
  "spoil_in_hours": 8.5,
  "factors": [
    "Temperature 18.2°C exceeds safety threshold (Optimal: 2-6°C)",
    "Elevated methane and respiration gas (820 ppm CO2)"
  ],
  "recommendations": "CRITICAL: Inspect cooling unit immediately! Cool compartment below 6°C and enable ventilation. Priority unloading advised."
}
```

---

## 🗺️ Route Travel Risk API

The system integrates a rule-based weather and road hazard analyzer for routes across India.

### Call Endpoint
- **Method**: `POST /api/analyze`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "current_location": "Anantapur, Andhra Pradesh, India",
  "destination": "Hyderabad, Telangana, India",
  "departure_date": "2026-08-29",
  "departure_time": "09:30"
}
```

### Response Format
```json
{
  "departure_time": "2026-08-29T09:30:00+05:30",
  "route": {
    "distance_km": 393.9,
    "travel_time_minutes": 429.7
  },
  "locations": [
    {
      "place": "Anantapur, Andhra Pradesh, India",
      "distance_km": 0.0,
      "arrival_time": "2026-08-29T09:30:00+05:30",
      "temperature_c": 31.5,
      "humidity_percent": 62,
      "rain_probability_percent": 15,
      "wind_speed_kmh": 12.5,
      "risk": {
        "level": "low",
        "score": 10,
        "factors": ["no elevated weather threshold met"]
      }
    },
    {
      "place": "Midway Highway Transit Point (km 197)",
      "distance_km": 197.0,
      "arrival_time": "2026-08-29T13:04:00+05:30",
      "temperature_c": 34.2,
      "humidity_percent": 74,
      "rain_probability_percent": 35,
      "wind_speed_kmh": 18.2,
      "risk": {
        "level": "moderate",
        "score": 28,
        "factors": ["elevated ambient temperature (>30°C)", "moderate rain chance"]
      }
    },
    {
      "place": "Hyderabad, Telangana, India",
      "distance_km": 393.9,
      "arrival_time": "2026-08-29T16:39:00+05:30",
      "temperature_c": 30.2,
      "humidity_percent": 70,
      "rain_probability_percent": 20,
      "wind_speed_kmh": 14.0,
      "risk": {
        "level": "low",
        "score": 15,
        "factors": ["no elevated weather threshold met"]
      }
    }
  ],
  "overall_risk": {
    "level": "moderate",
    "score": 28,
    "highest_risk_places": ["Midway Highway Transit Point"],
    "method": "Rule-based weather risk using temperature, humidity, rain probability, and wind speed."
  }
}
```

---

## 📜 License
MIT License. Developed for Smart Food Logistics and Cold-Chain Spoilage Risk Monitoring.
