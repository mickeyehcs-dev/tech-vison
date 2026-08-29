const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query, isMySQLConnected, getMemoryStore } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { predictFoodSpoilage } = require('../utils/mlPredictor');
const { analyzeRouteRisk, INDIAN_LOCATIONS } = require('../utils/routeRiskCalculator');

// Helper to trigger notification
async function createNotification(userId, roleTarget, title, message, type, deliveryId) {
  try {
    if (isMySQLConnected()) {
      await query(
        'INSERT INTO `notifications` (`user_id`, `role_target`, `title`, `message`, `type`, `delivery_id`) VALUES (?, ?, ?, ?, ?, ?)',
        [userId || null, roleTarget || 'all', title, message, type, deliveryId || null]
      );
    } else {
      const store = getMemoryStore();
      store.notifications.unshift({
        id: store.notifications.length + 1,
        user_id: userId || null,
        role_target: roleTarget || 'all',
        title,
        message,
        type,
        delivery_id: deliveryId || null,
        is_read: 0,
        created_at: new Date()
      });
    }
  } catch (e) {
    console.error('[Notification Error]', e.message);
  }
}

// 1. Get deliveries list (Filtered by Role: Admin = All, Sender = Mine, Driver = Mine)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let deliveries = [];
    if (isMySQLConnected()) {
      let sql = `
        SELECT d.*, 
               u_drv.full_name AS driver_name, u_drv.phone_number AS driver_phone, u_drv.email AS driver_email,
               u_snd.full_name AS sender_name, u_snd.phone_number AS sender_phone, u_snd.email AS sender_email
        FROM \`deliveries\` d
        LEFT JOIN \`users\` u_drv ON d.driver_id = u_drv.id
        LEFT JOIN \`users\` u_snd ON d.sender_id = u_snd.id
      `;
      const params = [];
      if (req.user.role === 'sender') {
        sql += ' WHERE d.sender_id = ?';
        params.push(req.user.id);
      } else if (req.user.role === 'driver') {
        sql += ' WHERE d.driver_id = ?';
        params.push(req.user.id);
      }
      sql += ' ORDER BY d.id DESC';
      const [rows] = await query(sql, params);
      deliveries = rows;
    } else {
      const store = getMemoryStore();
      deliveries = store.deliveries.map(d => {
        const driver = store.users.find(u => u.id === d.driver_id);
        const sender = store.users.find(u => u.id === d.sender_id);
        return {
          ...d,
          driver_name: driver ? driver.full_name : null,
          driver_phone: driver ? driver.phone_number : null,
          driver_email: driver ? driver.email : null,
          sender_name: sender ? sender.full_name : null,
          sender_phone: sender ? sender.phone_number : null,
          sender_email: sender ? sender.email : null
        };
      });

      if (req.user.role === 'sender') {
        deliveries = deliveries.filter(d => d.sender_id === req.user.id);
      } else if (req.user.role === 'driver') {
        deliveries = deliveries.filter(d => d.driver_id === req.user.id);
      }
    }

    // Recalculate dynamic elapsed_hours for in_transit deliveries
    const now = Date.now();
    deliveries = deliveries.map(d => {
      if (d.status === 'in_transit' && d.started_at) {
        const startedTime = new Date(d.started_at).getTime();
        const diffHours = Math.max(0, (now - startedTime) / (1000 * 60 * 60));
        return {
          ...d,
          elapsed_hours: parseFloat(diffHours.toFixed(2)),
          storage_days: parseFloat((diffHours / 24.0).toFixed(4))
        };
      }
      return {
        ...d,
        storage_days: parseFloat(((d.elapsed_hours || 0) / 24.0).toFixed(4))
      };
    });

    res.json({ deliveries });
  } catch (error) {
    console.error('[Get Deliveries Error]', error);
    res.status(500).json({ error: 'Failed to fetch deliveries.' });
  }
});

// 2. Public Tracking Endpoint (Accessible without login by tracking code or ID)
router.get('/track/:code', async (req, res) => {
  const code = req.params.code.trim();

  try {
    let delivery = null;
    if (isMySQLConnected()) {
      const [rows] = await query(`
        SELECT d.*, 
               u_drv.full_name AS driver_name, u_drv.phone_number AS driver_phone, u_drv.email AS driver_email,
               u_snd.full_name AS sender_name, u_snd.phone_number AS sender_phone
        FROM \`deliveries\` d
        LEFT JOIN \`users\` u_drv ON d.driver_id = u_drv.id
        LEFT JOIN \`users\` u_snd ON d.sender_id = u_snd.id
        WHERE d.tracking_code = ? OR d.id = ?
        LIMIT 1
      `, [code, isNaN(code) ? -1 : parseInt(code, 10)]);
      delivery = rows[0];
    } else {
      const store = getMemoryStore();
      const raw = store.deliveries.find(d => d.tracking_code.toLowerCase() === code.toLowerCase() || String(d.id) === code);
      if (raw) {
        const driver = store.users.find(u => u.id === raw.driver_id);
        const sender = store.users.find(u => u.id === raw.sender_id);
        delivery = {
          ...raw,
          driver_name: driver ? driver.full_name : null,
          driver_phone: driver ? driver.phone_number : null,
          driver_email: driver ? driver.email : null,
          sender_name: sender ? sender.full_name : null,
          sender_phone: sender ? sender.phone_number : null
        };
      }
    }

    if (!delivery) {
      return res.status(404).json({ error: `Delivery with tracking ID "${code}" not found.` });
    }

    // Dynamic elapsed hours
    if (delivery.status === 'in_transit' && delivery.started_at) {
      const diffHours = Math.max(0, (Date.now() - new Date(delivery.started_at).getTime()) / (1000 * 60 * 60));
      delivery.elapsed_hours = parseFloat(diffHours.toFixed(2));
    }
    delivery.storage_days = parseFloat(((delivery.elapsed_hours || 0) / 24.0).toFixed(4));

    // Fetch route weather risk
    const routeRisk = await analyzeRouteRisk({
      current_location: delivery.origin_address,
      destination: delivery.destination_address,
      departure_date: delivery.scheduled_departure ? new Date(delivery.scheduled_departure).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      departure_time: '09:00'
    });

    res.json({
      delivery,
      routeRisk
    });
  } catch (error) {
    console.error('[Public Tracking Error]', error);
    res.status(500).json({ error: 'Failed to retrieve tracking information.' });
  }
});

// 3. Get single delivery details with Telemetry Logs & Route Weather Analysis
router.get('/:id', authenticateToken, async (req, res) => {
  const deliveryId = parseInt(req.params.id, 10);

  try {
    let delivery = null;
    let telemetryLogs = [];

    if (isMySQLConnected()) {
      const [rows] = await query(`
        SELECT d.*, 
               u_drv.full_name AS driver_name, u_drv.phone_number AS driver_phone, u_drv.email AS driver_email,
               u_snd.full_name AS sender_name, u_snd.phone_number AS sender_phone
        FROM \`deliveries\` d
        LEFT JOIN \`users\` u_drv ON d.driver_id = u_drv.id
        LEFT JOIN \`users\` u_snd ON d.sender_id = u_snd.id
        WHERE d.id = ?
        LIMIT 1
      `, [deliveryId]);
      delivery = rows[0];

      const [logs] = await query('SELECT * FROM `delivery_telemetry_logs` WHERE delivery_id = ? ORDER BY recorded_at ASC', [deliveryId]);
      telemetryLogs = logs;
    } else {
      const store = getMemoryStore();
      const raw = store.deliveries.find(d => d.id === deliveryId);
      if (raw) {
        const driver = store.users.find(u => u.id === raw.driver_id);
        const sender = store.users.find(u => u.id === raw.sender_id);
        delivery = {
          ...raw,
          driver_name: driver ? driver.full_name : null,
          driver_phone: driver ? driver.phone_number : null,
          driver_email: driver ? driver.email : null,
          sender_name: sender ? sender.full_name : null,
          sender_phone: sender ? sender.phone_number : null
        };
      }
      telemetryLogs = store.delivery_telemetry_logs.filter(l => l.delivery_id === deliveryId);
    }

    if (!delivery) return res.status(404).json({ error: 'Delivery not found.' });

    // Role security check
    if (req.user.role === 'sender' && delivery.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this delivery.' });
    }
    if (req.user.role === 'driver' && delivery.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this delivery.' });
    }

    // Dynamic elapsed hours calculation
    if (delivery.status === 'in_transit' && delivery.started_at) {
      const diffHours = Math.max(0, (Date.now() - new Date(delivery.started_at).getTime()) / (1000 * 60 * 60));
      delivery.elapsed_hours = parseFloat(diffHours.toFixed(2));
    }
    delivery.storage_days = parseFloat(((delivery.elapsed_hours || 0) / 24.0).toFixed(4));

    // Route Risk calculation
    const routeRisk = await analyzeRouteRisk({
      current_location: delivery.origin_address,
      destination: delivery.destination_address,
      departure_date: delivery.scheduled_departure ? new Date(delivery.scheduled_departure).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      departure_time: '09:00'
    });

    res.json({
      delivery,
      telemetryLogs,
      routeRisk
    });
  } catch (error) {
    console.error('[Get Delivery Detail Error]', error);
    res.status(500).json({ error: 'Failed to retrieve delivery information.' });
  }
});

// 4. Create New Delivery (Sender or Admin)
router.post('/', authenticateToken, async (req, res) => {
  if (!['admin', 'sender'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only senders and admins can create new deliveries.' });
  }

  const {
    food_name,
    food_category,
    origin_address,
    destination_address,
    scheduled_departure,
    driver_id
  } = req.body;

  if (!food_name || !origin_address || !destination_address) {
    return res.status(400).json({ error: 'Food name, origin address, and destination address are required.' });
  }

  const senderId = req.user.role === 'sender' ? req.user.id : (req.body.sender_id || req.user.id);
  const assignedDriverId = driver_id ? parseInt(driver_id, 10) : null;
  const initialStatus = assignedDriverId ? 'assigned' : 'pending';
  const trackingCode = `TRK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Approximate default coordinates for India
  const originLat = 14.6819;
  const originLng = 77.6006;
  const destLat = 17.3850;
  const destLng = 78.4867;

  try {
    let newDeliveryId = null;

    if (isMySQLConnected()) {
      const [result] = await query(`
        INSERT INTO \`deliveries\` (
          \`tracking_code\`, \`sender_id\`, \`driver_id\`, \`food_name\`, \`food_category\`,
          \`origin_address\`, \`origin_lat\`, \`origin_lng\`,
          \`destination_address\`, \`destination_lat\`, \`destination_lng\`,
          \`scheduled_departure\`, \`status\`, \`last_lat\`, \`last_lng\`,
          \`current_temp\`, \`current_humidity\`, \`current_methane\`, \`current_co2\`,
          \`current_spoilage_score\`, \`current_spoilage_status\`, \`current_spoilage_risk_percent\`, \`current_recommendation\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4.0, 65.0, 10.0, 450.0, 5, 'Safe', 5.0, 'Scheduled delivery created. Ready for dispatch.', NOW())
      `, [
        trackingCode, senderId, assignedDriverId, food_name.trim(), food_category || 'General',
        origin_address.trim(), originLat, originLng,
        destination_address.trim(), destLat, destLng,
        scheduled_departure || new Date(), initialStatus, originLat, originLng
      ]);
      newDeliveryId = result.insertId;
    } else {
      const store = getMemoryStore();
      newDeliveryId = store.deliveries.length ? Math.max(...store.deliveries.map(d => d.id)) + 1 : 1;
      store.deliveries.unshift({
        id: newDeliveryId,
        tracking_code: trackingCode,
        sender_id: senderId,
        driver_id: assignedDriverId,
        food_name: food_name.trim(),
        food_category: food_category || 'General',
        origin_address: origin_address.trim(),
        origin_lat: originLat,
        origin_lng: originLng,
        destination_address: destination_address.trim(),
        destination_lat: destLat,
        destination_lng: destLng,
        scheduled_departure: scheduled_departure || new Date(),
        status: initialStatus,
        started_at: null,
        completed_at: null,
        elapsed_hours: 0,
        last_lat: originLat,
        last_lng: originLng,
        current_temp: 4.0,
        current_humidity: 65.0,
        current_methane: 10.0,
        current_co2: 450.0,
        current_spoilage_score: 5,
        current_spoilage_status: 'Safe',
        current_spoilage_risk_percent: 5.0,
        current_recommendation: 'Scheduled delivery created. Ready for dispatch.',
        created_at: new Date()
      });
    }

    // Notifications
    await createNotification(null, 'admin', 'New Delivery Created', `New delivery ${trackingCode} (${food_name}) has been created.`, 'delivery', newDeliveryId);
    if (assignedDriverId) {
      await createNotification(assignedDriverId, 'driver', 'New Trip Assigned', `You have been assigned to delivery ${trackingCode} (${food_name}). Please review and accept.`, 'assignment', newDeliveryId);
    }

    res.status(201).json({
      message: 'Delivery created successfully!',
      delivery_id: newDeliveryId,
      tracking_code: trackingCode,
      status: initialStatus
    });
  } catch (error) {
    console.error('[Create Delivery Error]', error);
    res.status(500).json({ error: 'Failed to create new delivery.' });
  }
});

// 5. Assign Driver to Delivery (Sender or Admin)
router.patch('/:id/assign-driver', authenticateToken, async (req, res) => {
  const deliveryId = parseInt(req.params.id, 10);
  const { driver_id } = req.body;
  const targetDriverId = driver_id ? parseInt(driver_id, 10) : null;

  try {
    let delivery = null;
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT * FROM `deliveries` WHERE id = ?', [deliveryId]);
      delivery = rows[0];
    } else {
      const store = getMemoryStore();
      delivery = store.deliveries.find(d => d.id === deliveryId);
    }

    if (!delivery) return res.status(404).json({ error: 'Delivery not found.' });
    if (req.user.role === 'sender' && delivery.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only assign drivers to your own deliveries.' });
    }

    const newStatus = targetDriverId ? 'assigned' : 'pending';

    if (isMySQLConnected()) {
      await query('UPDATE `deliveries` SET driver_id = ?, status = ? WHERE id = ?', [targetDriverId, newStatus, deliveryId]);
    } else {
      delivery.driver_id = targetDriverId;
      delivery.status = newStatus;
    }

    if (targetDriverId) {
      await createNotification(targetDriverId, 'driver', 'New Trip Assigned', `You have been assigned delivery ${delivery.tracking_code} (${delivery.food_name}).`, 'assignment', deliveryId);
    }

    res.json({ message: 'Driver assigned successfully!', status: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign driver.' });
  }
});

// 6. Driver: Accept Assigned Delivery
router.patch('/:id/accept', authenticateToken, requireRole('driver'), async (req, res) => {
  const deliveryId = parseInt(req.params.id, 10);

  try {
    let delivery = null;
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT * FROM `deliveries` WHERE id = ? AND driver_id = ?', [deliveryId, req.user.id]);
      delivery = rows[0];
    } else {
      const store = getMemoryStore();
      delivery = store.deliveries.find(d => d.id === deliveryId && d.driver_id === req.user.id);
    }

    if (!delivery) return res.status(404).json({ error: 'Delivery not found or not assigned to you.' });

    if (isMySQLConnected()) {
      await query("UPDATE `deliveries` SET status = 'assigned' WHERE id = ?", [deliveryId]);
    } else {
      delivery.status = 'assigned';
    }

    await createNotification(delivery.sender_id, 'sender', 'Driver Accepted Trip', `Driver ${req.user.full_name || 'Assigned Driver'} accepted delivery ${delivery.tracking_code}.`, 'delivery', deliveryId);

    res.json({ message: 'Delivery accepted. You can start the trip when ready.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept delivery.' });
  }
});

// 7. Driver: Reject Assigned Delivery
router.patch('/:id/reject', authenticateToken, requireRole('driver'), async (req, res) => {
  const deliveryId = parseInt(req.params.id, 10);

  try {
    let delivery = null;
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT * FROM `deliveries` WHERE id = ? AND driver_id = ?', [deliveryId, req.user.id]);
      delivery = rows[0];
    } else {
      const store = getMemoryStore();
      delivery = store.deliveries.find(d => d.id === deliveryId && d.driver_id === req.user.id);
    }

    if (!delivery) return res.status(404).json({ error: 'Delivery not found or not assigned to you.' });

    if (isMySQLConnected()) {
      await query("UPDATE `deliveries` SET driver_id = NULL, status = 'pending' WHERE id = ?", [deliveryId]);
    } else {
      delivery.driver_id = null;
      delivery.status = 'pending';
    }

    await createNotification(delivery.sender_id, 'sender', 'Driver Rejected Trip', `The assigned driver was unable to accept ${delivery.tracking_code}. The shipment is back to pending.`, 'delivery', deliveryId);
    await createNotification(null, 'admin', 'Delivery Rejected by Driver', `Delivery ${delivery.tracking_code} was rejected by driver and requires reassignment.`, 'delivery', deliveryId);

    res.json({ message: 'Delivery assignment rejected.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject delivery.' });
  }
});

// 8. Driver: Start Delivery Trip -> sets 'in_transit', sets started_at, begins elapsed hours counting
router.patch('/:id/start', authenticateToken, requireRole('driver'), async (req, res) => {
  const deliveryId = parseInt(req.params.id, 10);
  const now = new Date();

  try {
    let delivery = null;
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT * FROM `deliveries` WHERE id = ? AND driver_id = ?', [deliveryId, req.user.id]);
      delivery = rows[0];
    } else {
      const store = getMemoryStore();
      delivery = store.deliveries.find(d => d.id === deliveryId && d.driver_id === req.user.id);
    }

    if (!delivery) return res.status(404).json({ error: 'Delivery not found or not assigned to you.' });

    if (isMySQLConnected()) {
      await query("UPDATE `deliveries` SET status = 'in_transit', started_at = ?, elapsed_hours = 0.00 WHERE id = ?", [now, deliveryId]);
    } else {
      delivery.status = 'in_transit';
      delivery.started_at = now;
      delivery.elapsed_hours = 0.00;
    }

    // Trigger Notifications
    await createNotification(delivery.sender_id, 'sender', 'Trip Started!', `Your shipment ${delivery.tracking_code} (${delivery.food_name}) is now in transit.`, 'delivery', deliveryId);
    await createNotification(null, 'admin', 'Shipment In Transit', `Delivery ${delivery.tracking_code} has started transit.`, 'delivery', deliveryId);

    res.json({
      message: 'Trip started! Elapsed hours timer is now active.',
      started_at: now,
      status: 'in_transit'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start delivery trip.' });
  }
});

// 9. Driver: Complete Delivery Trip -> sets 'completed', sets completed_at
router.patch('/:id/complete', authenticateToken, requireRole('driver'), async (req, res) => {
  const deliveryId = parseInt(req.params.id, 10);
  const now = new Date();

  try {
    let delivery = null;
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT * FROM `deliveries` WHERE id = ? AND driver_id = ?', [deliveryId, req.user.id]);
      delivery = rows[0];
    } else {
      const store = getMemoryStore();
      delivery = store.deliveries.find(d => d.id === deliveryId && d.driver_id === req.user.id);
    }

    if (!delivery) return res.status(404).json({ error: 'Delivery not found or not assigned to you.' });

    let finalElapsedHours = delivery.elapsed_hours || 0;
    if (delivery.started_at) {
      finalElapsedHours = parseFloat(((now.getTime() - new Date(delivery.started_at).getTime()) / (1000 * 60 * 60)).toFixed(2));
    }

    if (isMySQLConnected()) {
      await query("UPDATE `deliveries` SET status = 'completed', completed_at = ?, elapsed_hours = ? WHERE id = ?", [now, finalElapsedHours, deliveryId]);
    } else {
      delivery.status = 'completed';
      delivery.completed_at = now;
      delivery.elapsed_hours = finalElapsedHours;
    }

    // Trigger Notifications
    await createNotification(delivery.sender_id, 'sender', 'Delivery Completed Successfully', `Shipment ${delivery.tracking_code} has reached its destination safely.`, 'delivery', deliveryId);
    await createNotification(null, 'admin', 'Delivery Completed', `Shipment ${delivery.tracking_code} was completed by driver.`, 'delivery', deliveryId);

    res.json({
      message: 'Delivery successfully marked as completed!',
      completed_at: now,
      elapsed_hours: finalElapsedHours,
      status: 'completed'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete delivery trip.' });
  }
});

// 10. Update Driver Live GPS Location
router.patch('/:id/location', authenticateToken, requireRole('driver'), async (req, res) => {
  const deliveryId = parseInt(req.params.id, 10);
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Latitude and Longitude are required.' });
  }

  try {
    if (isMySQLConnected()) {
      await query('UPDATE `deliveries` SET last_lat = ?, last_lng = ? WHERE id = ? AND driver_id = ?', [lat, lng, deliveryId, req.user.id]);
    } else {
      const store = getMemoryStore();
      const delivery = store.deliveries.find(d => d.id === deliveryId && d.driver_id === req.user.id);
      if (delivery) {
        delivery.last_lat = lat;
        delivery.last_lng = lng;
      }
    }
    res.json({ message: 'Location updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location.' });
  }
});

module.exports = router;
