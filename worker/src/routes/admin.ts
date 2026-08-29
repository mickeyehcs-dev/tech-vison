import { Hono } from 'hono';
import { authMiddleware } from '../middleware/authMiddleware';
import { executeQuery } from '../db/connection';
import { successResponse, errorResponse } from '../utils/response';
import { AppEnv } from '../types';
import { RowDataPacket } from 'mysql2/promise';

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', authMiddleware);

// GET /api/v1/admin/stats (Dynamic statistics for Admin/Sender/Driver)
adminRoutes.get('/stats', async (c) => {
  try {
    const user = c.get('user');
    const env = c.env;

    if (user.role === 'admin') {
      const [userCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL",
        [],
        env
      );
      const [driverCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND is_active = 1 AND deleted_at IS NULL",
        [],
        env
      );
      const [pendingCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE status = 'pending'",
        [],
        env
      );
      const [currentCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE status IN ('assigned', 'accepted', 'in_transit')",
        [],
        env
      );
      const [completedCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE status = 'completed'",
        [],
        env
      );
      const [totalSensors] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM sensor_modules WHERE status != 'removed'",
        [],
        env
      );
      const [availableSensors] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM sensor_modules WHERE status = 'available' AND is_active = 1",
        [],
        env
      );
      const [highRiskCount] = await executeQuery<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT d.id) as count 
         FROM deliveries d
         JOIN sensor_logs sl ON sl.delivery_id = d.id
         WHERE d.status IN ('assigned', 'accepted', 'in_transit') AND sl.risk_level IN ('HIGH', 'CRITICAL')`,
        [],
        env
      );

      return successResponse(c, {
        totalUsers: userCount?.count || 0,
        activeDrivers: driverCount?.count || 0,
        pendingDeliveries: pendingCount?.count || 0,
        currentDeliveries: currentCount?.count || 0,
        completedDeliveries: completedCount?.count || 0,
        totalSensors: totalSensors?.count || 0,
        availableSensors: availableSensors?.count || 0,
        highRiskDeliveries: highRiskCount?.count || 0
      });
    } else if (user.role === 'sender') {
      const [pendingCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE sender_id = ? AND status = 'pending'",
        [user.id],
        env
      );
      const [currentCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE sender_id = ? AND status IN ('assigned', 'accepted', 'in_transit')",
        [user.id],
        env
      );
      const [completedCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE sender_id = ? AND status = 'completed'",
        [user.id],
        env
      );

      return successResponse(c, {
        pendingDeliveries: pendingCount?.count || 0,
        currentDeliveries: currentCount?.count || 0,
        completedDeliveries: completedCount?.count || 0
      });
    } else if (user.role === 'driver') {
      const [assignedCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE driver_id = ? AND status = 'assigned'",
        [user.id],
        env
      );
      const [currentCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE driver_id = ? AND status IN ('accepted', 'in_transit')",
        [user.id],
        env
      );
      const [completedCount] = await executeQuery<RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM deliveries WHERE driver_id = ? AND status = 'completed'",
        [user.id],
        env
      );

      return successResponse(c, {
        assignedDeliveries: assignedCount?.count || 0,
        currentDeliveries: currentCount?.count || 0,
        completedDeliveries: completedCount?.count || 0
      });
    }

    return successResponse(c, {});
  } catch (err: any) {
    return errorResponse(c, err.message, 500);
  }
});

export { adminRoutes };
