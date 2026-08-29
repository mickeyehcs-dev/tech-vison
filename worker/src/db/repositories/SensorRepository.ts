import { executeQuery } from '../connection';
import { SensorModule, SensorStatus, EnvBindings, SensorLog } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { formatMySqlDateTime } from '../../utils/datetime';

function enrichSensorLiveStatus(sensor: any): SensorModule {
  const isLive = Boolean(
    sensor.is_active &&
    sensor.status !== 'removed' &&
    sensor.status !== 'offline' &&
    sensor.last_seen_at &&
    (Date.now() - new Date(sensor.last_seen_at).getTime() <= 120000 || sensor.is_live === 1 || sensor.is_live === true)
  );

  return {
    ...sensor,
    is_live: isLive
  };
}

export class SensorRepository {
  static async findById(id: number, env?: EnvBindings): Promise<SensorModule | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT sm.*, 
              IF(sm.last_seen_at IS NOT NULL AND sm.last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) AND sm.is_active = 1 AND sm.status != 'removed', 1, 0) as is_live,
              u.full_name as registered_by_name,
              dr.full_name as driver_name, dr.email as driver_email, dr.phone_number as driver_phone,
              d.id as current_delivery_id, d.delivery_code as current_delivery_code
       FROM sensor_modules sm
       LEFT JOIN users u ON sm.registered_by = u.id
       LEFT JOIN users dr ON sm.driver_id = dr.id
       LEFT JOIN deliveries d ON (d.sensor_module_id = sm.id OR (sm.driver_id IS NOT NULL AND d.driver_id = sm.driver_id)) AND d.status IN ('assigned', 'accepted', 'in_transit')
       WHERE sm.id = ? AND sm.status != 'removed'
       LIMIT 1`,
      [id],
      env
    );
    if (!rows[0]) return null;
    return enrichSensorLiveStatus(rows[0]);
  }

  static async findByDeviceId(deviceId: string, env?: EnvBindings): Promise<SensorModule | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT sm.*,
              IF(sm.last_seen_at IS NOT NULL AND sm.last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) AND sm.is_active = 1 AND sm.status != 'removed', 1, 0) as is_live,
              dr.full_name as driver_name, dr.email as driver_email, dr.phone_number as driver_phone
       FROM sensor_modules sm
       LEFT JOIN users dr ON sm.driver_id = dr.id
       WHERE sm.device_id = ? AND sm.status != 'removed' LIMIT 1`,
      [deviceId.trim()],
      env
    );
    if (!rows[0]) return null;
    return enrichSensorLiveStatus(rows[0]);
  }

  static async findByDriverId(driverId: number, env?: EnvBindings): Promise<SensorModule | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT sm.*,
              IF(sm.last_seen_at IS NOT NULL AND sm.last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) AND sm.is_active = 1 AND sm.status != 'removed', 1, 0) as is_live
       FROM sensor_modules sm 
       WHERE sm.driver_id = ? AND sm.is_active = 1 AND sm.status != 'removed' LIMIT 1`,
      [driverId],
      env
    );
    if (!rows[0]) return null;
    return enrichSensorLiveStatus(rows[0]);
  }

  static async assignDriver(sensorId: number, driverId: number | null, env?: EnvBindings): Promise<boolean> {
    // If driverId is provided, first unassign any other sensor currently assigned to this driver
    if (driverId) {
      await executeQuery(
        `UPDATE sensor_modules SET driver_id = NULL, status = 'available', updated_at = NOW() WHERE driver_id = ? AND id != ?`,
        [driverId, sensorId],
        env
      );
    }

    const newStatus: SensorStatus = driverId ? 'assigned' : 'available';
    const result = await executeQuery<ResultSetHeader>(
      `UPDATE sensor_modules SET driver_id = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [driverId, newStatus, sensorId],
      env
    );
    return result.affectedRows > 0;
  }

  static async create(
    module: {
      device_id: string;
      device_name: string;
      api_key_hash: string;
      hardware_model?: string;
      firmware_version?: string;
      registered_by?: number | null;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO sensor_modules 
       (device_id, device_name, api_key_hash, hardware_model, firmware_version, status, is_active, registered_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'available', 1, ?, NOW())`,
      [
        module.device_id,
        module.device_name,
        module.api_key_hash,
        module.hardware_model || 'SFM-ESP32-V1',
        module.firmware_version || '1.0.0',
        module.registered_by || null
      ],
      env
    );
    return result.insertId;
  }

  static async updateApiKeyHash(id: number, apiKeyHash: string, env?: EnvBindings): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE sensor_modules SET api_key_hash = ?, updated_at = NOW() WHERE id = ?',
      [apiKeyHash, id],
      env
    );
    return result.affectedRows > 0;
  }

  static async updateStatus(
    id: number,
    status: SensorStatus,
    env?: EnvBindings
  ): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE sensor_modules SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id],
      env
    );
    return result.affectedRows > 0;
  }

  static async updateLastSeen(id: number, env?: EnvBindings): Promise<void> {
    await executeQuery(
      'UPDATE sensor_modules SET last_seen_at = NOW() WHERE id = ?',
      [id],
      env
    );
  }

  static async softRemove(id: number, env?: EnvBindings): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      `UPDATE sensor_modules SET status = 'removed', is_active = 0, updated_at = NOW() WHERE id = ?`,
      [id],
      env
    );
    return result.affectedRows > 0;
  }

  static async getAvailableSensors(env?: EnvBindings): Promise<SensorModule[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT sm.id, sm.device_id, sm.device_name, sm.hardware_model, sm.firmware_version, sm.status, sm.last_seen_at,
              IF(sm.last_seen_at IS NOT NULL AND sm.last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) AND sm.is_active = 1 AND sm.status != 'removed', 1, 0) as is_live
       FROM sensor_modules sm
       WHERE sm.status = 'available' AND sm.is_active = 1
       ORDER BY sm.device_name ASC`,
      [],
      env
    );
    return rows.map((r) => enrichSensorLiveStatus(r));
  }

  static async listSensors(
    params: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    env?: EnvBindings
  ): Promise<{ sensors: SensorModule[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["sm.status != 'removed'"];
    const values: any[] = [];

    if (params.status) {
      conditions.push('sm.status = ?');
      values.push(params.status);
    }

    if (params.search) {
      conditions.push('(sm.device_id LIKE ? OR sm.device_name LIKE ?)');
      const term = `%${params.search.trim()}%`;
      values.push(term, term);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRows = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM sensor_modules sm ${whereClause}`,
      values,
      env
    );
    const total = countRows[0]?.count || 0;

    const querySql = `
      SELECT sm.id, sm.device_id, sm.device_name, sm.hardware_model, sm.firmware_version, sm.driver_id,
             sm.status, sm.is_active, sm.last_seen_at, sm.created_at, sm.updated_at,
             IF(sm.last_seen_at IS NOT NULL AND sm.last_seen_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) AND sm.is_active = 1 AND sm.status != 'removed', 1, 0) as is_live,
             u.full_name as registered_by_name,
             dr.full_name as driver_name, dr.email as driver_email, dr.phone_number as driver_phone,
             d.id as current_delivery_id, d.delivery_code as current_delivery_code
      FROM sensor_modules sm
      LEFT JOIN users u ON sm.registered_by = u.id
      LEFT JOIN users dr ON sm.driver_id = dr.id
      LEFT JOIN deliveries d ON (d.sensor_module_id = sm.id OR (sm.driver_id IS NOT NULL AND d.driver_id = sm.driver_id)) AND d.status IN ('assigned', 'accepted', 'in_transit')
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await executeQuery<RowDataPacket[]>(
      querySql,
      [...values, limit, offset],
      env
    );

    return {
      sensors: rows.map((r) => enrichSensorLiveStatus(r)),
      total,
      page,
      limit
    };
  }

  static async logTelemetry(
    log: {
      delivery_id: number;
      sensor_module_id: number;
      temperature: number;
      humidity: number;
      methane: number;
      co2: number;
      storage_hours?: number;
      storage_days?: number;
      score: number;
      status: string;
      risk_level: string;
      spoil_in?: number | null;
      device_recorded_at?: string | null;
    },
    env?: EnvBindings
  ): Promise<number> {
    const hours = log.storage_hours !== undefined 
      ? log.storage_hours 
      : (log.storage_days !== undefined ? log.storage_days * 24 : 0.00);
    const days = log.storage_days !== undefined 
      ? log.storage_days 
      : (hours / 24);

    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO sensor_logs 
       (delivery_id, sensor_module_id, temperature, humidity, methane, co2, storage_hours, storage_days, score, status, risk_level, spoil_in, device_recorded_at, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        log.delivery_id,
        log.sensor_module_id,
        log.temperature,
        log.humidity,
        log.methane,
        log.co2,
        hours,
        days,
        log.score,
        log.status,
        log.risk_level,
        log.spoil_in !== undefined ? log.spoil_in : null,
        formatMySqlDateTime(log.device_recorded_at)
      ],
      env
    );
    return result.insertId;
  }

  static async getLatestLogByDelivery(deliveryId: number, env?: EnvBindings): Promise<SensorLog | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM sensor_logs WHERE delivery_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      [deliveryId],
      env
    );
    return (rows[0] as SensorLog) || null;
  }

  static async getLogsByDelivery(
    deliveryId: number,
    limit: number = 100,
    env?: EnvBindings
  ): Promise<SensorLog[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT * FROM sensor_logs WHERE delivery_id = ? ORDER BY recorded_at ASC LIMIT ?`,
      [deliveryId, limit],
      env
    );
    return rows as SensorLog[];
  }

  static async getAllLogsForExport(
    params: { deliveryId?: number; limit?: number },
    env?: EnvBindings
  ): Promise<any[]> {
    const limit = params.limit || 5000;
    let sql = `
      SELECT sl.id, sl.delivery_id, d.delivery_code, d.food_name, sm.device_id,
             sl.temperature, sl.humidity, sl.methane, sl.co2, sl.storage_days,
             sl.score, sl.status, sl.risk_level, sl.spoil_in, sl.recorded_at
      FROM sensor_logs sl
      JOIN deliveries d ON sl.delivery_id = d.id
      JOIN sensor_modules sm ON sl.sensor_module_id = sm.id
    `;
    const values: any[] = [];
    if (params.deliveryId) {
      sql += ' WHERE sl.delivery_id = ?';
      values.push(params.deliveryId);
    }
    sql += ' ORDER BY sl.recorded_at DESC LIMIT ?';
    values.push(limit);

    const rows = await executeQuery<RowDataPacket[]>(sql, values, env);
    return rows;
  }
}
