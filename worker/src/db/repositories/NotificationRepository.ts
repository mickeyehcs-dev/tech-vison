import { executeQuery } from '../connection';
import { Notification, EnvBindings } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export class NotificationRepository {
  static async create(
    data: {
      user_id: number;
      type: string;
      title: string;
      message: string;
      data_json?: any;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, title, message, data_json, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [
        data.user_id,
        data.type,
        data.title,
        data.message,
        data.data_json ? JSON.stringify(data.data_json) : null
      ],
      env
    );
    return result.insertId;
  }

  static async listByUser(
    userId: number,
    params: { is_read?: number; page?: number; limit?: number },
    env?: EnvBindings
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = ?'];
    const values: any[] = [userId];

    if (params.is_read !== undefined) {
      conditions.push('is_read = ?');
      values.push(params.is_read);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRows = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM notifications ${whereClause}`,
      values,
      env
    );
    const total = countRows[0]?.count || 0;

    const unreadRows = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId],
      env
    );
    const unreadCount = unreadRows[0]?.count || 0;

    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT id, user_id, type, title, message, data_json, is_read, created_at
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
      env
    );

    const formatted = rows.map((r) => ({
      ...r,
      data_json: typeof r.data_json === 'string' ? JSON.parse(r.data_json) : r.data_json
    })) as Notification[];

    return {
      notifications: formatted,
      total,
      unreadCount
    };
  }

  static async markRead(id: number, userId: number, env?: EnvBindings): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId],
      env
    );
    return result.affectedRows > 0;
  }

  static async markAllRead(userId: number, env?: EnvBindings): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId],
      env
    );
    return result.affectedRows > 0;
  }
}
