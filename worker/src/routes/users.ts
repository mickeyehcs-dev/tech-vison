import { Hono } from 'hono';
import { UserService } from '../services/UserService';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { successResponse, errorResponse } from '../utils/response';
import { isValidEmail } from '../utils/validation';
import { UserRole, AppEnv } from '../types';

const userRoutes = new Hono<AppEnv>();

userRoutes.use('*', authMiddleware);

// GET /api/v1/users (Admin only)
userRoutes.get('/', requireRole('admin'), async (c) => {
  try {
    const role = c.req.query('role') as UserRole | undefined;
    const search = c.req.query('search');
    const isActiveStr = c.req.query('is_active');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '10', 10);

    const isActive = isActiveStr !== undefined ? parseInt(isActiveStr, 10) : undefined;

    const result = await UserService.listUsers(
      { role, search, is_active: isActive, page, limit },
      c.env
    );

    return successResponse(c, result.users, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

// GET /api/v1/users/drivers/active (Admin and Sender - for delivery assignment)
userRoutes.get('/drivers/active', requireRole('admin', 'sender'), async (c) => {
  try {
    const drivers = await UserService.getActiveDrivers(c.env);
    return successResponse(c, drivers);
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

// POST /api/v1/users (Admin only)
userRoutes.post('/', requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const body = await c.req.json();
    const { email, role, fullName, phoneNumber, initialPassword } = body;

    if (!email || !role) {
      return errorResponse(c, 'Email and role are required', 400);
    }

    if (!isValidEmail(email)) {
      return errorResponse(c, 'Invalid email format', 400);
    }

    if (!['admin', 'sender', 'driver'].includes(role)) {
      return errorResponse(c, 'Invalid role. Must be admin, sender, or driver', 400);
    }

    const result = await UserService.createUser(
      { email, role, fullName, phoneNumber, initialPassword },
      adminUser,
      c.env
    );

    return successResponse(c, result, 201);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// PUT /api/v1/users/:id (Admin only)
userRoutes.put('/:id', requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const body = await c.req.json();
    const { fullName, phoneNumber } = body;

    const updated = await UserService.updateUser(id, { fullName, phoneNumber }, adminUser, c.env);
    return successResponse(c, updated);
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// PATCH /api/v1/users/:id/status (Admin only)
userRoutes.patch('/:id/status', requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);
    const body = await c.req.json();
    const { isActive } = body;

    if (isActive === undefined) {
      return errorResponse(c, 'isActive boolean is required', 400);
    }

    await UserService.setUserStatus(id, Boolean(isActive), adminUser, c.env);
    return successResponse(c, { message: `User status updated to ${isActive ? 'active' : 'inactive'}` });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

// DELETE /api/v1/users/:id (Admin only - soft delete)
userRoutes.delete('/:id', requireRole('admin'), async (c) => {
  try {
    const adminUser = c.get('user');
    const id = parseInt(c.req.param('id') || '0', 10);

    await UserService.softDeleteUser(id, adminUser, c.env);
    return successResponse(c, { message: 'User deleted successfully' });
  } catch (err: any) {
    return errorResponse(c, err.message, 400);
  }
});

export { userRoutes };
