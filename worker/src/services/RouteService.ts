import { calculateRouteRisk, RouteAnalyzeResponse } from '../utils/routeRiskCalculator';
import { DeliveryRepository } from '../db/repositories/DeliveryRepository';
import { Delivery, EnvBindings } from '../types';

export class RouteService {
  private static cache = new Map<string, { data: RouteAnalyzeResponse; expiresAt: number }>();

  /**
   * Retrieves route analysis for a delivery.
   * If the delivery already has stored route_risk_data in the database, uses that stored data
   * and DOES NOT re-query the external Weather/Route API.
   * If not yet stored, queries the Weather/Route API once and persists it in the database.
   */
  static async getDeliveryRouteAnalysis(
    delivery: Delivery,
    env?: EnvBindings
  ): Promise<RouteAnalyzeResponse> {
    if (delivery.route_risk_data) {
      try {
        const parsed = typeof delivery.route_risk_data === 'string'
          ? JSON.parse(delivery.route_risk_data)
          : delivery.route_risk_data;
        if (parsed && parsed.route) {
          return parsed as RouteAnalyzeResponse;
        }
      } catch (_) {}
    }

    const depDate = delivery.start_time
      ? new Date(delivery.start_time).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const result = await this.getRouteAnalysis(
      delivery.source_location,
      delivery.destination_location,
      depDate,
      '09:30',
      env
    );

    // Persist in DB so it is permanently attached to this delivery
    try {
      await DeliveryRepository.updateRouteRiskData(delivery.id, JSON.stringify(result), env);
      delivery.route_risk_data = JSON.stringify(result);
    } catch (_) {}

    return result;
  }

  static async getRouteAnalysis(
    currentLocation: string,
    destination: string,
    departureDate?: string,
    departureTime?: string,
    env?: EnvBindings
  ): Promise<RouteAnalyzeResponse> {
    const origin = (currentLocation || 'Anantapur').trim();
    const dest = (destination || 'Hyderabad').trim();
    const depDate = departureDate || new Date().toISOString().split('T')[0];
    const depTime = departureTime || '09:30';

    const cacheKey = `${origin.toLowerCase()}::${dest.toLowerCase()}::${depDate}::${depTime}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const routeUrl = env?.ROUTE_API_URL || 'http://127.0.0.1:8000';
    const payload = {
      current_location: origin,
      destination: dest,
      departure_date: depDate,
      departure_time: depTime
    };

    const endpoints = [
      `${routeUrl}/api/analyze`,
      `${routeUrl}/analyze`,
      `http://127.0.0.1:8000/api/analyze`,
      `http://127.0.0.1:8000/analyze`,
      `http://localhost:8000/api/analyze`,
      `http://localhost:8000/analyze`
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = (await res.json()) as any;
          const baseMinutes = Number(json.route?.travel_time_minutes ?? json.travel_time_minutes ?? 0);
          const bufferedMinutes = Math.round(baseMinutes * 1.20);
          const bufferedHours = Number((bufferedMinutes / 60).toFixed(2));
          const distanceKm = Number(json.route?.distance_km ?? json.distance_km ?? 0);

          const result: RouteAnalyzeResponse = {
            departure_time: json.departure_time || `${depDate}T${depTime}:00+05:30`,
            route: {
              distance_km: distanceKm,
              travel_time_minutes: baseMinutes,
              estimated_travel_time_minutes: bufferedMinutes,
              estimated_travel_time_hours: bufferedHours,
              delay_buffer_minutes: Math.round(baseMinutes * 0.20)
            },
            locations: json.locations || [],
            overall_risk: json.overall_risk || {
              level: 'low',
              score: 10,
              highest_risk_places: [],
              method: 'FastAPI Open-Meteo & OSRM Weather Route Model'
            },
            warning: json.warning
          };

          this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 10 * 60 * 1000 });
          return result;
        }
      } catch (_) {
        // continue to next endpoint
      }
    }

    // Fallback to internal route risk calculator
    const fallbackResult = calculateRouteRisk(origin, dest, depDate, depTime);
    this.cache.set(cacheKey, { data: fallbackResult, expiresAt: Date.now() + 5 * 60 * 1000 });
    return fallbackResult;
  }
}
