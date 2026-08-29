import { Hono } from 'hono';
import { LocationService } from '../services/LocationService';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { rateLimit } from '../middleware/rateLimitMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { AppEnv } from '../types';

const locationRoutes = new Hono<AppEnv>();

locationRoutes.use('*', authMiddleware);

// POST /api/v1/locations (Driver updates live GPS position)
locationRoutes.post('/', requireRole('driver'), rateLimit(60, 60), async (c) => {
  try {
    const driver = c.get('user');
    const body = await c.req.json();
    const { deliveryId, latitude, longitude } = body;

    if (!deliveryId || latitude === undefined || longitude === undefined) {
      return errorResponse(c, 'deliveryId, latitude, and longitude are required', 400);
    }

    const recorded = await LocationService.recordDriverLocation(
      driver.id,
      {
        deliveryId: Number(deliveryId),
        latitude: Number(latitude),
        longitude: Number(longitude)
      },
      c.env
    );

    return successResponse(c, recorded, 201);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// GET /api/v1/locations/:deliveryId (Location trail)
locationRoutes.get('/:deliveryId', async (c) => {
  try {
    const deliveryId = parseInt(c.req.param('deliveryId') || '0', 10);
    const limit = parseInt(c.req.query('limit') || '200', 10);

    const trail = await LocationService.getLocationTrail(deliveryId, limit, c.env);
    const latest = await LocationService.getLatestLocation(deliveryId, c.env);

    return successResponse(c, { trail, latest });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

export { locationRoutes };
