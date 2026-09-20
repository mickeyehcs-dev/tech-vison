# ESP32-WROOM-32 Environmental Sensor & GPS Telemetry System

## 1. Project Overview

This project uses an **ESP32-WROOM-32** to collect environmental and location data from:

- **MQ-4** – Methane detection/estimation
- **MQ-135** – CO₂ estimation
- **DHT11** – Temperature and humidity
- **GY-GPS6MV2** – GPS latitude and longitude

The ESP32 connects to Wi-Fi and sends the collected data to a server using an **HTTP POST request in JSON format**.

The JSON sent to the server contains only:

```json
{
  "temperature": 29.0,
  "humidity": 61,
  "methane_ppm": 182.45,
  "co2_ppm": 450.25,
  "latitude": 13.628800,
  "longitude": 79.419200
}
```

---

## 2. Hardware Required

| Component | Quantity |
|---|---:|
| ESP32-WROOM-32 | 1 |
| MQ-4 Methane Sensor | 1 |
| MQ-135 Gas Sensor | 1 |
| DHT11 Temperature/Humidity Sensor | 1 |
| GY-GPS6MV2 GPS Module | 1 |
| Resistors for voltage dividers | As required |
| Jumper wires | As required |
| Breadboard | 1 |
| Suitable power supply | 1 |

---

## 3. ESP32 Pin Connections

### 3.1 MQ-4

| MQ-4 Pin | ESP32-WROOM-32 |
|---|---|
| AO | **D34 / GPIO34** |
| GND | GND |
| VCC | Suitable supply |

The MQ-4 analog output is read using GPIO34.

### 3.2 MQ-135

| MQ-135 Pin | ESP32-WROOM-32 |
|---|---|
| AO | **D35 / GPIO35** |
| GND | GND |
| VCC | Suitable supply |

The MQ-135 analog output is read using GPIO35.

### 3.3 DHT11

| DHT11 Pin | ESP32-WROOM-32 |
|---|---|
| DATA | **D4 / GPIO4** |
| VCC | 3.3V |
| GND | GND |

If using a bare DHT11 sensor rather than a module, a pull-up resistor on the DATA line may be required.

### 3.4 GY-GPS6MV2

The GPS uses ESP32 Hardware Serial 2.

| GPS Pin | ESP32-WROOM-32 |
|---|---|
| TX | **D16 / GPIO16** |
| RX | **D17 / GPIO17** |
| GND | GND |
| VCC | Appropriate GPS supply |

The connections are crossed:

```text
GPS TX  ---> ESP32 D16 (RX2)
GPS RX  <--- ESP32 D17 (TX2)
```

---

## 4. Complete Connection Summary

```text
                 ESP32-WROOM-32
                 ┌──────────────┐
                 │              │
MQ-4 AO -------->| D34          │
MQ-135 AO ------->| D35          │
DHT11 DATA ------>| D4           │
                 │              │
GPS TX ---------->| D16 (RX2)    │
GPS RX <----------| D17 (TX2)    │
                 │              │
All GND --------->| GND          │
                 │              │
                 └──────────────┘
```

---

## 5. Important Analog Voltage Protection

The ESP32 ADC inputs must not be exposed to a voltage above the ESP32's allowed input range.

MQ gas sensor modules are commonly operated from 5V, and their analog output can therefore exceed 3.3V.

**Do not connect a potentially 5V MQ sensor analog output directly to ESP32 D34 or D35.**

Use an appropriate voltage divider between each MQ sensor's AO output and the ESP32 ADC input.

Example:

```text
MQ Sensor AO
     |
    R1
     |
     +-----------> ESP32 ADC pin
     |
    R2
     |
    GND
```

For example, the divider used in the project can be selected so that the maximum possible sensor output is reduced to a safe ESP32 ADC voltage.

The same protection principle applies to both:

```text
MQ-4 AO  -> voltage divider -> D34
MQ-135 AO -> voltage divider -> D35
```

---

## 6. Software Requirements

Install the following Arduino libraries:

### Built-in ESP32 libraries

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
```

These are provided by the ESP32 Arduino core.

### Additional libraries

```cpp
#include <ArduinoJson.h>
#include <DHT.h>
#include <TinyGPS++.h>
```

Install these through:

**Arduino IDE → Sketch → Include Library → Manage Libraries**

Search for:

- **ArduinoJson**
- **DHT sensor library**
- **TinyGPSPlus**

For the DHT library, install the library from **Adafruit**.

---

## 7. ESP32 Board Selection

For a typical ESP32-WROOM-32 development board, select the appropriate ESP32 DevKit board in:

```text
Tools
  → Board
    → ESP32 Arduino
      → DOIT ESP32 DEVKIT V1
```

The exact board selection can depend on the particular ESP32-WROOM development board being used.

---

## 8. Pin Definitions Used by the Program

The program uses:

```cpp
const int MQ4_PIN = 34;
const int MQ135_PIN = 35;

#define DHTPIN 4
#define DHTTYPE DHT11;

#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
```

Therefore the physical board markings are:

```text
D34 -> MQ-4
D35 -> MQ-135
D4  -> DHT11
D16 -> GPS TX
D17 -> GPS RX
```

---

## 9. MQ-4 Operation

The MQ-4 analog output is read using the ESP32 ADC.

The program:

1. Reads the MQ-4 ADC value.
2. Converts the ADC value to voltage.
3. Calculates sensor resistance (`Rs`).
4. Calculates the `Rs/R0` ratio.
5. Uses the methane curve parameters to estimate methane concentration in PPM.

The relevant parameters are:

```cpp
const float RL_VALUE = 10.0;
const float AIR_RATIO = 4.4;

const float A_CH4 = 1012.2;
const float B_CH4 = -2.786;
```

The sensor performs an initial clean-air calibration to calculate `R0`.

---

## 10. MQ-135 Operation

The MQ-135 analog output is connected to D35.

The program:

1. Reads the MQ-135 ADC value.
2. Converts the ADC value to voltage.
3. Calculates MQ-135 sensor resistance.
4. Calculates the `Rs/R0` ratio.
5. Uses the configured CO₂ curve to estimate CO₂ concentration.
6. Adds the estimated value to the JSON data as `co2_ppm`.

The program uses:

```cpp
const float RL_VALUE_MQ135 = 10.0;
const float AIR_RATIO_MQ135 = 3.6;

const float A_CO2 = 116.6020682;
const float B_CO2 = -2.769034857;
```

### Important MQ-135 limitation

The MQ-135 is a broad-response gas sensor. The `co2_ppm` value produced by this program is an **estimated value** and should not be treated as laboratory-grade CO₂ measurement.

For accurate CO₂ measurement, an NDIR CO₂ sensor is normally preferred.

The MQ-135 result can be improved through proper calibration using known reference concentrations and controlled environmental conditions.

---

## 11. DHT11 Operation

The DHT11 provides:

- Temperature in °C
- Relative humidity in %

The program reads:

```cpp
float humidity = dht.readHumidity();
float tempC = dht.readTemperature();
```

If the DHT11 returns an invalid reading, the program does not send telemetry for that cycle.

---

## 12. GPS Operation

The GY-GPS6MV2 is connected to ESP32 HardwareSerial 2.

The program initializes the GPS at:

```cpp
GPS_Serial.begin(
  9600,
  SERIAL_8N1,
  GPS_RX_PIN,
  GPS_TX_PIN
);
```

The GPS is expected to provide NMEA data at 9600 baud.

The TinyGPSPlus library processes the incoming GPS data.

The program checks:

```cpp
gps.location.isValid()
```

Only when a valid GPS location is available are latitude and longitude used for telemetry.

---

## 13. GPS Fix

When the GPS does not have a valid position fix, the serial monitor displays:

```text
GPS Status  : NO FIX
```

When a valid position is available:

```text
GPS Status  : FIXED
```

The program can also display the number of satellites and altitude when those values are available.

For the first GPS fix, place the GPS antenna where it has a clear view of the sky. Initial GPS acquisition can take some time.

---

## 14. Wi-Fi Configuration

Change these values to match the Wi-Fi network:

```cpp
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
```

The ESP32 connects using:

```cpp
WiFi.begin(ssid, password);
```

After connection, the ESP32 IP address is displayed in the Serial Monitor.

---

## 15. Server Configuration

The program sends an HTTP POST request to:

```cpp
const char* serverUrl =
  "http://YOUR_SERVER_IP:8787/api/v1/sensors/data";
```

Replace `YOUR_SERVER_IP` with the IP address of the computer/server running the API.

For example:

```cpp
const char* serverUrl =
  "http://192.168.1.100:8787/api/v1/sensors/data";
```

### Important

Do not use:

```text
http://localhost:8787/...
```

when the API server is running on a separate computer.

From the ESP32, `localhost` means the ESP32 itself, not your computer.

Use the computer's LAN IP address instead.

---

## 16. Device Authentication

The program sends these HTTP headers:

```cpp
http.addHeader("X-DEVICE-ID", deviceId);
http.addHeader("X-API-KEY", apiKey);
```

The device ID and API key are therefore sent as HTTP headers and are **not included in the JSON body**.

Configure:

```cpp
const char* deviceId = "YOUR_DEVICE_ID";
const char* apiKey = "YOUR_API_KEY";
```

Keep API keys private.

---

## 17. JSON Data Format

The telemetry function creates:

```cpp
StaticJsonDocument<256> doc;

doc["temperature"] = temp;
doc["humidity"] = humidity;
doc["methane_ppm"] = methane;
doc["co2_ppm"] = co2;
doc["latitude"] = latitude;
doc["longitude"] = longitude;
```

The resulting JSON is:

```json
{
  "temperature": 29.0,
  "humidity": 61,
  "methane_ppm": 182.45,
  "co2_ppm": 450.25,
  "latitude": 13.628800,
  "longitude": 79.419200
}
```

No altitude, satellite count, voltage, device ID, or API key is included in the JSON body.

---

## 18. HTTP Request

The ESP32 sends the JSON using:

```cpp
int httpResponseCode = http.POST(requestBody);
```

The content type is:

```text
Content-Type: application/json
```

The server response code is printed to the Serial Monitor.

For example:

```text
HTTP Response code: 200
```

generally indicates that the server successfully returned an HTTP 200 response.

---

## 19. Data Flow

The complete system works as follows:

```text
MQ-4 ────────┐
             │
MQ-135 ──────┤
             │
DHT11 ───────┤
             │
GPS ─────────┤
             ↓
        ESP32-WROOM-32
             │
             ↓
          Wi-Fi
             │
             ↓
       HTTP POST Request
             │
             ↓
          API Server
```

The sensor values are collected by the ESP32, converted/processed, combined with the GPS position, converted into JSON, and transmitted to the server.

---

## 20. Program Startup Sequence

When the ESP32 starts:

1. Serial communication starts at 115200 baud.
2. ESP32 ADC is configured.
3. DHT11 is initialized.
4. GPS serial communication is initialized.
5. ESP32 connects to Wi-Fi.
6. MQ-4 and MQ-135 heaters are allowed to warm up.
7. MQ-4 R0 is calibrated in clean air.
8. MQ-135 R0 is calibrated in clean air.
9. The system waits for a GPS fix.
10. Sensor data is continuously read.
11. When valid DHT11 and GPS data are available, JSON telemetry is sent.
12. The cycle repeats approximately every second.

---

## 21. Serial Monitor

Set the Arduino Serial Monitor to:

```text
115200 baud
```

Typical output will contain:

```text
WiFi Connected!
ESP32 IP Address: 192.168.1.xxx

MQ-4 R0 = ...
MQ-135 R0 = ...

System Ready.
Waiting for GPS fix...
```

After GPS lock:

```text
Temperature : 29.0 C
Humidity    : 61 %
MQ-4 Voltage: 1.38 V
Methane     : 182.45 PPM
MQ-135 Voltage: 1.20 V
CO2         : 450.25 PPM

GPS Status  : FIXED
Latitude    : 13.628800
Longitude   : 79.419200

JSON DATA:
{"temperature":29.0,"humidity":61,"methane_ppm":182.45,"co2_ppm":450.25,"latitude":13.628800,"longitude":79.419200}

HTTP Response code: 200
```

---

## 22. Troubleshooting

### TinyGPS++.h not found

Install:

```text
TinyGPSPlus
```

from the Arduino Library Manager.

### DHT11 error

Check:

- DHT11 DATA is connected to D4.
- VCC and GND are correct.
- DATA pull-up is present if required.
- The DHT11 is not being read too rapidly.

### GPS shows NO FIX

Check:

- GPS TX → ESP32 D16.
- GPS RX → ESP32 D17.
- GPS baud rate is 9600.
- GPS has adequate power.
- GPS antenna has a clear view of the sky.
- Allow enough time for the first fix.

### Wi-Fi connection fails

Check:

- SSID.
- Password.
- ESP32 is within Wi-Fi range.
- The network is available to the ESP32.

### HTTP connection fails

Check:

- Server is running.
- Server IP address is correct.
- Port 8787 is open/listening.
- ESP32 and server are on the same network when using a local IP.
- The API path is correct.

### HTTP 404

The server was reached, but the requested API endpoint was not found. Check:

```text
/api/v1/sensors/data
```

### HTTP 401 or 403

Check:

- `X-DEVICE-ID`
- `X-API-KEY`

### MQ sensor values look incorrect

Check:

- Sensor warm-up time.
- Voltage divider.
- Sensor supply voltage.
- R0 calibration conditions.
- MQ sensor curve/calibration parameters.

MQ-4 and MQ-135 readings should be treated as estimates unless the sensors have been properly calibrated.

---

## 23. Safety Notes

1. Do not apply more than the safe voltage to ESP32 ADC inputs.
2. Use voltage dividers for MQ analog outputs when required.
3. Ensure all modules have a common ground.
4. Do not assume an MQ-135 reading is an accurate CO₂ measurement without calibration.
5. MQ gas sensors require heater power and can become hot during operation.
6. Keep the sensors in appropriate, ventilated test environments.

---

## 24. Final Pin Reference

```text
┌─────────────────────────────────────────────┐
│              ESP32-WROOM-32                 │
├─────────────────────────────────────────────┤
│ D4   ─────────────── DHT11 DATA             │
│ D16  <────────────── GPS TX                 │
│ D17  ──────────────> GPS RX                 │
│ D34  <────────────── MQ-4 AO                │
│ D35  <────────────── MQ-135 AO              │
│ GND  ─────────────── Common GND             │
└─────────────────────────────────────────────┘
```

---

## 25. Summary

The system combines four sensing functions in one ESP32-WROOM-32 device:

```text
DHT11       → Temperature + Humidity
MQ-4        → Methane estimate
MQ-135      → CO₂ estimate
GY-GPS6MV2  → Latitude + Longitude
```

The ESP32 processes these readings and sends them to the configured server over Wi-Fi as a JSON HTTP POST request.

Final telemetry fields:

```text
temperature
humidity
methane_ppm
co2_ppm
latitude
longitude
```
