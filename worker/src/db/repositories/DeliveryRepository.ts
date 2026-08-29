import { executeQuery, executeTransaction } from '../connection';
import { Delivery, DeliveryStatus, EnvBindings, UserRole } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { formatMySqlDateTime } from '../../utils/datetime';

export class DeliveryRepository {
  static async findById(id: number, env?: EnvBindings): Promise<Delivery | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT d.*, 
              s.full_name as sender_name, s.email as sender_email,
              dr.full_name as driver_name, dr.email as driver_email, dr.phone_number as driver_phone,
              COALESCE(sm.device_id, sm_dr.device_id) as device_id,
              COALESCE(sm.device_name, sm_dr.device_name) as device_name,
              COALESCE(d.sensor_module_id, sm_dr.id) as resolved_sensor_id
       FROM deliveries d
       JOIN users s ON d.sender_id = s.id
       LEFT JOIN users dr ON d.driver_id = dr.id
       LEFT JOIN sensor_modules sm ON d.sensor_module_id = sm.id
       LEFT JOIN sensor_modules sm_dr ON d.driver_id IS NOT NULL AND sm_dr.driver_id = d.driver_id AND sm_dr.status != 'removed'
       WHERE d.id = ?
       LIMIT 1`,
      [id],
      env
    );
    if (!rows[0]) return null;
    const item = rows[0] as Delivery & { resolved_sensor_id?: number };
    if (!item.sensor_module_id && item.resolved_sensor_id) {
      item.sensor_module_id = item.resolved_sensor_id;
    }
    return item;
  }

  static async findByCode(code: string, env?: EnvBindings): Promise<Delivery | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT d.*, 
              s.full_name as sender_name, s.email as sender_email,
              dr.full_name as driver_name, dr.email as driver_email, dr.phone_number as driver_phone,
              COALESCE(sm.device_id, sm_dr.device_id) as device_id,
              COALESCE(sm.device_name, sm_dr.device_name) as device_name,
              COALESCE(d.sensor_module_id, sm_dr.id) as resolved_sensor_id
       FROM deliveries d
       JOIN users s ON d.sender_id = s.id
       LEFT JOIN users dr ON d.driver_id = dr.id
       LEFT JOIN sensor_modules sm ON d.sensor_module_id = sm.id
       LEFT JOIN sensor_modules sm_dr ON d.driver_id IS NOT NULL AND sm_dr.driver_id = d.driver_id AND sm_dr.status != 'removed'
       WHERE d.delivery_code = ?
       LIMIT 1`,
      [code.trim()],
      env
    );
    if (!rows[0]) return null;
    const item = rows[0] as Delivery & { resolved_sensor_id?: number };
    if (!item.sensor_module_id && item.resolved_sensor_id) {
      item.sensor_module_id = item.resolved_sensor_id;
    }
    return item;
  }

  static async create(
    data: {
      delivery_code: string;
      sender_id: number;
      food_name: string;
      source_location: string;
      destination_location: string;
      start_time?: string;
      driver_id?: number | null;
    },
    env?: EnvBindings
  ): Promise<number> {
    let sensorId: number | null = null;
    let initialStatus: DeliveryStatus = 'pending';
    let assignedAt: string | null = null;

    if (data.driver_id) {
      initialStatus = 'assigned';
      assignedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Lookup driver's assigned sensor if any
      const [senRows] = await executeQuery<RowDataPacket[]>(
        'SELECT id FROM sensor_modules WHERE driver_id = ? AND is_active = 1 AND status != \'removed\' LIMIT 1',
        [data.driver_id],
        env
      );
      if (senRows && senRows.length > 0) {
        sensorId = senRows[0].id;
      }
    }

    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO deliveries (delivery_code, sender_id, driver_id, sensor_module_id, food_name, source_location, destination_location, start_time, status, assigned_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.delivery_code,
        data.sender_id,
        data.driver_id || null,
        sensorId,
        data.food_name,
        data.source_location,
        data.destination_location,
        formatMySqlDateTime(data.start_time) || formatMySqlDateTime(new Date()),
        initialStatus,
        assignedAt
      ],
      env
    );
    return result.insertId;
  }

  static async assignDriver(
    deliveryId: number,
    driverId: number,
    sensorModuleId?: number | null,
    env?: EnvBindings
  ): Promise<boolean> {
    return executeTransaction(async (conn) => {
      // 1. Check delivery status is pending
      const [delRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, status FROM deliveries WHERE id = ? FOR UPDATE',
        [deliveryId]
      );
      if (!delRows || delRows.length === 0 || (delRows[0].status !== 'pending' && delRows[0].status !== 'assigned')) {
        throw new Error('Delivery is not in a pending or assigned state');
      }

      // 2. Check driver is active driver
      const [drvRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, role, is_active FROM users WHERE id = ? AND deleted_at IS NULL',
        [driverId]
      );
      if (!drvRows || drvRows.length === 0 || drvRows[0].role !== 'driver' || !drvRows[0].is_active) {
        throw new Error('Selected driver is invalid or inactive');
      }

      // 3. Find driver's assigned sensor if not explicitly specified
      let resolvedSensorId = sensorModuleId || null;
      if (!resolvedSensorId) {
        const [senRows] = await conn.query<RowDataPacket[]>(
          'SELECT id FROM sensor_modules WHERE driver_id = ? AND is_active = 1 AND status != \'removed\' LIMIT 1',
          [driverId]
        );
        if (senRows && senRows.length > 0) {
          resolvedSensorId = senRows[0].id;
        }
      }

      // 4. Update delivery
      await conn.query(
        `UPDATE deliveries 
         SET driver_id = ?, sensor_module_id = ?, status = 'assigned', assigned_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [driverId, resolvedSensorId, deliveryId]
      );

      // 5. If sensor is resolved, log assignment
      if (resolvedSensorId) {
        await conn.query(
          `INSERT INTO delivery_sensor_assignments (delivery_id, sensor_module_id, assigned_at) VALUES (?, ?, NOW())`,
          [deliveryId, resolvedSensorId]
        );
      }

      return true;
    }, env);
  }

  static async rejectDelivery(deliveryId: number, env?: EnvBindings): Promise<boolean> {
    return executeTransaction(async (conn) => {
      const [delRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, status, sensor_module_id FROM deliveries WHERE id = ? FOR UPDATE',
        [deliveryId]
      );
      if (!delRows || delRows.length === 0) {
        throw new Error('Delivery not found');
      }
      if (delRows[0].status !== 'assigned') {
        throw new Error(`Cannot reject delivery with status: ${delRows[0].status}. Only newly assigned orders can be rejected.`);
      }

      const sensorId = delRows[0].sensor_module_id;
      if (sensorId) {
        await conn.query(
          'UPDATE delivery_sensor_assignments SET unassigned_at = NOW() WHERE delivery_id = ? AND sensor_module_id = ? AND unassigned_at IS NULL',
          [deliveryId, sensorId]
        );
      }

      // Revert delivery to pending with unassigned driver
      await conn.query(
        `UPDATE deliveries 
         SET driver_id = NULL, sensor_module_id = NULL, status = 'pending', assigned_at = NULL, accepted_at = NULL, updated_at = NOW()
         WHERE id = ?`,
        [deliveryId]
      );

      return true;
    }, env);
  }

  static async updateStatus(
    id: number,
    newStatus: DeliveryStatus,
    timestampField?: 'accepted_at' | 'started_at' | 'completed_at',
    env?: EnvBindings
  ): Promise<boolean> {
    return executeTransaction(async (conn) => {
      let updateSql = 'UPDATE deliveries SET status = ?, updated_at = NOW()';
      const params: any[] = [newStatus];

      if (timestampField) {
        updateSql += `, ${timestampField} = NOW()`;
      }

      updateSql += ' WHERE id = ?';
      params.push(id);

      const [res] = await conn.query<ResultSetHeader>(updateSql, params);

      // If completed or cancelled, free the sensor module
      if (newStatus === 'completed' || newStatus === 'cancelled') {
        const [delRows] = await conn.query<RowDataPacket[]>(
          'SELECT sensor_module_id FROM deliveries WHERE id = ?',
          [id]
        );
        const sensorId = delRows[0]?.sensor_module_id;
        if (sensorId) {
          await conn.query(
            "UPDATE sensor_modules SET status = 'available', updated_at = NOW() WHERE id = ?",
            [sensorId]
          );
          await conn.query(
            'UPDATE delivery_sensor_assignments SET unassigned_at = NOW() WHERE delivery_id = ? AND sensor_module_id = ? AND unassigned_at IS NULL',
            [id, sensorId]
          );
        }
      }

      return res.affectedRows > 0;
    }, env);
  }

  static async listDeliveries(
    params: {
      userId?: number;
      role?: UserRole;
      status?: DeliveryStatus;
      statusGroup?: 'pending' | 'current' | 'completed';
      search?: string;
      page?: number;
      limit?: number;
    },
    env?: EnvBindings
  ): Promise<{ deliveries: Delivery[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    // Role-based visibility
    if (params.role === 'sender' && params.userId) {
      conditions.push('d.sender_id = ?');
      values.push(params.userId);
    } else if (params.role === 'driver' && params.userId) {
      conditions.push('d.driver_id = ?');
      values.push(params.userId);
    }

    // Status / Status group
    if (params.status) {
      conditions.push('d.status = ?');
      values.push(params.status);
    } else if (params.statusGroup === 'pending') {
      conditions.push("d.status = 'pending'");
    } else if (params.statusGroup === 'current') {
      conditions.push("d.status IN ('assigned', 'accepted', 'in_transit')");
    } else if (params.statusGroup === 'completed') {
      conditions.push("d.status IN ('completed', 'cancelled')");
    }

    // Search query
    if (params.search) {
      conditions.push(
        '(d.delivery_code LIKE ? OR d.food_name LIKE ? OR d.source_location LIKE ? OR d.destination_location LIKE ? OR s.full_name LIKE ? OR dr.full_name LIKE ?)'
      );
      const term = `%${params.search.trim()}%`;
      values.push(term, term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as count 
      FROM deliveries d
      JOIN users s ON d.sender_id = s.id
      LEFT JOIN users dr ON d.driver_id = dr.id
      ${whereClause}
    `;

    const countRows = await executeQuery<RowDataPacket[]>(countSql, values, env);
    const total = countRows[0]?.count || 0;

    const querySql = `
      SELECT d.*, 
             s.full_name as sender_name, s.email as sender_email,
             dr.full_name as driver_name, dr.email as driver_email, dr.phone_number as driver_phone,
             COALESCE(sm.device_id, sm_dr.device_id) as device_id,
             COALESCE(sm.device_name, sm_dr.device_name) as device_name,
             COALESCE(d.sensor_module_id, sm_dr.id) as resolved_sensor_id
      FROM deliveries d
      JOIN users s ON d.sender_id = s.id
      LEFT JOIN users dr ON d.driver_id = dr.id
      LEFT JOIN sensor_modules sm ON d.sensor_module_id = sm.id
      LEFT JOIN sensor_modules sm_dr ON d.driver_id IS NOT NULL AND sm_dr.driver_id = d.driver_id AND sm_dr.status != 'removed'
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await executeQuery<RowDataPacket[]>(
      querySql,
      [...values, limit, offset],
      env
    );

    const deliveries = (rows as (Delivery & { resolved_sensor_id?: number })[]).map((d) => {
      if (!d.sensor_module_id && d.resolved_sensor_id) {
        d.sensor_module_id = d.resolved_sensor_id;
      }
      return d as Delivery;
    });

    return {
      deliveries,
      total,
      page,
      limit
    };
  }

  static async getActiveDeliveryForSensor(sensorModuleId: number, env?: EnvBindings): Promise<Delivery | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT d.* FROM deliveries d
       LEFT JOIN sensor_modules sm ON sm.id = ?
       WHERE (d.sensor_module_id = ? OR (sm.driver_id IS NOT NULL AND d.driver_id = sm.driver_id))
         AND d.status IN ('assigned', 'accepted', 'in_transit')
       ORDER BY (CASE WHEN d.status = 'in_transit' THEN 1 WHEN d.status = 'accepted' THEN 2 ELSE 3 END), d.id DESC
       LIMIT 1`,
      [sensorModuleId, sensorModuleId],
      env
    );
    return (rows[0] as Delivery) || null;
  }
}
