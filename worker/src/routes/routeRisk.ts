import { Hono } from 'hono';
import { RouteService } from '../services/RouteService';
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

    const result = await RouteService.getRouteAnalysis(
      current_location,
      destination,
      depDate,
      depTime,
      c.env
    );
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
