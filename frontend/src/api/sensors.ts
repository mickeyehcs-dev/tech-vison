import { apiClient } from './client';
import { SensorModule } from '../types';

export const sensorsApi = {
  async listModules(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await apiClient.get<SensorModule[]>(`/sensors/modules?${query.toString()}`);
    return {
      sensors: res.data,
      total: res.meta?.total || 0,
      page: res.meta?.page || 1,
      limit: res.meta?.limit || 10
    };
  },

  async getAvailableModules() {
    const res = await apiClient.get<SensorModule[]>('/sensors/modules/available');
    return res.data;
  },

  async createModule(data: {
    device_name: string;
    hardware_model?: string;
    firmware_version?: string;
  }) {
    const res = await apiClient.post<{ module: SensorModule; rawApiKey: string }>(
      '/sensors/modules',
      data
    );
    return res.data;
  },

  async renewApiKey(id: number) {
    const res = await apiClient.post<{ rawApiKey: string }>(`/sensors/modules/${id}/renew-key`);
    return res.data;
  },

  async deleteModule(id: number) {
    const res = await apiClient.delete<{ message: string }>(`/sensors/modules/${id}`);
    return res.data;
  },

  async assignDriverToSensor(sensorId: number, driverId: number | null) {
    const res = await apiClient.post<{ message: string }>(`/sensors/modules/${sensorId}/assign-driver`, {
      driver_id: driverId
    });
    return res.data;
  },

  async testInjectTelemetry(data: {
    delivery_id?: number;
    sensor_module_id?: number;
    temperature: number;
    humidity: number;
    methane?: number;
    co2?: number;
    storage_hours?: number;
    storage_days?: number;
  }) {
    const res = await apiClient.post<{
      message: string;
      logId: number;
      riskLevel: string;
      score: number;
      deliveryId: number;
      status: string;
      violations: string[];
    }>('/sensors/test-inject', data);
    return res.data;
  },

  async exportLogsCsv(deliveryId?: number) {
    const query = deliveryId ? `?delivery_id=${deliveryId}` : '';
    const res = await apiClient.get<string>(`/sensors/logs/export${query}`);
    return res.data;
  }
};
