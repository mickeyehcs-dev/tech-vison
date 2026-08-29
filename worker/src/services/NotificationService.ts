import { NotificationRepository } from '../db/repositories/NotificationRepository';
import { EnvBindings, Notification } from '../types';

export class NotificationService {
  static async sendNotification(
    data: {
      userId: number;
      type: string;
      title: string;
      message: string;
      data?: any;
    },
    env?: EnvBindings
  ): Promise<number> {
    return NotificationRepository.create(
      {
        user_id: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data_json: data.data || null
      },
      env
    );
  }

  static async sendBulkNotification(
    userIds: number[],
    data: {
      type: string;
      title: string;
      message: string;
      data?: any;
    },
    env?: EnvBindings
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds.filter((id) => id > 0)));
    for (const id of uniqueIds) {
      await this.sendNotification(
        {
          userId: id,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data
        },
        env
      );
    }
  }

  static async listUserNotifications(
    userId: number,
    params: { is_read?: number; page?: number; limit?: number },
    env?: EnvBindings
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    return NotificationRepository.listByUser(userId, params, env);
  }

  static async markAsRead(id: number, userId: number, env?: EnvBindings): Promise<boolean> {
    return NotificationRepository.markRead(id, userId, env);
  }

  static async markAllAsRead(userId: number, env?: EnvBindings): Promise<boolean> {
    return NotificationRepository.markAllRead(userId, env);
  }
}
