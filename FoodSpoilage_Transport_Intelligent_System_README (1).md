# Food Spoilage Intelligent Monitoring & Transport Risk System

## Product Overview

The Food Spoilage Intelligent Monitoring & Transport Risk System is an
end-to-end intelligent food transportation monitoring platform.

It combines:

1.  Pre-transport route and weather risk analysis.
2.  Real-time sensor monitoring during transportation.
3.  Food-specific machine-learning prediction.
4.  Chronological sensor history.
5.  Automatic feature extraction from raw sensor data.
6.  Risk Score, Spoilage State, Estimated RUL, risk reasons, and driver
    guidance.

The goal is to help transport operators understand expected route
conditions before departure and continuously assess the actual food
condition during transport.

------------------------------------------------------------------------

## End-to-End Architecture

``` text
USER
 |
 +--> From Address
 +--> To Address
 +--> Food Type
 |
 v
ROUTE + WEATHER LAYER
 |
 +--> Route / ETA
 +--> Weather forecast
 +--> Expected transport conditions
 |
 v
PRE-TRANSPORT RISK
 |
 v
TRANSPORT STARTS
 |
 v
REAL-TIME SENSORS
 |
 +--> Temperature
 +--> Humidity
 +--> Methane
 +--> CO2
 +--> Storage Days
 +--> Timestamp
 |
 v
MAIN MONITORING SYSTEM
 |
 |  sends RAW sensor data
 v
ML /sensor API
 |
 v
CHRONOLOGICAL HISTORY
 |
 v
FEATURE ENGINE
 |
 v
201 FEATURES
 |
 v
FOOD-SPECIFIC XGBOOST
 |
 +--> Spoilage State
 +--> Spoilage Probabilities
 +--> Risk Score
 +--> Risk Category
 +--> Estimated RUL
 +--> Risk Reasons
 |
 v
DRIVER DECISION SUPPORT
 |
 +--> Recommended actions
 +--> Monitoring guidance
 +--> Transport intervention
```

------------------------------------------------------------------------

## 1. User Input

Before transportation starts, the application receives:

-   From Address
-   To Address
-   Food Type
-   Batch/transport information as required by the application

Example:

``` text
From: Bengaluru, India
To: Chennai, India
Food: Chicken
```

The application determines the planned route and expected journey
duration.

------------------------------------------------------------------------

## 2. Route and Weather Risk

The first risk layer evaluates the planned journey using route
information and weather information obtained from a configured free-tier
weather API/provider.

The weather layer can consider:

-   Temperature
-   Humidity
-   Forecast conditions
-   Weather changes
-   Conditions at relevant route locations
-   Expected journey duration

The exact weather provider is configurable. Production use must respect
the provider's current free-tier limits, rate limits, licensing, and
terms.

### Important distinction

The weather layer is a **pre-transport planning layer**.

It does not replace the ML sensor model.

``` text
Weather + Route + Food
        |
        v
Expected transport risk
```

The ML layer instead evaluates the actual measured transport
environment:

``` text
Actual sensor data
+
Previous sensor history
        |
        v
Learned ML prediction
```

------------------------------------------------------------------------

## 3. Real-Time Sensor Monitoring

During transport, the main application sends raw sensor readings to the
ML server.

Example:

``` json
{
  "Food_Name": "Chicken",
  "Batch_ID": "BATCH001",
  "Reading": {
    "Timestamp_Hours": 0.066666,
    "Temperature": 35,
    "Humidity": 55,
    "Methane": 60,
    "CO2": 300,
    "Storage_Days": 2
  }
}
```

The client sends raw measurements. The ML service performs the feature
extraction.

------------------------------------------------------------------------

## 4. Chronological History

Each batch has a unique `Batch_ID`.

Example:

``` text
BATCH001
 |
 +-- Reading 1
 +-- Reading 2
 +-- Reading 3
 +-- Reading 4
 ...
```

Every new `/sensor` request appends the current reading to the batch
history.

Conceptually:

``` text
Reading 1
   |
   v
History = 1
   |
   v
Feature extraction
   |
   v
201 features
   |
   v
Prediction
```

Then:

``` text
Reading 1 + Reading 2
          |
          v
      History = 2
          |
          v
     201 features
          |
          v
      Prediction
```

Then:

``` text
Previous history + Reading 3
          |
          v
      History = 3
          |
          v
     201 features
          |
          v
      Prediction
```

This allows the system to use temporal information and trends rather
than treating every reading as an isolated observation.

------------------------------------------------------------------------

## 5. Food-Specific Machine Learning

The Phase 9.1 ML package uses food-specific XGBoost models.

Supported foods:

``` text
Apple
Beef
Bread
Cheese
Chicken
Eggs
Fish
Milk
Mushroom
Orange
Potato
Spinach
Strawberry
Tomato
Yogurt
```

The selected `Food_Name` determines which food-specific model is used.

For example:

``` text
Food_Name = Chicken
        |
        v
Chicken-specific XGBoost
```

and:

``` text
Food_Name = Fish
        |
        v
Fish-specific XGBoost
```

This separation is important because different foods have different
spoilage characteristics.

------------------------------------------------------------------------

## 6. Feature Extraction

The ML service converts the raw sensor/history information into the
deployed **201-feature representation**.

The application should therefore send raw sensor values rather than
attempting to reproduce the feature-engineering pipeline itself.

The feature engine can incorporate current and historical information
such as temporal changes, trends, rolling/statistical information, and
interactions according to the frozen model's feature schema.

The exact feature schema of the deployed package is authoritative.

------------------------------------------------------------------------

## 7. ML Prediction

The food-specific XGBoost model produces multiple outputs.

### Spoilage State

Current predicted spoilage state.

### Spoilage Probabilities

Probabilities for supported states such as:

``` text
Fresh
Intermediate
Advanced
```

### Risk Score

A continuous model-derived risk score.

### Risk Category

A human-readable category such as:

``` text
LOW
MEDIUM
HIGH
```

The deployed model's output contract should be treated as authoritative.

### Estimated RUL

Estimated Remaining Useful Life in days.

For the Phase 9.1 package, RUL is a **dataset-derived estimate**, not a
directly supervised time-to-failure target.

### Risk Reasons

The system returns explanations associated with the current prediction.

Example:

``` text
The food-specific model assigns significant probability
to the intermediate spoilage state.
```

------------------------------------------------------------------------

## 8. Driver Solutions

The main application converts the ML result into simple operational
guidance.

Example:

``` text
Food: Chicken
Risk: MEDIUM
Risk Score: 43.8
Estimated RUL: 3.9 days
State: INTERMEDIATE

Why:
The food-specific model assigns significant probability
to the intermediate spoilage state.

Recommended actions:
- Continue cold-chain monitoring.
- Check refrigeration performance.
- Avoid unnecessary transport delays.
- Continue monitoring sensor trends.
```

Driver guidance should be based on the actual prediction and transport
context. It should not be presented as a guaranteed food-safety
certification.

------------------------------------------------------------------------

## 9. API Interface

The deployed ML service exposes endpoints including:

``` text
GET  /health
GET  /foods

POST /predict
POST /sensor

GET  /history/{batch_id}
DELETE /history/{batch_id}
```

### `/health`

Checks service availability.

### `/foods`

Returns supported food categories.

### `/predict`

Stateless prediction endpoint. The client can provide accumulated
history.

### `/sensor`

Real-time endpoint. The service appends the current reading to
server-side chronological history and performs prediction.

### `/history/{batch_id}`

Returns stored readings for a batch.

### `DELETE /history/{batch_id}`

Clears a batch's server-side history.

------------------------------------------------------------------------

## 10. CURL Integration

The main monitoring system can send raw sensor data through CURL/HTTP.

Example:

``` bash
curl -X POST "http://ML_SERVER_IP:8000/sensor"   -H "Content-Type: application/json"   -d '{
    "Food_Name": "Chicken",
    "Batch_ID": "BATCH001",
    "Reading": {
      "Timestamp_Hours": 0,
      "Temperature": 30,
      "Humidity": 60,
      "Methane": 32,
      "CO2": 200,
      "Storage_Days": 2
    }
  }'
```

For Windows PowerShell, `curl.exe` can be used with the PowerShell
stop-parsing form when necessary:

``` powershell
curl.exe --% -X POST http://ML_SERVER_IP:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0,"Temperature":30,"Humidity":60,"Methane":32,"CO2":200,"Storage_Days":2}}"
```

------------------------------------------------------------------------

## 11. Example ML Response

A typical response has the following structure:

``` json
{
  "status": "OK",
  "Food_Name": "Chicken",
  "Batch_ID": "BATCH001",
  "Current_Reading": 1,
  "History_Used": 1,
  "Feature_Count": 201,
  "Spoilage_State": 1,
  "Spoilage_Probabilities": {
    "Fresh": 0.02492,
    "Intermediate": 0.954572,
    "Advanced": 0.020508
  },
  "Estimated_RUL_Days": 3.8853,
  "Risk_Score": 43.8235,
  "Risk_Category": "MEDIUM",
  "Risk_Reasons": [
    "The food-specific model assigns significant probability to the intermediate spoilage state."
  ],
  "Model": "Food-specific XGBoost",
  "Features": 201,
  "History_Enabled": true,
  "Threshold_Driven": false,
  "RUL_Type": "Dataset-derived estimate"
}
```

The values above are an example of the response format, not fixed
production values.

------------------------------------------------------------------------

## 12. Complete Product Decision Flow

### Before Transport

``` text
From Address
+
To Address
+
Food Type
+
Route
+
Weather Forecast
        |
        v
Pre-Transport Risk
```

### During Transport

``` text
Sensor Reading
       +
Previous History
       |
       v
201 Feature Representation
       |
       v
Food-Specific XGBoost
       |
       +------------------+
       |                  |
       v                  v
Spoilage State           RUL
       |
       v
Risk Score
       |
       v
Risk Reasons
       |
       v
Driver Solutions
```

The two layers complement each other:

``` text
Weather/Route
     =
Expected future conditions

ML Sensor Model
     =
Actual observed transport condition + learned prediction
```

------------------------------------------------------------------------

## 13. Production Architecture

``` text
                    USER APPLICATION
                           |
              +------------+------------+
              |                         |
              v                         v
       ROUTE SERVICE              ML SERVICE
              |                         |
              v                         |
        WEATHER API                     |
              |                         |
              v                         |
     PRE-TRIP RISK                      |
                                        |
                                  SENSOR GATEWAY
                                        |
                                        v
                                  /sensor API
                                        |
                                        v
                                 HISTORY STORAGE
                                        |
                                        v
                                  FEATURE ENGINE
                                        |
                                        v
                              FOOD-SPECIFIC XGBOOST
                                        |
                                        v
                                  ML PREDICTION
                                        |
                  +---------------------+--------------------+
                  |                     |                    |
                  v                     v                    v
                 RUL                Risk Score          Risk Reasons
                  |                     |                    |
                  +---------------------+--------------------+
                                        |
                                        v
                                DRIVER DASHBOARD
```

------------------------------------------------------------------------

## 14. Cloud Deployment Recommendation

For a production cloud deployment, persistent storage should be used for
sensor history instead of depending only on process memory.

Recommended architecture:

``` text
Sensors
   |
   v
API Gateway
   |
   v
Sensor/Application Service
   |
   +------> Persistent Database / Time-Series Storage
   |
   v
ML Inference Service
   |
   v
Prediction Storage
   |
   v
Driver Dashboard
```

Store information such as:

-   Batch ID
-   Food type
-   Timestamp
-   Sensor values
-   Route
-   Weather information used for planning
-   Model version
-   Feature schema version
-   Prediction timestamp
-   Spoilage state
-   Spoilage probabilities
-   Risk score
-   RUL
-   Risk reasons
-   Driver action/recommendation

------------------------------------------------------------------------

## 15. Model Traceability

Each production prediction should be traceable to the deployed model.

Recommended metadata:

``` text
Model Version
Feature Schema Version
API Version
Food Model
Prediction Timestamp
Batch ID
```

This allows a prediction to be associated with the exact deployed
inference configuration.

------------------------------------------------------------------------

## 16. Reliability Principles

### Do not replace the learned model with hardcoded sensor thresholds

The deployed Phase 9.1 response reports:

``` text
Threshold_Driven: false
```

The model should remain responsible for the learned prediction.

### Keep food histories separate

Never mix Chicken readings with Fish readings.

### Use unique Batch IDs

Each transport session should have a unique batch identifier.

### Preserve timestamps

Chronological ordering is important for temporal features.

### Validate incoming data

Malformed or invalid sensor requests should be rejected before
inference.

### Monitor missing sensor values

The deployed preprocessing pipeline should be used for missing values.

### Monitor model drift

Production sensor distributions can differ from the original training
dataset.

### Treat RUL as an estimate

RUL should not be presented as a guaranteed expiration date.

------------------------------------------------------------------------

## 17. Monitoring

Production monitoring should include:

``` text
API latency
Prediction failures
Missing sensor readings
Sensor frequency
History length
Feature-generation failures
Model version
Prediction distributions
Risk distributions
RUL distributions
Weather API failures
Route API failures
```

Separate system failures from food-risk events.

Example:

``` text
SYSTEM ALERT
Weather API unavailable
```

is different from:

``` text
FOOD RISK ALERT
Chicken batch risk increased
```

------------------------------------------------------------------------

## 18. Driver Interface

The driver should not need to understand all 201 features.

A useful dashboard can display:

``` text
--------------------------------------------
FOOD TRANSPORT STATUS
--------------------------------------------

Food:          Chicken
Batch:         BATCH001

Route:         Bengaluru -> Chennai
Weather Risk:  Moderate

ML Risk:       MEDIUM
Risk Score:    43.8
Estimated RUL: 3.9 days

Spoilage State:
INTERMEDIATE

WHY?
The food-specific model assigns significant
probability to the intermediate spoilage state.

RECOMMENDED ACTION
- Continue cold-chain monitoring.
- Check refrigeration performance.
- Avoid unnecessary delays.
- Continue sensor monitoring.
--------------------------------------------
```

The dashboard can also show sensor and risk trends over time.

------------------------------------------------------------------------

## 19. Hackathon Demonstration

Recommended demonstration:

### Step 1

Enter:

``` text
From Address
To Address
Food Type
```

### Step 2

Obtain route and weather information.

### Step 3

Display expected route/weather risk.

### Step 4

Start transport monitoring.

### Step 5

Send raw sensor readings to:

``` text
POST /sensor
```

### Step 6

Show:

``` text
History Used
201 Features
Food-specific XGBoost
Spoilage Probabilities
Risk Score
RUL
Risk Reasons
```

### Step 7

Change sensor conditions to simulate deterioration.

### Step 8

Send additional chronological readings.

### Step 9

Show the updated prediction.

### Step 10

Display recommended driver action.

This demonstrates both:

``` text
PREDICTIVE TRANSPORT PLANNING
```

and:

``` text
REAL-TIME FOOD-SPOILAGE MONITORING
```

------------------------------------------------------------------------

## 20. Product Differentiator

The platform is not simply:

``` text
Temperature
    |
Threshold
    |
Alert
```

Instead:

``` text
Route
+
Weather Forecast
+
Food Type
+
Real Sensor Data
+
Historical Sensor Data
+
Feature Extraction
+
Food-Specific Machine Learning
        |
        v
Risk + RUL + Reasons + Driver Actions
```

This creates a complete intelligent food-transport monitoring workflow.

------------------------------------------------------------------------

## 21. Current Phase 9.1 ML Capabilities

The frozen developer package provides:

``` text
15 food-specific XGBoost models
201-feature inference representation
Chronological history support
Raw sensor /sensor API
Stateless /predict API
RUL output
Risk Score output
Risk Category output
Risk Reasons output
Spoilage probabilities
Health endpoint
Food listing endpoint
History retrieval
History deletion
```

The deployed service reports:

``` text
Model: Food-specific XGBoost
Features: 201
History Enabled: true
Threshold Driven: false
RUL Type: Dataset-derived estimate
```

------------------------------------------------------------------------

## 22. Final Product Summary

The final product workflow is:

``` text
ENTER
From + To + Food
       |
       v
ROUTE + WEATHER ANALYSIS
       |
       v
PRE-TRANSPORT RISK
       |
       v
TRANSPORT
       |
       v
RAW SENSOR DATA
       |
       v
CHRONOLOGICAL HISTORY
       |
       v
201 FEATURES
       |
       v
FOOD-SPECIFIC XGBOOST
       |
       v
SPOILAGE + RISK + RUL
       |
       v
RISK REASONS
       |
       v
DRIVER SOLUTIONS
       |
       v
CONTINUOUS INTELLIGENT MONITORING
```

### Product Goal

> Enter the origin, destination, and food type, estimate the expected
> route/weather risk, monitor actual transport conditions, automatically
> extract learned features from raw sensor data, use the correct
> food-specific ML model, continuously estimate spoilage risk and RUL,
> explain the current risk, and provide actionable guidance to the
> driver.

------------------------------------------------------------------------

## Disclaimer

This system is an AI/ML decision-support platform for food
transportation monitoring. Model-derived risk scores and RUL estimates
are not guaranteed food-safety certifications, legal compliance
determinations, or substitutes for applicable food-safety procedures,
cold-chain requirements, inspection, or professional judgment.

Weather forecasts are also predictions and can change during
transportation. Real-time sensor monitoring should therefore remain
active throughout the journey.
