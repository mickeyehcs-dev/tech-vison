const express = require('express');
const router = express.Router();
const { query, isMySQLConnected, getMemoryStore } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get all notifications relevant to current logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    let notifications = [];
    if (isMySQLConnected()) {
      const [rows] = await query(`
        SELECT * FROM \`notifications\`
        WHERE user_id = ? OR role_target = ? OR role_target = 'all'
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.user.id, req.user.role]);
      notifications = rows;
    } else {
      const store = getMemoryStore();
      notifications = store.notifications.filter(
        n => n.user_id === req.user.id || n.role_target === req.user.role || n.role_target === 'all'
      );
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;

    res.json({
      notifications,
      unread_count: unreadCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// Mark single notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const notifId = parseInt(req.params.id, 10);
  try {
    if (isMySQLConnected()) {
      await query('UPDATE `notifications` SET is_read = 1 WHERE id = ?', [notifId]);
    } else {
      const store = getMemoryStore();
      const n = store.notifications.find(item => item.id === notifId);
      if (n) n.is_read = 1;
    }
    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

// Mark all as read
router.post('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    if (isMySQLConnected()) {
      await query(
        "UPDATE `notifications` SET is_read = 1 WHERE user_id = ? OR role_target = ? OR role_target = 'all'",
        [req.user.id, req.user.role]
      );
    } else {
      const store = getMemoryStore();
      store.notifications.forEach(n => {
        if (n.user_id === req.user.id || n.role_target === req.user.role || n.role_target === 'all') {
          n.is_read = 1;
        }
      });
    }
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read.' });
  }
});

module.exports = router;
