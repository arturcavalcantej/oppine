# Oppine Frontend - SSO Integration

## Overview

Oppine uses Angular Hub as its Single Sign-On (SSO) provider. The frontend authenticates users through the Oppine backend, which proxies requests to Angular Hub.

## Architecture

```
┌─────────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Oppine             │      │  Oppine         │      │   Angular Hub   │
│  Frontend (React)   │ ──── │  Backend (API)  │ ──── │   (SSO)         │
└─────────────────────┘      └─────────────────┘      └─────────────────┘
        │                           │                         │
        │  1. POST /hub/auth/login  │                         │
        │ ────────────────────────► │                         │
        │                           │  2. POST /api/auth/login│
        │                           │ ───────────────────────►│
        │                           │                         │
        │                           │  3. Tokens + User       │
        │                           │ ◄───────────────────────│
        │  4. Return tokens + user  │                         │
        │ ◄──────────────────────── │                         │
        │                           │                         │
        │  5. Store tokens locally  │                         │
        │  6. API calls with Bearer │                         │
        │ ────────────────────────► │                         │
```

## Configuration

### Environment Variables (.env)

```env
# API URL pointing to Oppine backend
VITE_API_URL=http://localhost:8000
```

## Files Structure

```
oppine_front/
├── src/
│   ├── lib/
│   │   └── auth.ts              # Token/user storage utilities
│   ├── contexts/
│   │   └── authStore.ts         # Zustand auth state management
│   └── api/
│       └── axiosClient.ts       # Axios instance with auth headers
└── docs/
    └── SSO_INTEGRATION.md       # This file
```

## Key Files

### src/lib/auth.ts

Handles localStorage management for authentication data:

```typescript
// Storage keys
const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

// Interfaces
export interface User {
  uid: string;
  email: string;
  name: string;
  language?: string;
  hub_user_id?: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// Functions
export function getStoredToken(): string | null;
export function setStoredToken(token: string): void;
export function removeStoredToken(): void;
export function getStoredRefreshToken(): string | null;
export function setStoredRefreshToken(token: string): void;
export function removeStoredRefreshToken(): void;
export function getStoredUser(): User | null;
export function setStoredUser(user: User): void;
export function removeStoredUser(): void;
export function clearAuthData(): void;
```

### src/contexts/authStore.ts

Zustand store for authentication state:

```typescript
interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}
```

**Login Flow:**
1. Calls `POST /hub/auth/login` with email and password
2. Receives `access_token`, `refresh_token`, and `user` data
3. Stores tokens and user in localStorage
4. Updates Zustand state

**Initialize Flow:**
1. Checks for stored token and user
2. If found, shows UI immediately (optimistic)
3. Validates token in background via `GET /hub/auth/me`
4. On 401 error, clears auth data and logs out

## API Endpoints Used

### POST `/hub/auth/login`
Login via Angular Hub SSO.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "uid": "12a74b5c-5fd7-4d61-9d0f-a6ca00f40bda",
    "email": "user@example.com",
    "name": "User Name",
    "hub_user_id": 5
  }
}
```

### GET `/hub/auth/me`
Get current authenticated user info.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "uid": "12a74b5c-5fd7-4d61-9d0f-a6ca00f40bda",
  "email": "user@example.com",
  "name": "User Name",
  "language": "pt-BR",
  "hub_user_id": 5
}
```

## Usage Example

### Login Component

```tsx
import { useAuthStore } from '@/contexts/authStore';

function LoginForm() {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Redirect to dashboard
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p>{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```

### Protected Route

```tsx
import { useAuthStore } from '@/contexts/authStore';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
```

### Checking Auth on App Mount

```tsx
import { useEffect } from 'react';
import { useAuthStore } from '@/contexts/authStore';

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <Router>...</Router>;
}
```

## Token Storage

| Key | Description | Lifetime |
|-----|-------------|----------|
| `token` | JWT access token | 7 days |
| `refresh_token` | JWT refresh token | 7 days |
| `user` | User object (JSON) | Persistent |

## Security Notes

1. **Token Storage**: Access token stored in cookie (strict mode via `js-cookie`); user data in localStorage.

2. **Token Refresh**: The refresh token can be used to obtain new access tokens via `POST /hub/token/refresh`.

3. **Logout**: On logout, all auth data is cleared from both cookies and localStorage.

4. **Background Validation**: Token validity is checked in the background on app initialization. Invalid tokens result in automatic logout.

## Running Locally

```bash
# Install dependencies
cd oppine_front
npm install

# Configure environment
echo "VITE_API_URL=http://localhost:8000" > .env

# Start development server
npm run dev
```

Then navigate to `http://localhost:3000` and login.
