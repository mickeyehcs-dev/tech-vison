import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { EnvBindings, UserRole } from '../types';
import fs from 'fs';
import path from 'path';

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

let pool: Pool | null = null;
let isMySqlActive = false;

// Universal in-memory fallback store with full initial seed data
export interface MemoryStore {
  users: any[];
  sensor_modules: any[];
  deliveries: any[];
  sensor_logs: any[];
  driver_locations: any[];
  model_predictions: any[];
  notifications: any[];
  security_logs: any[];
  blockchain_batches: any[];
  blockchain_verifications: any[];
}

export const memoryStore: MemoryStore = {
  users: [
    {
      id: 1,
      email: 'admin@smartdelivery.com',
      password_hash: 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d',
      full_name: 'System Administrator (Chief Logistics)',
      phone_number: '+91 98450 11223',
      role: 'admin' as UserRole,
      is_active: 1,
      first_login: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    },
    {
      id: 2,
      email: 'sender@agrofarms.com',
      password_hash: 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d',
      full_name: 'Sunita Rao (Agro Fresh Farms)',
      phone_number: '+91 97410 44556',
      role: 'sender' as UserRole,
      is_active: 1,
      first_login: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    },
    {
      id: 3,
      email: 'driver@fastlogistics.com',
      password_hash: 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d',
      full_name: 'Venkatesh Reddy (Refrigerated Van 04)',
      phone_number: '+91 94401 88990',
      role: 'driver' as UserRole,
      is_active: 1,
      first_login: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    },
    {
      id: 4,
      email: 'driver2@coldchain.com',
      password_hash: 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d',
      full_name: 'Anil Sharma (Cold Truck AP-02)',
      phone_number: '+91 91234 56789',
      role: 'driver' as UserRole,
      is_active: 1,
      first_login: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    },
    {
      id: 5,
      email: 'newuser@transport.com',
      password_hash: 'pbkdf2:sha256:100000:b9cd5fb999d068f4d612ed802392bbab:d58cedae336cf504fb26a2c028e582e3227301977bf735386aa5c24eb1d7d60d',
      full_name: 'New Driver Onboarding',
      phone_number: '+91 99887 76655',
      role: 'driver' as UserRole,
      is_active: 1,
      first_login: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    }
  ],
  sensor_modules: [
    {
      id: 1,
      device_id: 'SFM-7C81A19D',
      device_name: 'Cold-Sense IoT Alpha',
      api_key_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      hardware_model: 'SFM-ESP32-V1',
      firmware_version: '1.2.0',
      driver_id: 3,
      status: 'assigned',
      is_active: 1,
      last_seen_at: new Date().toISOString(),
      registered_by: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      device_id: 'SFM-99214F8A',
      device_name: 'Bio-Respiration Sensor Beta',
      api_key_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      hardware_model: 'SFM-ESP32-PRO',
      firmware_version: '1.2.0',
      driver_id: 4,
      status: 'assigned',
      is_active: 1,
      last_seen_at: new Date().toISOString(),
      registered_by: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      device_id: 'SFM-44102B19',
      device_name: 'Agri-Tracker Unit Gamma (Spare)',
      api_key_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      hardware_model: 'SFM-ESP32-V1',
      firmware_version: '1.0.0',
      driver_id: null,
      status: 'available',
      is_active: 1,
      last_seen_at: null,
      registered_by: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  deliveries: [
    {
      id: 1,
      delivery_code: 'DEL-2026-8841',
      sender_id: 2,
      driver_id: 3,
      sensor_module_id: 1,
      food_name: 'Fresh Cow Milk (Pasteurized 500L)',
      source_location: 'Anantapur, Andhra Pradesh, India',
      destination_location: 'Hyderabad, Telangana, India',
      start_time: new Date(Date.now() - 7.5 * 3600 * 1000).toISOString(),
      status: 'in_transit',
      created_at: new Date(Date.now() - 8.5 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      assigned_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      accepted_at: new Date(Date.now() - 7.8 * 3600 * 1000).toISOString(),
      started_at: new Date(Date.now() - 7.5 * 3600 * 1000).toISOString(),
      completed_at: null
    },
    {
      id: 2,
      delivery_code: 'DEL-2026-9932',
      sender_id: 2,
      driver_id: 4,
      sensor_module_id: 2,
      food_name: 'Organic Ripe Tomatoes (1200 kg)',
      source_location: 'Madanapalle, Andhra Pradesh, India',
      destination_location: 'Bengaluru, Karnataka, India',
      start_time: new Date(Date.now() - 5.75 * 3600 * 1000).toISOString(),
      status: 'in_transit',
      created_at: new Date(Date.now() - 6.5 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      assigned_at: new Date(Date.now() - 6.2 * 3600 * 1000).toISOString(),
      accepted_at: new Date(Date.now() - 6.0 * 3600 * 1000).toISOString(),
      started_at: new Date(Date.now() - 5.75 * 3600 * 1000).toISOString(),
      completed_at: null
    },
    {
      id: 3,
      delivery_code: 'DEL-2026-4411',
      sender_id: 2,
      driver_id: null,
      sensor_module_id: null,
      food_name: 'Fresh Farm Strawberries (300 kg)',
      source_location: 'Mahabaleshwar, Maharashtra, India',
      destination_location: 'Pune, Maharashtra, India',
      start_time: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      status: 'pending',
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      assigned_at: null,
      accepted_at: null,
      started_at: null,
      completed_at: null
    },
    {
      id: 4,
      delivery_code: 'DEL-2026-1029',
      sender_id: 2,
      driver_id: 3,
      sensor_module_id: 1,
      food_name: 'Fresh Paneer & Butter Crates (400 kg)',
      source_location: 'Guntur, Andhra Pradesh, India',
      destination_location: 'Vijayawada, Andhra Pradesh, India',
      start_time: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
      status: 'completed',
      created_at: new Date(Date.now() - 29 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 25.5 * 3600 * 1000).toISOString(),
      assigned_at: new Date(Date.now() - 28.5 * 3600 * 1000).toISOString(),
      accepted_at: new Date(Date.now() - 28.2 * 3600 * 1000).toISOString(),
      started_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 25.5 * 3600 * 1000).toISOString()
    }
  ],
  sensor_logs: [
    {
      id: 1,
      delivery_id: 1,
      sensor_module_id: 1,
      sequence_number: 1,
      temperature: 4.8,
      humidity: 68.5,
      methane: 0.012,
      co2: 480,
      storage_hours: 7.5,
      storage_days: 0.31,
      score: 14,
      status: 'Safe',
      risk_level: 'LOW',
      spoil_in: 72.0,
      record_hash: '90a8870fb8de7fa0120150d0a793c2c7974011ef92955f11116fa05d6e2746eb',
      previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      device_recorded_at: new Date().toISOString(),
      recorded_at: new Date().toISOString()
    },
    {
      id: 2,
      delivery_id: 2,
      sensor_module_id: 2,
      sequence_number: 1,
      temperature: 18.5,
      humidity: 82.0,
      methane: 0.025,
      co2: 720,
      storage_hours: 5.75,
      storage_days: 0.24,
      score: 38,
      status: 'Moderate Risk',
      risk_level: 'MEDIUM',
      spoil_in: 36.0,
      record_hash: 'b1c8870fb8de7fa0120150d0a793c2c7974011ef92955f11116fa05d6e2746f0',
      previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      device_recorded_at: new Date().toISOString(),
      recorded_at: new Date().toISOString()
    }
  ],
  driver_locations: [
    {
      id: 1,
      driver_id: 3,
      delivery_id: 1,
      latitude: 15.8281,
      longitude: 78.0373,
      recorded_at: new Date().toISOString()
    },
    {
      id: 2,
      driver_id: 4,
      delivery_id: 2,
      latitude: 13.1800,
      longitude: 78.1000,
      recorded_at: new Date().toISOString()
    }
  ],
  model_predictions: [
    {
      id: 1,
      delivery_id: 1,
      sensor_log_id: 1,
      score: 14,
      risk_level: 'LOW',
      spoil_in: 72.0,
      factors: JSON.stringify(['Optimal cold chain parameters maintained']),
      recommendations: 'Temperature within optimal refrigeration boundary (2°C - 6°C). Maintain speed and ventilation.',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      delivery_id: 2,
      sensor_log_id: 2,
      score: 38,
      risk_level: 'MEDIUM',
      spoil_in: 36.0,
      factors: JSON.stringify(['High relative humidity detected', 'Ethylene & CO2 rising']),
      recommendations: 'High relative humidity detected. Ethylene & CO2 rising. Ensure cabin exhaust fan is turned ON to avoid premature soft-rot.',
      created_at: new Date().toISOString()
    }
  ],
  notifications: [
    {
      id: 1,
      user_id: 1,
      role_target: 'admin',
      type: 'DELIVERY_CREATED',
      title: 'New Delivery Created',
      message: 'Delivery DEL-2026-4411 (Fresh Farm Strawberries) created by Agro Fresh Farms.',
      delivery_id: 3,
      is_read: 0,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: 2,
      user_id: 1,
      role_target: 'admin',
      type: 'RISK_ALERT',
      title: 'Moderate Food Risk Alert',
      message: 'Delivery DEL-2026-9932: Elevated humidity and respiration gas detected in tomato consignment.',
      delivery_id: 2,
      is_read: 0,
      created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
    },
    {
      id: 3,
      user_id: 2,
      role_target: 'sender',
      type: 'DELIVERY_STARTED',
      title: 'Trip Started by Driver',
      message: 'Driver Venkatesh Reddy has started trip for Fresh Cow Milk (DEL-2026-8841).',
      delivery_id: 1,
      is_read: 0,
      created_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString()
    },
    {
      id: 4,
      user_id: 3,
      role_target: 'driver',
      type: 'DELIVERY_ASSIGNED',
      title: 'New Trip Assigned',
      message: 'You have been assigned to delivery DEL-2026-8841 (Fresh Cow Milk).',
      delivery_id: 1,
      is_read: 1,
      created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
    }
  ],
  security_logs: [
    {
      id: 1,
      user_id: 1,
      email: 'admin@smartdelivery.com',
      event_type: 'LOGIN_SUCCESS',
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Chrome/128.0',
      success: 1,
      details: null,
      created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
    }
  ],
  blockchain_batches: [
    {
      id: 1,
      batch_id: 'BATCH-DEL-2026-8841-001',
      delivery_id: 1,
      device_id: 'SFM-7C81A19D',
      start_sequence: 1,
      end_sequence: 1,
      record_count: 1,
      start_time: new Date(Date.now() - 7.5 * 3600 * 1000).toISOString(),
      end_time: new Date(Date.now() - 6.5 * 3600 * 1000).toISOString(),
      merkle_root: '9e2b17f54c86df5b682312b98e82110c71a3962d35c8b211f18546bdfc1452e8',
      blockchain_tx_id: 'tx_fab_8f72c91a03e14df8b64e5209ac741bde4410291e',
      block_number: 142,
      blockchain_status: 'ANCHORED',
      batch_type: 'PERIODIC_HOURLY',
      tamper_event_type: null,
      metadata_json: { notes: 'Hourly batch proof anchored to Hyperledger Fabric channel coldchain-channel' },
      verified_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 6.5 * 3600 * 1000).toISOString()
    },
    {
      id: 2,
      batch_id: 'BATCH-DEL-2026-9932-001',
      delivery_id: 2,
      device_id: 'SFM-99214F8A',
      start_sequence: 1,
      end_sequence: 1,
      record_count: 1,
      start_time: new Date(Date.now() - 5.75 * 3600 * 1000).toISOString(),
      end_time: new Date(Date.now() - 4.75 * 3600 * 1000).toISOString(),
      merkle_root: '3a884f18c2d589e9bbd62e171092a4e21a719c8f00b2184e1b854e7d9b9211c4',
      blockchain_tx_id: 'tx_fab_44a9018e6cb0f41295b9d31ecf01487bb0811e54',
      block_number: 143,
      blockchain_status: 'ANCHORED',
      batch_type: 'CRITICAL_EVENT',
      tamper_event_type: 'ELEVATED_RESPIRATION_GAS',
      metadata_json: { notes: 'Adaptive evidence proof triggered on respiration anomaly' },
      verified_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 4.75 * 3600 * 1000).toISOString()
    }
  ],
  blockchain_verifications: [
    {
      id: 1,
      batch_id: 'BATCH-DEL-2026-8841-001',
      delivery_id: 1,
      status: 'VALID',
      calculated_merkle_root: '9e2b17f54c86df5b682312b98e82110c71a3962d35c8b211f18546bdfc1452e8',
      blockchain_merkle_root: '9e2b17f54c86df5b682312b98e82110c71a3962d35c8b211f18546bdfc1452e8',
      hash_chain_valid: 1,
      tampered_record_count: 0,
      details_json: { verifiedRecords: 1, match: true },
      verified_by: 'SYSTEM_AUDITOR',
      verified_at: new Date().toISOString()
    }
  ]
};

export function getDbPool(env?: EnvBindings): Pool | null {
  if (pool) return pool;

  const host = env?.DB_HOST || process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(env?.DB_PORT || process.env.DB_PORT || '3306', 10);
  const user = env?.DB_USER || process.env.DB_USER || 'root';
  const password = env?.DB_PASSWORD || process.env.DB_PASSWORD || '';
  const database = env?.DB_NAME || process.env.DB_NAME || process.env.DB_DATABASE || 'smart_food_delivery';

  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+00:00',
      dateStrings: true
    });

    // Test connection asynchronously
    testAndInitMySql(host, port, user, password, database).catch(() => {
      isMySqlActive = false;
    });

    return pool;
  } catch (err: any) {
    console.warn('[DB] MySQL init notice:', err.message);
    return null;
  }
}

async function testAndInitMySql(host: string, port: number, user: string, password: string, database: string) {
  try {
    const rawConn = await mysql.createConnection({ host, port, user, password });
    await rawConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rawConn.end();

    if (pool) {
      const [rows]: any = await pool.query("SHOW TABLES LIKE 'users'");
      if (!rows || rows.length === 0) {
        // Auto-run schema
        const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
        if (fs.existsSync(schemaPath)) {
          const sql = fs.readFileSync(schemaPath, 'utf8');
          const statements = sql
            .split(/;\s*$/m)
            .map((s) => s.trim())
            .filter((s) => s.length > 5 && !s.startsWith('--') && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use'));
          for (const stmt of statements) {
            try {
              await pool.query(stmt);
            } catch (_) {}
          }
          console.log('[DB] MySQL Schema initialized successfully in XAMPP!');
        }
      } else {
        // Ensure blockchain tables and columns exist even if users table was already created
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS \`blockchain_batches\` (
              \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              \`batch_id\` VARCHAR(100) NOT NULL UNIQUE,
              \`delivery_id\` INT UNSIGNED NOT NULL,
              \`device_id\` VARCHAR(50) NOT NULL,
              \`start_sequence\` BIGINT UNSIGNED NOT NULL DEFAULT 1,
              \`end_sequence\` BIGINT UNSIGNED NOT NULL DEFAULT 1,
              \`record_count\` INT UNSIGNED NOT NULL DEFAULT 1,
              \`start_time\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`end_time\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`merkle_root\` VARCHAR(64) NOT NULL,
              \`blockchain_tx_id\` VARCHAR(128) NOT NULL,
              \`block_number\` BIGINT UNSIGNED NOT NULL DEFAULT 1,
              \`blockchain_status\` ENUM('PENDING', 'ANCHORED', 'VERIFIED', 'TAMPERED', 'FAILED') NOT NULL DEFAULT 'ANCHORED',
              \`batch_type\` ENUM('PERIODIC_HOURLY', 'BATCH_SIZE_THRESHOLD', 'CRITICAL_EVENT', 'MANUAL_TRIGGER') NOT NULL DEFAULT 'PERIODIC_HOURLY',
              \`tamper_event_type\` VARCHAR(100) NULL DEFAULT NULL,
              \`metadata_json\` JSON DEFAULT NULL,
              \`verified_at\` TIMESTAMP NULL DEFAULT NULL,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX \`idx_bb_delivery\` (\`delivery_id\`),
              INDEX \`idx_bb_batch_id\` (\`batch_id\`),
              INDEX \`idx_bb_tx_id\` (\`blockchain_tx_id\`),
              INDEX \`idx_bb_root\` (\`merkle_root\`),
              INDEX \`idx_bb_status\` (\`blockchain_status\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `);
        } catch (_) {}

        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS \`blockchain_verifications\` (
              \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              \`batch_id\` VARCHAR(100) NOT NULL,
              \`delivery_id\` INT UNSIGNED NOT NULL,
              \`status\` ENUM('VALID', 'TAMPERED', 'ERROR') NOT NULL,
              \`calculated_merkle_root\` VARCHAR(64) NOT NULL,
              \`blockchain_merkle_root\` VARCHAR(64) NOT NULL,
              \`hash_chain_valid\` TINYINT(1) NOT NULL DEFAULT 1,
              \`tampered_record_count\` INT UNSIGNED NOT NULL DEFAULT 0,
              \`details_json\` JSON DEFAULT NULL,
              \`verified_by\` VARCHAR(100) NOT NULL DEFAULT 'SYSTEM_AUDITOR',
              \`verified_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              INDEX \`idx_bv_batch\` (\`batch_id\`),
              INDEX \`idx_bv_delivery\` (\`delivery_id\`),
              INDEX \`idx_bv_status\` (\`status\`),
              INDEX \`idx_bv_verified_at\` (\`verified_at\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `);
        } catch (_) {}

        try {
          await pool.query("ALTER TABLE `sensor_logs` ADD COLUMN `sequence_number` BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER `sensor_module_id`");
        } catch (_) {}
        try {
          await pool.query("ALTER TABLE `sensor_logs` ADD COLUMN `record_hash` VARCHAR(64) NULL DEFAULT NULL AFTER `spoil_in`");
        } catch (_) {}
        try {
          await pool.query("ALTER TABLE `sensor_logs` ADD COLUMN `previous_hash` VARCHAR(64) NULL DEFAULT NULL AFTER `record_hash`");
        } catch (_) {}
      }
      isMySqlActive = true;
      console.log(`[DB] Connected to XAMPP MySQL database \`${database}\``);
    }
  } catch (err: any) {
    isMySqlActive = false;
    // Keep running in resilient In-Memory Active Store mode
  }
}

export async function executeQuery<T = any>(
  sql: string,
  params: any[] = [],
  env?: EnvBindings
): Promise<T> {
  const db = getDbPool(env);

  if (isMySqlActive && db) {
    try {
      const [results] = await db.query(sql, params);
      return results as T;
    } catch (err: any) {
      console.warn('[DB MySQL Query fallback to Memory Store]:', err.message);
    }
  }

  // Fallback to Memory Store Query Engine
  return executeInMemoryQuery(sql, params) as T;
}

export async function executeTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
  env?: EnvBindings
): Promise<T> {
  const db = getDbPool(env);
  if (isMySqlActive && db) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  // Simulated transaction in memory
  return callback({} as any);
}

// Resilient In-Memory Query Engine supporting all App entities
function executeInMemoryQuery(sql: string, params: any[] = []): any {
  const clean = sql.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();

  // 1. SELECT Users
  if (lower.startsWith('select') && lower.includes('from users')) {
    let list = memoryStore.users.filter((u) => u.deleted_at === null);
    if (lower.includes('where email = ?')) {
      const email = String(params[0] || '').toLowerCase().trim();
      const u = list.find((usr) => usr.email.toLowerCase() === email);
      return u ? [u] : [];
    }
    if (lower.includes('where id = ?')) {
      const id = parseInt(params[0], 10);
      const u = list.find((usr) => usr.id === id);
      return u ? [u] : [];
    }
    if (lower.includes("where u.role = 'driver'")) {
      return memoryStore.users
        .filter((u) => u.role === 'driver' && u.is_active === 1 && u.deleted_at === null)
        .map((u) => {
          const s = memoryStore.sensor_modules.find((sm) => sm.driver_id === u.id && sm.status !== 'removed');
          return {
            ...u,
            sensor_module_id: s ? s.id : null,
            device_id: s ? s.device_id : null,
            device_name: s ? s.device_name : null
          };
        });
    }
    if (lower.includes('count(*)')) {
      return [{ count: list.length }];
    }
    return list;
  }

  // 2. INSERT into Users
  if (lower.startsWith('insert into users')) {
    const newId = memoryStore.users.length ? Math.max(...memoryStore.users.map((u) => u.id)) + 1 : 1;
    const email = params[0]?.toLowerCase().trim();
    const password_hash = params[1];
    const full_name = params[2] || null;
    const phone_number = params[3] || null;
    const role = params[4];
    const first_login = params[5] !== undefined ? params[5] : 1;

    memoryStore.users.push({
      id: newId,
      email,
      password_hash,
      full_name,
      phone_number,
      role,
      is_active: 1,
      first_login,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // 3. UPDATE Users
  if (lower.startsWith('update users')) {
    let targetId = params[params.length - 1];
    const u = memoryStore.users.find((usr) => usr.id === parseInt(targetId, 10));
    if (u) {
      if (lower.includes('full_name = ?') && lower.includes('phone_number = ?')) {
        u.full_name = params[0];
        u.phone_number = params[1];
      }
      if (lower.includes('password_hash = ?')) {
        u.password_hash = params[0];
        u.first_login = params[1] !== undefined ? params[1] : 0;
      }
      if (lower.includes('is_active = ?')) {
        u.is_active = params[0];
      }
      if (lower.includes('deleted_at = now()')) {
        u.deleted_at = new Date().toISOString();
        u.is_active = 0;
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 4. Deliveries Queries
  if (lower.startsWith('select') && lower.includes('from deliveries')) {
    let list = memoryStore.deliveries.map((d) => {
      const sender = memoryStore.users.find((u) => u.id === d.sender_id);
      const driver = memoryStore.users.find((u) => u.id === d.driver_id);
      const sensor = memoryStore.sensor_modules.find((sm) => sm.id === d.sensor_module_id || sm.driver_id === d.driver_id);
      const latestLog = memoryStore.sensor_logs.filter((sl) => sl.delivery_id === d.id).slice(-1)[0];
      const latestPred = memoryStore.model_predictions.filter((mp) => mp.delivery_id === d.id).slice(-1)[0];

      return {
        ...d,
        sender_name: sender ? sender.full_name : 'Sender',
        sender_phone: sender ? sender.phone_number : '',
        sender_email: sender ? sender.email : '',
        driver_name: driver ? driver.full_name : null,
        driver_phone: driver ? driver.phone_number : null,
        driver_email: driver ? driver.email : null,
        sensor_device_id: sensor ? sensor.device_id : null,
        sensor_name: sensor ? sensor.device_name : null,
        latest_temp: latestLog ? latestLog.temperature : null,
        latest_humidity: latestLog ? latestLog.humidity : null,
        latest_methane: latestLog ? latestLog.methane : null,
        latest_co2: latestLog ? latestLog.co2 : null,
        latest_score: latestPred ? latestPred.score : (latestLog ? latestLog.score : null),
        latest_risk_level: latestPred ? latestPred.risk_level : 'LOW',
        spoil_in: latestPred ? latestPred.spoil_in : null
      };
    });

    if (lower.includes('where d.id = ?') || lower.includes('where id = ?')) {
      const id = parseInt(params[0], 10);
      const found = list.find((d) => d.id === id);
      return found ? [found] : [];
    }

    if (lower.includes('where d.delivery_code = ?') || lower.includes('where delivery_code = ?')) {
      const code = String(params[0] || '').toLowerCase().trim();
      const found = list.find((d) => d.delivery_code.toLowerCase() === code || String(d.id) === code);
      return found ? [found] : [];
    }

    if (lower.includes('d.sender_id = ?') || lower.includes('sender_id = ?')) {
      const sId = parseInt(params[0], 10);
      list = list.filter((d) => d.sender_id === sId);
    } else if (lower.includes('d.driver_id = ?') || lower.includes('driver_id = ?')) {
      const dId = parseInt(params[0], 10);
      list = list.filter((d) => d.driver_id === dId);
    }

    if (lower.includes('count(*)')) {
      return [{ count: list.length }];
    }

    return list;
  }

  // 5. INSERT Delivery
  if (lower.startsWith('insert into deliveries')) {
    const newId = memoryStore.deliveries.length ? Math.max(...memoryStore.deliveries.map((d) => d.id)) + 1 : 1;
    const delivery_code = params[0];
    const sender_id = params[1];
    const driver_id = params[2] || null;
    const sensor_module_id = params[3] || null;
    const food_name = params[4];
    const source_location = params[5];
    const destination_location = params[6];
    const start_time = params[7] || new Date().toISOString();
    const status = params[8] || (driver_id ? 'assigned' : 'pending');

    memoryStore.deliveries.unshift({
      id: newId,
      delivery_code,
      sender_id,
      driver_id,
      sensor_module_id,
      food_name,
      source_location,
      destination_location,
      start_time,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assigned_at: driver_id ? new Date().toISOString() : null,
      accepted_at: null,
      started_at: null,
      completed_at: null
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // 6. UPDATE Delivery
  if (lower.startsWith('update deliveries')) {
    const targetId = parseInt(params[params.length - 1], 10);
    const d = memoryStore.deliveries.find((del) => del.id === targetId);
    if (d) {
      if (lower.includes('driver_id = ?') && lower.includes("status = 'assigned'")) {
        d.driver_id = params[0];
        d.sensor_module_id = params[1] || d.sensor_module_id;
        d.status = 'assigned';
        d.assigned_at = new Date().toISOString();
      } else if (lower.includes("status = 'accepted'")) {
        d.status = 'accepted';
        d.accepted_at = new Date().toISOString();
      } else if (lower.includes("status = 'pending'") && lower.includes('driver_id = null')) {
        d.status = 'pending';
        d.driver_id = null;
      } else if (lower.includes("status = 'in_transit'")) {
        d.status = 'in_transit';
        d.started_at = new Date().toISOString();
      } else if (lower.includes("status = 'completed'")) {
        d.status = 'completed';
        d.completed_at = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 7. Sensor Modules Queries
  if (lower.startsWith('select') && lower.includes('from sensor_modules')) {
    let list = memoryStore.sensor_modules.map((sm) => {
      const driver = memoryStore.users.find((u) => u.id === sm.driver_id);
      return {
        ...sm,
        driver_name: driver ? driver.full_name : null,
        driver_phone: driver ? driver.phone_number : null,
        driver_email: driver ? driver.email : null
      };
    });

    if (lower.includes('where sm.id = ?') || lower.includes('where id = ?')) {
      const id = parseInt(params[0], 10);
      const found = list.find((s) => s.id === id);
      return found ? [found] : [];
    }
    if (lower.includes('where sm.device_id = ?') || lower.includes('where device_id = ?')) {
      const devId = String(params[0] || '').trim();
      const found = list.find((s) => s.device_id.toUpperCase() === devId.toUpperCase());
      return found ? [found] : [];
    }
    if (lower.includes('where sm.driver_id = ?') || lower.includes('where driver_id = ?')) {
      const dId = parseInt(params[0], 10);
      const found = list.find((s) => s.driver_id === dId);
      return found ? [found] : [];
    }
    if (lower.includes('count(*)')) {
      return [{ count: list.length }];
    }
    return list;
  }

  // 8. INSERT / UPDATE Sensor Modules
  if (lower.startsWith('insert into sensor_modules')) {
    const newId = memoryStore.sensor_modules.length ? Math.max(...memoryStore.sensor_modules.map((s) => s.id)) + 1 : 1;
    memoryStore.sensor_modules.push({
      id: newId,
      device_id: params[0],
      device_name: params[1],
      api_key_hash: params[2],
      hardware_model: params[3] || 'SFM-ESP32-V1',
      firmware_version: params[4] || '1.0.0',
      driver_id: params[5] || null,
      status: params[5] ? 'assigned' : 'available',
      is_active: 1,
      last_seen_at: null,
      registered_by: params[6] || 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  if (lower.startsWith('update sensor_modules')) {
    const targetId = parseInt(params[params.length - 1], 10);
    const s = memoryStore.sensor_modules.find((sm) => sm.id === targetId);
    if (s) {
      if (lower.includes('driver_id = ?')) {
        s.driver_id = params[0] || null;
        s.status = params[0] ? 'assigned' : 'available';
      }
      if (lower.includes('api_key_hash = ?')) {
        s.api_key_hash = params[0];
      }
      if (lower.includes("status = 'removed'")) {
        s.status = 'removed';
        s.is_active = 0;
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 9. Sensor Logs & Predictions
  if (lower.startsWith('select') && lower.includes('from sensor_logs')) {
    let list = [...memoryStore.sensor_logs];

    // Join deliveries & sensor_modules if needed
    list = list.map((sl) => {
      const del = memoryStore.deliveries.find((d) => d.id === sl.delivery_id);
      const sm = memoryStore.sensor_modules.find((s) => s.id === sl.sensor_module_id);
      return {
        ...sl,
        sequence_number: sl.sequence_number || 1,
        delivery_code: del ? del.delivery_code : `DEL-${sl.delivery_id}`,
        food_name: del ? del.food_name : 'Cold Cargo',
        device_id: sm ? sm.device_id : `SFM-00${sl.sensor_module_id}`
      };
    });

    if (lower.includes('where sl.delivery_id = ?') || lower.includes('where delivery_id = ?')) {
      const delId = parseInt(params[0], 10);
      list = list.filter((sl) => sl.delivery_id === delId);
    }

    if (lower.includes('and sl.sequence_number > ?') || lower.includes('and sequence_number > ?')) {
      const afterSeq = parseInt(params[1], 10);
      list = list.filter((sl) => (sl.sequence_number || 0) > afterSeq);
    }

    if (lower.includes('where id = ?') || lower.includes('where sl.id = ?')) {
      const id = parseInt(params[0], 10);
      return list.filter((sl) => sl.id === id);
    }

    if (lower.includes('sequence_number between ? and ?')) {
      const start = parseInt(params[params.length - 2], 10);
      const end = parseInt(params[params.length - 1], 10);
      list = list.filter((sl) => (sl.sequence_number || 1) >= start && (sl.sequence_number || 1) <= end);
    }

    if (lower.includes('order by')) {
      if (lower.includes('sequence_number asc') || lower.includes('sl.sequence_number asc')) {
        list.sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0) || a.id - b.id);
      } else if (
        lower.includes('sequence_number desc') ||
        lower.includes('sl.sequence_number desc') ||
        lower.includes('recorded_at desc') ||
        lower.includes('sl.recorded_at desc') ||
        lower.includes('sl.id desc')
      ) {
        list.sort((a, b) => (b.sequence_number || 0) - (a.sequence_number || 0) || b.id - a.id);
      }
    }

    if (lower.includes('limit ?')) {
      const limitVal = parseInt(params[params.length - 1], 10) || 100;
      return list.slice(0, limitVal);
    }

    if (lower.includes('limit 1')) {
      return list.slice(0, 1);
    }

    return list;
  }

  if (lower.startsWith('insert into sensor_logs')) {
    const newId = memoryStore.sensor_logs.length + 1;
    // Handle both 16 parameter full insert (with hashes) and legacy
    const logObj: any = {
      id: newId,
      delivery_id: params[0],
      sensor_module_id: params[1],
      sequence_number: params[2] !== undefined ? params[2] : newId,
      temperature: params[3] !== undefined ? params[3] : params[2],
      humidity: params[4] !== undefined ? params[4] : params[3],
      methane: params[5] !== undefined ? params[5] : params[4],
      co2: params[6] !== undefined ? params[6] : params[5],
      storage_hours: params[7] !== undefined ? params[7] : params[6],
      storage_days: params[8] !== undefined ? params[8] : params[7],
      score: params[9] !== undefined ? params[9] : params[8],
      status: params[10] !== undefined ? params[10] : params[9],
      risk_level: params[11] !== undefined ? params[11] : (params[10] || 'LOW'),
      spoil_in: params[12] !== undefined ? params[12] : params[11],
      record_hash: params[13] || null,
      previous_hash: params[14] || null,
      device_recorded_at: params[15] || new Date().toISOString(),
      recorded_at: new Date().toISOString()
    };
    memoryStore.sensor_logs.push(logObj);
    return { insertId: newId, affectedRows: 1 };
  }

  if (lower.startsWith('update sensor_logs')) {
    const targetId = parseInt(params[params.length - 1], 10);
    const sl = memoryStore.sensor_logs.find((s) => s.id === targetId);
    if (sl) {
      const setPart = lower.split('set')[1]?.split('where')[0] || '';
      const assignments = setPart.split(',').map((s) => s.trim());
      assignments.forEach((assign, index) => {
        const val = params[index];
        if (assign.startsWith('temperature')) sl.temperature = val;
        else if (assign.startsWith('humidity')) sl.humidity = val;
        else if (assign.startsWith('methane')) sl.methane = val;
        else if (assign.startsWith('co2')) sl.co2 = val;
        else if (assign.startsWith('record_hash')) sl.record_hash = val;
        else if (assign.startsWith('previous_hash')) sl.previous_hash = val;
      });
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 10. Notifications & Security Logs
  if (lower.startsWith('select') && lower.includes('from notifications')) {
    return memoryStore.notifications;
  }

  if (lower.startsWith('insert into notifications')) {
    const newId = memoryStore.notifications.length + 1;
    memoryStore.notifications.unshift({
      id: newId,
      user_id: params[0],
      type: params[1],
      title: params[2],
      message: params[3],
      delivery_id: params[4],
      is_read: 0,
      created_at: new Date().toISOString()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  if (lower.startsWith('select') && lower.includes('from security_logs')) {
    return memoryStore.security_logs;
  }

  if (lower.startsWith('insert into security_logs')) {
    const newId = memoryStore.security_logs.length + 1;
    memoryStore.security_logs.unshift({
      id: newId,
      user_id: params[0],
      email: params[1],
      event_type: params[2],
      ip_address: params[3],
      user_agent: params[4],
      success: params[5] ? 1 : 0,
      details: params[6],
      created_at: new Date().toISOString()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // 11. Driver Locations
  if (lower.startsWith('select') && lower.includes('from driver_locations')) {
    if (lower.includes('where delivery_id = ?')) {
      const dId = parseInt(params[0], 10);
      return memoryStore.driver_locations.filter((dl) => dl.delivery_id === dId);
    }
    return memoryStore.driver_locations;
  }

  if (lower.startsWith('insert into driver_locations')) {
    const newId = memoryStore.driver_locations.length + 1;
    memoryStore.driver_locations.push({
      id: newId,
      driver_id: params[0],
      delivery_id: params[1],
      latitude: params[2],
      longitude: params[3],
      recorded_at: new Date().toISOString()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // 12. Blockchain Batches
  if (lower.startsWith('select') && lower.includes('from blockchain_batches')) {
    let list = memoryStore.blockchain_batches.map((bb) => {
      const del = memoryStore.deliveries.find((d) => d.id === bb.delivery_id);
      const driver = del ? memoryStore.users.find((u) => u.id === del.driver_id) : null;
      return {
        ...bb,
        delivery_code: del ? del.delivery_code : `DEL-${bb.delivery_id}`,
        food_name: del ? del.food_name : 'Cold Transport Cargo',
        driver_name: driver ? driver.full_name : null
      };
    });

    if (lower.includes('where bb.batch_id = ?') || lower.includes('where batch_id = ?')) {
      const bId = String(params[0] || '').trim();
      const found = list.find((b) => b.batch_id === bId);
      return found ? [found] : [];
    }

    if (lower.includes('where bb.delivery_id = ?') || lower.includes('where delivery_id = ?')) {
      const dId = parseInt(params[0], 10);
      list = list.filter((b) => b.delivery_id === dId);
    }

    if (lower.includes('count(*)')) {
      return [{ count: list.length }];
    }

    if (lower.includes('order by created_at desc') || lower.includes('order by bb.created_at desc')) {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return list;
  }

  if (lower.startsWith('insert into blockchain_batches')) {
    const newId = memoryStore.blockchain_batches.length + 1;
    const batchObj = {
      id: newId,
      batch_id: params[0],
      delivery_id: params[1],
      device_id: params[2],
      start_sequence: params[3],
      end_sequence: params[4],
      record_count: params[5],
      start_time: params[6] || new Date().toISOString(),
      end_time: params[7] || new Date().toISOString(),
      merkle_root: params[8],
      blockchain_tx_id: params[9],
      block_number: params[10] || 1,
      blockchain_status: params[11] || 'ANCHORED',
      batch_type: params[12] || 'PERIODIC_HOURLY',
      tamper_event_type: params[13] || null,
      metadata_json: params[14] || null,
      verified_at: params[15] || null,
      created_at: new Date().toISOString()
    };
    memoryStore.blockchain_batches.unshift(batchObj);
    return { insertId: newId, affectedRows: 1 };
  }

  if (lower.startsWith('update blockchain_batches')) {
    const batchId = params[params.length - 1];
    const b = memoryStore.blockchain_batches.find((batch) => batch.batch_id === batchId || batch.id === parseInt(batchId, 10));
    if (b) {
      if (lower.includes('blockchain_status = ?')) {
        b.blockchain_status = params[0];
      }
      if (lower.includes('verified_at = ?') || lower.includes('verified_at = now()')) {
        b.verified_at = params[1] || new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 13. Blockchain Verifications
  if (lower.startsWith('select') && lower.includes('from blockchain_verifications')) {
    if (lower.includes('where delivery_id = ?')) {
      const dId = parseInt(params[0], 10);
      return memoryStore.blockchain_verifications.filter((bv) => bv.delivery_id === dId);
    }
    if (lower.includes('where batch_id = ?')) {
      const bId = String(params[0] || '').trim();
      return memoryStore.blockchain_verifications.filter((bv) => bv.batch_id === bId);
    }
    return memoryStore.blockchain_verifications;
  }

  if (lower.startsWith('insert into blockchain_verifications')) {
    const newId = memoryStore.blockchain_verifications.length + 1;
    memoryStore.blockchain_verifications.unshift({
      id: newId,
      batch_id: params[0],
      delivery_id: params[1],
      status: params[2],
      calculated_merkle_root: params[3],
      blockchain_merkle_root: params[4],
      hash_chain_valid: params[5] !== undefined ? params[5] : 1,
      tampered_record_count: params[6] || 0,
      details_json: params[7] || null,
      verified_by: params[8] || 'SYSTEM_AUDITOR',
      verified_at: new Date().toISOString()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // 14. System Settings
  if (lower.startsWith('select') && lower.includes('from system_settings')) {
    return [
      { setting_key: 'temp_threshold_warning', setting_value: '10.0' },
      { setting_key: 'temp_threshold_critical', setting_value: '15.0' },
      { setting_key: 'humidity_threshold_warning', setting_value: '80.0' },
      { setting_key: 'methane_threshold_critical', setting_value: '0.05' },
      { setting_key: 'co2_threshold_critical', setting_value: '1000.0' },
      { setting_key: 'sensor_offline_seconds', setting_value: '60' },
      { setting_key: 'alert_cooldown_seconds', setting_value: '300' }
    ];
  }

  return [];
}
