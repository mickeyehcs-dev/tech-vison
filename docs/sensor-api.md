# IoT Sensor Module & Telemetry API Specification

## 1. Overview

Hardware telemetry sensors (e.g., ESP32, Raspberry Pi, Arduino with DHT22 / MQ-4 / GPS NEO-6M modules) deployed in temperature-controlled delivery containers transmit sensor readings and GPS coordinates to the Backend API via HTTP POST.

Authentication is supported via:
- Request Headers: `X-DEVICE-ID` and `X-API-KEY`
- OR inside the JSON payload: `device_id` and `api_key`

---

## 2. Sensor Ingestion Endpoints

### `POST /api/v1/sensors/data` (or `POST /api/v1/sensors/ingest`)

#### Request Headers:
```http
POST /api/v1/sensors/data HTTP/1.1
Host: localhost:8787
Content-Type: application/json
X-DEVICE-ID: SFM-7C81A19D
X-API-KEY: sfm_9f81a7b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8
```

#### JSON Payload Format:
```json
{
  "temp": 24.5,
  "humidity": 68.2,
  "methane": 0.032,
  "latitude": 13.5560,
  "logitutude": 78.5010
}
```

*(Alternative key variations like `temperature`, `lat`, `longitude`, `lng`, `co2`, `device_id`, `api_key` are also automatically recognized).*

#### Fields Description:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `temp` (or `temperature`) | Number | **Yes** | Cargo temperature in degrees Celsius (°C) |
| `humidity` | Number | **Yes** | Relative humidity percentage (0–100%) |
| `methane` | Number | No | Decomposition gas level in ppm |
| `latitude` (or `lat`) | Number | No | Vehicle GPS Latitude (-90 to +90) |
| `logitutude` (or `longitude`) | Number | No | Vehicle GPS Longitude (-180 to +180) |
| `co2` | Number | No | Carbon dioxide concentration in ppm |
| `device_id` | String | No | Sensor device ID (if not provided in header) |
| `api_key` | String | No | Sensor API key (if not provided in header) |

---

## 3. Server Processing & Response

The Worker automatically:
1. Validates the device's active status and verifies the `X-API-KEY`.
2. Updates `last_seen_at` on the `sensor_modules` table.
3. Automatically resolves the active shipment assigned to the sensor or driver.
4. If `latitude` and `logitutude` are present, records live GPS trail into `driver_locations` for real-time live map tracking.
5. Saves raw environmental readings to `sensor_logs`.
6. Evaluates spoilage risk and saves to `model_predictions`.
7. Dispatches deduplicated risk alerts to Admin, Sender, and Driver if telemetry exceeds safe thresholds.

#### Success Response (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Telemetry ingested successfully",
    "logId": 1420,
    "riskLevel": "LOW",
    "score": 12.5,
    "status": "SAFE",
    "spoilIn": 68.0,
    "deliveryId": 8,
    "temperature": 24.5,
    "humidity": 68.2,
    "methane": 0.032,
    "latitude": 13.5560,
    "longitude": 78.5010,
    "violations": []
  }
}
```

---

## 4. Hardware Sample Ingestion Snippet (C++ / Arduino ESP32)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "WIFI_SSID";
const char* password = "WIFI_PASSWORD";
const char* serverUrl = "http://192.168.1.100:8787/api/v1/sensors/data";
const char* deviceId = "SFM-7C81A19D";
const char* apiKey = "sfm_your_secret_api_key_here";

void sendTelemetry(float temp, float humidity, float methane, float latitude, float longitude) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-DEVICE-ID", deviceId);
    http.addHeader("X-API-KEY", apiKey);

    StaticJsonDocument<200> doc;
    doc["temp"] = temp;
    doc["humidity"] = humidity;
    doc["methane"] = methane;
    doc["latitude"] = latitude;
    doc["logitutude"] = longitude;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    http.end();
  }
}
```
