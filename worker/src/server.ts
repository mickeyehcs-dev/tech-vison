import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import app from './index';

// Load .env variables if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      const val = values.join('=').trim();
      if (key && val !== undefined && process.env[key.trim()] === undefined) {
        process.env[key.trim()] = val;
      }
    }
  }
}

const port = parseInt(process.env.PORT || '8787', 10);
const host = process.env.HOST || '0.0.0.0';

const server = createServer(async (req, res) => {
  try {
    const url = `http://${req.headers.host || `${host}:${port}`}${req.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    }

    let body: any = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: body && body.length > 0 ? body : undefined
    });

    const env = {
      ENVIRONMENT: process.env.NODE_ENV || 'production',
      DB_HOST: process.env.DB_HOST || '127.0.0.1',
      DB_PORT: process.env.DB_PORT || '3306',
      DB_NAME: process.env.DB_NAME || process.env.DB_DATABASE || 'smart_food_delivery',
      DB_USER: process.env.DB_USER || 'root',
      DB_PASSWORD: process.env.DB_PASSWORD || '',
      JWT_SECRET: process.env.JWT_SECRET || 'super_secure_jwt_secret_key_smart_food_delivery_2026_x89',
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
      ML_MODEL_URL: process.env.ML_MODEL_URL || 'http://127.0.0.1:8001/api/predict'
    };

    const response = await app.fetch(request, env);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Server error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
});

server.listen(port, host, () => {
  console.log(`🚀 Smart Food Delivery Worker API listening at http://${host}:${port} (bound to 0.0.0.0:${port})`);
});
