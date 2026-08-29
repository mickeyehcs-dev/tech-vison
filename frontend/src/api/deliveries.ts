import { apiClient } from './client';
import { Delivery, DeliveryStatus, SensorLog, ModelPrediction, DriverLocation } from '../types';

export const deliveriesApi = {
  async listDeliveries(params: {
    status?: DeliveryStatus;
    statusGroup?: 'pending' | 'current' | 'completed';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.statusGroup) query.append('statusGroup', params.statusGroup);
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await apiClient.get<Delivery[]>(`/deliveries?${query.toString()}`);
    return {
      deliveries: res.data,
      total: res.meta?.total || 0,
      page: res.meta?.page || 1,
      limit: res.meta?.limit || 10
    };
  },

  async createDelivery(data: {
    food_name: string;
    source_location: string;
    destination_location: string;
    start_time?: string;
    driver_id?: number;
  }) {
    const res = await apiClient.post<Delivery>('/deliveries', data);
    return res.data;
  },

  async getDeliveryById(id: number) {
    const res = await apiClient.get<Delivery>(`/deliveries/${id}`);
    return res.data;
  },

  async assignDriver(deliveryId: number, driverId: number, sensorModuleId?: number) {
    const res = await apiClient.post<Delivery>(`/deliveries/${deliveryId}/assign`, {
      driver_id: driverId,
      sensor_module_id: sensorModuleId
    });
    return res.data;
  },

  async assignDriverAndSensor(deliveryId: number, driverId: number, sensorModuleId?: number) {
    return this.assignDriver(deliveryId, driverId, sensorModuleId);
  },

  async acceptDelivery(deliveryId: number) {
    const res = await apiClient.post<Delivery>(`/deliveries/${deliveryId}/accept`);
    return res.data;
  },

  async rejectDelivery(deliveryId: number, reason?: string) {
    const res = await apiClient.post<Delivery>(`/deliveries/${deliveryId}/reject`, { reason });
    return res.data;
  },

  async startDelivery(deliveryId: number) {
    const res = await apiClient.post<Delivery>(`/deliveries/${deliveryId}/start`);
    return res.data;
  },

  async completeDelivery(deliveryId: number) {
    const res = await apiClient.post<Delivery>(`/deliveries/${deliveryId}/complete`);
    return res.data;
  },

  async getLatestSensorData(deliveryId: number) {
    const res = await apiClient.get<SensorLog | null>(`/deliveries/${deliveryId}/latest-sensor`);
    return res.data;
  },

  async getSensorHistory(deliveryId: number, limit: number = 100) {
    const res = await apiClient.get<SensorLog[]>(`/deliveries/${deliveryId}/sensors?limit=${limit}`);
    return res.data;
  },

  async getPredictions(deliveryId: number, limit: number = 100) {
    const res = await apiClient.get<ModelPrediction[]>(`/deliveries/${deliveryId}/predictions?limit=${limit}`);
    return res.data;
  },

  async getLocations(deliveryId: number, limit: number = 200) {
    const res = await apiClient.get<{ trail: DriverLocation[]; latest: DriverLocation | null }>(
      `/deliveries/${deliveryId}/locations?limit=${limit}`
    );
    return res.data;
  }
};
