import { Hono } from 'hono';
import { calculateRouteRisk } from '../utils/routeRiskCalculator';
import { AppEnv } from '../types';

const routeRiskRoutes = new Hono<AppEnv>();

// POST /api/analyze and POST /api/v1/route-risk/analyze
routeRiskRoutes.post('/analyze', async (c) => {
  try {
    const body = await c.req.json();
    const { current_location, destination, departure_date, departure_time } = body;

    if (!current_location || !destination) {
      return c.json(
        {
          detail: 'Both current_location and destination are required.'
        },
        422
      );
    }

    const depDate = departure_date || new Date().toISOString().split('T')[0];
    const depTime = departure_time || '09:30';

    const payload = {
      current_location,
      destination,
      departure_date: depDate,
      departure_time: depTime
    };

    // Attempt to query upstream weather/route service at 127.0.0.1:8000
    const routeUrl = c.env?.ROUTE_API_URL || 'http://127.0.0.1:8000';
    const upstreamEndpoints = [
      `${routeUrl}/api/analyze`,
      `${routeUrl}/analyze`,
      `http://127.0.0.1:8000/api/analyze`,
      `http://127.0.0.1:8000/analyze`
    ];

    for (const upstream of upstreamEndpoints) {
      try {
        const upstreamRes = await fetch(upstream, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (upstreamRes.ok) {
          const upstreamJson = await upstreamRes.json();
          return c.json(upstreamJson);
        }
      } catch (_) {
        // Continue to next endpoint or fallback
      }
    }

    // Fallback to internal route risk calculator if external service is offline
    const result = calculateRouteRisk(current_location, destination, depDate, depTime);
    return c.json(result);
  } catch (err: any) {
    return c.json(
      {
        detail: err.message || 'Routing or weather analysis error'
      },
      502
    );
  }
});

export { routeRiskRoutes };
