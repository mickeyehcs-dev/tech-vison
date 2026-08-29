import { apiClient } from './client';
import { User, UserRole } from '../types';

export const usersApi = {
  async listUsers(params: {
    role?: UserRole;
    search?: string;
    is_active?: number;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params.role) query.append('role', params.role);
    if (params.search) query.append('search', params.search);
    if (params.is_active !== undefined) query.append('is_active', String(params.is_active));
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    const res = await apiClient.get<User[]>(`/users?${query.toString()}`);
    return {
      users: res.data,
      total: res.meta?.total || 0,
      page: res.meta?.page || 1,
      limit: res.meta?.limit || 10
    };
  },

  async getActiveDrivers() {
    const res = await apiClient.get<User[]>('/users/drivers/active');
    return res.data;
  },

  async createUser(data: {
    email: string;
    role: UserRole;
    fullName?: string;
    phoneNumber?: string;
    initialPassword?: string;
  }) {
    const res = await apiClient.post<{ user: User; initialPassword: string }>('/users', data);
    return res.data;
  },

  async updateUser(id: number, data: { fullName?: string; phoneNumber?: string }) {
    const res = await apiClient.put<User>(`/users/${id}`, data);
    return res.data;
  },

  async setUserStatus(id: number, isActive: boolean) {
    const res = await apiClient.patch<{ message: string }>(`/users/${id}/status`, { isActive });
    return res.data;
  },

  async deleteUser(id: number) {
    const res = await apiClient.delete<{ message: string }>(`/users/${id}`);
    return res.data;
  }
};
