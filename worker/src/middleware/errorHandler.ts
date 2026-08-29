import { Context } from 'hono';
import { errorResponse } from '../utils/response';

export function errorHandler(err: Error, c: Context) {
  console.error('Unhandled Application Error:', err);
  const message = err.message || 'Internal Server Error';
  return errorResponse(c, message, 500);
}
