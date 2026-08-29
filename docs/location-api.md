# Driver GPS Telemetry & Mapping API Specification

## 1. Overview

During delivery transit, the driver's browser accesses `navigator.geolocation.watchPosition()` after explicit user authorization. Live GPS coordinate points are streamed to the backend to power the real-time map on customer and administration dashboards.

---

## 2. Driver Location Ingestion

### `POST /api/v1/locations`

#### Authentication:
Requires authenticated `driver` role session (via `Authorization: Bearer <token>` or HttpOnly session cookie). The server derives the driver ID from the cryptographically verified JWT and validates assignment to the delivery.

#### JSON Body:
```json
{
  "deliveryId": 12,
  "latitude": 37.774929,
  "longitude": -122.419416,
  "accuracy": 12.5,
  "speed": 45.2,
  "heading": 180.0
}
```

#### Field Specifications:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `deliveryId` | Integer | **Yes** | ID of the active delivery |
| `latitude` | Number | **Yes** | Geographic latitude coordinate (-90 to +90) |
| `longitude` | Number | **Yes** | Geographic longitude coordinate (-180 to +180) |
| `accuracy` | Number | No | Accuracy radius in meters |
| `speed` | Number | No | Speed over ground in km/h or m/s |
| `heading` | Number | No | Direction of travel in degrees (0 to 360) |

#### Success Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 8502,
    "driver_id": 4,
    "delivery_id": 12,
    "latitude": 37.774929,
    "longitude": -122.419416,
    "accuracy": 12.5,
    "speed": 45.2,
    "heading": 180.0,
    "recorded_at": "2026-08-21T16:30:15Z"
  }
}
```

---

## 3. Retrieving GPS Trail & Latest Position

### `GET /api/v1/locations/:deliveryId`

Retrieves the historical route polyline points and current latest coordinate for map rendering.

#### Success Response (200 OK):
```json
{
  "success": true,
  "data": {
    "trail": [
      { "id": 8500, "latitude": 37.774100, "longitude": -122.418200, "recorded_at": "2026-08-21T16:28:00Z" },
      { "id": 8501, "latitude": 37.774500, "longitude": -122.418900, "recorded_at": "2026-08-21T16:29:00Z" },
      { "id": 8502, "latitude": 37.774929, "longitude": -122.419416, "recorded_at": "2026-08-21T16:30:15Z" }
    ],
    "latest": {
      "id": 8502,
      "latitude": 37.774929,
      "longitude": -122.419416,
      "accuracy": 12.5,
      "recorded_at": "2026-08-21T16:30:15Z"
    }
  }
}
```
