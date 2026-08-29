import { Hono } from 'hono';
import { NotificationService } from '../services/NotificationService';
import { authMiddleware } from '../middleware/authMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { AppEnv } from '../types';

const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use('*', authMiddleware);

// GET /api/v1/notifications
notificationRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const isReadStr = c.req.query('is_read');
    const isRead = isReadStr !== undefined ? parseInt(isReadStr, 10) : undefined;
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);

    const result = await NotificationService.listUserNotifications(
      user.id,
      { is_read: isRead, page, limit },
      c.env
    );

    return successResponse(c, result.notifications, 200, {
      total: result.total,
      unreadCount: result.unreadCount
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

// PATCH /api/v1/notifications/:id/read
notificationRoutes.patch('/:id/read', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    await NotificationService.markAsRead(id, user.id, c.env);
    return successResponse(c, { message: 'Notification marked as read' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// PATCH /api/v1/notifications/read-all
notificationRoutes.patch('/read-all', async (c) => {
  try {
    const user = c.get('user');

    await NotificationService.markAllAsRead(user.id, c.env);
    return successResponse(c, { message: 'All notifications marked as read' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

export { notificationRoutes };
