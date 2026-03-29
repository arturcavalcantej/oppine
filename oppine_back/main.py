from dotenv import load_dotenv
load_dotenv()  # Load .env before other imports

import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
import json
import sentry_sdk
from config import settings
from fastapi.middleware.cors import CORSMiddleware
import users
from routers import hub, stats, businesses, feedback, inbound_webhook, scheduled_tasks, whatsapp_pool, google_integration
import models
from database import engine
from scheduler import init_scheduler, start_scheduler, shutdown_scheduler, get_scheduler_status

# Initialize Sentry for error tracking (only if DSN is configured)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        send_default_pii=True,
        traces_sample_rate=0.1,  # 10% sampling in production
        profiles_sample_rate=0.1,
    )

# Create Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Oppine API",
    description="API para coleta e triagem de feedback pós-compra via WhatsApp",
    version="1.0.0"
)

# CORS - Read origins from environment variable
cors_origins_env = os.getenv("CORS_ORIGINS", '["http://localhost:3000"]')
try:
    cors_origins = json.loads(cors_origins_env)
except json.JSONDecodeError:
    # Fallback: try comma-separated format
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth & Users
app.include_router(users.router)

# Angular Hub Integration (SSO & Payments)
app.include_router(hub.router)
app.include_router(stats.router)

# Oppine - Feedback Collection
app.include_router(businesses.router)
app.include_router(feedback.router)

# Inbound Webhook (for client system integrations - POS, CRM, etc.)
app.include_router(inbound_webhook.router)

# Scheduled Tasks (cron jobs for notifications)
app.include_router(scheduled_tasks.router)

# WhatsApp Number Pool Management (Admin)
app.include_router(whatsapp_pool.router)

# Google Business Profile Integration
app.include_router(google_integration.router)

# Mount static files for local media storage
if settings.STORAGE_MODE == "local":
    os.makedirs(settings.LOCAL_MEDIA_PATH, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.LOCAL_MEDIA_PATH), name="media")


@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on application startup."""
    init_scheduler()
    start_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup scheduler on application shutdown."""
    shutdown_scheduler()


@app.get("/")
def read_root():
    return {"app": "Oppine API", "version": "1.0.0"}


@app.get("/scheduler/status")
def scheduler_status():
    """Get scheduler status and next run times."""
    return get_scheduler_status()
