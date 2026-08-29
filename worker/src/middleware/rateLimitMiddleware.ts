import { Context, Next } from 'hono';
import { errorResponse } from '../utils/response';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export function rateLimit(limit: number = 60, windowSeconds: number = 60) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('x-forwarded-for') ||
      '127.0.0.1';

    const path = c.req.path;
    const key = `${ip}:${path}`;
    const now = Date.now();

    const record = memoryStore.get(key);

    if (record && record.resetTime > now) {
      if (record.count >= limit) {
        return errorResponse(
          c,
          'Too many requests. Please try again shortly.',
          429
        );
      }
      record.count += 1;
    } else {
      memoryStore.set(key, {
        count: 1,
        resetTime: now + windowSeconds * 1000
      });
    }

    await next();
  };
}
