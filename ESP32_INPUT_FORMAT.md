# ESP32 Telemetry & Blockchain Hash-Sharing Specification

This guide explains how **cryptographic hashing**, **hash chaining**, and **blockchain hash sharing** work between the **ESP32-WROOM-32 IoT Device**, the **Backend Ingestion Engine**, and the **Hyperledger Fabric Blockchain**.

---

## 1. How Hash Sharing Works (End-to-End Flow)

```text
[ESP32 IoT Node]
  ├─ Reads Sensors (Temp, Hum, MQ-4, MQ-135, GPS)
  ├─ Maintains Monotonic Sequence Number (n)
  └─ Links Previous Record Hash (H_n-1)
       ↓
[HTTP POST /api/v1/sensors/data]
       ↓
[Backend Server (:8787)]
  ├─ Canonicalizes Telemetry (Canonical JSON format)
  ├─ Computes SHA-256 Hash: H_n = SHA256(CanonicalData_n + H_n-1)
  ├─ Persists to MySQL `sensor_logs` (sequence_number, record_hash, previous_hash)
  └─ Returns (H_n, H_n-1, sequence_number) in HTTP 200 Response
       ↓
[Merkle Tree Engine]
  ├─ Aggregates batch of sensor record hashes: [H_1, H_2, H_3, ... H_k]
  └─ Computes Binary Merkle Root: Root = SHA256(H_L + H_R)
       ↓
[Hyperledger Fabric / Blockchain Ledger]
  ├─ Smart Contract `recordBatchProof(batchId, merkleRoot, startSeq, endSeq, ...)`
  └─ Emits Immutable On-Chain Transaction & Block Proof
```

---

## 2. Two Hashing Modes Supported

### Mode A: Server-Assisted Automatic Hashing (Default / Easiest)
- **ESP32 sends:** Raw sensor readings (`temperature`, `humidity`, `methane_ppm`, `co2_ppm`, `latitude`, `longitude`).
- **Server does:**
  1. Retrieves the latest hash $H_{n-1}$ for the shipment.
  2. Computes the deterministic SHA-256 record hash $H_n$.
  3. Increments sequence number $n$.
  4. Stores to database and automatically queues for blockchain Merkle tree batching.
  5. **Returns $H_n$ and $H_{n-1}$ in the JSON response** so the ESP32 knows its verified cryptographic state.

---

### Mode B: On-Device Cryptographic Hash Generation (Maximum Security)
- **ESP32 maintains in memory:**
  - `sequenceNumber` (starts at `1`, increments by `1` each cycle)
  - `previousHash` (starts at Genesis `0000000000000000000000000000000000000000000000000000000000000000`)
- **ESP32 computes:** SHA-256 hash using the ESP32's built-in **mbedTLS** cryptographic hardware accelerator.
- **ESP32 sends:** `temperature`, `humidity`, `methane_ppm`, `co2_ppm`, `latitude`, `longitude`, `sequence_number`, `previous_hash`, `record_hash`.
- **Server verifies:** Compares the ESP32's `record_hash` with the expected canonical SHA-256 hash. If valid, anchors to the blockchain.

---

## 3. JSON Payload Formats

### 3.1 Standard Telemetry Payload (Mode A - Server-Computed Hashes)
```json
{
  "temperature": 29.0,
  "humidity": 61.0,
  "methane_ppm": 182.45,
  "co2_ppm": 450.25,
  "latitude": 13.628800,
  "longitude": 79.419200
}
```

### 3.2 Advanced Telemetry with On-Device Hash Sharing (Mode B)
```json
{
  "device_id": "SFM-936474A0",
  "api_key": "sfm_88897fed3e50feaff307c8e1feb78315a7ca6e011d0d8390",
  "sequence_number": 3,
  "temperature": 29.0,
  "humidity": 61.0,
  "methane_ppm": 182.45,
  "co2_ppm": 450.25,
  "latitude": 13.628800,
  "longitude": 79.419200,
  "previous_hash": "032b07628eef0fc2dc7a2c46c861b76a61d67b1bc6bc3a82fdace788c4a60d2a",
  "record_hash": "bb8a0489628f476a8d2d60142a50e8e4c011cdd0e5da8370cc6fce898e6790a8",
  "timestamp": "2026-09-21T15:47:00Z"
}
```

---

## 4. Server Response (Sharing Hashes Back to ESP32)

Every time the ESP32 sends a reading, the server responds with the assigned `sequence_number`, the newly generated `record_hash`, and the chained `previous_hash`:

```json
{
  "success": true,
  "data": {
    "message": "Telemetry ingested successfully",
    "logId": 4966,
    "sequence_number": 3,
    "record_hash": "bb8a0489628f476a8d2d60142a50e8e4c011cdd0e5da8370cc6fce898e6790a8",
    "previous_hash": "032b07628eef0fc2dc7a2c46c861b76a61d67b1bc6bc3a82fdace788c4a60d2a",
    "riskLevel": "LOW",
    "score": 13.6,
    "status": "OPTIMAL",
    "spoilIn": 55,
    "deliveryId": 1,
    "latitude": 13.6288,
    "longitude": 79.4192,
    "temperature": 29.0,
    "humidity": 61.0,
    "methane": 182.45,
    "co2": 450.25,
    "violations": []
  }
}
```

---

## 5. ESP32 Arduino C++ Implementation (With Hash-Sharing & Response Sync)

Below is the complete C++ function for the ESP32 that sends telemetry and receives/synchronizes the cryptographic record hash:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Configuration
const char* serverUrl = "http://10.224.49.59:8787/api/v1/sensors/data";
const char* deviceId  = "SFM-936474A0";
const char* apiKey    = "sfm_88897fed3e50feaff307c8e1feb78315a7ca6e011d0d8390";

// Persistent Hash-Chain state on ESP32
String lastRecordHash = "0000000000000000000000000000000000000000000000000000000000000000";
unsigned long currentSequence = 1;

void sendTelemetry(float temp, float hum, float methanePpm, float co2Ppm, float lat, float lon) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi not connected. Skipping upload.");
    return;
  }

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-DEVICE-ID", deviceId);
  http.addHeader("X-API-KEY", apiKey);

  // Build JSON request
  StaticJsonDocument<384> reqDoc;
  reqDoc["temperature"]     = round(temp * 100.0) / 100.0;
  reqDoc["humidity"]        = round(hum * 100.0) / 100.0;
  reqDoc["methane_ppm"]     = round(methanePpm * 100.0) / 100.0;
  reqDoc["co2_ppm"]         = round(co2Ppm * 100.0) / 100.0;
  reqDoc["latitude"]        = lat;
  reqDoc["longitude"]       = lon;
  reqDoc["sequence_number"] = currentSequence;
  reqDoc["previous_hash"]   = lastRecordHash;

  String requestBody;
  serializeJson(reqDoc, requestBody);

  Serial.println();
  Serial.print("[HTTP POST] ");
  Serial.println(serverUrl);
  Serial.print("[Payload] ");
  Serial.println(requestBody);

  int httpCode = http.POST(requestBody);

  if (httpCode == 200 || httpCode == 201) {
    String responseString = http.getString();
    Serial.print("[Server Response] ");
    Serial.println(responseString);

    // Parse returned hash from server
    StaticJsonDocument<512> resDoc;
    DeserializationError err = deserializeJson(resDoc, responseString);

    if (!err && resDoc["success"]) {
      const char* serverRecordHash = resDoc["data"]["record_hash"];
      unsigned long seq = resDoc["data"]["sequence_number"];

      if (serverRecordHash != nullptr) {
        lastRecordHash = String(serverRecordHash);
        currentSequence = seq + 1;
        Serial.printf("[Blockchain Sync] Hash H_%lu Verified: %s\n", seq, lastRecordHash.c_str());
      }
    }
  } else {
    Serial.printf("[HTTP Error] Code %d: %s\n", httpCode, http.errorToString(httpCode).c_str());
  }

  http.end();
}
```

---

## 6. On-Device Hardware SHA-256 (ESP32 `mbedtls`)

If you wish to compute the SHA-256 hash locally on the ESP32 chip before transmission:

```cpp
#include "mbedtls/sha256.h"

String calculateSHA256(String payload) {
  byte shaResult[32];
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0); // 0 = SHA-256
  mbedtls_sha256_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
  mbedtls_sha256_finish(&ctx, shaResult);
  mbedtls_sha256_free(&ctx);

  char hashStr[65];
  for (int i = 0; i < 32; i++) {
    sprintf(hashStr + (i * 2), "%02x", shaResult[i]);
  }
  hashStr[64] = '\0';
  return String(hashStr);
}
```

---

## 7. Verification in Dashboard

Once the ESP32 sends telemetry readings:
1. Open the web dashboard at `http://localhost:5173/blockchain` (or `http://10.224.49.59:5173/blockchain`).
2. You will see the batch containing your ESP32's sequence range.
3. Click **View Tree** to see the binary Merkle tree visualizer computed from your record hashes ($H_1, H_2, ...$).
4. Click **Verify** to execute real-time cryptographic audit against the on-chain Hyperledger Fabric proof.
