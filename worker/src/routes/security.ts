import { Hono } from 'hono';
import { SecurityService } from '../services/SecurityService';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { AppEnv } from '../types';

const securityRoutes = new Hono<AppEnv>();

securityRoutes.use('*', authMiddleware);

// GET /api/v1/security/logs (Admin only)
securityRoutes.get('/logs', requireRole('admin'), async (c) => {
  try {
    const search = c.req.query('search');
    const eventType = c.req.query('event_type');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);

    const result = await SecurityService.listLogs(
      { search, eventType, page, limit },
      c.env
    );

    return successResponse(c, result.logs, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

export { securityRoutes };
