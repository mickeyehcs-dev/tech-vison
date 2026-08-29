import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { deliveryRoutes } from './routes/deliveries';
import { sensorRoutes } from './routes/sensors';
import { notificationRoutes } from './routes/notifications';
import { securityRoutes } from './routes/security';
import { locationRoutes } from './routes/locations';
import { adminRoutes } from './routes/admin';
import { publicTrackingRoutes } from './routes/publicTracking';
import { routeRiskRoutes } from './routes/routeRisk';
import { errorHandler } from './middleware/errorHandler';
import { AppEnv } from './types';

const app = new Hono<AppEnv>();

// CORS Middleware
app.use('*', async (c, next) => {
  const origin = c.env?.CORS_ORIGIN || '*';
  return cors({
    origin: (reqOrigin) => {
      // Allow all origins or localhost Vite dev server
      if (!reqOrigin || reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')) {
        return reqOrigin || '*';
      }
      return origin || '*';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-DEVICE-ID', 'X-API-KEY', 'X-Device-Id', 'X-Api-Key', 'X-Device-ID', 'X-API-Key'],
    credentials: true,
    maxAge: 86400
  })(c, next);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'online',
    service: 'Smart Food Delivery Worker API',
    timestamp: new Date().toISOString()
  });
});

// Mount Route Travel Risk API directly for external & internal calls
app.route('/api', routeRiskRoutes); // Mounts POST /api/analyze
app.route('/api/v1/route-risk', routeRiskRoutes);

// Public Live Tracking endpoints (no authentication required)
app.route('/api/v1/public/track', publicTrackingRoutes);
app.route('/api/v1/track', publicTrackingRoutes);

// Mount Versioned API Routes (/api/v1/*)
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/users', userRoutes);
app.route('/api/v1/deliveries', deliveryRoutes);
app.route('/api/v1/sensors', sensorRoutes);
app.route('/api/v1/notifications', notificationRoutes);
app.route('/api/v1/security', securityRoutes);
app.route('/api/v1/locations', locationRoutes);
app.route('/api/v1/admin', adminRoutes);

// Fallback 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: `Route not found: ${c.req.method} ${c.req.path}`
    },
    404
  );
});

// Global Error Handler
app.onError(errorHandler);

export default app;
