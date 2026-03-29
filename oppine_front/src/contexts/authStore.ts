import { axiosClient } from '@/api/axiosClient';
import { queryClient } from '@/api/queryClient';
import {
  AuthResponse,
  clearAuthData,
  getStoredToken,
  getStoredUser,
  setStoredRefreshToken,
  setStoredToken,
  setStoredUser,
  User,
} from '@/lib/auth';
import { create } from 'zustand';
import { useLanguageStore } from './languageStore';

interface UpdateProfileData {
  name?: string;
  language?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

// Mock User for Dev Mode
const MOCK_USER: User = {
  id: 'dev-user-123',
  email: 'dev@oppine.com',
  name: 'Developer Mode',
  language: 'pt-BR',
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  initialize: () => {
    // Check for Dev Mode Mock Auth
    if (import.meta.env.VITE_MOCK_AUTH === 'true') {
      console.warn('⚠️ DEV MODE: Mock Auth Enabled ⚠️');
      set({ user: MOCK_USER, loading: false, initialized: true });
      useLanguageStore.getState().syncFromUser(MOCK_USER.language);
      return;
    }

    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (token && storedUser) {
      // Trust localStorage initially - show UI immediately
      set({ user: storedUser, loading: false, initialized: true });

      // Sync language from stored user
      useLanguageStore.getState().syncFromUser(storedUser.language);

      // Validate token in background
      axiosClient
        .get<User>('/auth/me')
        .then((response) => {
          const user = response.data;
          setStoredUser(user);
          set({ user });
          // Sync language from backend (in case it changed)
          useLanguageStore.getState().syncFromUser(user.language);
        })
        .catch((error) => {
          // Only logout on explicit 401 (invalid/expired token)
          // Network errors shouldn't force logout - user stays logged in
          if (error.response?.status === 401) {
            clearAuthData();
            set({ user: null });
          }
        });
    } else {
      clearAuthData();
      set({ user: null, loading: false, initialized: true });
    }
  },

  login: async (email: string, password: string) => {
    // Clear any previous user data including last project
    clearAuthData();
    queryClient.clear();

    // Dev Mode Bypass
    if (import.meta.env.VITE_MOCK_AUTH === 'true') {
      console.warn('⚠️ DEV MODE: Mock Login ⚠️');
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const user = { ...MOCK_USER, email };
      set({ user });
      useLanguageStore.getState().syncFromUser(user.language);
      return;
    }

    // Login via local auth
    const response = await axiosClient.post<AuthResponse>('/auth/login', {
      email,
      password,
    });

    const { access_token, refresh_token, user } = response.data;
    setStoredToken(access_token);
    setStoredRefreshToken(refresh_token);
    setStoredUser(user);
    set({ user });
    // Sync language from user
    useLanguageStore.getState().syncFromUser(user.language);
  },

  register: async (email: string, password: string, name: string) => {
    // Clear any previous user data including last project
    clearAuthData();

    // Dev Mode Bypass
    if (import.meta.env.VITE_MOCK_AUTH === 'true') {
      console.warn('⚠️ DEV MODE: Mock Register ⚠️');
      await new Promise((resolve) => setTimeout(resolve, 800));

      const user = { ...MOCK_USER, email, name };
      set({ user });
      useLanguageStore.getState().syncFromUser(user.language);
      return;
    }

    // Register via local auth
    const response = await axiosClient.post<AuthResponse>('/auth/register', {
      email,
      password,
      name,
    });

    const { access_token, refresh_token, user } = response.data;
    setStoredToken(access_token);
    setStoredRefreshToken(refresh_token);
    setStoredUser(user);
    set({ user });
    // Sync language from user (new users get default language)
    useLanguageStore.getState().syncFromUser(user.language);
  },

  logout: () => {
    clearAuthData();
    queryClient.clear();
    set({ user: null });
  },

  setUser: (user) => set({ user }),

  updateProfile: async (data: UpdateProfileData) => {
    const response = await axiosClient.patch<User>('/auth/me', data);
    const updatedUser = response.data;
    setStoredUser(updatedUser);
    set({ user: updatedUser });
    // Sync language if it was updated
    if (data.language) {
      useLanguageStore.getState().syncFromUser(updatedUser.language);
    }
  },

  completeOnboarding: async () => {
    const response = await axiosClient.post<User>('/auth/me/complete-onboarding');
    const updatedUser = response.data;
    setStoredUser(updatedUser);
    set({ user: updatedUser });
  },
}));
