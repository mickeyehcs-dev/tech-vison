import { apiClient } from './client';
import { Notification } from '../types';

export const notificationsApi = {
  async listNotifications(params: { is_read?: number; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params.is_read !== undefined) query.append('is_read', String(params.is_read));
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await apiClient.get<Notification[]>(`/notifications?${query.toString()}`);
    return {
      notifications: res.data,
      total: res.meta?.total || 0,
      unreadCount: res.meta?.unreadCount || 0
    };
  },

  async markAsRead(id: number) {
    const res = await apiClient.patch<{ message: string }>(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllAsRead() {
    const res = await apiClient.patch<{ message: string }>('/notifications/read-all');
    return res.data;
  }
};
