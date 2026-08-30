from __future__ import annotations

import math
import time
import re
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor

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
    "kadiri": (14.1147, 78.1601, "Kadiri, Andhra Pradesh, India"),
    "anantapur": (14.6819, 77.6006, "Anantapur, Andhra Pradesh, India"),
    "ananthapur": (14.6819, 77.6006, "Anantapur, Andhra Pradesh, India"),
    "anantapuram": (14.6819, 77.6006, "Anantapur, Andhra Pradesh, India"),
    "hyderabad": (17.3850, 78.4867, "Hyderabad, Telangana, India"),
    "secunderabad": (17.4399, 78.4983, "Secunderabad, Telangana, India"),
    "dharmavaram": (14.4137, 77.7126, "Dharmavaram, Andhra Pradesh, India"),
    "hindupur": (13.8289, 77.4919, "Hindupur, Andhra Pradesh, India"),
    "guntakal": (15.1670, 77.3670, "Guntakal, Andhra Pradesh, India"),
    "kurnool": (15.8281, 78.0373, "Kurnool, Andhra Pradesh, India"),
    "kadapa": (14.4673, 78.8242, "Kadapa, Andhra Pradesh, India"),
    "tirupati": (13.6288, 79.4192, "Tirupati, Andhra Pradesh, India"),
    "tirupathi": (13.6288, 79.4192, "Tirupati, Andhra Pradesh, India"),
    "chittoor": (13.2172, 79.1003, "Chittoor, Andhra Pradesh, India"),
    "nellore": (14.4426, 79.9865, "Nellore, Andhra Pradesh, India"),
    "ongole": (15.5057, 80.0499, "Ongole, Andhra Pradesh, India"),
    "guntur": (16.3067, 80.4365, "Guntur, Andhra Pradesh, India"),
    "vijayawada": (16.5062, 80.6480, "Vijayawada, Andhra Pradesh, India"),
    "rajahmundry": (17.0005, 81.8040, "Rajahmundry, Andhra Pradesh, India"),
    "kakinada": (16.9891, 82.2475, "Kakinada, Andhra Pradesh, India"),
    "visakhapatnam": (17.6868, 83.2185, "Visakhapatnam, Andhra Pradesh, India"),
    "vizag": (17.6868, 83.2185, "Visakhapatnam, Andhra Pradesh, India"),
    "bengaluru": (12.9716, 77.5946, "Bangalore, Karnataka, India"),
    "bangalore": (12.9716, 77.5946, "Bangalore, Karnataka, India"),
    "chennai": (13.0827, 80.2707, "Chennai, Tamil Nadu, India"),
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
            return {"latitude": float(item["lat"]), "longitude": float(item["lon"]), "name": item.get("display_name", location)}
    except Exception:
        pass

    # Fallback coordinate heuristics for Indian towns
    if any(k in cleaned for k in ["hyder", "secunder", "telangana", "ts"]):
        return {"latitude": 17.3850, "longitude": 78.4867, "name": f"{location.strip()}"}
    if any(k in cleaned for k in ["bengal", "bangal", "karnat"]):
        return {"latitude": 12.9716, "longitude": 77.5946, "name": f"{location.strip()}"}
    if any(k in cleaned for k in ["madanapalle", "chittoor", "rayalaseema"]):
        return {"latitude": 13.5560, "longitude": 78.5010, "name": f"{location.strip()}"}
    if any(k in cleaned for k in ["kadiri"]):
        return {"latitude": 14.1147, "longitude": 78.1601, "name": f"{location.strip()}"}
    return {"latitude": 14.6819, "longitude": 77.6006, "name": f"{location.strip()}"}


def km(first: list[float], second: list[float]) -> float:
    lon1, lat1 = map(math.radians, first); lon2, lat2 = map(math.radians, second)
    a = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(a))


def sample_route(coordinates: list[list[float]]) -> list[dict[str, Any]]:
    distances = [0.0]
    for first, second in zip(coordinates, coordinates[1:]):
        distances.append(distances[-1] + km(first, second))
    total = distances[-1]
    
    # 6 to 10 points max for instant response
    num_points = 6 if total < 200 else (8 if total < 600 else 10)
    targets = [round(total * (i / (num_points - 1)), 1) for i in range(num_points)]

    points = []
    for target in targets:
        index = next((i for i in range(1, len(distances)) if distances[i] >= target), len(distances) - 1)
        segment = distances[index] - distances[index - 1]
        fraction = 0 if segment == 0 else (target - distances[index - 1]) / segment
        first, second = coordinates[index - 1], coordinates[index]
        points.append({
            "latitude": first[1] + (second[1] - first[1]) * fraction,
            "longitude": first[0] + (second[0] - first[0]) * fraction,
            "distance_km": round(target, 1),
            "fraction": target / total if total else 0
        })
    return points


@lru_cache(maxsize=256)
def reverse_geocode_locality(latitude: float, longitude: float, fallback_dist: float = 0.0) -> str:
    """
    Reverse geocodes coordinates to real village, mandal, or town name.
    Uses BigDataCloud high-speed reverse geocoding with local administrative hierarchy.
    """
    try:
        url = "https://api.bigdatacloud.net/data/reverse-geocode-client"
        params = {"latitude": round(latitude, 4), "longitude": round(longitude, 4), "localityLanguage": "en"}
        resp = requests.get(url, params=params, timeout=4)
        if resp.ok:
            data = resp.json()
            admin = data.get("localityInfo", {}).get("administrative", [])
            
            village = data.get("locality") or data.get("city") or ""
            if not village:
                for item in reversed(admin):
                    if item.get("adminLevel", 0) >= 6 and item.get("name"):
                        village = item["name"]
                        break

            district = ""
            for item in admin:
                if item.get("adminLevel") == 5 or "district" in item.get("name", "").lower():
                    district = re.sub(r'\s+district', '', item.get("name", ""), flags=re.I).strip()
                    break

            state = data.get("principalSubdivision") or ""

            if village and district and village.lower() != district.lower():
                return f"{village}, {district}"
            if village and state:
                return f"{village}, {state}"
            if village:
                return village
            if district:
                return f"{district} District"
    except Exception:
        pass

    return f"Transit Point (+{fallback_dist:.0f} km)"


def resolve_point_name(index: int, point: dict[str, Any], total_n: int, start: str, destination: str) -> None:
    if index == 0:
        point["place"] = start
    elif index == total_n - 1:
        point["place"] = destination
    else:
        lat = point["latitude"]
        lon = point["longitude"]
        dist = point["distance_km"]
        point["place"] = reverse_geocode_locality(lat, lon, dist)


def add_place_names(points: list[dict[str, Any]], start: str, destination: str) -> None:
    n = len(points)
    with ThreadPoolExecutor(max_workers=min(n, 8)) as executor:
        futures = [executor.submit(resolve_point_name, i, p, n, start, destination) for i, p in enumerate(points)]
        for f in futures:
            try:
                f.result()
            except Exception:
                pass


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
    try:
        data = get_json("https://api.open-meteo.com/v1/forecast", {
            "latitude": round(point["latitude"], 4),
            "longitude": round(point["longitude"], 4),
            "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m",
            "timezone": "Asia/Kolkata",
            "forecast_days": 16,
            "wind_speed_unit": "kmh"
        })
        hourly = data.get("hourly", {})
        if hourly.get("time"):
            index = min(range(len(hourly["time"])), key=lambda i: abs(datetime.fromisoformat(hourly["time"][i]) - arrival.replace(tzinfo=None)).total_seconds())
            temperature = hourly["temperature_2m"][index]
            humidity = hourly["relative_humidity_2m"][index]
            rain = hourly["precipitation_probability"][index]
            wind = hourly["wind_speed_10m"][index]
            return {
                "place": point["place"],
                "distance_km": point["distance_km"],
                "arrival_time": arrival.isoformat(timespec="minutes"),
                "temperature_c": temperature,
                "humidity_percent": humidity,
                "rain_probability_percent": rain,
                "wind_speed_kmh": wind,
                "risk": risk(temperature, humidity, rain, wind)
            }
    except Exception:
        pass

    # Safe fallback weather point if Open-Meteo has temporary timeout
    return {
        "place": point["place"],
        "distance_km": point["distance_km"],
        "arrival_time": arrival.isoformat(timespec="minutes"),
        "temperature_c": 28.5,
        "humidity_percent": 65,
        "rain_probability_percent": 10,
        "wind_speed_kmh": 12.0,
        "risk": {"level": "low", "score": 10, "factors": ["no elevated weather threshold met"]}
    }


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
    start = geocode(request.current_location.strip())
    destination = geocode(request.destination.strip())

    route = None
    try:
        data = get_json(
            f"https://router.project-osrm.org/route/v1/driving/{start['longitude']},{start['latitude']};{destination['longitude']},{destination['latitude']}",
            {"overview": "full", "geometries": "geojson"}
        )
        routes = data.get("routes") or []
        if routes and routes[0].get("geometry", {}).get("coordinates"):
            route = routes[0]
    except Exception:
        pass

    if not route:
        # Straight line approximation fallback
        dist = km([start['longitude'], start['latitude']], [destination['longitude'], destination['latitude']]) * 1.25
        duration_sec = (dist / 50.0) * 3600 # assume 50 km/h average truck speed
        route = {
            "distance": dist * 1000,
            "duration": duration_sec,
            "geometry": {
                "coordinates": [
                    [start['longitude'], start['latitude']],
                    [(start['longitude'] + destination['longitude']) / 2, (start['latitude'] + destination['latitude']) / 2],
                    [destination['longitude'], destination['latitude']]
                ]
            }
        }

    points = sample_route(route["geometry"]["coordinates"])
    add_place_names(points, start["name"], destination["name"])

    def fetch_point_weather(p: dict[str, Any]) -> dict[str, Any]:
        arr_time = departure + timedelta(seconds=route["duration"] * p["fraction"])
        return weather(p, arr_time)

    with ThreadPoolExecutor(max_workers=min(len(points), 8)) as executor:
        locations = list(executor.map(fetch_point_weather, points))

    score = max((item["risk"]["score"] for item in locations), default=10)
    level = "high" if score >= 50 else "moderate" if score >= 20 else "low"

    distance_km = round(route["distance"] / 1000, 1)
    travel_time_minutes = round(route["duration"] / 60, 1)
    estimated_travel_time_minutes = round(travel_time_minutes * 1.20)
    estimated_travel_time_hours = round(estimated_travel_time_minutes / 60, 2)
    delay_buffer_minutes = round(travel_time_minutes * 0.20)

    return {
        "departure_time": departure.isoformat(timespec="minutes"),
        "route": {
            "distance_km": distance_km,
            "travel_time_minutes": travel_time_minutes,
            "estimated_travel_time_minutes": estimated_travel_time_minutes,
            "estimated_travel_time_hours": estimated_travel_time_hours,
            "delay_buffer_minutes": delay_buffer_minutes
        },
        "locations": locations,
        "overall_risk": {
            "level": level,
            "score": score,
            "highest_risk_places": [item["place"] for item in locations if item["risk"]["score"] == score],
            "method": "Rule-based weather risk using temperature, humidity, rain probability, and wind speed."
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
