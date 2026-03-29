import { useUIStore } from '@/contexts/uiStore';
import { clearAuthData, getStoredToken } from '@/lib/auth';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token from cookies
axiosClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 and 402
// Note: We only clear auth data here. Navigation is handled by React Router
// through the ProtectedRoute component reacting to auth state changes.
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      clearAuthData();
      // Don't hard redirect - let authStore and ProtectedRoute handle navigation
    }

    if (status === 402) {
      // Payment required - trigger global upgrade modal
      const detail = error.response?.data?.detail;

      // Extract structured error data if available
      const reason =
        typeof detail === 'object'
          ? detail.message
          : detail || 'Upgrade necessário para continuar';
      const currentUsage = typeof detail === 'object' ? detail.current : undefined;
      const limit = typeof detail === 'object' ? detail.limit : undefined;
      const tier = typeof detail === 'object' ? detail.tier : undefined;

      // Trigger global upgrade modal
      useUIStore.getState().openUpgradeModal({
        reason,
        currentUsage,
        limit,
        tier,
      });
    }

    return Promise.reject(error);
  }
);
