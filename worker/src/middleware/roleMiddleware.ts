import { Context, Next } from 'hono';
import { UserRole, AppEnv } from '../types';
import { errorResponse } from '../utils/response';

export function requireRole(...allowedRoles: UserRole[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return errorResponse(c, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return errorResponse(
        c,
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
        403
      );
    }

    await next();
  };
}
