import type { LoginInput, RegisterInput } from '@documind/shared';
import { request } from './api';
import type { AuthResponse, User } from '@/types/api';

export const authService = {
  register: (input: RegisterInput) => request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: LoginInput) => request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  refresh: () => request<{ accessToken: string }>('/api/v1/auth/refresh', { method: 'POST', body: '{}' }),
  me: () => request<{ user: User }>('/api/v1/auth/me'),
  logout: () => request<{ success: boolean }>('/api/v1/auth/logout', { method: 'POST', body: '{}' }),
};
