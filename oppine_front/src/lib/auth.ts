import Cookies from 'js-cookie';

const TOKEN_KEY = 'oppine_token';
const REFRESH_TOKEN_KEY = 'oppine_refresh_token';
const USER_KEY = 'oppine_user';

export interface User {
  id: string;
  email: string;
  name: string;
  language?: string;
  has_completed_onboarding?: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export function getStoredToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, { expires: 7, secure: true, sameSite: 'Strict' });
}

export function removeStoredToken(): void {
  Cookies.remove(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string): void {
  Cookies.set(REFRESH_TOKEN_KEY, token, { expires: 30, secure: true, sameSite: 'Strict' });
}

export function removeStoredRefreshToken(): void {
  Cookies.remove(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearAuthData(): void {
  removeStoredToken();
  removeStoredRefreshToken();
  removeStoredUser();
  localStorage.removeItem('oppine_last_project_id');
}
