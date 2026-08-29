import { apiClient } from './client';
import { SecurityLog } from '../types';

export const securityApi = {
  async listLogs(params: {
    search?: string;
    event_type?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.event_type) query.append('event_type', params.event_type);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await apiClient.get<SecurityLog[]>(`/security/logs?${query.toString()}`);
    return {
      logs: res.data,
      total: res.meta?.total || 0,
      page: res.meta?.page || 1,
      limit: res.meta?.limit || 20
    };
  }
};
