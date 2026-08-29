# CURL examples

## Health
```bash
curl http://localhost:8000/health
```

## Stateless prediction
Send the complete accumulated history when the client owns history.

```bash
curl -X POST http://localhost:8000/predict   -H "Content-Type: application/json"   -d '{
    "Food_Name": "Chicken",
    "Batch_ID": "BATCH001",
    "History": [
      {
        "Timestamp_Hours": 0,
        "Temperature": 30,
        "Humidity": 60,
        "Methane": 32,
        "CO2": 200,
        "Storage_Days": 2
      },
      {
        "Timestamp_Hours": 0.033333,
        "Temperature": 31,
        "Humidity": 59,
        "Methane": 35,
        "CO2": 220,
        "Storage_Days": 2
      }
    ]
  }'
```

## Server-managed chronological sensor input
Each request appends one reading to `Batch_ID`. The server then predicts using all accumulated readings.

```bash
curl -X POST http://localhost:8000/sensor   -H "Content-Type: application/json"   -d '{
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

Repeat `/sensor` with the same `Batch_ID`. The response should show:
`Server_History_Length: 1`, then `2`, then `3`, etc.

## Clear a batch
```bash
curl -X DELETE http://localhost:8000/history/BATCH001
```
