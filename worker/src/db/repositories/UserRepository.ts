import { executeQuery } from '../connection';
import { User, UserRole, EnvBindings } from '../../types';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export class UserRepository {
  static async findById(id: number, env?: EnvBindings): Promise<User | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      'SELECT id, email, password_hash, full_name, phone_number, role, is_active, first_login, created_at, updated_at, deleted_at FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [id],
      env
    );
    return (rows[0] as User) || null;
  }

  static async findByEmail(email: string, env?: EnvBindings): Promise<User | null> {
    const rows = await executeQuery<RowDataPacket[]>(
      'SELECT id, email, password_hash, full_name, phone_number, role, is_active, first_login, created_at, updated_at, deleted_at FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      [email.toLowerCase().trim()],
      env
    );
    return (rows[0] as User) || null;
  }

  static async create(
    user: {
      email: string;
      password_hash: string;
      full_name?: string | null;
      phone_number?: string | null;
      role: UserRole;
      first_login?: number;
    },
    env?: EnvBindings
  ): Promise<number> {
    const result = await executeQuery<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, full_name, phone_number, role, is_active, first_login, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, NOW())`,
      [
        user.email.toLowerCase().trim(),
        user.password_hash,
        user.full_name || null,
        user.phone_number || null,
        user.role,
        user.first_login !== undefined ? user.first_login : 1
      ],
      env
    );
    return result.insertId;
  }

  static async update(
    id: number,
    data: { full_name?: string | null; phone_number?: string | null },
    env?: EnvBindings
  ): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE users SET full_name = ?, phone_number = ? WHERE id = ? AND deleted_at IS NULL',
      [data.full_name || null, data.phone_number || null, id],
      env
    );
    return result.affectedRows > 0;
  }

  static async updatePassword(
    id: number,
    password_hash: string,
    first_login: number = 0,
    env?: EnvBindings
  ): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE users SET password_hash = ?, first_login = ? WHERE id = ? AND deleted_at IS NULL',
      [password_hash, first_login, id],
      env
    );
    return result.affectedRows > 0;
  }

  static async setStatus(id: number, is_active: boolean, env?: EnvBindings): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE users SET is_active = ? WHERE id = ? AND deleted_at IS NULL',
      [is_active ? 1 : 0, id],
      env
    );
    return result.affectedRows > 0;
  }

  static async softDelete(id: number, env?: EnvBindings): Promise<boolean> {
    const result = await executeQuery<ResultSetHeader>(
      'UPDATE users SET deleted_at = NOW(), is_active = 0 WHERE id = ?',
      [id],
      env
    );
    return result.affectedRows > 0;
  }

  static async listUsers(
    params: {
      role?: UserRole;
      search?: string;
      is_active?: number;
      page?: number;
      limit?: number;
    },
    env?: EnvBindings
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['deleted_at IS NULL'];
    const values: any[] = [];

    if (params.role) {
      conditions.push('role = ?');
      values.push(params.role);
    }

    if (params.is_active !== undefined) {
      conditions.push('is_active = ?');
      values.push(params.is_active);
    }

    if (params.search) {
      conditions.push('(email LIKE ? OR full_name LIKE ? OR phone_number LIKE ?)');
      const term = `%${params.search.trim()}%`;
      values.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      values,
      env
    );
    const total = countRows[0]?.count || 0;

    const querySql = `
      SELECT id, email, full_name, phone_number, role, is_active, first_login, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await executeQuery<RowDataPacket[]>(
      querySql,
      [...values, limit, offset],
      env
    );

    return {
      users: rows as User[],
      total,
      page,
      limit
    };
  }

  static async getActiveDrivers(env?: EnvBindings): Promise<User[]> {
    const rows = await executeQuery<RowDataPacket[]>(
      `SELECT u.id, u.email, u.full_name, u.phone_number, u.role, u.is_active,
              sm.id as sensor_module_id, sm.device_id, sm.device_name
       FROM users u
       LEFT JOIN sensor_modules sm ON sm.driver_id = u.id AND sm.status != 'removed'
       WHERE u.role = 'driver' AND u.is_active = 1 AND u.deleted_at IS NULL
       ORDER BY u.full_name ASC`,
      [],
      env
    );
    return rows as User[];
  }
}
