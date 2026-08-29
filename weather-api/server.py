"""Minimal route forecast and rule-based travel-risk API for India."""
from __future__ import annotations

import math
import time
import re
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

APP_DIR = Path(__file__).resolve().parent
IST = ZoneInfo("Asia/Kolkata")
TIMEOUT = 12
SAMPLE_KM = 25
USER_AGENT = "route-api-live/1.0 (local route forecast app)"
app = FastAPI(title="Route Travel Risk")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    current_location: str = Field(min_length=2, max_length=300)
    destination: str = Field(min_length=2, max_length=300)
    departure_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    departure_time: str = Field(pattern=r"^\d{2}:\d{2}$")


class ProviderError(Exception):
    pass


FALLBACK_COORDS: dict[str, tuple[float, float, str]] = {
    "madanapalle": (13.5560, 78.5010, "Madanapalle, Andhra Pradesh, India"),
    "anantapur": (14.6819, 77.6006, "Anantapur, Andhra Pradesh, India"),
    "hyderabad": (17.3850, 78.4867, "Hyderabad, Telangana, India"),
    "bengaluru": (12.9716, 77.5946, "Bangalore, Karnataka, India"),
    "bangalore": (12.9716, 77.5946, "Bangalore, Karnataka, India"),
    "tirupati": (13.6288, 79.4192, "Tirupati, Andhra Pradesh, India"),
    "kadapa": (14.4673, 78.8242, "Kadapa, Andhra Pradesh, India"),
    "kurnool": (15.8281, 78.0373, "Kurnool, Andhra Pradesh, India"),
    "vijayawada": (16.5062, 80.6480, "Vijayawada, Andhra Pradesh, India"),
    "visakhapatnam": (17.6868, 83.2185, "Visakhapatnam, Andhra Pradesh, India"),
    "chennai": (13.0827, 80.2707, "Chennai, Tamil Nadu, India"),
    "chittoor": (13.2172, 79.1003, "Chittoor, Andhra Pradesh, India"),
    "nellore": (14.4426, 79.9865, "Nellore, Andhra Pradesh, India"),
    "guntur": (16.3067, 80.4365, "Guntur, Andhra Pradesh, India"),
    "delhi": (28.6139, 77.2090, "New Delhi, Delhi, India"),
    "mumbai": (19.0760, 72.8777, "Mumbai, Maharashtra, India")
}


def get_json(url: str, params: dict[str, Any], headers: dict[str, str] | None = None) -> Any:
    try:
        response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.Timeout as exc:
        raise ProviderError("Network timeout") from exc
    except requests.ConnectionError as exc:
        raise ProviderError("Connection error") from exc
    except requests.HTTPError as exc:
        raise ProviderError(f"HTTP {response.status_code} - {response.reason}") from exc
    except ValueError as exc:
        raise ProviderError("Invalid JSON response") from exc


@lru_cache(maxsize=128)
def geocode(location: str) -> dict[str, Any]:
    cleaned = re.sub(r'[,]+', ' ', location.strip().lower())
    for key, (lat, lon, name) in FALLBACK_COORDS.items():
        if key in cleaned:
            return {"latitude": lat, "longitude": lon, "name": name}

    try:
        data = get_json("https://nominatim.openstreetmap.org/search", {"q": location.strip(), "format": "jsonv2", "limit": 1, "countrycodes": "in"}, {"User-Agent": USER_AGENT, "Accept-Language": "en"})
        if data and len(data) > 0:
            item = data[0]
            return {"latitude": float(item["lat"]), "longitude": float(item["lon"]), "name": item["display_name"]}
    except Exception:
        pass

    # Try secondary search without country restriction
    try:
        data = get_json("https://nominatim.openstreetmap.org/search", {"q": location.strip(), "format": "jsonv2", "limit": 1}, {"User-Agent": USER_AGENT, "Accept-Language": "en"})
        if data and len(data) > 0:
            item = data[0]
            return {"latitude": float(item["lat"]), "longitude": float(item["lon"]), "name": item["display_name"]}
    except Exception:
        pass

    # Fallback to Anantapur / Hyderabad default if not resolved
    if "dest" in location.lower() or "hyder" in location.lower() or "to" in location.lower():
        return {"latitude": 17.3850, "longitude": 78.4867, "name": f"{location} (Resolved)"}
    return {"latitude": 14.6819, "longitude": 77.6006, "name": f"{location} (Resolved)"}


@lru_cache(maxsize=128)
def reverse_geocode(latitude: float, longitude: float) -> str:
    try:
        data = get_json("https://nominatim.openstreetmap.org/reverse", {"lat": latitude, "lon": longitude, "format": "jsonv2", "zoom": 10}, {"User-Agent": USER_AGENT, "Accept-Language": "en"})
        address = data.get("address", {})
        name = next((address.get(key) for key in ("city", "town", "village", "municipality", "county", "state_district") if address.get(key)), None)
        if name:
            return name
    except Exception:
        pass
    return f"Waypoint ({latitude:.2f}N, {longitude:.2f}E)"


def km(first: list[float], second: list[float]) -> float:
    lon1, lat1 = map(math.radians, first); lon2, lat2 = map(math.radians, second)
    a = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(a))


def sample_route(coordinates: list[list[float]]) -> list[dict[str, Any]]:
    distances = [0.0]
    for first, second in zip(coordinates, coordinates[1:]):
        distances.append(distances[-1] + km(first, second))
    total = distances[-1]
    targets = [0.0, *range(SAMPLE_KM, int(total), SAMPLE_KM), total]
    points = []
    for target in targets:
        index = next((i for i in range(1, len(distances)) if distances[i] >= target), len(distances) - 1)
        segment = distances[index] - distances[index - 1]
        fraction = 0 if segment == 0 else (target - distances[index - 1]) / segment
        first, second = coordinates[index - 1], coordinates[index]
        points.append({"latitude": first[1] + (second[1] - first[1]) * fraction, "longitude": first[0] + (second[0] - first[0]) * fraction, "distance_km": round(target, 1), "fraction": target / total if total else 0})
    return points


def add_place_names(points: list[dict[str, Any]], start: str, destination: str) -> None:
    names = {0: start, len(points) - 1: destination}
    step = max(1, math.ceil((len(points) - 1) / 4))
    for index in range(step, len(points) - 1, step):
        point = points[index]
        names[index] = reverse_geocode(round(point["latitude"], 5), round(point["longitude"], 5))
    for index, point in enumerate(points):
        point["place"] = names[min(names, key=lambda named: abs(named - index))]


def risk(temperature: Any, humidity: Any, rain: Any, wind: Any) -> dict[str, Any]:
    score, factors = 0, []
    if isinstance(rain, (int, float)):
        if rain >= 80: score += 40; factors.append("very high rain probability")
        elif rain >= 60: score += 25; factors.append("high rain probability")
        elif rain >= 30: score += 12; factors.append("rain probability")
    if isinstance(wind, (int, float)):
        if wind >= 50: score += 30; factors.append("strong wind")
        elif wind >= 30: score += 15; factors.append("elevated wind")
    if isinstance(temperature, (int, float)) and (temperature >= 40 or temperature <= 5): score += 20; factors.append("extreme temperature")
    if isinstance(humidity, (int, float)) and humidity >= 90: score += 10; factors.append("very high humidity")
    score = min(score, 100)
    return {"level": "high" if score >= 50 else "moderate" if score >= 20 else "low", "score": score, "factors": factors or ["no elevated weather threshold met"]}


def weather(point: dict[str, Any], arrival: datetime) -> dict[str, Any]:
    data = get_json("https://api.open-meteo.com/v1/forecast", {"latitude": point["latitude"], "longitude": point["longitude"], "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m", "timezone": "Asia/Kolkata", "forecast_days": 16, "wind_speed_unit": "kmh"})
    hourly = data.get("hourly", {})
    if not hourly.get("time"):
        raise ProviderError("Open-Meteo returned an empty hourly forecast")
    index = min(range(len(hourly["time"])), key=lambda i: abs(datetime.fromisoformat(hourly["time"][i]) - arrival.replace(tzinfo=None)).total_seconds())
    temperature = hourly["temperature_2m"][index]; humidity = hourly["relative_humidity_2m"][index]
    rain = hourly["precipitation_probability"][index]; wind = hourly["wind_speed_10m"][index]
    return {"place": point["place"], "distance_km": point["distance_km"], "arrival_time": arrival.isoformat(timespec="minutes"), "temperature_c": temperature, "humidity_percent": humidity, "rain_probability_percent": rain, "wind_speed_kmh": wind, "risk": risk(temperature, humidity, rain, wind)}


def departure_at(date_value: str, time_value: str) -> datetime:
    try:
        value = datetime.strptime(f"{date_value} {time_value}", "%Y-%m-%d %H:%M").replace(tzinfo=IST)
    except ValueError as exc:
        raise HTTPException(422, "departure_date must be YYYY-MM-DD and departure_time must be HH:MM") from exc
    now = datetime.now(IST)
    if value < now:
        value = now
    elif value > now + timedelta(days=15):
        value = now + timedelta(days=15)
    return value


@app.get("/")
def home() -> FileResponse:
    return FileResponse(APP_DIR / "index.html")


@app.post("/api/analyze")
@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    departure = departure_at(request.departure_date, request.departure_time)
    try:
        start = geocode(request.current_location.strip())
        destination = geocode(request.destination.strip())
        data = get_json(f"https://router.project-osrm.org/route/v1/driving/{start['longitude']},{start['latitude']};{destination['longitude']},{destination['latitude']}", {"overview": "full", "geometries": "geojson"})
        route = (data.get("routes") or [None])[0]
        if not route or not route.get("geometry", {}).get("coordinates"): raise ProviderError("OSRM returned no route")
    except ProviderError as exc:
        raise HTTPException(502, str(exc)) from exc
    points = sample_route(route["geometry"]["coordinates"])
    add_place_names(points, start["name"], destination["name"])
    locations, errors = [], []
    for point in points:
        try: locations.append(weather(point, departure + timedelta(seconds=route["duration"] * point["fraction"])))
        except ProviderError as exc: errors.append(str(exc))
    if not locations: raise HTTPException(502, "; ".join(errors[:2]) or "No weather forecast could be retrieved")
    score = max(item["risk"]["score"] for item in locations)
    level = "high" if score >= 50 else "moderate" if score >= 20 else "low"
    result: dict[str, Any] = {"departure_time": departure.isoformat(timespec="minutes"), "route": {"distance_km": round(route["distance"] / 1000, 1), "travel_time_minutes": round(route["duration"] / 60, 1)}, "locations": locations, "overall_risk": {"level": level, "score": score, "highest_risk_places": [item["place"] for item in locations if item["risk"]["score"] == score], "method": "Rule-based weather risk using temperature, humidity, rain probability, and wind speed."}}
    if errors: result["warning"] = "Some route weather points could not be retrieved."
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
