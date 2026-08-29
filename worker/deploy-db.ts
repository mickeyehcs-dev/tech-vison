import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Read .env manually if exists
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        const val = values.join('=').trim();
        if (key && val !== undefined) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const host = process.env.DB_HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT || '3306', 10);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_DATABASE || process.env.DB_NAME || 'smart_food_delivery';

async function deployDatabase() {
  console.log(`📡 Connecting to MySQL Server at ${host}:${port} as '${user}'...`);

  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
    console.log(`✅ Successfully connected to MySQL Server!`);
  } catch (err: any) {
    console.error(`❌ Failed to connect to MySQL server:`, err.message);
    process.exit(1);
  }

  try {
    console.log(`📦 Creating database \`${database}\` if not exists...`);
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`✅ Database \`${database}\` is ready.`);

    console.log(`📄 Reading schema.sql...`);
    const schemaPath = path.resolve(__dirname, '../database/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`🚀 Executing schema and seeding on database \`${database}\`...`);
    await rootConn.changeUser({ database });
    await rootConn.query(schemaSql);
    console.log(`✅ Schema executed successfully!`);

    // Verify tables
    const [tables]: any = await rootConn.query('SHOW TABLES;');
    console.log(`\n📊 Created Tables:`);
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const [countRows]: any = await rootConn.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      console.log(`  - ${tableName}: ${countRows[0].count} rows`);
    }

    console.log(`\n🎉 Database deployment completed successfully!`);
  } catch (err: any) {
    console.error(`❌ Error executing schema:`, err);
    process.exit(1);
  } finally {
    await rootConn.end();
  }
}

deployDatabase();
