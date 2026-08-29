const express = require('express');
const router = express.Router();
const { query, isMySQLConnected, getMemoryStore } = require('../config/db');
const { predictFoodSpoilage } = require('../utils/mlPredictor');

// Helper to trigger alert notifications
async function notifySpoilageAlert(delivery, prediction) {
  const isHighRisk = prediction.spoilage_score >= 45;
  const alertTitle = isHighRisk ? 'CRITICAL FOOD SPOILAGE ALERT!' : 'Food Quality Warning';
  const alertMsg = `Shipment ${delivery.tracking_code} (${delivery.food_name}): ${prediction.status} (${prediction.risk_percentage}% Risk). Recommendation: ${prediction.recommendations}`;

  try {
    if (isMySQLConnected()) {
      // Notify Admin
      await query(
        'INSERT INTO `notifications` (`user_id`, `role_target`, `title`, `message`, `type`, `delivery_id`) VALUES (NULL, "admin", ?, ?, "spoil_alert", ?)',
        [alertTitle, alertMsg, delivery.id]
      );
      // Notify Sender
      if (delivery.sender_id) {
        await query(
          'INSERT INTO `notifications` (`user_id`, `role_target`, `title`, `message`, `type`, `delivery_id`) VALUES (?, "sender", ?, ?, "spoil_alert", ?)',
          [delivery.sender_id, alertTitle, alertMsg, delivery.id]
        );
      }
      // Notify Driver
      if (delivery.driver_id) {
        await query(
          'INSERT INTO `notifications` (`user_id`, `role_target`, `title`, `message`, `type`, `delivery_id`) VALUES (?, "driver", ?, ?, "spoil_alert", ?)',
          [delivery.driver_id, alertTitle, alertMsg, delivery.id]
        );
      }
    } else {
      const store = getMemoryStore();
      store.notifications.unshift(
        { id: store.notifications.length + 1, user_id: null, role_target: 'admin', title: alertTitle, message: alertMsg, type: 'spoil_alert', delivery_id: delivery.id, is_read: 0, created_at: new Date() },
        { id: store.notifications.length + 2, user_id: delivery.sender_id, role_target: 'sender', title: alertTitle, message: alertMsg, type: 'spoil_alert', delivery_id: delivery.id, is_read: 0, created_at: new Date() },
        { id: store.notifications.length + 3, user_id: delivery.driver_id, role_target: 'driver', title: alertTitle, message: alertMsg, type: 'spoil_alert', delivery_id: delivery.id, is_read: 0, created_at: new Date() }
      );
    }
  } catch (err) {
    console.error('[Notification Trigger Error]', err.message);
  }
}

/**
 * IoT Sensor Telemetry Ingestion Endpoint
 * Headers required:
 *   X-API-Key: sg_live_...
 *   X-Device-ID: DEV-XXXXX
 * Body payload:
 *   { temperature, humidity, methane, co2, lat, lng }
 */
router.post('/ingest', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.body.api_key;
  const deviceId = req.headers['x-device-id'] || req.body.device_id;
  const { temperature, humidity, methane, co2, lat, lng } = req.body;

  if (!apiKey || !deviceId) {
    return res.status(401).json({
      error: 'Authentication failed. Please provide X-API-Key and X-Device-ID in HTTP headers or request body.'
    });
  }

  if (temperature === undefined || humidity === undefined) {
    return res.status(400).json({ error: 'Temperature and humidity sensor telemetry values are required.' });
  }

  try {
    // 1. Verify Sensor Device
    let sensor = null;
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT * FROM `sensor_devices` WHERE `api_key` = ? AND `device_code` = ? AND `status` = "active" LIMIT 1', [apiKey, deviceId]);
      sensor = rows[0];
    } else {
      const store = getMemoryStore();
      sensor = store.sensor_devices.find(s => s.api_key === apiKey && s.device_code === deviceId && s.status === 'active');
    }

    if (!sensor) {
      return res.status(403).json({ error: 'Invalid or inactive Sensor API Key / Device ID.' });
    }

    // Update sensor last ping
    if (isMySQLConnected()) {
      await query('UPDATE `sensor_devices` SET last_ping_at = NOW() WHERE id = ?', [sensor.id]);
    } else {
      sensor.last_ping_at = new Date();
    }

    // 2. Locate Active Delivery for the Assigned Driver
    if (!sensor.assigned_driver_id) {
      return res.json({
        message: 'Telemetry received, but sensor is not currently assigned to an active driver.',
        sensor_status: 'standby'
      });
    }

    let activeDelivery = null;
    if (isMySQLConnected()) {
      const [delRows] = await query(
        'SELECT * FROM `deliveries` WHERE `driver_id` = ? AND `status` = "in_transit" ORDER BY id DESC LIMIT 1',
        [sensor.assigned_driver_id]
      );
      activeDelivery = delRows[0];
    } else {
      const store = getMemoryStore();
      activeDelivery = store.deliveries.find(d => d.driver_id === sensor.assigned_driver_id && d.status === 'in_transit');
    }

    if (!activeDelivery) {
      return res.json({
        message: 'Telemetry received and logged. Driver currently has no active "in_transit" shipment.',
        driver_id: sensor.assigned_driver_id
      });
    }

    // 3. Compute elapsed storage hours and convert to days for ML model
    const now = Date.now();
    let elapsedHours = 0.00;
    if (activeDelivery.started_at) {
      elapsedHours = parseFloat(((now - new Date(activeDelivery.started_at).getTime()) / (1000 * 60 * 60)).toFixed(2));
    }
    const storageDays = parseFloat((elapsedHours / 24.0).toFixed(4));

    // 4. Request ML Prediction
    const tempVal = parseFloat(temperature);
    const humVal = parseFloat(humidity);
    const methaneVal = methane !== undefined ? parseFloat(methane) : (activeDelivery.current_methane || 10.0);
    const co2Val = co2 !== undefined ? parseFloat(co2) : (activeDelivery.current_co2 || 450.0);

    const prediction = await predictFoodSpoilage({
      food_name: activeDelivery.food_name,
      temperature: tempVal,
      humidity: humVal,
      methane: methaneVal,
      co2: co2Val,
      storage_days: storageDays
    });

    const currentLat = lat !== undefined ? parseFloat(lat) : activeDelivery.last_lat;
    const currentLng = lng !== undefined ? parseFloat(lng) : activeDelivery.last_lng;

    // 5. Update Delivery Real-Time Telemetry & Risk in DB
    if (isMySQLConnected()) {
      await query(`
        UPDATE \`deliveries\` SET
          \`elapsed_hours\` = ?,
          \`last_lat\` = ?,
          \`last_lng\` = ?,
          \`current_temp\` = ?,
          \`current_humidity\` = ?,
          \`current_methane\` = ?,
          \`current_co2\` = ?,
          \`current_spoilage_score\` = ?,
          \`current_spoilage_status\` = ?,
          \`current_spoilage_risk_percent\` = ?,
          \`current_recommendation\` = ?
        WHERE \`id\` = ?
      `, [
        elapsedHours, currentLat, currentLng, tempVal, humVal, methaneVal, co2Val,
        prediction.spoilage_score, prediction.status, prediction.risk_percentage, prediction.recommendations,
        activeDelivery.id
      ]);

      // Archive into delivery_telemetry_logs for ML training dataset
      await query(`
        INSERT INTO \`delivery_telemetry_logs\` (
          \`delivery_id\`, \`sensor_device_id\`, \`driver_id\`,
          \`temperature\`, \`humidity\`, \`methane\`, \`co2\`,
          \`storage_hours\`, \`storage_days\`, \`spoilage_score\`,
          \`spoilage_risk_percent\`, \`spoilage_status\`, \`recommendation\`,
          \`lat\`, \`lng\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        activeDelivery.id, sensor.id, sensor.assigned_driver_id,
        tempVal, humVal, methaneVal, co2Val,
        elapsedHours, storageDays, prediction.spoilage_score,
        prediction.risk_percentage, prediction.status, prediction.recommendations,
        currentLat, currentLng
      ]);
    } else {
      activeDelivery.elapsed_hours = elapsedHours;
      activeDelivery.last_lat = currentLat;
      activeDelivery.last_lng = currentLng;
      activeDelivery.current_temp = tempVal;
      activeDelivery.current_humidity = humVal;
      activeDelivery.current_methane = methaneVal;
      activeDelivery.current_co2 = co2Val;
      activeDelivery.current_spoilage_score = prediction.spoilage_score;
      activeDelivery.current_spoilage_status = prediction.status;
      activeDelivery.current_spoilage_risk_percent = prediction.risk_percentage;
      activeDelivery.current_recommendation = prediction.recommendations;

      const store = getMemoryStore();
      store.delivery_telemetry_logs.push({
        id: store.delivery_telemetry_logs.length + 1,
        delivery_id: activeDelivery.id,
        sensor_device_id: sensor.id,
        driver_id: sensor.assigned_driver_id,
        temperature: tempVal,
        humidity: humVal,
        methane: methaneVal,
        co2: co2Val,
        storage_hours: elapsedHours,
        storage_days: storageDays,
        spoilage_score: prediction.spoilage_score,
        spoilage_risk_percent: prediction.risk_percentage,
        spoilage_status: prediction.status,
        recommendation: prediction.recommendations,
        lat: currentLat,
        lng: currentLng,
        recorded_at: new Date()
      });
    }

    // 6. Check if Risk Alert should trigger notifications
    if (prediction.spoilage_score >= 35) {
      await notifySpoilageAlert(activeDelivery, prediction);
    }

    res.json({
      status: 'success',
      delivery_id: activeDelivery.id,
      tracking_code: activeDelivery.tracking_code,
      food_name: activeDelivery.food_name,
      storage_hours: elapsedHours,
      storage_days: storageDays,
      prediction: {
        risk_score: prediction.spoilage_score,
        risk_percentage: prediction.risk_percentage,
        status: prediction.status,
        recommendations: prediction.recommendations,
        factors: prediction.factors
      }
    });
  } catch (error) {
    console.error('[Telemetry Ingest Error]', error);
    res.status(500).json({ error: 'Failed to process telemetry data.' });
  }
});

module.exports = router;
