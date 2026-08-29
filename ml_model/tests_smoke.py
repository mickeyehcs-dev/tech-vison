"""Offline smoke tests for the frozen Phase 9.1 package."""
import json
from pathlib import Path

from predict import predict_from_sensor_payload

ROOT = Path(__file__).resolve().parent

with open(ROOT / "manifest.json", encoding="utf-8") as f:
    manifest = json.load(f)

assert manifest["feature_count"] == 201
assert len(manifest["trained_foods"]) == 15

food = "Chicken"
history = []

for i in range(5):
    history.append({
        "Timestamp_Hours": i * 0.033333,
        "Temperature": 30 + i,
        "Humidity": 60 - i,
        "Methane": 32 + i * 4,
        "CO2": 200 + i * 20,
        "Storage_Days": 2,
    })

    out = predict_from_sensor_payload({
        "Food_Name": food,
        "Batch_ID": "SMOKE",
        "History": history,
    })

    assert out["History_Used"] == i + 1
    assert out["Feature_Count"] == 201
    assert 0 <= out["Risk_Score"] <= 100
    assert out["Risk_Category"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

print("Phase 9.1 smoke test: PASS")
print("Chronological history: 1 -> 2 -> 3 -> 4 -> 5")
print("Feature count: 201")
