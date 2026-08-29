import { apiClient } from './client';
import { DriverLocation, DashboardStats } from '../types';

export const locationsApi = {
  async sendLocation(data: {
    deliveryId: number;
    latitude: number;
    longitude: number;
  }) {
    const res = await apiClient.post<DriverLocation>('/locations', data);
    return res.data;
  },

  async getLocationTrail(deliveryId: number, limit: number = 200) {
    const res = await apiClient.get<{ trail: DriverLocation[]; latest: DriverLocation | null }>(
      `/locations/${deliveryId}?limit=${limit}`
    );
    return res.data;
  }
};

export const adminApi = {
  async getDashboardStats() {
    const res = await apiClient.get<DashboardStats>('/admin/stats');
    return res.data;
  }
};
