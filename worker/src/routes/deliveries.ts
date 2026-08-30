import { Hono } from 'hono';
import { DeliveryService } from '../services/DeliveryService';
import { SensorService } from '../services/SensorService';
import { PredictionRepository } from '../db/repositories/PredictionRepository';
import { LocationService } from '../services/LocationService';
import { RouteService } from '../services/RouteService';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { DeliveryStatus, AppEnv } from '../types';

const deliveryRoutes = new Hono<AppEnv>();

deliveryRoutes.use('*', authMiddleware);

// GET /api/v1/deliveries (Role-scoped list)
deliveryRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const status = c.req.query('status') as DeliveryStatus | undefined;
    const statusGroup = c.req.query('statusGroup') as 'pending' | 'current' | 'completed' | undefined;
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '10', 10);

    const result = await DeliveryService.listDeliveries(
      {
        userId: user.id,
        role: user.role,
        status,
        statusGroup,
        search,
        page,
        limit
      },
      c.env
    );

    return successResponse(c, result.deliveries, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

// POST /api/v1/deliveries (Sender create)
deliveryRoutes.post('/', requireRole('sender', 'admin'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { food_name, source_location, destination_location, start_time, driver_id } = body;

    if (!food_name || !source_location || !destination_location) {
      return errorResponse(c, 'Food name, source, and destination are required', 400);
    }

    const delivery = await DeliveryService.createDelivery(
      {
        food_name,
        source_location,
        destination_location,
        start_time,
        driver_id: driver_id ? parseInt(driver_id, 10) : undefined
      },
      user,
      c.env
    );

    return successResponse(c, delivery, 201);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// GET /api/v1/deliveries/:id (Detail view)
deliveryRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    const delivery = await DeliveryService.getDeliveryById(id, user, c.env);
    if (!delivery) {
      return errorResponse(c, 'Delivery not found', 404);
    }

    return successResponse(c, delivery);
  } catch (err: any) {
    return errorResponse(c, err.message, 403);
  }
});

// GET /api/v1/deliveries/:id/route-risk (Cached/persisted route risk)
deliveryRoutes.get('/:id/route-risk', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    const delivery = await DeliveryService.getDeliveryById(id, user, c.env);
    if (!delivery) {
      return errorResponse(c, 'Delivery not found', 404);
    }

    const routeAnalysis = await RouteService.getDeliveryRouteAnalysis(delivery, c.env);
    return successResponse(c, routeAnalysis);
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

// POST /api/v1/deliveries/:id/assign (Admin and Sender)
deliveryRoutes.post('/:id/assign', requireRole('admin', 'sender'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const body = await c.req.json();
    const { driver_id, sensor_module_id } = body;

    if (!driver_id) {
      return errorResponse(c, 'driver_id is required', 400);
    }

    const updated = await DeliveryService.assignDriver(
      id,
      parseInt(driver_id, 10),
      sensor_module_id ? parseInt(sensor_module_id, 10) : undefined,
      user,
      c.env
    );

    return successResponse(c, updated);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/deliveries/:id/reject (Driver only)
deliveryRoutes.post('/:id/reject', requireRole('driver'), async (c) => {
  try {
    const driver = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const body = await c.req.json().catch(() => ({}));

    const updated = await DeliveryService.rejectDelivery(id, driver, body?.reason, c.env);
    return successResponse(c, updated);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/deliveries/:id/accept (Driver only)
deliveryRoutes.post('/:id/accept', requireRole('driver'), async (c) => {
  try {
    const driver = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    const updated = await DeliveryService.acceptDelivery(id, driver, c.env);
    return successResponse(c, updated);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/deliveries/:id/start (Driver only)
deliveryRoutes.post('/:id/start', requireRole('driver'), async (c) => {
  try {
    const driver = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    const updated = await DeliveryService.startDelivery(id, driver, c.env);
    return successResponse(c, updated);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/deliveries/:id/complete (Driver only)
deliveryRoutes.post('/:id/complete', requireRole('driver'), async (c) => {
  try {
    const driver = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    const updated = await DeliveryService.completeDelivery(id, driver, c.env);
    return successResponse(c, updated);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// GET /api/v1/deliveries/:id/latest-sensor (Real-time polling)
deliveryRoutes.get('/:id/latest-sensor', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    await DeliveryService.getDeliveryById(id, user, c.env);

    const latest = await SensorService.getLatestSensorData(id, c.env);
    return successResponse(c, latest);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// GET /api/v1/deliveries/:id/sensors (Telemetry history for charts)
deliveryRoutes.get('/:id/sensors', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const limit = parseInt(c.req.query('limit') || '100', 10);

    await DeliveryService.getDeliveryById(id, user, c.env);

    const logs = await SensorService.getSensorHistory(id, limit, c.env);
    return successResponse(c, logs);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// GET /api/v1/deliveries/:id/predictions (ML prediction history)
deliveryRoutes.get('/:id/predictions', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const limit = parseInt(c.req.query('limit') || '100', 10);

    await DeliveryService.getDeliveryById(id, user, c.env);

    const predictions = await PredictionRepository.getByDeliveryId(id, limit, c.env);
    return successResponse(c, predictions);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// GET /api/v1/deliveries/:id/locations (GPS trail)
deliveryRoutes.get('/:id/locations', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const limit = parseInt(c.req.query('limit') || '200', 10);

    await DeliveryService.getDeliveryById(id, user, c.env);

    const trail = await LocationService.getLocationTrail(id, limit, c.env);
    const latest = await LocationService.getLatestLocation(id, c.env);

    return successResponse(c, { trail, latest });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

export { deliveryRoutes };
