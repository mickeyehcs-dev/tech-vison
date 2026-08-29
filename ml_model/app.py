from typing import Any, Optional
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import MANIFEST
from history_manager import HistoryManager
from predict import predict_from_sensor_payload, load_model

app = FastAPI(
    title="Food Spoilage Intelligent Monitoring API",
    version="9.1",
    description="Food-specific XGBoost inference with 201-feature chronological history.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

history_store = HistoryManager()

with open(MANIFEST, "r", encoding="utf-8") as f:
    MANIFEST_DATA = json.load(f)

FOODS = MANIFEST_DATA["trained_foods"]

class SensorReading(BaseModel):
    Timestamp_Hours: Optional[float] = None
    Temperature: Optional[float] = None
    Humidity: Optional[float] = None
    Methane: Optional[float] = None
    CO2: Optional[float] = None
    Storage_Days: float

class PredictRequest(BaseModel):
    Food_Name: str
    Batch_ID: str = "DEFAULT"
    History: list[SensorReading] = Field(min_length=1)

class IngestRequest(BaseModel):
    Food_Name: str
    Batch_ID: str
    Reading: SensorReading

@app.get("/")
def root():
    return {
        "service": "Food Spoilage Intelligent Monitoring API",
        "phase": "9.1",
        "foods": len(FOODS),
        "feature_count": MANIFEST_DATA["feature_count"],
        "history_enabled": True,
        "model": MANIFEST_DATA["model"],
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "phase": "9.1",
        "model_count": len(FOODS),
        "feature_count": MANIFEST_DATA["feature_count"],
    }

@app.get("/foods")
def foods():
    return {"foods": FOODS}

@app.get("/history/{batch_id}")
def get_history(batch_id: str):
    return {"Batch_ID": batch_id, "History": history_store.get(batch_id)}

@app.delete("/history/{batch_id}")
def clear_history(batch_id: str):
    history_store.clear(batch_id)
    return {"status": "cleared", "Batch_ID": batch_id}

@app.post("/predict")
@app.post("/api/predict")
def predict(req: PredictRequest):
    if req.Food_Name not in FOODS:
        raise HTTPException(status_code=400, detail=f"Unsupported Food_Name: {req.Food_Name}")
    try:
        payload = {
            "Food_Name": req.Food_Name,
            "Batch_ID": req.Batch_ID,
            "History": [r.model_dump() for r in req.History],
        }
        return predict_from_sensor_payload(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/sensor")
def sensor(req: IngestRequest):
    if req.Food_Name not in FOODS:
        raise HTTPException(status_code=400, detail=f"Unsupported Food_Name: {req.Food_Name}")

    reading = req.Reading.model_dump()
    history = history_store.append(req.Batch_ID, reading)

    try:
        payload = {
            "Food_Name": req.Food_Name,
            "Batch_ID": req.Batch_ID,
            "History": history,
        }
        result = predict_from_sensor_payload(payload)
        result["Server_History_Length"] = len(history)
        return result
    except Exception as exc:
        history_store.clear(req.Batch_ID)
        raise HTTPException(status_code=500, detail=str(exc))
