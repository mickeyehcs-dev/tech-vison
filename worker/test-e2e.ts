import { AuthService } from './src/services/AuthService';
import { UserService } from './src/services/UserService';
import { DeliveryService } from './src/services/DeliveryService';
import { SensorService } from './src/services/SensorService';
import { LocationService } from './src/services/LocationService';
import { RiskService } from './src/services/RiskService';
import { NotificationService } from './src/services/NotificationService';
import { SecurityService } from './src/services/SecurityService';
import { executeQuery } from './src/db/connection';
import { RowDataPacket } from 'mysql2/promise';

async function runEndToEndVerification() {
  console.log('🧪 Starting End-to-End Real MySQL Database Verification...\n');

  try {
    // 1. Verify Database Connection
    console.log('1️⃣ Checking Database Tables...');
    const tables = await executeQuery<RowDataPacket[]>('SHOW TABLES FROM smart_food_delivery');
    console.log(`   ✅ Connected to MySQL. Found ${tables.length} tables in smart_food_delivery.\n`);

    // 2. Authenticate Admin
    console.log('2️⃣ Testing Admin Authentication...');
    const adminLogin = await AuthService.login({
      email: 'admin@smartdelivery.com',
      password: 'AdminPassword123!'
    });
    console.log(`   ✅ Admin authenticated successfully! Token generated: ${adminLogin.token.substring(0, 20)}...\n`);

    // 3. Admin Provisions Sender and Driver
    console.log('3️⃣ Provisioning Sender & Driver Accounts...');
    const senderRes = await UserService.createUser(
      {
        email: `sender_${Date.now()}@organicfoods.com`,
        role: 'sender',
        fullName: 'Organic Farm Foods',
        phoneNumber: '+1 555-0111'
      },
      adminLogin.user
    );
    console.log(`   ✅ Provisioned Sender: ${senderRes.user.email} (ID: ${senderRes.user.id})`);

    const driverRes = await UserService.createUser(
      {
        email: `driver_${Date.now()}@smartfleet.com`,
        role: 'driver',
        fullName: 'Alex Fleet Driver',
        phoneNumber: '+1 555-0222'
      },
      adminLogin.user
    );
    console.log(`   ✅ Provisioned Driver: ${driverRes.user.email} (ID: ${driverRes.user.id})\n`);

    // 4. Test Driver First-Time Onboarding
    console.log('4️⃣ Testing Driver Onboarding & Password Setup...');
    const onboardedDriver = await AuthService.completeOnboarding(driverRes.user.id, {
      fullName: 'Alex R. Fleet Driver',
      phoneNumber: '+1 555-0222-99',
      newPassword: 'DriverSecurePassword2026!'
    });
    console.log(`   ✅ Driver onboarding completed. first_login is now: ${onboardedDriver.first_login}\n`);

    // 5. Admin Registers IoT Sensor Module
    console.log('5️⃣ Testing IoT Sensor Registration & Secret Key Generation...');
    const sensorModule = await SensorService.registerModule(
      {
        deviceName: 'ColdBox Sensor Unit #8',
        hardwareModel: 'SFM-ESP32-V1',
        firmwareVersion: '1.2.0'
      },
      adminLogin.user
    );
    console.log(`   ✅ IoT Module Registered: ${sensorModule.module.device_id}`);
    console.log(`   🔑 Secret Device API Key: ${sensorModule.rawApiKey.substring(0, 16)}...\n`);

    // 6. Sender Creates Delivery
    console.log('6️⃣ Testing Delivery Dispatch Creation by Sender...');
    const delivery = await DeliveryService.createDelivery(
      {
        food_name: 'Fresh Wild Salmon Fillets',
        source_location: 'Seafood Harbor Pier 4',
        destination_location: 'Metro Gourmet Supermarket'
      },
      senderRes.user
    );
    console.log(`   ✅ Created Delivery #${delivery.delivery_code} (Status: ${delivery.status})\n`);

    // 7. Admin Assigns Driver and Sensor Module
    console.log('7️⃣ Testing Admin Assignment (Atomic Transaction)...');
    const assignedDelivery = await DeliveryService.assignDriverAndSensor(
      delivery.id,
      driverRes.user.id,
      sensorModule.module.id,
      adminLogin.user
    );
    console.log(`   ✅ Delivery #${assignedDelivery.delivery_code} assigned to Driver ${driverRes.user.id} & Sensor ${sensorModule.module.id}. Status: ${assignedDelivery.status}\n`);

    // 8. Driver Accepts Delivery
    console.log('8️⃣ Testing Driver Acceptance...');
    const acceptedDelivery = await DeliveryService.acceptDelivery(delivery.id, driverRes.user);
    console.log(`   ✅ Delivery status transitioned to: ${acceptedDelivery.status}\n`);

    // 9. Driver Starts Delivery Run
    console.log('9️⃣ Testing Driver Starting Transit Run...');
    const startedDelivery = await DeliveryService.startDelivery(delivery.id, driverRes.user);
    console.log(`   ✅ Delivery status transitioned to: ${startedDelivery.status} (IoT & GPS Active)\n`);

    // 10. Sensor Ingests Telemetry via Device Auth Headers
    console.log('🔟 Testing Hardware IoT Telemetry Ingestion & Spoilage ML Inference...');
    const telemetryResult = await SensorService.ingestTelemetry(
      sensorModule.module.device_id,
      sensorModule.rawApiKey,
      {
        temperature: 12.4, // Elevated temperature
        humidity: 78.5,
        methane: 0.035,   // Trace decomposition
        co2: 720.0,
        storage_days: 1.0
      }
    );
    console.log(`   ✅ Telemetry Ingested (Log ID: ${telemetryResult.logId})`);
    console.log(`   🧠 ML Spoilage Risk Evaluated: ${telemetryResult.riskLevel}\n`);

    // 11. Driver GPS Location Update
    console.log('1️⃣1️⃣ Testing Driver GPS Coordinate Upload...');
    const loc = await LocationService.recordDriverLocation(driverRes.user.id, {
      deliveryId: delivery.id,
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 8.5,
      speed: 38.0
    });
    console.log(`   ✅ GPS Location Saved (ID: ${loc.id}, Lat: ${loc.latitude}, Lng: ${loc.longitude})\n`);

    // 12. Complete Delivery
    console.log('1️⃣2️⃣ Testing Delivery Drop-off Completion & Hardware Sensor Release...');
    const completedDelivery = await DeliveryService.completeDelivery(delivery.id, driverRes.user);
    console.log(`   ✅ Delivery #${completedDelivery.delivery_code} marked as COMPLETED.`);

    const sensorAfter = await SensorService.listModules({ search: sensorModule.module.device_id });
    console.log(`   🔄 Sensor Module status released back to: "${sensorAfter.sensors[0].status}"\n`);

    // 13. Verify Audit & Notifications Logs
    console.log('1️⃣3️⃣ Verifying Security Logs and Notifications...');
    const notifs = await NotificationService.listUserNotifications(senderRes.user.id, {});
    console.log(`   🔔 Sender received ${notifs.total} in-app notification events.`);

    const auditLogs = await SecurityService.listLogs({ limit: 5 });
    console.log(`   🛡️ System recorded ${auditLogs.total} immutable security audit events.\n`);

    console.log('🎉 ALL END-TO-END DATABASE & BACKEND TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ E2E Verification failed:', err);
    process.exit(1);
  }
}

runEndToEndVerification();
