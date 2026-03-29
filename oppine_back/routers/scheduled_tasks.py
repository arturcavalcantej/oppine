"""
Scheduled Tasks Router

Endpoints for cron jobs and scheduled tasks.
These endpoints are protected by an API key to prevent unauthorized access.

Cron schedule:
- Daily summary: Every day at 20:00 (end of business day)
- Weekly summary: Every Monday at 9:00
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/scheduled", tags=["scheduled-tasks"])

# API key for scheduled tasks (set in environment variable)
SCHEDULED_TASKS_API_KEY = os.getenv("SCHEDULED_TASKS_API_KEY", "")


def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Verify API key for scheduled task endpoints."""
    if not SCHEDULED_TASKS_API_KEY:
        # If no API key is configured, allow access (development mode)
        logger.warning("SCHEDULED_TASKS_API_KEY not configured - allowing access")
        return True

    if x_api_key != SCHEDULED_TASKS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return True


@router.post("/weekly-summary")
async def trigger_weekly_summary(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_api_key)
):
    """
    Trigger weekly summary notifications for all eligible businesses.

    Cron: Every Monday at 9am
    ```
    0 9 * * 1 curl -X POST https://api.oppine.com/api/v1/scheduled/weekly-summary -H "X-API-Key: YOUR_KEY"
    ```
    """
    from services.notification_service import send_all_weekly_summaries

    try:
        results = await send_all_weekly_summaries(db)
        return {
            "success": True,
            "message": "Weekly summaries processed",
            "results": results
        }
    except Exception as e:
        logger.error(f"Error processing weekly summaries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daily-summary")
async def trigger_daily_summary(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_api_key)
):
    """
    Trigger daily summary notifications for all eligible users.

    Cron: Every day at 8pm (end of business day)
    ```
    0 20 * * * curl -X POST https://api.oppine.com/api/v1/scheduled/daily-summary -H "X-API-Key: YOUR_KEY"
    ```
    """
    from services.notification_service import send_all_daily_summaries

    try:
        results = await send_all_daily_summaries(db)
        return {
            "success": True,
            "message": "Daily summaries processed",
            "results": results
        }
    except Exception as e:
        logger.error(f"Error processing daily summaries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def scheduled_tasks_health():
    """Health check for scheduled tasks service."""
    return {
        "status": "ok",
        "service": "scheduled-tasks",
        "api_key_configured": bool(SCHEDULED_TASKS_API_KEY)
    }
