import { apiClient } from './client';
import { User } from '../types';

export const authApi = {
  async login(credentials: { email: string; password: string }) {
    const res = await apiClient.post<{ token: string; user: User }>('/auth/login', credentials);
    const data: any = res?.data || res;
    const token = data?.token;
    const user: User = data?.user || (data?.email ? data : null);
    if (token) {
      apiClient.setToken(token);
    }
    return { token, user };
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      apiClient.setToken(null);
    }
  },

  async getMe() {
    const res = await apiClient.get<{ user: User }>('/auth/me');
    return res.data.user;
  },

  async completeOnboarding(data: {
    fullName: string;
    phoneNumber: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    const res = await apiClient.post<{ user: User; message: string }>('/auth/onboarding', data);
    return res.data.user;
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    const res = await apiClient.post<{ message: string }>('/auth/change-password', data);
    return res.data;
  },

  async updateProfile(data: { fullName?: string; phoneNumber?: string }) {
    const res = await apiClient.put<{ user: User; message: string }>('/auth/profile', data);
    return res.data.user;
  }
};
