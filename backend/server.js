const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');
const { initDatabase } = require('./config/db');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable CORS for all frontend origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Device-ID']
}));

app.use(express.json());
app.use(morgan('dev'));

// Database Initialization
initDatabase().catch(err => {
  console.error('[DB Init Error]', err);
});

// Import API Routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const sensorsRoutes = require('./routes/sensors.routes');
const deliveriesRoutes = require('./routes/deliveries.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const routeRiskRoutes = require('./routes/route_risk.routes');
const notificationsRoutes = require('./routes/notifications.routes');

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sensors', sensorsRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api', routeRiskRoutes); // Mounts /api/analyze for Route Travel Risk API
app.use('/api/notifications', notificationsRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Food Transport Spoilage & Risk Tracking API',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Express Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Food Transport Spoilage API running on port ${PORT}`);
  console.log(`📡 Route Travel Risk API available at /api/analyze`);
  console.log(`📡 IoT Telemetry Ingest endpoint at /api/telemetry/ingest`);
  console.log(`=======================================================`);
});
