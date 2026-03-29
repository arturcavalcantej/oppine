"""
APScheduler Configuration

Handles scheduled tasks for the application:
- Daily Summary: Every day at 20:00 (8pm) [comentado]
- Weekly Summary: Every Monday at 09:00 (9am)
- NPS Follow-up: Every hour (checks for pending follow-ups)

The scheduler runs inside the FastAPI process using AsyncIOScheduler.
"""

import os
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()


async def daily_summary_job():
    """Job: Send daily summaries to all eligible businesses."""
    from database import SessionLocal
    from services.notification_service import send_all_daily_summaries

    logger.info(f"[Scheduler] Starting daily summary job at {datetime.now()}")

    db = SessionLocal()
    try:
        results = await send_all_daily_summaries(db)
        logger.info(f"[Scheduler] Daily summary completed: {results}")
    except Exception as e:
        logger.error(f"[Scheduler] Daily summary failed: {e}")
    finally:
        db.close()


async def weekly_summary_job():
    """Job: Send weekly summaries to all eligible businesses."""
    from database import SessionLocal
    from services.notification_service import send_all_weekly_summaries

    logger.info(f"[Scheduler] Starting weekly summary job at {datetime.now()}")

    db = SessionLocal()
    try:
        results = await send_all_weekly_summaries(db)
        logger.info(f"[Scheduler] Weekly summary completed: {results}")
    except Exception as e:
        logger.error(f"[Scheduler] Weekly summary failed: {e}")
    finally:
        db.close()


async def nps_follow_up_job():
    """Job: Process NPS follow-ups for customers who haven't responded."""
    from database import SessionLocal
    from services.follow_up_service import process_all_follow_ups, mark_expired_requests

    logger.info(f"[Scheduler] Starting NPS follow-up job at {datetime.now()}")

    db = SessionLocal()
    try:
        # Process pending follow-ups
        results = await process_all_follow_ups(db)
        logger.info(f"[Scheduler] NPS follow-up completed: {results}")

        # Mark expired requests
        expired_count = mark_expired_requests(db)
        if expired_count > 0:
            logger.info(f"[Scheduler] Marked {expired_count} requests as expired")
    except Exception as e:
        logger.error(f"[Scheduler] NPS follow-up failed: {e}")
    finally:
        db.close()


async def google_review_sync_job():
    """Job: Sync Google reviews for all connected businesses."""
    from database import SessionLocal
    from services.google_business_service import sync_all_businesses

    logger.info(f"[Scheduler] Starting Google review sync job at {datetime.now()}")

    db = SessionLocal()
    try:
        results = sync_all_businesses(db)
        logger.info(f"[Scheduler] Google review sync completed: {results}")
    except Exception as e:
        logger.error(f"[Scheduler] Google review sync failed: {e}")
    finally:
        db.close()


def init_scheduler():
    """Initialize and configure the scheduler with all jobs."""

    # Check if scheduler is disabled (useful for testing or multiple instances)
    if os.getenv("SCHEDULER_DISABLED", "false").lower() == "true":
        logger.info("[Scheduler] Scheduler is disabled via SCHEDULER_DISABLED env var")
        return

    # Daily Summary: Comentado por enquanto - apenas semanal ativo
    # scheduler.add_job(
    #     daily_summary_job,
    #     CronTrigger(hour=20, minute=0),
    #     id="daily_summary",
    #     name="Daily Summary Notifications",
    #     replace_existing=True,
    #     misfire_grace_time=300  # Executa mesmo se atrasou até 5 minutos
    # )
    # logger.info("[Scheduler] Added job: Daily Summary at 20:00")

    # Weekly Summary: Every Monday at 09:00 (9am)
    scheduler.add_job(
        weekly_summary_job,
        CronTrigger(day_of_week="mon", hour=9, minute=0),
        id="weekly_summary",
        name="Weekly Summary Notifications",
        replace_existing=True,
        misfire_grace_time=300  # Executa mesmo se atrasou até 5 minutos
    )
    logger.info("[Scheduler] Added job: Weekly Summary on Mondays at 09:00")

    # NPS Follow-up: Every hour (processes pending follow-ups)
    scheduler.add_job(
        nps_follow_up_job,
        CronTrigger(minute=0),  # Every hour at minute 0
        id="nps_follow_up",
        name="NPS Follow-up Processing",
        replace_existing=True,
        misfire_grace_time=600  # 10 minutes grace time
    )
    logger.info("[Scheduler] Added job: NPS Follow-up every hour")

    # Google Review Sync: Every hour at minute 30
    scheduler.add_job(
        google_review_sync_job,
        CronTrigger(minute=30),  # Every hour at minute 30
        id="google_review_sync",
        name="Google Review Sync",
        replace_existing=True,
        misfire_grace_time=600
    )
    logger.info("[Scheduler] Added job: Google Review Sync every hour at :30")


def start_scheduler():
    """Start the scheduler."""
    if os.getenv("SCHEDULER_DISABLED", "false").lower() == "true":
        return

    if not scheduler.running:
        scheduler.start()
        logger.info("[Scheduler] Scheduler started")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Scheduler stopped")


def get_scheduler_status():
    """Get current scheduler status and jobs info."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger)
        })

    return {
        "running": scheduler.running,
        "jobs": jobs
    }
