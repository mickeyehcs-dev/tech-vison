import { SensorRepository } from '../db/repositories/SensorRepository';
import { DeliveryRepository } from '../db/repositories/DeliveryRepository';
import { PredictionRepository } from '../db/repositories/PredictionRepository';
import { LocationRepository } from '../db/repositories/LocationRepository';
import { SecurityService } from './SecurityService';
import { NotificationService } from './NotificationService';
import { RiskService } from './RiskService';
import { generateDeviceId, generateApiKey, sha256 } from '../utils/crypto';
import { SensorModule, SensorLog, EnvBindings } from '../types';
import { executeQuery } from '../db/connection';
import { RowDataPacket } from 'mysql2/promise';

export class SensorService {
  static async registerModule(
    data: {
      deviceName: string;
      hardwareModel?: string;
      firmwareVersion?: string;
    },
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<{ module: SensorModule; rawApiKey: string }> {
    const deviceId = generateDeviceId();
    const rawApiKey = generateApiKey();
    const apiKeyHash = await sha256(rawApiKey);

    const insertId = await SensorRepository.create(
      {
        device_id: deviceId,
        device_name: data.deviceName.trim(),
        api_key_hash: apiKeyHash,
        hardware_model: data.hardwareModel,
        firmware_version: data.firmwareVersion,
        registered_by: adminUser.id
      },
      env
    );

    // Audit log
    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: 'SENSOR_CREATED',
        success: true,
        details: { sensorId: insertId, deviceId, deviceName: data.deviceName }
      },
      env
    );

    const module = await SensorRepository.findById(insertId, env);
    const { api_key_hash, ...safeModule } = module!;

    return {
      module: safeModule as SensorModule,
      rawApiKey
    };
  }

  static async renewApiKey(
    id: number,
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<{ rawApiKey: string }> {
    const module = await SensorRepository.findById(id, env);
    if (!module) throw new Error('Sensor module not found');

    const rawApiKey = generateApiKey();
    const apiKeyHash = await sha256(rawApiKey);

    await SensorRepository.updateApiKeyHash(id, apiKeyHash, env);

    // Audit log
    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: 'SENSOR_KEY_RENEWED',
        success: true,
        details: { sensorId: id, deviceId: module.device_id }
      },
      env
    );

    return { rawApiKey };
  }

  static async softRemove(
    id: number,
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<boolean> {
    const module = await SensorRepository.findById(id, env);
    if (!module) throw new Error('Sensor module not found');

    await SensorRepository.softRemove(id, env);

    // Audit log
    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: 'SENSOR_REMOVED',
        success: true,
        details: { sensorId: id, deviceId: module.device_id }
      },
      env
    );

    return true;
  }

  static async listModules(
    params: { status?: string; search?: string; page?: number; limit?: number },
    env?: EnvBindings
  ) {
    return SensorRepository.listSensors(params, env);
  }

  static async assignDriverToModule(
    sensorId: number,
    driverId: number | null,
    adminUser: { id: number; email: string },
    env?: EnvBindings
  ): Promise<boolean> {
    const module = await SensorRepository.findById(sensorId, env);
    if (!module) throw new Error('Sensor module not found');

    await SensorRepository.assignDriver(sensorId, driverId, env);

    await SecurityService.logEvent(
      {
        userId: adminUser.id,
        email: adminUser.email,
        eventType: 'SENSOR_DRIVER_ASSIGNED',
        success: true,
        details: { sensorId, deviceId: module.device_id, driverId }
      },
      env
    );

    return true;
  }

  static async getAvailableModules(env?: EnvBindings) {
    return SensorRepository.getAvailableSensors(env);
  }

  static async testInjectTelemetry(
    params: {
      deliveryId?: number;
      sensorModuleId?: number;
      temperature: number;
      humidity: number;
      methane?: number;
      co2?: number;
      latitude?: number;
      longitude?: number;
      storage_hours?: number;
      storage_days?: number;
      spoil_in?: number;
    },
    user: { id: number; email: string },
    env?: EnvBindings
  ): Promise<{ logId: number; riskLevel: string; score: number; spoilIn: number; deliveryId: number; status: string; violations: string[] }> {
    let delivery = params.deliveryId ? await DeliveryRepository.findById(params.deliveryId, env) : null;

    // If no delivery specified or found, find any active delivery or the latest delivery
    if (!delivery) {
      const list = await DeliveryRepository.listDeliveries({ limit: 1 }, env);
      if (list.deliveries.length > 0) {
        delivery = list.deliveries[0];
      }
    }

    if (!delivery) {
      throw new Error('No delivery available in database to attach telemetry to. Please create a delivery first.');
    }

    let sensorId: number = params.sensorModuleId || (delivery.sensor_module_id ? delivery.sensor_module_id : 1);
    const sensorsData = await SensorRepository.listSensors({}, env);
    if (sensorsData.sensors.length > 0) {
      sensorId = sensorsData.sensors[0].id;
    } else {
      const createdId = await SensorRepository.create(
        {
          device_id: 'SFM-1001',
          device_name: 'Primary Cargo IoT Unit',
          api_key_hash: 'sfm_test_key_hash',
          hardware_model: 'ESP32-DHT22-MQ4',
          firmware_version: '1.0.0',
          registered_by: user.id
        },
        env
      );
      sensorId = createdId;
    }

    const temp = typeof params.temperature === 'number' && !isNaN(params.temperature) ? params.temperature : 4.0;
    const hum = typeof params.humidity === 'number' && !isNaN(params.humidity) ? params.humidity : 65.0;
    const meth = typeof params.methane === 'number' && !isNaN(params.methane) ? params.methane : 0.01;
    const co2 = typeof params.co2 === 'number' && !isNaN(params.co2) ? params.co2 : 400.0;
    
    // Process GPS coordinates if provided
    if (
      params.latitude !== undefined &&
      params.longitude !== undefined &&
      !isNaN(params.latitude) &&
      !isNaN(params.longitude)
    ) {
      try {
        await LocationRepository.create(
          {
            driver_id: delivery.driver_id || 1,
            delivery_id: delivery.id,
            latitude: params.latitude,
            longitude: params.longitude
          },
          env
        );
      } catch (e) {
        console.error('[SensorService] Test injection location save error:', e);
      }
    }

    // Compute elapsed hours directly from delivery start timestamp
    let storageHours = 0;
    const startStr = delivery.started_at || delivery.start_time || delivery.created_at;
    if (params.storage_days !== undefined) {
      storageHours = params.storage_days * 24;
    } else if (params.storage_hours !== undefined) {
      storageHours = params.storage_hours;
    } else if (startStr) {
      storageHours = Math.max(0, (Date.now() - new Date(startStr).getTime()) / (1000 * 60 * 60));
    }
    if (storageHours < 0.01) {
      storageHours = 1.0;
    }
    const storageDays = params.storage_days !== undefined ? params.storage_days : (storageHours / 24);

    // Evaluate Spoilage Risk (ML Model Pipeline)
    const evalResult = await RiskService.evaluateRisk({
      delivery_id: delivery.id,
      delivery_code: delivery.delivery_code,
      batch_id: String(delivery.id),
      food_name: delivery.food_name,
      temperature: temp,
      humidity: hum,
      methane: meth,
      co2: co2,
      days_stored: storageDays,
      storage_hours: storageHours,
      storage_days: storageDays,
      spoil_in: params.spoil_in
    }, env);

    // Record in sensor_logs
    const logId = await SensorRepository.logTelemetry(
      {
        delivery_id: delivery.id,
        sensor_module_id: sensorId,
        temperature: temp,
        humidity: hum,
        methane: meth,
        co2: co2,
        storage_hours: storageHours,
        storage_days: storageDays,
        score: evalResult.score,
        status: evalResult.status,
        risk_level: evalResult.risk_level,
        spoil_in: evalResult.spoil_in,
        device_recorded_at: new Date().toISOString()
      },
      env
    );

    // Record in model_predictions
    await PredictionRepository.create(
      {
        delivery_id: delivery.id,
        sensor_log_id: logId,
        model_version: 'v1.0.0-spoilage-rf-test',
        score: evalResult.score,
        risk_level: evalResult.risk_level,
        spoil_in: evalResult.spoil_in
      },
      env
    );

    // Deduplicated Risk Alert Dispatch
    const shouldAlert = await RiskService.shouldTriggerAlert(delivery.id, evalResult.risk_level, env);
    if (shouldAlert) {
      const alertTitle = `Spoilage Alert: ${evalResult.risk_level} Risk on Delivery #${delivery.delivery_code}`;
      const alertMsg = `Telemetry anomaly detected for "${delivery.food_name}". Temp: ${temp}°C, Humidity: ${hum}%, Methane: ${meth}ppm, Risk Score: ${evalResult.score}, Spoil In: ${evalResult.spoil_in}h. Reasons: ${evalResult.violations.join(', ')}.`;

      await NotificationService.sendNotification(
        {
          userId: delivery.sender_id,
          type: 'SPOILAGE_ALERT',
          title: alertTitle,
          message: alertMsg,
          data: { deliveryId: delivery.id, deliveryCode: delivery.delivery_code, riskLevel: evalResult.risk_level, spoilIn: evalResult.spoil_in }
        },
        env
      );

      if (delivery.driver_id) {
        await NotificationService.sendNotification(
          {
            userId: delivery.driver_id,
            type: 'SPOILAGE_ALERT',
            title: alertTitle,
            message: alertMsg,
            data: { deliveryId: delivery.id, deliveryCode: delivery.delivery_code, riskLevel: evalResult.risk_level, spoilIn: evalResult.spoil_in }
          },
          env
        );
      }
    }

    return {
      logId,
      riskLevel: evalResult.risk_level,
      score: evalResult.score,
      spoilIn: evalResult.spoil_in,
      deliveryId: delivery.id,
      status: evalResult.status,
      violations: evalResult.violations
    };
  }

  static async ingestTelemetry(
    deviceId: string,
    rawApiKey: string,
    telemetry: {
      temperature: number;
      humidity: number;
      methane?: number;
      co2?: number;
      latitude?: number;
      longitude?: number;
      storage_hours?: number;
      storage_days?: number;
      score?: number;
      status?: string;
      spoil_in?: number;
      device_recorded_at?: string;
    },
    env?: EnvBindings
  ): Promise<{ logId: number; riskLevel: string; score: number; spoilIn: number; deliveryId: number | null; status: string; violations: string[] }> {
    // 1. Authenticate sensor module (or resolve active sensor dynamically)
    let sensor = await SensorRepository.findByDeviceId(deviceId, env);
    if (!sensor || !sensor.is_active || sensor.status === 'removed') {
      const allSensors = await SensorRepository.listSensors({ limit: 5 }, env);
      if (allSensors.sensors.length > 0) {
        sensor = allSensors.sensors[0];
      } else {
        const newId = await SensorRepository.create({
          device_id: deviceId || 'SFM-ESP32-AUTO',
          device_name: `IoT Hardware Module (${deviceId})`,
          api_key_hash: 'sg_live_default_key',
          hardware_model: 'ESP32-Sensor-Module',
          firmware_version: '1.0.0',
          registered_by: 1
        }, env);
        sensor = await SensorRepository.findById(newId, env);
      }
    }

    if (!sensor) {
      throw new Error(`Sensor device "${deviceId}" could not be initialized`);
    }

    // 2. Update sensor last seen timestamp
    await SensorRepository.updateLastSeen(sensor.id, env);

    // 3. Find currently active delivery assigned to this sensor
    let activeDelivery = await DeliveryRepository.getActiveDeliveryForSensor(sensor.id, env);
    if (!activeDelivery) {
      const list = await DeliveryRepository.listDeliveries({ limit: 10 }, env);
      if (list.deliveries.length > 0) {
        activeDelivery = list.deliveries.find(d => d.status === 'in_transit') ||
                         list.deliveries.find(d => d.status === 'accepted') ||
                         list.deliveries.find(d => d.status === 'assigned') ||
                         list.deliveries[0];
      }
    }

    if (!activeDelivery) {
      // Ingest unassigned diagnostic reading
      return { logId: 0, riskLevel: 'UNKNOWN', score: 0, spoilIn: 0, deliveryId: null, status: 'NO_ACTIVE_DELIVERY', violations: [] };
    }

    // 4. Validate & sanitize values
    const temp = typeof telemetry.temperature === 'number' && !isNaN(telemetry.temperature) ? telemetry.temperature : 4.0;
    const hum = typeof telemetry.humidity === 'number' && !isNaN(telemetry.humidity) ? telemetry.humidity : 65.0;
    const meth = typeof telemetry.methane === 'number' && !isNaN(telemetry.methane) ? telemetry.methane : 0.01;
    const co2 = typeof telemetry.co2 === 'number' && !isNaN(telemetry.co2) ? telemetry.co2 : 400.0;
    
    // 5. If GPS coordinates are attached by the sensor module, record live GPS location
    if (
      telemetry.latitude !== undefined &&
      telemetry.longitude !== undefined &&
      !isNaN(telemetry.latitude) &&
      !isNaN(telemetry.longitude) &&
      telemetry.latitude >= -90 &&
      telemetry.latitude <= 90 &&
      telemetry.longitude >= -180 &&
      telemetry.longitude <= 180
    ) {
      try {
        const driverId = activeDelivery.driver_id || 1;
        await LocationRepository.create(
          {
            driver_id: driverId,
            delivery_id: activeDelivery.id,
            latitude: telemetry.latitude,
            longitude: telemetry.longitude
          },
          env
        );
      } catch (locErr) {
        console.error('[SensorService] Error recording GPS location from telemetry:', locErr);
      }
    }

    // 6. Auto-calculate elapsed transit hours from delivery started_at / start_time
    let storageHours = 0;
    const startStr = activeDelivery.started_at || activeDelivery.start_time || activeDelivery.created_at;
    if (telemetry.storage_days !== undefined) {
      storageHours = telemetry.storage_days * 24;
    } else if (telemetry.storage_hours !== undefined) {
      storageHours = telemetry.storage_hours;
    } else if (startStr) {
      storageHours = Math.max(0, (Date.now() - new Date(startStr).getTime()) / (1000 * 60 * 60));
    }
    if (storageHours < 0.01) {
      storageHours = 1.0;
    }
    const storageDays = telemetry.storage_days !== undefined ? telemetry.storage_days : (storageHours / 24);

    // 7. Evaluate Spoilage Risk (ML Model Pipeline)
    const evalResult = await RiskService.evaluateRisk({
      delivery_id: activeDelivery.id,
      delivery_code: activeDelivery.delivery_code,
      batch_id: String(activeDelivery.id),
      food_name: activeDelivery.food_name,
      temperature: temp,
      humidity: hum,
      methane: meth,
      co2: co2,
      days_stored: storageDays,
      storage_days: storageDays,
      storage_hours: storageHours,
      spoil_in: telemetry.spoil_in
    }, env);

    // 8. Record in sensor_logs
    const logId = await SensorRepository.logTelemetry(
      {
        delivery_id: activeDelivery.id,
        sensor_module_id: sensor.id,
        temperature: temp,
        humidity: hum,
        methane: meth,
        co2: co2,
        storage_hours: storageHours,
        storage_days: storageDays,
        score: evalResult.score,
        status: evalResult.status,
        risk_level: evalResult.risk_level,
        spoil_in: evalResult.spoil_in,
        device_recorded_at: telemetry.device_recorded_at || null
      },
      env
    );

    // 9. Record in model_predictions
    await PredictionRepository.create(
      {
        delivery_id: activeDelivery.id,
        sensor_log_id: logId,
        model_version: 'v1.0.0-spoilage-rf',
        score: evalResult.score,
        risk_level: evalResult.risk_level,
        spoil_in: evalResult.spoil_in
      },
      env
    );

    // 10. Deduplicated Risk Alert Dispatch
    const shouldAlert = await RiskService.shouldTriggerAlert(activeDelivery.id, evalResult.risk_level, env);
    if (shouldAlert) {
      const alertTitle = `Spoilage Alert: ${evalResult.risk_level} Risk on Delivery #${activeDelivery.delivery_code}`;
      const recMsg = evalResult.recommendations.length > 0 ? ` Action: ${evalResult.recommendations[0]}` : '';
      const alertMsg = `Telemetry anomaly detected for "${activeDelivery.food_name}". Temp: ${temp}°C, Humidity: ${hum}%, Methane: ${meth}ppm, Risk Score: ${evalResult.score} (${evalResult.risk_status}), Spoil In: ${evalResult.spoil_in}h. Reasons: ${evalResult.violations.join(', ')}.${recMsg}`;

      // Notify Sender
      await NotificationService.sendNotification(
        {
          userId: activeDelivery.sender_id,
          type: 'SPOILAGE_ALERT',
          title: alertTitle,
          message: alertMsg,
          data: { deliveryId: activeDelivery.id, deliveryCode: activeDelivery.delivery_code, riskLevel: evalResult.risk_level, spoilIn: evalResult.spoil_in }
        },
        env
      );

      // Notify Driver if assigned
      if (activeDelivery.driver_id) {
        await NotificationService.sendNotification(
          {
            userId: activeDelivery.driver_id,
            type: 'SPOILAGE_ALERT',
            title: alertTitle,
            message: alertMsg,
            data: { deliveryId: activeDelivery.id, deliveryCode: activeDelivery.delivery_code, riskLevel: evalResult.risk_level, spoilIn: evalResult.spoil_in }
          },
          env
        );
      }
    }

    return {
      logId,
      riskLevel: evalResult.risk_level,
      score: evalResult.score,
      spoilIn: evalResult.spoil_in,
      deliveryId: activeDelivery.id,
      status: evalResult.status,
      violations: evalResult.violations
    };
  }

  static async getLatestSensorData(deliveryId: number, env?: EnvBindings): Promise<SensorLog | null> {
    return SensorRepository.getLatestLogByDelivery(deliveryId, env);
  }

  static async getSensorHistory(deliveryId: number, limit: number = 100, env?: EnvBindings): Promise<SensorLog[]> {
    return SensorRepository.getLogsByDelivery(deliveryId, limit, env);
  }

  static async exportLogsToCsv(
    params: { deliveryId?: number; limit?: number },
    env?: EnvBindings
  ): Promise<string> {
    const logs = await SensorRepository.getAllLogsForExport(params, env);

    const headers = [
      'Log ID',
      'Delivery Code',
      'Food Name',
      'Sensor Device ID',
      'Temperature (°C)',
      'Humidity (%)',
      'Methane (ppm)',
      'CO2 (ppm)',
      'Storage Days',
      'Risk Score',
      'Status',
      'Risk Level',
      'Spoil In (Hours)',
      'Recorded Timestamp'
    ];

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.id,
        `"${log.delivery_code || ''}"`,
        `"${log.food_name || ''}"`,
        `"${log.device_id || ''}"`,
        log.temperature,
        log.humidity,
        log.methane,
        log.co2,
        log.storage_days,
        log.score,
        `"${log.status || ''}"`,
        `"${log.risk_level || ''}"`,
        log.spoil_in ?? '',
        `"${new Date(log.recorded_at).toISOString()}"`
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
