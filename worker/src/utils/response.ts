import { Context } from 'hono';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: any;
}

export function successResponse<T>(c: Context, data: T, status: number = 200, meta?: any) {
  const body: ApiResponse<T> = {
    success: true,
    data
  };
  if (meta) body.meta = meta;
  return c.json(body, status as any);
}

export function errorResponse(c: Context, message: string, status: number = 400) {
  const body: ApiResponse = {
    success: false,
    error: message
  };
  return c.json(body, status as any);
}
