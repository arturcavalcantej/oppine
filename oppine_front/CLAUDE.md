# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Oppine frontend.

## Project Overview

**Oppine** is a SaaS platform for post-purchase feedback collection and reputation management via WhatsApp. It automates NPS (Net Promoter Score) surveys, triages customer responses by score, and directs promoters to leave Google reviews while alerting business owners to negative feedback.

### Core Value Proposition
- Automate NPS feedback collection via WhatsApp
- Redirect satisfied customers (9-10) to Google Reviews
- Alert business owners to negative feedback (0-6) for proactive intervention
- Provide analytics dashboards with NPS trends

## Architecture

### Tech Stack
- **Framework**: Vite + React 18, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui (Radix Primitives)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router DOM v7
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **Icons**: `lucide-react`
- **Dates**: `date-fns`
- **Notifications**: `react-hot-toast`
- **Internationalization**: `i18next` (pt-BR, en, es)

### Key Design Decisions
- **Authentication**: JWT-based via Angular Hub SSO. Access token stored in **cookies** (`js-cookie`); user data in `localStorage`.
- **UI Library**: `shadcn/ui` components in `src/components/ui/`. Theme in `src/styles/globals.css`.
- **Project Structure**: Modular — `components/` split into `ui/`, `core/`, `modules/`, `features/`.
- **API Layer**: All API calls go through TanStack Query hooks in `src/api/hooks/`. Cache keys centralized in `src/api/queryKeys.ts`.
- **Subscription Enforcement**: Frontend checks plan limits before actions; backend enforces with 402 responses.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Dev Mode (Mock Auth)
To bypass backend authentication during frontend-only development:
1. Create/Edit `.env` file.
2. Set `VITE_MOCK_AUTH=true`.
3. Login/Register will use a mock user without hitting the backend.

### Environment Variables
```env
VITE_API_URL=http://localhost:8000   # Backend API URL
VITE_MOCK_AUTH=false                  # Enable mock auth for frontend-only dev
```

## Project Structure

```
src/
├── api/                       # Data layer
│   ├── axiosClient.ts         # Axios instance with JWT interceptors
│   ├── queryClient.ts         # TanStack Query configuration
│   ├── queryKeys.ts           # Centralized cache key factory
│   └── hooks/                 # Custom data hooks (one per domain)
│       ├── useFeedback.ts         # Feedback requests/responses
│       ├── useBusinesses.ts       # Business CRUD + webhook config
│       ├── useProjects.ts         # Project management
│       ├── useSubscription.ts     # Billing & subscription
│       ├── useProjectStats.ts     # Usage stats & limits
│       └── useCoupon.ts           # Coupon validation
│
├── components/
│   ├── ui/                    # shadcn/ui primitives (Button, Card, Modal, etc.)
│   ├── core/                  # Generic reusable (Logo, LanguageSelector, TagInput)
│   ├── modules/               # App-level modules
│   │   ├── Sidebar.tsx              # Navigation sidebar (collapsible + mobile)
│   │   ├── DashboardLayout.tsx      # Protected dashboard layout wrapper
│   │   ├── ProtectedRoute.tsx       # Auth guard component
│   │   ├── GlobalUpgradeModal.tsx   # Plan limit upgrade prompt
│   │   ├── PricingModal.tsx         # Plan selection modal
│   │   ├── CreateProjectModal.tsx   # New project creation
│   │   └── PostAuthPlanModal.tsx    # Post-registration plan selection
│   └── features/              # Domain-specific components
│       ├── businesses/            # Business management
│       └── settings/              # Settings UI
│
├── contexts/                  # Global state (Zustand stores)
│   ├── authStore.ts          # Auth state: login, logout, register, initialize
│   ├── languageStore.ts      # Language preference persistence
│   └── uiStore.ts            # UI state (modals, sidebar, etc.)
│
├── hooks/                     # Custom React hooks
│   └── landing/              # Landing page-specific hooks
│
├── lib/                       # Utilities
│   ├── auth.ts               # Token/user storage (cookies + localStorage)
│   ├── i18n.ts               # i18next configuration
│   └── cn.ts                 # Tailwind class merger (clsx + tailwind-merge)
│
├── locales/                   # Translation files
│   ├── pt-BR/                # Portuguese (Brazil) — primary
│   ├── en/                   # English
│   └── es/                   # Spanish
│
├── pages/                     # Route components
│   ├── Landing.tsx           # Public marketing/landing page
│   ├── Login.tsx             # Login form
│   ├── Register.tsx          # Registration form
│   ├── Dashboard.tsx         # Main dashboard (project overview)
│   ├── Businesses.tsx        # Business management (CRUD)
│   ├── FeedbackDashboard.tsx # Feedback analytics & NPS metrics
│   ├── Templates.tsx         # Message template management
│   ├── Settings.tsx          # User settings & billing
│   ├── FAQ.tsx               # FAQ page
│   └── FeedbackForm.tsx      # Public feedback response form
│
├── styles/globals.css         # Global CSS + Tailwind theme variables
├── App.tsx                    # Router configuration
└── main.tsx                   # Entry point
```

## Authentication Flow

- **Store**: `src/contexts/authStore.ts` (Zustand)
- **Token Storage**: `src/lib/auth.ts` — access token in cookie, user object in localStorage
- **HTTP Interceptor**: `src/api/axiosClient.ts` — attaches Bearer token, handles 401 logout

### Flow
1. User logs in → `POST /hub/auth/login` via Angular Hub SSO
2. Backend returns `access_token`, `refresh_token`, and `user` object
3. Token stored in cookie; user in localStorage
4. `axiosClient` attaches `Authorization: Bearer <token>` to all requests
5. On 401 response → automatic logout and redirect to `/login`
6. On app mount → `initialize()` checks stored token, validates via `GET /hub/auth/me`

## UI/UX Guidelines

- **Components**: **MUST** use `shadcn/ui` from `src/components/ui/` as the default.
- **Forms**: **MUST** use the shadcn Form pattern:
  - Wrapper: `Form` component from shadcn
  - Logic: `react-hook-form`
  - Validation: `zod` schemas
  - Full TypeScript support
  - Reference: [shadcn Form Docs](https://ui.shadcn.com/docs/components/form)
- **Styling**: Tailwind utility classes. No custom CSS unless necessary.
- **Icons**: `lucide-react` only.
- **Theme**: CSS variables in `src/styles/globals.css`.
- **Responsiveness**: Mobile-first. Sidebar is collapsible with mobile overlay.
- **Translations**: All user-facing text must use `i18next` (`useTranslation` hook). Keys in `src/locales/`.

## Common Workflows

### Adding a New shadcn Component
1. Run `npx shadcn@latest add [component-name]`
2. Component created in `src/components/ui/`
3. Import and use in feature code

### Adding a New Page
1. Create page component in `src/pages/`
2. Register route in `src/App.tsx`
3. Wrap with `<ProtectedRoute />` if auth required
4. Add to Sidebar navigation if needed (`src/components/modules/Sidebar.tsx`)

### Adding a New API Hook
1. Create or update hook file in `src/api/hooks/`
2. Add query keys to `src/api/queryKeys.ts`
3. Use `useQuery` for reads, `useMutation` for writes
4. Invalidate related queries on mutation success

## Backend Integration

The frontend connects to a FastAPI backend (`../oppine_back/`).

### Key API Domains
| Domain | Hooks File | Endpoints |
|--------|-----------|-----------|
| Auth/SSO | `authStore.ts` | `/hub/auth/login`, `/hub/auth/register`, `/hub/auth/me` |
| Projects | `useProjects.ts` | `/projects` CRUD |
| Businesses | `useBusinesses.ts` | `/businesses` CRUD + webhook config |
| Feedback | `useFeedback.ts` | `/feedback/requests`, `/feedback/responses`, `/feedback/dashboard` |
| Templates | `useFeedback.ts` | `/businesses/{id}/templates` CRUD |
| Subscription | `useSubscription.ts` | `/hub/billing/*`, `/hub/me/subscription` |
| Stats | `useProjectStats.ts` | `/projects/{id}/stats` |

### Webhook Integration
- Config UI in "Send NPS" modal → "Webhook" tab
- Hooks in `src/api/hooks/useBusinesses.ts`:
  - `useWebhookInfo(businessId)` — get webhook URL/token
  - `useRegenerateWebhookToken()` — regenerate token
  - `useWebhookConfig(webhookToken)` — field mapping
  - `useUpdateWebhookConfig()` — update mapping
  - `useTestWebhookPayload()` — test extraction
- Backend docs: `../oppine_back/docs/WEBHOOK_INTEGRATION.md`

## NPS Business Logic (Reference)

Understanding the backend logic helps when building frontend features:

| Score | Classification | Frontend Action |
|-------|---------------|----------------|
| 9-10 | Promoter | Show Google Review redirect |
| 7-8 | Passive | Show thank you |
| 0-6 | Detractor | Show alert sent confirmation |

### Subscription Plans
| Plan | Messages/mo | Businesses | Templates |
|------|------------|------------|-----------|
| Free | 50 | 1 | 1 |
| Basico (R$97) | 500 | 3 | 3 |
| Ilimitado (R$197) | Unlimited | Unlimited | Unlimited |
