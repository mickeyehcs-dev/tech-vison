import { executeQuery } from '../connection';
import { SecurityLog, EnvBindings } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export class SecurityLogRepository {
  static async create(
    data: {
      user_id?: number | null;
      email?: string | null;
      event_type: string;
      ip_address?: string | null;
      user_agent?: string | null;
      success?: boolean;
      details_json?: any;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO security_logs (user_id, email, event_type, ip_address, user_agent, success, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.user_id || null,
        data.email || null,
        data.event_type,
        data.ip_address || null,
        data.user_agent ? data.user_agent.substring(0, 255) : null,
        data.success !== false ? 1 : 0,
        data.details_json ? JSON.stringify(data.details_json) : null
      ],
      env
    );
    return result.insertId;
  }

  static async listLogs(
    params: {
      search?: string;
      eventType?: string;
      page?: number;
      limit?: number;
    },
    env?: EnvBindings
  ): Promise<{ logs: SecurityLog[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (params.eventType) {
      conditions.push('event_type = ?');
      values.push(params.eventType);
    }

    if (params.search) {
      conditions.push('(email LIKE ? OR event_type LIKE ? OR ip_address LIKE ?)');
      const term = `%${params.search.trim()}%`;
      values.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM security_logs ${whereClause}`,
      values,
      env
    );
    const total = countRows[0]?.count || 0;

    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT id, user_id, email, event_type, ip_address, user_agent, success, details_json, created_at
       FROM security_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
      env
    );

    const formatted = rows.map((r) => ({
      ...r,
      details_json: typeof r.details_json === 'string' ? JSON.parse(r.details_json) : r.details_json
    })) as SecurityLog[];

    return {
      logs: formatted,
      total,
      page,
      limit
    };
  }
}
