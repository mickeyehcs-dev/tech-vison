# Route Travel Risk API

This FastAPI service calculates a driving route in India and returns weather
conditions and a rule-based travel-risk score for locations along that route.

## Start the API

```powershell
python -m pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`. Interactive API documentation
is available at `http://localhost:8000/docs`.

## Call from another website

Send a `POST` request to `/api/analyze`. CORS is enabled so a browser frontend
on another origin can call the API. In production, replace `allow_origins=["*"]`
in `server.py` with the exact domains that may use the API.

```js
async function analyzeRoute(routeRequest) {
  const response = await fetch('https://your-api-domain.example/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(routeRequest)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.detail);
  return result;
}

const result = await analyzeRoute({
  current_location: locationEnteredByYourUser,
  destination: destinationEnteredByYourUser,
  departure_date: departureDateEnteredByYourUser,
  departure_time: departureTimeEnteredByYourUser
});
```

`departure_date` must be `YYYY-MM-DD`, `departure_time` must be `HH:MM`, and
the departure must be within the next 16 days.

## Successful response format

`POST /api/analyze` returns HTTP `200` and JSON in this shape:

```json
{
  "departure_time": "2026-08-23T09:30+05:30",
  "route": {
    "distance_km": 362.4,
    "travel_time_minutes": 401.8
  },
  "locations": [
    {
      "place": "Anantapur, Andhra Pradesh, India",
      "distance_km": 0.0,
      "arrival_time": "2026-08-23T09:30+05:30",
      "temperature_c": 28.1,
      "humidity_percent": 72,
      "rain_probability_percent": 20,
      "wind_speed_kmh": 14.4,
      "risk": {
        "level": "low",
        "score": 0,
        "factors": ["no elevated weather threshold met"]
      }
    }
  ],
  "overall_risk": {
    "level": "moderate",
    "score": 25,
    "highest_risk_places": ["Hyderabad"],
    "method": "Rule-based weather risk using temperature, humidity, rain probability, and wind speed."
  },
  "warning": "Some route weather points could not be retrieved."
}
```

`warning` is optional. `locations` contains the start, destination, and sampled
points between them. Values are live forecasts, so their values and count vary.

Risk levels are `low` (0-19), `moderate` (20-49), and `high` (50-100).

## Error format

Validation errors and provider failures return JSON with a `detail` field.

```json
{
  "detail": "Choose a departure within the next 16 days."
}
```

Common status codes are `422` for invalid input or an unsupported date and
`502` when a routing, geocoding, or weather provider cannot be reached.
