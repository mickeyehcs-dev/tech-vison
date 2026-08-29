import { SecurityLogRepository } from '../db/repositories/SecurityLogRepository';
import { EnvBindings, SecurityLog } from '../types';

export class SecurityService {
  static async logEvent(
    data: {
      userId?: number | null;
      email?: string | null;
      eventType: string;
      ipAddress?: string | null;
      userAgent?: string | null;
      success?: boolean;
      details?: any;
    },
    env?: EnvBindings
  ): Promise<void> {
    try {
      await SecurityLogRepository.create(
        {
          user_id: data.userId || null,
          email: data.email || null,
          event_type: data.eventType,
          ip_address: data.ipAddress || null,
          user_agent: data.userAgent || null,
          success: data.success !== false,
          details_json: data.details || null
        },
        env
      );
    } catch (err) {
      console.error('Failed to record security log:', err);
    }
  }

  static async listLogs(
    params: { search?: string; eventType?: string; page?: number; limit?: number },
    env?: EnvBindings
  ): Promise<{ logs: SecurityLog[]; total: number; page: number; limit: number }> {
    return SecurityLogRepository.listLogs(params, env);
  }
}
