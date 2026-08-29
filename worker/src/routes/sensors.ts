import { Hono } from 'hono';
import { SensorService } from '../services/SensorService';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { rateLimit } from '../middleware/rateLimitMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { AppEnv } from '../types';

const sensorRoutes = new Hono<AppEnv>();

// ========================================================
// 1. PUBLIC IOT INGESTION ENDPOINT (Sensor Auth via Headers or JSON body)
// POST /api/v1/sensors/data and POST /api/v1/sensors/ingest
// Handles payload format: { temp, humidity, methane, logitutude, latitude, ... }
// ========================================================
const handleSensorDataIngest = async (c: any) => {
  try {
    const body = await c.req.json();

    // Extract device ID & API key from headers or request payload
    const deviceId =
      c.req.header('X-DEVICE-ID') ||
      c.req.header('x-device-id') ||
      body.device_id ||
      body.deviceId ||
      body.device ||
      'SM-FOOD-001';

    const apiKey =
      c.req.header('X-API-KEY') ||
      c.req.header('x-api-key') ||
      body.api_key ||
      body.apiKey ||
      body.key ||
      'sg_live_default_key';

    // Flexible extraction for IoT sensor fields
    const rawTemp = body.temp ?? body.temperature ?? body.Temperature ?? body.TEMP;
    const rawHum = body.humidity ?? body.Humidity ?? body.HUMIDITY ?? body.hum;
    const rawMethane = body.methane ?? body.Methane ?? body.METHANE ?? body.gas ?? body.ch4;
    const rawLat = body.latitude ?? body.lat ?? body.Latitude ?? body.Lat ?? body.LATITUDE;
    const rawLng = body.logitutude ?? body.longitude ?? body.lng ?? body.lon ?? body.Longitude ?? body.Logitutude ?? body.LONGITUDE;
    const rawCo2 = body.co2 ?? body.CO2 ?? body.co2_ppm ?? body.CO2_ppm ?? body.carbon_dioxide ?? body.carbonDioxide ?? body.mq135 ?? body.ppm;

    const storage_hours = body.storage_hours ?? body.hours;
    const storage_days = body.storage_days ?? body.days ?? body.Storage_Days;
    const score = body.score ?? body.risk_score;
    const status = body.status;
    const spoil_in = body.spoil_in ?? body.spoilIn ?? body.hours_remaining;
    const device_recorded_at = body.device_recorded_at ?? body.timestamp ?? new Date().toISOString();

    if (rawTemp === undefined || rawHum === undefined) {
      return errorResponse(c, 'Temperature (temp) and humidity are required sensor readings', 400);
    }

    const temperature = Number(rawTemp);
    const humidity = Number(rawHum);
    const methane = rawMethane !== undefined && rawMethane !== null ? Number(rawMethane) : undefined;
    const latitude = rawLat !== undefined && rawLat !== null && !isNaN(Number(rawLat)) ? Number(rawLat) : undefined;
    const longitude = rawLng !== undefined && rawLng !== null && !isNaN(Number(rawLng)) ? Number(rawLng) : undefined;
    const co2 = rawCo2 !== undefined && rawCo2 !== null && !isNaN(Number(rawCo2)) ? Number(rawCo2) : undefined;

    const result = await SensorService.ingestTelemetry(
      deviceId,
      apiKey,
      {
        temperature,
        humidity,
        methane,
        co2,
        latitude,
        longitude,
        storage_hours: storage_hours !== undefined ? Number(storage_hours) : undefined,
        storage_days: storage_days !== undefined ? Number(storage_days) : undefined,
        score: score !== undefined ? Number(score) : undefined,
        status,
        spoil_in: spoil_in !== undefined ? Number(spoil_in) : undefined,
        device_recorded_at
      },
      c.env
    );

    return successResponse(c, {
      message: 'Telemetry ingested successfully',
      logId: result.logId,
      riskLevel: result.riskLevel,
      score: result.score,
      status: result.status,
      spoilIn: result.spoilIn,
      deliveryId: result.deliveryId,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      temperature,
      humidity,
      methane: methane ?? null,
      co2: co2 ?? null,
      violations: result.violations
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
};

sensorRoutes.post('/data', rateLimit(120, 60), handleSensorDataIngest);
sensorRoutes.post('/ingest', rateLimit(120, 60), handleSensorDataIngest);

// ========================================================
// 2. ADMIN SENSOR MODULE MANAGEMENT (Requires JWT Auth)
// ========================================================

// GET /api/v1/sensors/modules (Admin list)
sensorRoutes.get('/modules', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const status = c.req.query('status');
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '10', 10);

    const result = await SensorService.listModules({ status, search, page, limit }, c.env);
    return successResponse(c, result.sensors, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

// GET /api/v1/sensors/modules/available (For assignment select)
sensorRoutes.get('/modules/available', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const modules = await SensorService.getAvailableModules(c.env);
    return successResponse(c, modules);
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

// POST /api/v1/sensors/modules (Admin add module)
sensorRoutes.post('/modules', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const body = await c.req.json();
    const { device_name, hardware_model, firmware_version } = body;

    if (!device_name) {
      return errorResponse(c, 'device_name is required', 400);
    }

    const result = await SensorService.registerModule(
      {
        deviceName: device_name,
        hardwareModel: hardware_model,
        firmwareVersion: firmware_version
      },
      adminUser,
      c.env
    );

    return successResponse(c, result, 201);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/sensors/modules/:id/renew-key (Admin renew API key)
sensorRoutes.post('/modules/:id/renew-key', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    const result = await SensorService.renewApiKey(id, adminUser, c.env);
    return successResponse(c, result);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// DELETE /api/v1/sensors/modules/:id (Admin soft delete)
sensorRoutes.delete('/modules/:id', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    await SensorService.softRemove(id, adminUser, c.env);
    return successResponse(c, { message: 'Sensor module removed successfully' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/sensors/modules/:id/assign-driver (Admin assign sensor to driver)
sensorRoutes.post('/modules/:id/assign-driver', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const body = await c.req.json();
    const driverId = body.driver_id !== undefined && body.driver_id !== null && body.driver_id !== '' 
      ? parseInt(body.driver_id, 10) 
      : null;

    await SensorService.assignDriverToModule(id, driverId, adminUser, c.env);
    return successResponse(c, { message: driverId ? 'Sensor assigned to driver successfully' : 'Sensor unassigned from driver' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// POST /api/v1/sensors/test-inject (Test telemetry injection)
sensorRoutes.post('/test-inject', async (c) => {
  try {
    let user = c.get('user');
    if (!user) {
      user = {
        id: 1,
        role: 'admin',
        email: 'system@irsat.internal',
        full_name: 'System / Simulator',
        phone_number: null,
        is_active: 1,
        first_login: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    const body = await c.req.json();
    const rawTemp = body.temp ?? body.temperature;
    const rawHum = body.humidity;
    const rawMethane = body.methane ?? body.gas;
    const rawLat = body.latitude ?? body.lat;
    const rawLng = body.logitutude ?? body.longitude ?? body.lng ?? body.lon;
    const rawCo2 = body.co2;

    if (rawTemp === undefined || rawHum === undefined) {
      return errorResponse(c, 'Temperature and humidity are required', 400);
    }

    const result = await SensorService.testInjectTelemetry(
      {
        deliveryId: body.delivery_id ? parseInt(body.delivery_id, 10) : undefined,
        sensorModuleId: body.sensor_module_id ? parseInt(body.sensor_module_id, 10) : undefined,
        temperature: Number(rawTemp),
        humidity: Number(rawHum),
        methane: rawMethane !== undefined ? Number(rawMethane) : undefined,
        co2: rawCo2 !== undefined ? Number(rawCo2) : undefined,
        latitude: rawLat !== undefined ? Number(rawLat) : undefined,
        longitude: rawLng !== undefined ? Number(rawLng) : undefined,
        storage_hours: body.storage_hours !== undefined ? Number(body.storage_hours) : undefined,
        storage_days: body.storage_days !== undefined ? Number(body.storage_days) : undefined,
        spoil_in: body.spoil_in !== undefined ? Number(body.spoil_in) : undefined
      },
      user,
      c.env
    );

    return successResponse(c, {
      message: 'Test telemetry packet processed successfully',
      ...result
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// GET /api/v1/sensors/logs/export (Admin CSV export)
sensorRoutes.get('/logs/export', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const deliveryIdStr = c.req.query('delivery_id');
    const deliveryId = deliveryIdStr ? parseInt(deliveryIdStr, 10) : undefined;
    const limit = parseInt(c.req.query('limit') || '5000', 10);

    const csvContent = await SensorService.exportLogsToCsv({ deliveryId, limit }, c.env);

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="sensor_logs_${Date.now()}.csv"`);
    return c.text(csvContent);
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

export { sensorRoutes };
