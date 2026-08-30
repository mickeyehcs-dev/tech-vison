/*
  ==========================================================
  MQ-4 + MQ-135 + DHT11 + GPS + WiFi JSON TELEMETRY
  Board: ESP32-WROOM-32
  ==========================================================

  CONNECTIONS
  ----------------------------------------------------------
  MQ-4 AO        -> D34
  MQ-135 AO      -> D35
  DHT11 DATA     -> D4

  GPS GY-GPS6MV2:
  GPS TX        -> D16 (ESP32 RX2)
  GPS RX        -> D17 (ESP32 TX2)
  GPS GND       -> GND
  GPS VCC       -> Appropriate supply

  IMPORTANT:
  MQ-4 AO and MQ-135 AO must not exceed 3.3V at ESP32 ADC pins.
  Use voltage dividers if the sensor output can reach 5V.

  JSON DATA:
  {
    "temperature": 29.0,
    "humidity": 61,
    "methane_ppm": 182.45,
    "co2_ppm": 450.25,
    "latitude": 13.628800,
    "longitude": 79.419200
  }
*/


// ==========================================================
// LIBRARIES
// ==========================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <TinyGPS++.h>
#include <math.h>


// ==========================================================
// WIFI CONFIGURATION
// ==========================================================

const char* ssid = "Mickey";
const char* password = "kkrkkrkkr";


// ==========================================================
// SERVER CONFIGURATION
// ==========================================================

const char* serverUrl =
  "http://10.59.254.49:8787/api/v1/sensors/data";

const char* deviceId = "SFM-936474A0";

const char* apiKey =
  "sfm_88897fed3e50feaff307c8e1feb78315a7ca6e011d0d8390";


// ==========================================================
// SENSOR PIN DEFINITIONS
// ==========================================================

// MQ-4
const int MQ4_PIN = 34;

// MQ-135
const int MQ135_PIN = 35;

// DHT11
#define DHTPIN 4
#define DHTTYPE DHT11

// GPS
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17


// ==========================================================
// SENSOR OBJECTS
// ==========================================================

DHT dht(DHTPIN, DHTTYPE);

TinyGPSPlus gps;

HardwareSerial GPS_Serial(2);


// ==========================================================
// MQ-4 CONSTANTS
// ==========================================================

const float RL_VALUE = 10.0;
const float AIR_RATIO = 4.4;


// ==========================================================
// MQ-4 CH4 CURVE PARAMETERS
// ==========================================================

const float A_CH4 = 1012.2;
const float B_CH4 = -2.786;


// ==========================================================
// MQ-4 R0
// ==========================================================

float R0 = 0.0;


// ==========================================================
// WIFI CONNECTION
// ==========================================================

void connectWiFi() {

  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.begin(ssid, password);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 30) {

    delay(500);

    Serial.print(".");

    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi Connected!");

    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());

  } else {

    Serial.println("WiFi Connection Failed!");
  }
}


// ==========================================================
// SEND JSON TELEMETRY
// ==========================================================

void sendTelemetry(
  float temp,
  float humidity,
  float methane,
  float co2,
  float latitude,
  float longitude
) {

  // Check WiFi
  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("WiFi disconnected.");

    connectWiFi();

    if (WiFi.status() != WL_CONNECTED) {

      Serial.println("Unable to send telemetry.");

      return;
    }
  }


  // Create HTTP client
  HTTPClient http;


  // Connect to server
  http.begin(serverUrl);


  // HTTP headers
  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "X-DEVICE-ID",
    deviceId
  );

  http.addHeader(
    "X-API-KEY",
    apiKey
  );


  // ========================================================
  // CREATE JSON
  // ========================================================

  StaticJsonDocument<256> doc;

  doc["temperature"] = temp;

  doc["humidity"] = humidity;

  doc["methane_ppm"] = methane;

  doc["co2_ppm"] = co2;

  doc["latitude"] = latitude;

  doc["longitude"] = longitude;


  // Convert JSON to String
  String requestBody;

  serializeJson(doc, requestBody);


  // ========================================================
  // PRINT JSON
  // ========================================================

  Serial.println();
  Serial.println("JSON DATA:");
  Serial.println(requestBody);


  // ========================================================
  // HTTP POST
  // ========================================================

  int httpResponseCode =
    http.POST(requestBody);


  // ========================================================
  // PRINT SERVER RESPONSE
  // ========================================================

  Serial.print("HTTP Response code: ");
  Serial.println(httpResponseCode);


  if (httpResponseCode > 0) {

    String response =
      http.getString();

    Serial.println("Server Response:");
    Serial.println(response);

  } else {

    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(
      httpResponseCode
    ));
  }


  // Close HTTP connection
  http.end();
}


// ==========================================================
// SETUP
// ==========================================================

void setup() {

  // --------------------------------------------------------
  // Serial Monitor
  // --------------------------------------------------------

  Serial.begin(115200);

  delay(1000);


  // --------------------------------------------------------
  // ESP32 ADC
  // --------------------------------------------------------

  analogReadResolution(12);

  analogSetPinAttenuation(
    MQ4_PIN,
    ADC_11db
  );

  analogSetPinAttenuation(
    MQ135_PIN,
    ADC_11db
  );


  // --------------------------------------------------------
  // Start DHT11
  // --------------------------------------------------------

  dht.begin();


  // --------------------------------------------------------
  // Start GPS
  // --------------------------------------------------------

  GPS_Serial.begin(
    9600,
    SERIAL_8N1,
    GPS_RX_PIN,
    GPS_TX_PIN
  );


  // --------------------------------------------------------
  // Startup Message
  // --------------------------------------------------------

  Serial.println();
  Serial.println(
    "=========================================================="
  );

  Serial.println(
    " MQ-4 + MQ-135 + DHT11 + GPS + WiFi JSON SYSTEM"
  );

  Serial.println(
    "                 ESP32-WROOM-32"
  );

  Serial.println(
    "=========================================================="
  );


  // --------------------------------------------------------
  // Connect WiFi
  // --------------------------------------------------------

  connectWiFi();


  // --------------------------------------------------------
  // MQ Sensor Warm-up
  // --------------------------------------------------------

  Serial.println();
  Serial.println(
    "Warming up MQ-4 and MQ-135 heater elements (20 sec)..."
  );

  delay(20000);


  // ========================================================
  // MQ-4 CALIBRATION
  // ========================================================

  Serial.println();
  Serial.println(
    "Calibrating MQ-4 R0 in clean air..."
  );

  float rsSum = 0.0;


  for (int i = 0; i < 100; i++) {

    int raw = analogRead(MQ4_PIN);


    // ESP32 ADC = 0 to 4095
    float vOut =
      (raw / 4095.0) * 3.3;


    if (vOut < 0.01) {

      vOut = 0.01;
    }


    // Calculate Rs
    float rsCurrent =
      RL_VALUE *
      (3.3 - vOut) /
      vOut;


    rsSum += rsCurrent;


    delay(50);
  }


  // Average Rs
  float avgRsCleanAir =
    rsSum / 100.0;


  // Calculate R0
  R0 =
    avgRsCleanAir /
    AIR_RATIO;


  Serial.print(
    "MQ-4 R0 = "
  );

  Serial.print(
    R0,
    3
  );

  Serial.println(
    " kOhm"
  );


  // --------------------------------------------------------
  // System Ready
  // --------------------------------------------------------

  Serial.println();
  Serial.println(
    "System Ready."
  );

  Serial.println(
    "Waiting for GPS fix..."
  );
}


// ==========================================================
// LOOP
// ==========================================================

void loop() {


  // ========================================================
  // READ GPS DATA
  // ========================================================

  while (GPS_Serial.available() > 0) {

    gps.encode(
      GPS_Serial.read()
    );
  }


  // ========================================================
  // READ DHT11
  // ========================================================

  float humidity =
    dht.readHumidity();

  float tempC =
    dht.readTemperature();


  // ========================================================
  // READ MQ-4
  // ========================================================

  int rawADC =
    analogRead(MQ4_PIN);


  // ESP32 ADC conversion
  float voltage =
    (rawADC / 4095.0) * 3.3;


  if (voltage < 0.01) {

    voltage = 0.01;
  }


  // ========================================================
  // CALCULATE MQ-4 Rs
  // ========================================================

  float Rs =
    RL_VALUE *
    (3.3 - voltage) /
    voltage;


  // ========================================================
  // CALCULATE MQ-4 Rs/R0
  // ========================================================

  float ratio =
    Rs / R0;


  // ========================================================
  // CALCULATE METHANE PPM
  // ========================================================

  float ppm =
    A_CH4 *
    pow(
      ratio,
      B_CH4
    );


  // ========================================================
  // READ MQ-135
  // ========================================================
  //
  // This section is replaced with the user's MQ-135 code.
  // It takes 10 samples and calculates their average.
  //

  long sum = 0;

  int samples = 10;

  for (int i = 0; i < samples; i++) {

    sum += analogRead(MQ135_PIN);

    delay(10);
  }

  int rawAnalogValue =
    sum / samples;


  // Use the raw averaged MQ-135 value
  // as the CO2 value sent to the server.

  float co2ppm =
    rawAnalogValue;


  // ========================================================
  // PRINT SENSOR DATA
  // ========================================================

  Serial.println();
  Serial.println(
    "**************** SENSOR DATA ****************"
  );


  // --------------------------------------------------------
  // Temperature and Humidity
  // --------------------------------------------------------

  if (
    isnan(humidity) ||
    isnan(tempC)
  ) {

    Serial.println(
      "Temperature : DHT ERROR"
    );

    Serial.println(
      "Humidity    : DHT ERROR"
    );

  } else {

    Serial.print(
      "Temperature : "
    );

    Serial.print(
      tempC,
      1
    );

    Serial.println(
      " C"
    );


    Serial.print(
      "Humidity    : "
    );

    Serial.print(
      humidity,
      0
    );

    Serial.println(
      " %"
    );
  }


  // --------------------------------------------------------
  // MQ-4 Methane
  // --------------------------------------------------------

  Serial.print(
    "MQ-4 Voltage: "
  );

  Serial.print(
    voltage,
    2
  );

  Serial.println(
    " V"
  );


  Serial.print(
    "Methane     : "
  );

  Serial.print(
    ppm,
    2
  );

  Serial.println(
    " PPM"
  );


  // --------------------------------------------------------
  // MQ-135
  // --------------------------------------------------------

  Serial.print(
    "MQ-135 Raw Analog Value: "
  );

  Serial.println(
    rawAnalogValue
  );


  if (rawAnalogValue > 1200) {

    Serial.println(
      "Warning: Elevated gas/smoke levels detected!"
    );
  }


  Serial.print(
    "CO2         : "
  );

  Serial.print(
    co2ppm,
    2
  );

  Serial.println(
    " PPM"
  );


  // ========================================================
  // GPS DATA
  // ========================================================

  float latitude = 0.0;

  float longitude = 0.0;


  if (gps.location.isValid()) {

    latitude =
      gps.location.lat();

    longitude =
      gps.location.lng();


    Serial.println(
      "GPS Status  : FIXED"
    );


    Serial.print(
      "Latitude    : "
    );

    Serial.println(
      latitude,
      6
    );


    Serial.print(
      "Longitude   : "
    );

    Serial.println(
      longitude,
      6
    );


    if (gps.satellites.isValid()) {

      Serial.print(
        "Satellites  : "
      );

      Serial.println(
        gps.satellites.value()
      );
    }


    if (gps.altitude.isValid()) {

      Serial.print(
        "Altitude    : "
      );

      Serial.print(
        gps.altitude.meters(),
        2
      );

      Serial.println(
        " m"
      );
    }

  } else {

    Serial.println(
      "GPS Status  : NO FIX"
    );


    if (gps.satellites.isValid()) {

      Serial.print(
        "Satellites  : "
      );

      Serial.println(
        gps.satellites.value()
      );

    } else {

      Serial.println(
        "Satellites  : Searching..."
      );
    }
  }


  // ========================================================
  // SEND JSON
  // ========================================================

  // Only send when DHT11 data is valid
  // and GPS has a valid location.

  if (
    !isnan(tempC) &&
    !isnan(humidity) &&
    gps.location.isValid()
  ) {

    sendTelemetry(
      tempC,
      humidity,
      ppm,
      co2ppm,
      latitude,
      longitude
    );

  } else {

    Serial.println();
    Serial.println(
      "JSON NOT SENT:"
    );


    if (
      isnan(tempC) ||
      isnan(humidity)
    ) {

      Serial.println(
        "- DHT11 data invalid"
      );
    }


    if (
      !gps.location.isValid()
    ) {

      Serial.println(
        "- GPS location not available"
      );
    }
  }


  Serial.println(
    "***********************************************"
  );


  // ========================================================
  // 1 SECOND DELAY
  // ========================================================

  delay(1000);
}