const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, isMySQLConnected, getMemoryStore } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// 1. List all users (Admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    let users = [];
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT id, email, role, full_name, phone_number, is_active, first_login_completed, created_at FROM `users` ORDER BY id DESC');
      users = rows;
    } else {
      const store = getMemoryStore();
      users = store.users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        full_name: u.full_name,
        phone_number: u.phone_number,
        is_active: u.is_active,
        first_login_completed: Boolean(u.first_login_completed),
        created_at: u.created_at
      }));
    }
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users list.' });
  }
});

// 2. List drivers (Available for Admin and Sender when assigning deliveries)
router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    let drivers = [];
    if (isMySQLConnected()) {
      const [rows] = await query("SELECT id, email, role, full_name, phone_number, is_active FROM `users` WHERE role = 'driver' AND is_active = 1");
      drivers = rows;
    } else {
      const store = getMemoryStore();
      drivers = store.users
        .filter(u => u.role === 'driver' && u.is_active === 1)
        .map(u => ({
          id: u.id,
          email: u.email,
          role: u.role,
          full_name: u.full_name,
          phone_number: u.phone_number,
          is_active: u.is_active
        }));
    }
    res.json({ drivers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drivers list.' });
  }
});

// 3. Add new user with email (Admin only)
// New user is set with temporary password 'Welcome@123' and first_login_completed = 0 so they are directly prompted to set their password upon first login
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  const { email, role, full_name, phone_number } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role (admin, sender, driver) are required.' });
  }

  if (!['admin', 'sender', 'driver'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, sender, or driver.' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Check if email already exists
    if (isMySQLConnected()) {
      const [existing] = await query('SELECT id FROM `users` WHERE email = ?', [cleanEmail]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'A user with this email address already exists.' });
      }
    } else {
      const store = getMemoryStore();
      if (store.users.some(u => u.email.toLowerCase() === cleanEmail)) {
        return res.status(400).json({ error: 'A user with this email address already exists.' });
      }
    }

    const defaultTempPassword = 'Welcome@123';
    const passwordHash = await bcrypt.hash(defaultTempPassword, 10);

    let newUserId = null;
    if (isMySQLConnected()) {
      const [result] = await query(
        'INSERT INTO `users` (`email`, `password_hash`, `role`, `full_name`, `phone_number`, `is_active`, `first_login_completed`) VALUES (?, ?, ?, ?, ?, 1, 0)',
        [cleanEmail, passwordHash, role, full_name || '', phone_number || '']
      );
      newUserId = result.insertId;
    } else {
      const store = getMemoryStore();
      newUserId = store.users.length ? Math.max(...store.users.map(u => u.id)) + 1 : 1;
      store.users.push({
        id: newUserId,
        email: cleanEmail,
        password_hash: passwordHash,
        role: role,
        full_name: full_name || '',
        phone_number: phone_number || '',
        is_active: 1,
        first_login_completed: 0,
        created_at: new Date()
      });
    }

    res.status(201).json({
      message: `User created successfully! Default onboarding password: ${defaultTempPassword}. User will be prompted to set password on first login.`,
      user: {
        id: newUserId,
        email: cleanEmail,
        role: role,
        full_name: full_name || '',
        phone_number: phone_number || '',
        is_active: 1,
        first_login_completed: false
      }
    });
  } catch (error) {
    console.error('[Add User Error]', error);
    res.status(500).json({ error: 'Failed to create new user.' });
  }
});

// 4. Toggle User Active/Deactivate Status (Admin only)
router.patch('/:id/toggle-status', authenticateToken, requireRole('admin'), async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own admin account.' });
  }

  try {
    let newStatus = 0;
    if (isMySQLConnected()) {
      const [rows] = await query('SELECT is_active FROM `users` WHERE id = ?', [userId]);
      if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
      newStatus = rows[0].is_active ? 0 : 1;
      await query('UPDATE `users` SET is_active = ? WHERE id = ?', [newStatus, userId]);
    } else {
      const store = getMemoryStore();
      const user = store.users.find(u => u.id === userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      user.is_active = user.is_active ? 0 : 1;
      newStatus = user.is_active;
    }

    res.json({
      message: `User status changed to ${newStatus === 1 ? 'Active' : 'Deactivated'}.`,
      is_active: newStatus
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// 5. Delete User (Admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  }

  try {
    if (isMySQLConnected()) {
      await query('DELETE FROM `users` WHERE id = ?', [userId]);
    } else {
      const store = getMemoryStore();
      store.users = store.users.filter(u => u.id !== userId);
    }
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;
