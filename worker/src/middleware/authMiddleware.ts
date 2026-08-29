import { Context, Next } from 'hono';
import { verifyJwt } from '../utils/jwt';
import { UserRepository } from '../db/repositories/UserRepository';
import { errorResponse } from '../utils/response';
import { AppEnv } from '../types';

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const env = c.env;
  const authHeader = c.req.header('Authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Check cookie
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }
  }

  if (!token) {
    return errorResponse(c, 'Authentication required', 401);
  }

  const secret = env?.JWT_SECRET || 'super_secure_jwt_secret_key_smart_food_delivery_2026_x89';
  const payload = await verifyJwt(token, secret);

  if (!payload) {
    return errorResponse(c, 'Invalid or expired session token', 401);
  }

  // Check user is still active in database
  const user = await UserRepository.findById(payload.userId, env);
  if (!user || !user.is_active) {
    return errorResponse(c, 'User account is deactivated or deleted', 403);
  }

  const { password_hash, ...safeUser } = user;
  c.set('user', safeUser as any);
  c.set('tokenPayload', payload);

  await next();
}
