# Food Spoilage Intelligent Monitoring System --- Phase 9.1

## Local Laptop / VS Code Deployment and CURL Testing Guide

**Model:** Food-specific XGBoost\
**Food models:** 15\
**Feature representation:** 201 features\
**API:** FastAPI + Uvicorn\
**Primary real-time endpoint:** `POST /sensor`

------------------------------------------------------------------------

## 1. What this package does

This is the frozen Phase 9.1 inference/developer package. It is designed
to receive sensor readings, maintain chronological batch history,
generate the engineered 201-feature representation, select the
food-specific XGBoost model, and return spoilage, RUL, risk, and
explanation information.

Architecture:

``` text
Sensor / CURL
      |
      v
POST /sensor
      |
      v
Batch history
      |
      v
201 engineered features
      |
      v
Food-specific XGBoost
      |
      +----------------------+
      |          |           |
      v          v           v
Spoilage       RUL         Risk
State         Days         Score
                           |
                           v
                       Risk Reasons
```

Supported foods:

-   Apple
-   Beef
-   Bread
-   Cheese
-   Chicken
-   Eggs
-   Fish
-   Milk
-   Mushroom
-   Orange
-   Potato
-   Spinach
-   Strawberry
-   Tomato
-   Yogurt

------------------------------------------------------------------------

## 2. Important: this package is for inference

Do **not** retrain the model just to run it on your laptop.

You need the complete `FoodSpoilage_FINAL_Developer` folder, including
the Python files, model artifacts, schema/configuration files, and
`requirements.txt`.

Important files:

  File                      Purpose
  ------------------------- ----------------------------------------
  `app.py`                  FastAPI application and HTTP endpoints
  `predict.py`              Prediction/inference logic
  `feature_extractor.py`    Engineered feature generation
  `rul_engine.py`           RUL-related logic
  `risk_engine.py`          Risk assessment
  `history_manager.py`      Chronological batch history
  `config.py`               Configuration
  `requirements.txt`        Dependency versions
  `manifest.json`           Package/model metadata
  `feature_schema.json`     Frozen feature schema
  `model_performance.csv`   Model performance information
  `model_sha256.csv`        Model integrity information
  `food_audit.csv`          Food/model audit
  `CURL_EXAMPLES.md`        Additional CURL examples
  `Dockerfile`              Container deployment

Do not rename or remove model artifacts.

------------------------------------------------------------------------

## 3. Recommended laptop environment

Recommended:

``` text
Windows 10/11
Python 3.11.x 64-bit
VS Code
VS Code Python extension
```

The tested laptop environment used Python 3.11.9.

Use the dependency versions supplied in `requirements.txt`. Do not
randomly upgrade scikit-learn, XGBoost, NumPy, or other ML packages
after installation.

------------------------------------------------------------------------

## 4. Open the project

Extract:

``` text
FoodSpoilage_FINAL_Developer.zip
```

Open the folder containing `app.py` in VS Code.

In the VS Code terminal:

``` powershell
dir
```

You should see:

``` text
app.py
requirements.txt
predict.py
feature_extractor.py
...
```

------------------------------------------------------------------------

## 5. Create the Python virtual environment

If an old environment exists and points to another Python installation:

``` powershell
deactivate
```

Then delete it:

``` powershell
Remove-Item -Recurse -Force .venv
```

Create a Python 3.11 environment:

``` powershell
py -3.11 -m venv .venv
```

Activate:

``` powershell
.venv\Scripts\Activate.ps1
```

Verify:

``` powershell
python --version
```

Expected:

``` text
Python 3.11.x
```

Also verify:

``` powershell
where.exe python
```

The first path should point to:

``` text
...\FoodSpoilage_FINAL_Developer\.venv\Scripts\python.exe
```

------------------------------------------------------------------------

## 6. Install dependencies

Check pip:

``` powershell
python -m pip --version
```

Install the package requirements:

``` powershell
python -m pip install -r requirements.txt
```

Verify the important packages:

``` powershell
python -c "import numpy, pandas, sklearn, xgboost, fastapi, uvicorn; print('ALL DEPENDENCIES OK'); print('Python:', __import__('sys').version); print('scikit-learn:', sklearn.__version__); print('XGBoost:', xgboost.__version__)"
```

Do not manually upgrade the ML packages after this.

------------------------------------------------------------------------

## 7. Select the VS Code interpreter

Press:

``` text
Ctrl + Shift + P
```

Select:

``` text
Python: Select Interpreter
```

Choose:

``` text
.venv\Scripts\python.exe
```

------------------------------------------------------------------------

## 8. Start the API

Use **Terminal 1**:

``` powershell
.venv\Scripts\Activate.ps1
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Keep this terminal open.

Expected:

``` text
Uvicorn running on http://127.0.0.1:8000
```

------------------------------------------------------------------------

## 9. Open Swagger API documentation

Open:

``` text
http://127.0.0.1:8000/docs
```

The API includes:

``` text
GET  /health
GET  /foods
GET  /history/{batch_id}
DELETE /history/{batch_id}

POST /predict
POST /sensor
```

------------------------------------------------------------------------

# 10. Use a second terminal for CURL

Open **Terminal 2**.

Activate the environment if necessary:

``` powershell
.venv\Scripts\Activate.ps1
```

On Windows PowerShell, use:

``` text
curl.exe
```

instead of:

``` text
curl
```

because `curl` may be interpreted as PowerShell's web-request alias.

------------------------------------------------------------------------

# 11. Test the API

``` powershell
curl.exe http://127.0.0.1:8000/health
```

Then:

``` powershell
curl.exe http://127.0.0.1:8000/foods
```

------------------------------------------------------------------------

# 12. Real-time CURL testing with `/sensor`

The `/sensor` endpoint is the main endpoint for sending one sensor
reading at a time.

Each reading contains:

``` text
Food_Name
Batch_ID
Timestamp_Hours
Temperature
Humidity
Methane
CO2
Storage_Days
```

The same `Batch_ID` must be used for readings belonging to the same
physical storage batch.

------------------------------------------------------------------------

# 13. Windows PowerShell CURL syntax

For direct JSON requests in PowerShell, use the stop-parsing operator:

``` text
--%
```

This prevents PowerShell from changing the CURL command's JSON escaping.

Do not use:

``` powershell
curl -X POST ...
```

Use:

``` powershell
curl.exe --% -X POST ...
```

------------------------------------------------------------------------

# 14. Chicken Reading #1

Run:

``` powershell
curl.exe --% -X POST http://127.0.0.1:8001/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0,"Temperature":30,"Humidity":60,"Methane":32,"CO2":200,"Storage_Days":2}}"
```

Important response fields include:

``` text
Current_Reading
History_Used
Feature_Count
Spoilage_State
Spoilage_Probabilities
Estimated_RUL_Days
Risk_Score
Risk_Category
Risk_Reasons
Model
Features
History_Enabled
Threshold_Driven
Server_History_Length
```

For the first reading, the expected history count is:

``` text
History_Used = 1
Server_History_Length = 1
Feature_Count = 201
```

------------------------------------------------------------------------

# 15. Chicken Reading #2

Use the same batch:

``` text
BATCH001
```

Send:

``` powershell
curl.exe --% -X POST http://127.0.0.1:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0.033333,"Temperature":32,"Humidity":58,"Methane":40,"CO2":250,"Storage_Days":2}}"
```

Expected:

``` text
Current_Reading = 2
History_Used = 2
Feature_Count = 201
Server_History_Length = 2
```

------------------------------------------------------------------------

# 16. Chicken Reading #3

``` powershell
curl.exe --% -X POST http://127.0.0.1:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0.066666,"Temperature":35,"Humidity":55,"Methane":60,"CO2":300,"Storage_Days":2}}"
```

Expected:

``` text
Current_Reading = 3
History_Used = 3
Feature_Count = 201
Server_History_Length = 3
```

------------------------------------------------------------------------

# 17. Verify the stored history

``` powershell
curl.exe http://127.0.0.1:8000/history/BATCH001
```

The response should contain the chronological readings for `BATCH001`.

This is the important real-time flow:

``` text
Reading #1
   |
   v
History = 1
   |
   v
201 features
   |
   v
Prediction

Reading #2
   |
   v
History = 2
   |
   v
201 features using previous + current history
   |
   v
Prediction

Reading #3
   |
   v
History = 3
   |
   v
201 features using previous + current history
   |
   v
Prediction
```

------------------------------------------------------------------------

# 18. Test a different food

Use a different batch:

``` text
BATCH002
```

Example Fish request:

``` powershell
curl.exe --% -X POST http://127.0.0.1:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Fish","Batch_ID":"BATCH002","Reading":{"Timestamp_Hours":0,"Temperature":5,"Humidity":70,"Methane":30,"CO2":250,"Storage_Days":2}}"
```

This verifies food-specific model routing.

------------------------------------------------------------------------

# 19. Test progressively worsening sensor conditions

For a manual robustness demonstration, keep the same batch and use
chronological timestamps.

Example:

``` text
Reading 1:
30°C, 60% humidity, methane 32, CO2 200

Reading 2:
32°C, 58% humidity, methane 40, CO2 250

Reading 3:
35°C, 55% humidity, methane 60, CO2 300

Reading 4:
40°C, 75% humidity, methane 300, CO2 500

Reading 5:
45°C, 85% humidity, methane 600, CO2 800
```

Use timestamps:

``` text
0
0.033333
0.066666
0.100000
0.133333
```

Observe:

``` text
History_Used
Feature_Count
Spoilage_State
Spoilage_Probabilities
Estimated_RUL_Days
Risk_Score
Risk_Category
Risk_Reasons
```

Do not assume every individual sensor change must produce a monotonic
response; the model uses the complete learned feature representation and
chronological history.

------------------------------------------------------------------------

# 20. Why chronological history matters

The feature pipeline uses temporal information such as:

``` text
History length
Elapsed time
Sensor deltas
Sensor rates
Acceleration
Rolling statistics
Trend/slope features
Cumulative statistics
EWMA
Baseline deviations
Sensor interactions
Food/sensor interactions
```

Therefore, readings should normally arrive in chronological order.

Example:

``` text
0.000000
0.033333
0.066666
0.100000
```

Avoid sending timestamps backwards.

------------------------------------------------------------------------

# 21. `/sensor` versus `/predict`

Use `/sensor` when the server should accumulate the history:

``` text
POST /sensor
   |
   +-- append current reading
   |
   +-- use accumulated history
   |
   +-- generate features
   |
   +-- predict
```

Use `/predict` when the caller supplies the complete accumulated
history:

``` text
POST /predict
   |
   +-- send complete history
   |
   +-- generate features
   |
   +-- predict
```

For a direct real-time sensor demonstration, `/sensor` is the easiest
endpoint.

------------------------------------------------------------------------

# 22. Clear a batch

After testing:

``` powershell
curl.exe -X DELETE http://127.0.0.1:8000/history/BATCH001
```

Then:

``` powershell
curl.exe http://127.0.0.1:8000/history/BATCH001
```

Use a new batch or clear the existing batch before starting a clean
experiment.

------------------------------------------------------------------------

# 23. Important distinction: inference is not retraining

Sending CURL sensor data does not change the XGBoost model.

The normal flow is:

``` text
Frozen XGBoost model
        +
Current sensor reading
        +
Previous batch history
        |
        v
201 engineered features
        |
        v
Prediction
```

The model weights are not updated by normal `/sensor` requests.

------------------------------------------------------------------------

# 24. RUL interpretation

The package reports:

``` text
Estimated_RUL_Days
```

This is a dataset-derived estimate.

The training dataset does not contain a direct supervised
time-to-failure target, so RUL should be described as an estimated
remaining useful life rather than a laboratory-validated exact
shelf-life measurement.

------------------------------------------------------------------------

# 25. Troubleshooting

### Python 3.14 path not found

If you see:

``` text
Python314\python.exe
The system cannot find the file specified
```

delete the old environment and recreate it:

``` powershell
deactivate
Remove-Item -Recurse -Force .venv
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python --version
```

------------------------------------------------------------------------

### pip `open_rich_spinner` error

If pip inside the virtual environment is inconsistent, recreate the
environment cleanly:

``` powershell
deactivate
Remove-Item -Recurse -Force .venv
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m ensurepip --upgrade
python -m pip --version
```

Then install:

``` powershell
python -m pip install -r requirements.txt
```

------------------------------------------------------------------------

### PowerShell says it cannot bind `Headers`

Do not use:

``` powershell
curl -H ...
```

Use:

``` powershell
curl.exe
```

------------------------------------------------------------------------

### JSON decode error from CURL

Use the exact direct-CURL form:

``` powershell
curl.exe --% -X POST http://127.0.0.1:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0,"Temperature":30,"Humidity":60,"Methane":32,"CO2":200,"Storage_Days":2}}"
```

Do not mix this with PowerShell's `Invoke-WebRequest` syntax.

------------------------------------------------------------------------

### `curl: (7) Failed to connect`

Make sure Terminal 1 is still running:

``` powershell
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then retry from Terminal 2.

------------------------------------------------------------------------

# 26. Complete laptop test sequence

## Terminal 1

``` powershell
.venv\Scripts\Activate.ps1
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

## Browser

``` text
http://127.0.0.1:8000/docs
```

## Terminal 2

``` powershell
.venv\Scripts\Activate.ps1
```

Health:

``` powershell
curl.exe http://127.0.0.1:8000/health
```

Foods:

``` powershell
curl.exe http://127.0.0.1:8000/foods
```

Reading 1:

``` powershell
curl.exe --% -X POST http://127.0.0.1:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0,"Temperature":30,"Humidity":60,"Methane":32,"CO2":200,"Storage_Days":2}}"
```

Reading 2:

``` powershell
curl.exe --% -X POST http://127.0.0.1:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0.033333,"Temperature":32,"Humidity":58,"Methane":40,"CO2":250,"Storage_Days":2}}"
```

Reading 3:

``` powershell
curl.exe --% -X POST http://127.0.0.1:8000/sensor -H "Content-Type: application/json" -d "{"Food_Name":"Chicken","Batch_ID":"BATCH001","Reading":{"Timestamp_Hours":0.066666,"Temperature":35,"Humidity":55,"Methane":60,"CO2":300,"Storage_Days":2}}"
```

History:

``` powershell
curl.exe http://127.0.0.1:8000/history/BATCH001
```

------------------------------------------------------------------------

# 27. What success looks like

You want to see:

``` text
Reading 1
History_Used = 1
Feature_Count = 201

Reading 2
History_Used = 2
Feature_Count = 201

Reading 3
History_Used = 3
Feature_Count = 201
```

and each response should provide:

``` text
Spoilage_State
Spoilage_Probabilities
Estimated_RUL_Days
Risk_Score
Risk_Category
Risk_Reasons
```

------------------------------------------------------------------------

# 28. Final laptop architecture

``` text
                    LAPTOP
        +-----------------------------+
        |           VS Code            |
        |                             |
        |        Python 3.11          |
        |             |               |
        |          .venv              |
        |             |               |
        |          FastAPI            |
        |             |               |
        |          Uvicorn            |
        +-------------+---------------+
                      |
                      | HTTP / CURL
                      v
                 POST /sensor
                      |
                      v
                Batch History
                      |
                      v
             Feature Extraction
                      |
                      v
                  201 Features
                      |
                      v
             Food-specific XGBoost
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
      Spoilage       RUL        Risk
       State         Days       Score
                                  |
                                  v
                            Risk Reasons
```

------------------------------------------------------------------------

# 29. Final checklist

Before demonstrating the model:

``` text
[ ] Python 3.11 installed
[ ] Project opened in VS Code
[ ] .venv created
[ ] .venv activated
[ ] Python version verified
[ ] requirements.txt installed
[ ] Dependencies imported successfully
[ ] app.py present
[ ] Model artifacts present
[ ] Uvicorn starts
[ ] /health works
[ ] /foods works
[ ] /docs opens
[ ] /sensor Reading 1 works
[ ] History = 1
[ ] /sensor Reading 2 works
[ ] History = 2
[ ] /sensor Reading 3 works
[ ] History = 3
[ ] Feature count = 201
[ ] RUL returned
[ ] Risk Score returned
[ ] Risk Category returned
[ ] Risk Reasons returned
[ ] Different food model tested
```

## One-command startup after installation

Once the environment is already configured:

``` powershell
.venv\Scripts\Activate.ps1
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then use a second terminal for `curl.exe` requests.
