# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Oppine backend.

## Project Overview

**Oppine** is a SaaS platform for post-purchase feedback collection and reputation management via WhatsApp. The backend is a FastAPI application that handles NPS survey automation, WhatsApp messaging, subscription management, and webhook integrations.

### What It Does
1. Send NPS surveys via WhatsApp to customers after a purchase
2. Process responses conversationally (score → comment)
3. Triage by score: promoters → Google Review link, detractors → alert to owner
4. Follow up with non-respondents (up to 3 attempts)
5. Send daily/weekly summary reports to business owners
6. Accept webhook triggers from external systems (POS, CRM)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI + Uvicorn |
| Language | Python 3.11+ |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Database | PostgreSQL (prod) / SQLite (dev) |
| Auth | JWT (HS256, 7-day expiry) |
| SSO | Angular Hub integration |
| Payments | Stripe via Angular Hub |
| WhatsApp | Evolution API / Meta Cloud API / Mock |
| Scheduler | APScheduler (AsyncIOScheduler) |
| Monitoring | Sentry |
| Storage | Local filesystem or AWS S3 |

## Development Commands

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env template
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start development server
uvicorn main:app --reload --port 8000

# Create a new migration
alembic revision --autogenerate -m "description"

# Run tests
pytest tests/
```

### Docker
```bash
docker build -t oppine-backend .
docker run -p 8000:8000 --env-file .env oppine-backend
```

### Environment Variables
See `.env.example` for the full list. Key variables:
- `DATABASE_URL` — SQLAlchemy connection string
- `JWT_SECRET_KEY` — secret for JWT signing
- `WHATSAPP_PROVIDER` — `mock`, `evolution`, or `cloud`
- `ANGULAR_HUB_ENABLED` — `true` to enable SSO/payments
- `SCHEDULER_DISABLED` — `true` to disable background jobs

## Project Structure

```
oppine_back/
├── main.py                    # FastAPI app, CORS, lifespan, router includes
├── config.py                  # Pydantic Settings (env-based config)
├── database.py                # SQLAlchemy engine, session factory
├── auth.py                    # JWT creation/verification, get_current_user dependency
├── models.py                  # All SQLAlchemy ORM models
├── users.py                   # User auth + project endpoints
├── scheduler.py               # APScheduler jobs (weekly summary, follow-ups)
├── stripe_products.json       # Plan definitions (prices, limits)
│
├── routers/
│   ├── hub.py                 # Angular Hub SSO, subscription, billing (Stripe)
│   ├── businesses.py          # Business CRUD, templates CRUD, webhook config
│   ├── feedback.py            # Feedback requests/responses, dashboard, WhatsApp webhook
│   ├── inbound_webhook.py     # External system webhook (POS/CRM integration)
│   ├── stats.py               # Usage stats & plan limits
│   └── scheduled_tasks.py     # Scheduler status endpoint
│
├── services/
│   ├── whatsapp_service.py        # Abstract WhatsApp provider (Mock/Evolution/Cloud)
│   ├── angular_hub_service.py     # Angular Hub API client (SSO, subscriptions)
│   ├── nps_conversation_service.py # Conversational NPS flow (score parsing, classification)
│   ├── notification_service.py    # Daily & weekly summary generation/sending
│   └── follow_up_service.py       # Follow-up reminders for non-respondents
│
├── alembic/                   # Database migrations
│   ├── env.py
│   └── versions/              # 9 migration versions
│
├── docs/
│   └── WEBHOOK_INTEGRATION.md # External webhook integration guide
│
├── requirements.txt
├── Dockerfile
└── .env.example
```

## Key Patterns

### Dependency Injection (FastAPI)
```python
# Auth dependency — use in any protected endpoint
from auth import get_current_user

@router.get("/endpoint")
async def my_endpoint(user=Depends(get_current_user), db: Session = Depends(get_db)):
    ...
```

### Database Sessions
```python
from database import get_db

# In endpoints: use Depends(get_db)
# In scheduler jobs: use SessionLocal() directly with try/finally
```

### WhatsApp Service (Provider Pattern)
```python
from services.whatsapp_service import get_service

whatsapp = get_service()  # Returns Mock, Evolution, or Cloud based on env
result = await whatsapp.send_message(to="5511999999999", message="...", instance_id="...")
```

### Angular Hub Integration
- Login/Register proxied through Hub for SSO
- Subscription info cached locally in `SubscriptionCache` model
- Billing webhooks update cache when plan changes

## Data Models (Key Entities)

### Core Hierarchy
```
User → Project → Business → FeedbackRequest → FeedbackResponse
                         └→ FeedbackTemplate (project-level)
```

### Important Fields

**FeedbackRequest** lifecycle:
- `status`: pending → sent → delivered → read → responded | expired | failed
- `conversation_state`: awaiting_score → awaiting_comment → completed
- `follow_up_count`: 1 (initial) → 2 (1st follow-up) → 3 (2nd follow-up)
- `next_follow_up_at`: when next follow-up should be sent

**FeedbackResponse** classification:
- `score`: 0-10
- `classification`: promoter (≥9), passive (7-8), detractor (≤6)
- Thresholds configurable per business

**FeedbackTemplate** (project-level, not business-level):
- `initial_message`: with placeholders `{customer_name}`, `{business_name}`, `{feedback_link}`
- `nps_message`: score request message
- `thank_you_promoter/passive/detractor`: response messages per tier

## Services Architecture

### NPS Conversation Flow
`services/nps_conversation_service.py`

```
Customer sends score → parse_score() → classify_score()
  ├── Promoter: thank you + Google Review link → COMPLETED
  ├── Passive: ask for comment → AWAITING_COMMENT
  └── Detractor: ask for comment → AWAITING_COMMENT (schedule delayed alert)

Customer sends comment → save comment → COMPLETED
  └── If detractor: send alert immediately with comment
```

Score parsing handles: plain numbers, "nota 9", "9/10", written numbers ("dez"), etc.

### Follow-up Flow
`services/follow_up_service.py`

```
Initial send (count=1) → wait 24h → 1st follow-up (count=2) → wait 48h → 2nd follow-up (count=3)
→ wait 72h → mark as expired
```

### Notification Service
`services/notification_service.py`

- **Weekly Summary** (Mon 9am): NPS score, trends, breakdown by classification
- **Daily Summary** (disabled currently): day's metrics vs yesterday

### Scheduled Jobs
`scheduler.py` — APScheduler AsyncIOScheduler

| Job | Schedule | Description |
|-----|----------|-------------|
| Weekly Summary | Monday 9:00 | Send weekly NPS reports |
| NPS Follow-up | Every hour | Process pending follow-ups + expire old requests |
| Daily Summary | 20:00 (disabled) | Send daily metrics |

Disable scheduler: `SCHEDULER_DISABLED=true`

## API Endpoints Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register (local) |
| POST | `/auth/login` | No | Login (local) |
| GET | `/auth/me` | Yes | Current user |
| PATCH | `/auth/me` | Yes | Update preferences |

### Hub (SSO + Billing)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/hub/auth/login` | No | Login via Angular Hub |
| POST | `/hub/auth/register` | No | Register via Angular Hub |
| GET | `/hub/me/subscription` | Yes | Subscription info |
| POST | `/hub/me/subscription/refresh` | Yes | Force refresh |
| GET | `/hub/billing/plans` | Yes | Available plans |
| GET | `/hub/billing/price-preview` | Yes | Price with coupon |
| POST | `/hub/billing/checkout` | Yes | Create Stripe checkout |
| POST | `/hub/billing/portal` | Yes | Billing management |
| POST | `/hub/webhook` | No* | Subscription webhooks |

### Projects
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/projects` | Yes | List projects |
| POST | `/projects` | Yes | Create project |
| GET | `/projects/{id}` | Yes | Project details |
| GET | `/projects/{id}/stats` | Yes | Usage & limits |

### Businesses
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/businesses?project_id=` | Yes | List businesses |
| POST | `/businesses` | Yes | Create business |
| GET | `/businesses/{id}` | Yes | Business details |
| PATCH | `/businesses/{id}` | Yes | Update business |
| DELETE | `/businesses/{id}` | Yes | Delete business |
| GET | `/businesses/{id}/webhook` | Yes | Webhook info |
| POST | `/businesses/{id}/webhook/regenerate` | Yes | New token |

### Templates (project-level)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/businesses/{id}/templates` | Yes | List templates |
| POST | `/businesses/{id}/templates` | Yes | Create template |
| PATCH | `/businesses/{id}/templates/{tid}` | Yes | Update template |
| DELETE | `/businesses/{id}/templates/{tid}` | Yes | Delete template |

### Feedback
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/feedback/requests` | Yes | Create request |
| POST | `/feedback/requests/bulk` | Yes | Bulk create |
| GET | `/feedback/requests?business_id=` | Yes | List requests |
| POST | `/feedback/requests/{id}/send` | Yes | Send manually |
| GET | `/feedback/responses?business_id=` | Yes | List responses |
| PATCH | `/feedback/responses/{id}/resolve` | Yes | Mark resolved |
| GET | `/feedback/dashboard/{business_id}` | Yes | Dashboard metrics |
| GET | `/feedback/public/{request_id}` | No | Public form info |
| POST | `/feedback/public/{request_id}/respond` | No | Submit response |
| POST | `/feedback/webhook/whatsapp` | No* | WhatsApp events |

### Inbound Webhook (External Systems)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/inbound/{token}` | Token | Receive data |
| GET | `/api/v1/inbound/{token}/config` | Token | Field mapping |
| PATCH | `/api/v1/inbound/{token}/config` | Token | Update mapping |
| POST | `/api/v1/inbound/{token}/test` | Token | Test extraction |

## Subscription & Limits

Plans enforced at API level — returns 402 when limits exceeded.

| Plan | Messages/mo | Businesses | Templates |
|------|------------|------------|-----------|
| Free | 50 | 1 | 1 |
| Basico | 500 | 3 | 3 |
| Ilimitado | Unlimited | Unlimited | Unlimited |

Usage tracked in `DailyUsage` model, checked via `stats.py`.

## Common Tasks

### Adding a New Endpoint
1. Create or update router in `routers/`
2. Add router to `main.py` if new file
3. Use `Depends(get_current_user)` for auth
4. Use `Depends(get_db)` for database session

### Adding a New Model
1. Add class to `models.py`
2. Create migration: `alembic revision --autogenerate -m "add xyz"`
3. Apply: `alembic upgrade head`

### Adding a New Service
1. Create file in `services/`
2. Follow existing patterns (async functions, db session param)
3. Import lazily in scheduler jobs to avoid circular imports

### Modifying WhatsApp Integration
1. Abstract interface in `services/whatsapp_service.py`
2. Provider-specific logic in same file (MockService, EvolutionService, CloudService)
3. Test with `WHATSAPP_PROVIDER=mock`
