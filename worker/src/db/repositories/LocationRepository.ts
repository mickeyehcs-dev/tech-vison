import { executeQuery } from '../connection';
import { DriverLocation, EnvBindings } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export class LocationRepository {
  static async create(
    data: {
      driver_id: number;
      delivery_id: number;
      latitude: number;
      longitude: number;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO driver_locations (driver_id, delivery_id, latitude, longitude, recorded_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        data.driver_id,
        data.delivery_id,
        data.latitude,
        data.longitude
      ],
      env
    );
    return result.insertId;
  }

  static async getLatestByDeliveryId(
    deliveryId: number,
    env?: EnvBindings
  ): Promise<DriverLocation | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT id, driver_id, delivery_id, latitude, longitude, recorded_at FROM driver_locations WHERE delivery_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      [deliveryId],
      env
    );
    return (rows[0] as DriverLocation) || null;
  }

  static async getHistoryByDeliveryId(
    deliveryId: number,
    limit: number = 200,
    env?: EnvBindings
  ): Promise<DriverLocation[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT id, driver_id, delivery_id, latitude, longitude, recorded_at FROM driver_locations WHERE delivery_id = ? ORDER BY recorded_at ASC LIMIT ?`,
      [deliveryId, limit],
      env
    );
    return rows as DriverLocation[];
  }
}
