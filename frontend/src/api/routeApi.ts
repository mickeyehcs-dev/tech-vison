export interface RouteRiskDetail {
  level: 'low' | 'moderate' | 'high' | string;
  score: number;
  factors: string[];
}

export interface RouteWeatherLocation {
  place: string;
  distance_km: number;
  arrival_time: string;
  temperature_c: number;
  humidity_percent: number;
  rain_probability_percent: number;
  wind_speed_kmh: number;
  risk: RouteRiskDetail;
}

export interface RouteOverallRisk {
  level: 'low' | 'moderate' | 'high' | string;
  score: number;
  highest_risk_places: string[];
  method: string;
}

export interface RouteAnalyzeResponse {
  departure_time: string;
  route: {
    distance_km: number;
    travel_time_minutes: number;
    estimated_travel_time_minutes: number; // Base travel time + 20% delay buffer
    estimated_travel_time_hours: number;   // In hours (with 20% delay buffer)
    delay_buffer_minutes: number;          // 20% buffer allowance
  };
  locations: RouteWeatherLocation[];
  overall_risk: RouteOverallRisk;
  warning?: string;
  source_endpoint?: string;
}

export interface RouteAnalyzeParams {
  current_location: string;
  destination: string;
  departure_date: string; // YYYY-MM-DD
  departure_time: string; // HH:MM
}

const PRIMARY_ROUTE_URL = (import.meta as any).env?.VITE_ROUTE_API_URL || 'http://127.0.0.1:8000';
const BACKEND_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8787';

function normalizeResponse(json: any, endpointUrl?: string): RouteAnalyzeResponse {
  if (json.data && typeof json.data === 'object' && json.data.locations) {
    json = json.data;
  }

  const departure_time = json.departure_time || '09:30';
  const baseMinutes = Number(json.route?.travel_time_minutes ?? json.travel_time_minutes ?? json.duration_minutes ?? 0);
  
  // Calculate +20% extra time for transit delays
  const bufferedMinutes = Math.round(baseMinutes * 1.20);
  const delayBufferMinutes = Math.round(baseMinutes * 0.20);
  const bufferedHours = Number((bufferedMinutes / 60).toFixed(2));

  const route = {
    distance_km: Number(json.route?.distance_km ?? json.distance_km ?? 0),
    travel_time_minutes: baseMinutes,
    estimated_travel_time_minutes: bufferedMinutes,
    estimated_travel_time_hours: bufferedHours,
    delay_buffer_minutes: delayBufferMinutes
  };

  const rawLocations = json.locations || json.points || json.weather_points || json.waypoints || [];
  const locations: RouteWeatherLocation[] = rawLocations.map((loc: any, idx: number) => {
    const riskLevel = (loc.risk?.level || loc.risk_level || (loc.temperature_c > 35 ? 'high' : loc.temperature_c > 28 ? 'moderate' : 'low')).toLowerCase();
    const riskScore = Number(loc.risk?.score ?? loc.risk_score ?? (riskLevel === 'high' ? 75 : riskLevel === 'moderate' ? 45 : 15));
    const factors: string[] = Array.isArray(loc.risk?.factors)
      ? loc.risk.factors
      : Array.isArray(loc.factors)
      ? loc.factors
      : [];

    return {
      place: String(loc.place || loc.name || loc.city || `Waypoint #${idx + 1}`),
      distance_km: Number(loc.distance_km ?? loc.distance ?? idx * 25),
      arrival_time: String(loc.arrival_time || loc.time || departure_time),
      temperature_c: Number(loc.temperature_c ?? loc.temperature ?? loc.temp ?? 25),
      humidity_percent: Number(loc.humidity_percent ?? loc.humidity ?? 60),
      rain_probability_percent: Number(loc.rain_probability_percent ?? loc.rain_prob ?? loc.precipitation_probability ?? 0),
      wind_speed_kmh: Number(loc.wind_speed_kmh ?? loc.wind_speed ?? 10),
      risk: {
        level: riskLevel,
        score: riskScore,
        factors: factors.length > 0 ? factors : [`Weather condition normal`]
      }
    };
  });

  const overall_risk: RouteOverallRisk = {
    level: String(json.overall_risk?.level || json.overall_level || (locations.some((l) => l.risk.level === 'high') ? 'high' : locations.some((l) => l.risk.level === 'moderate') ? 'moderate' : 'low')),
    score: Number(json.overall_risk?.score ?? json.overall_score ?? (locations.length > 0 ? Math.max(...locations.map((l) => l.risk.score)) : 10)),
    highest_risk_places: Array.isArray(json.overall_risk?.highest_risk_places)
      ? json.overall_risk.highest_risk_places
      : locations.filter((l) => l.risk.level === 'high' || l.risk.level === 'moderate').map((l) => l.place),
    method: String(json.overall_risk?.method || 'FastAPI Open-Meteo & OSRM Weather Route Model')
  };

  return {
    departure_time,
    route,
    locations,
    overall_risk,
    warning: json.warning,
    source_endpoint: endpointUrl || PRIMARY_ROUTE_URL
  };
}

export const routeApi = {
  async analyzeRoute(params: RouteAnalyzeParams): Promise<RouteAnalyzeResponse> {
    const payload = {
      current_location: String(params.current_location || '').trim(),
      destination: String(params.destination || '').trim(),
      departure_date: String(params.departure_date || '').trim(),
      departure_time: String(params.departure_time || '').trim()
    };

    if (!payload.current_location || !payload.destination) {
      throw new Error('Please provide both current location and destination');
    }

    // Direct endpoints prioritizing 127.0.0.1:8000
    const endpoints = [
      `${PRIMARY_ROUTE_URL}/api/analyze`,
      `${PRIMARY_ROUTE_URL}/analyze`,
      `http://127.0.0.1:8000/api/analyze`,
      `http://127.0.0.1:8000/analyze`,
      `http://localhost:8000/api/analyze`,
      `http://localhost:8000/analyze`,
      `${BACKEND_URL}/api/analyze`,
      `${BACKEND_URL}/api/v1/route-risk/analyze`
    ];

    let lastError: Error | null = null;

    for (const url of endpoints) {
      try {
        console.log(`[routeApi] Requesting live weather route analysis from: ${url}`, payload);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const rawJson = await response.json();
          console.log(`[routeApi] Successfully received response from: ${url}`, rawJson);
          return normalizeResponse(rawJson, url);
        }

        try {
          const errJson = await response.json();
          if (errJson.detail) {
            const detailStr = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
            lastError = new Error(detailStr);
          }
        } catch (_) {}
      } catch (err: any) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    throw new Error('Could not connect to weather/route analysis service at 127.0.0.1:8000.');
  }
};
