const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query, isMySQLConnected, getMemoryStore } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

function generateApiKey(prefix = 'alpha') {
  return `sg_live_${crypto.randomBytes(16).toString('hex')}_${prefix}`;
}

function generateDeviceCode() {
  return `DEV-${Math.floor(10000 + Math.random() * 90000)}`;
}

// 1. Get all sensor devices (Admin view, or Driver view for their assigned device)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let sensors = [];
    if (isMySQLConnected()) {
      const [rows] = await query(`
        SELECT s.*, u.full_name AS assigned_driver_name, u.phone_number AS assigned_driver_phone, u.email AS assigned_driver_email
        FROM \`sensor_devices\` s
        LEFT JOIN \`users\` u ON s.assigned_driver_id = u.id
        ORDER BY s.id DESC
      `);
      sensors = rows;
    } else {
      const store = getMemoryStore();
      sensors = store.sensor_devices.map(s => {
        const driver = store.users.find(u => u.id === s.assigned_driver_id);
        return {
          ...s,
          assigned_driver_name: driver ? driver.full_name : null,
          assigned_driver_phone: driver ? driver.phone_number : null,
          assigned_driver_email: driver ? driver.email : null
        };
      });
    }

    if (req.user.role === 'driver') {
      sensors = sensors.filter(s => s.assigned_driver_id === req.user.id);
    }

    res.json({ sensors });
  } catch (error) {
    console.error('[Get Sensors Error]', error);
    res.status(500).json({ error: 'Failed to fetch sensor devices.' });
  }
});

// 2. Add New Sensor Module (Admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  const { device_name, assigned_driver_id } = req.body;

  if (!device_name) {
    return res.status(400).json({ error: 'Device name is required.' });
  }

  const deviceCode = generateDeviceCode();
  const apiKey = generateApiKey(device_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'node');
  const driverId = assigned_driver_id ? parseInt(assigned_driver_id, 10) : null;

  try {
    let newId = null;
    if (isMySQLConnected()) {
      const [result] = await query(
        'INSERT INTO `sensor_devices` (`device_name`, `device_code`, `api_key`, `assigned_driver_id`, `status`) VALUES (?, ?, ?, ?, ?)',
        [device_name.trim(), deviceCode, apiKey, driverId, 'active']
      );
      newId = result.insertId;
    } else {
      const store = getMemoryStore();
      newId = store.sensor_devices.length ? Math.max(...store.sensor_devices.map(s => s.id)) + 1 : 1;
      store.sensor_devices.unshift({
        id: newId,
        device_name: device_name.trim(),
        device_code: deviceCode,
        api_key: apiKey,
        assigned_driver_id: driverId,
        status: 'active',
        last_ping_at: null,
        created_at: new Date()
      });
    }

    res.status(201).json({
      message: 'Sensor module created successfully with generated API key and Device ID.',
      sensor: {
        id: newId,
        device_name: device_name.trim(),
        device_code: deviceCode,
        api_key: apiKey,
        assigned_driver_id: driverId,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('[Add Sensor Error]', error);
    res.status(500).json({ error: 'Failed to create sensor module.' });
  }
});

// 3. Renew Sensor API Key (Admin only)
router.post('/:id/renew-key', authenticateToken, requireRole('admin'), async (req, res) => {
  const sensorId = parseInt(req.params.id, 10);
  const newApiKey = generateApiKey('renewed');

  try {
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT id FROM `sensor_devices` WHERE id = ?', [sensorId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Sensor device not found.' });
      await query('UPDATE `sensor_devices` SET `api_key` = ? WHERE id = ?', [newApiKey, sensorId]);
    } else {
      const store = getMemoryStore();
      const s = store.sensor_devices.find(dev => dev.id === sensorId);
      if (!s) return res.status(404).json({ error: 'Sensor device not found.' });
      s.api_key = newApiKey;
    }

    res.json({
      message: 'API Key renewed successfully! Please update the IoT firmware credentials.',
      new_api_key: newApiKey
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to renew sensor API key.' });
  }
});

// 4. Assign / Reassign Sensor to Driver (Admin only)
router.patch('/:id/assign-driver', authenticateToken, requireRole('admin'), async (req, res) => {
  const sensorId = parseInt(req.params.id, 10);
  const { driver_id } = req.body;
  const targetDriverId = driver_id ? parseInt(driver_id, 10) : null;

  try {
    if (isMySQLConnected()) {
      await query('UPDATE `sensor_devices` SET `assigned_driver_id` = ? WHERE id = ?', [targetDriverId, sensorId]);
    } else {
      const store = getMemoryStore();
      const s = store.sensor_devices.find(dev => dev.id === sensorId);
      if (!s) return res.status(404).json({ error: 'Sensor device not found.' });
      s.assigned_driver_id = targetDriverId;
    }

    res.json({ message: 'Sensor assigned to driver successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign sensor device.' });
  }
});

// 5. Remove Sensor Device (Admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const sensorId = parseInt(req.params.id, 10);

  try {
    if (isMySQLConnected()) {
      await query('DELETE FROM `sensor_devices` WHERE id = ?', [sensorId]);
    } else {
      const store = getMemoryStore();
      store.sensor_devices = store.sensor_devices.filter(s => s.id !== sensorId);
    }
    res.json({ message: 'Sensor device removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove sensor device.' });
  }
});

module.exports = router;
