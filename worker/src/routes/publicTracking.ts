import { Hono } from 'hono';
import { DeliveryRepository } from '../db/repositories/DeliveryRepository';
import { SensorService } from '../services/SensorService';
import { LocationService } from '../services/LocationService';
import { PredictionRepository } from '../db/repositories/PredictionRepository';
import { RouteService } from '../services/RouteService';
import { successResponse, errorResponse } from '../utils/response';
import { AppEnv } from '../types';

const publicTrackingRoutes = new Hono<AppEnv>();

// GET /api/v1/public/track/:code or /api/v1/track/:code
publicTrackingRoutes.get('/:code', async (c) => {
  try {
    const code = c.req.param('code').trim();

    let delivery = await DeliveryRepository.findByCode(code, c.env);
    if (!delivery && !isNaN(Number(code))) {
      delivery = await DeliveryRepository.findById(Number(code), c.env);
    }

    if (!delivery) {
      return errorResponse(c, `Delivery with tracking ID "${code}" was not found.`, 404);
    }

    // Fetch latest telemetry, location and live route analysis in parallel
    const depDate = delivery.start_time ? new Date(delivery.start_time).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const [latestSensor, locationData, predictions, routeRisk] = await Promise.all([
      SensorService.getLatestSensorData(delivery.id, c.env),
      LocationService.getLocationTrail(delivery.id, 50, c.env).then((trail) => ({
        trail,
        latest: trail[trail.length - 1] || null
      })),
      PredictionRepository.getByDeliveryId(delivery.id, 10, c.env),
      RouteService.getDeliveryRouteAnalysis(delivery, c.env)
    ]);

    return successResponse(c, {
      delivery,
      latestSensor,
      locations: locationData,
      predictions,
      routeRisk
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

export { publicTrackingRoutes };
