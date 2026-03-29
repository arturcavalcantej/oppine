"""
Notification Service

Handles scheduled notifications:
- Weekly Summary: Sent on Mondays with week overview
- Daily Summary: Sent at end of day with day's metrics

Messages adapt based on performance (positive vs. needs improvement).
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import func

logger = logging.getLogger(__name__)


@dataclass
class PeriodMetrics:
    """Metrics for a time period."""
    total_responses: int
    promoters: int
    passives: int
    detractors: int
    average_score: Optional[float]
    nps_score: Optional[float]


def calculate_nps(promoters: int, detractors: int, total: int) -> Optional[float]:
    """Calculate NPS score from classification counts."""
    if total == 0:
        return None
    promoter_pct = promoters / total
    detractor_pct = detractors / total
    return round((promoter_pct - detractor_pct) * 100, 1)


def get_period_metrics(
    db: Session,
    business_id: str,
    start_date: datetime,
    end_date: datetime
) -> PeriodMetrics:
    """Get metrics for a specific period."""
    from models import FeedbackResponse, FeedbackRequest

    responses = db.query(FeedbackResponse).join(FeedbackRequest).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.responded_at >= start_date,
        FeedbackResponse.responded_at < end_date
    ).all()

    total = len(responses)
    promoters = sum(1 for r in responses if r.classification == "promoter")
    passives = sum(1 for r in responses if r.classification == "passive")
    detractors = sum(1 for r in responses if r.classification == "detractor")

    avg_score = None
    if total > 0:
        avg_score = round(sum(r.score for r in responses) / total, 2)

    nps = calculate_nps(promoters, detractors, total)

    return PeriodMetrics(
        total_responses=total,
        promoters=promoters,
        passives=passives,
        detractors=detractors,
        average_score=avg_score,
        nps_score=nps
    )


# ============================================================================
# Daily Summary
# ============================================================================

def generate_daily_message(
    business_name: str,
    today: PeriodMetrics,
    yesterday: PeriodMetrics
) -> str:
    """Generate daily summary message."""
    messages = []
    messages.append(f"📊 *Resumo do Dia - {business_name}*\n")

    if today.total_responses == 0:
        messages.append("Nenhuma avaliação recebida hoje.")
        if yesterday.total_responses > 0:
            messages.append(f"Ontem foram {yesterday.total_responses} avaliações.")
        return "\n".join(messages)

    # Today's stats
    messages.append(f"*{today.total_responses}* avaliação(ões) recebida(s)")

    if today.average_score:
        emoji = "⭐" if today.average_score >= 8 else "📈" if today.average_score >= 6 else "⚠️"
        messages.append(f"{emoji} Nota média: *{today.average_score}*/10")

    # Breakdown
    if today.promoters > 0:
        messages.append(f"💚 {today.promoters} promotor(es)")
    if today.passives > 0:
        messages.append(f"💛 {today.passives} neutro(s)")
    if today.detractors > 0:
        messages.append(f"🔴 {today.detractors} detrator(es) - atenção necessária")

    # Comparison with yesterday
    diff = today.total_responses - yesterday.total_responses
    if diff > 0:
        messages.append(f"\n📈 +{diff} comparado a ontem")
    elif diff < 0:
        messages.append(f"\n📉 {diff} comparado a ontem")

    return "\n".join(messages)


# ============================================================================
# Weekly Summary
# ============================================================================

def generate_weekly_message(
    business_name: str,
    current_week: PeriodMetrics,
    previous_week: PeriodMetrics
) -> str:
    """Generate weekly summary message - adapts tone based on performance."""
    messages = []
    messages.append(f"📅 *Resumo Semanal - {business_name}*\n")

    # No responses this week
    if current_week.total_responses == 0:
        messages.append("Nenhuma avaliação recebida esta semana.")
        messages.append("\n💡 Dica: Envie pesquisas de NPS após cada atendimento!")
        return "\n".join(messages)

    # Responses count
    messages.append(f"*{current_week.total_responses}* avaliações esta semana")

    # Comparison with last week
    diff = current_week.total_responses - previous_week.total_responses
    if diff > 0:
        messages.append(f"📈 +{diff} comparado à semana passada")
    elif diff < 0:
        messages.append(f"📉 {diff} comparado à semana passada")

    # Score and NPS
    if current_week.average_score:
        messages.append(f"\n⭐ Nota média: *{current_week.average_score}*/10")

    if current_week.nps_score is not None:
        messages.append(f"📊 NPS: *{current_week.nps_score}*")

        # NPS change
        if previous_week.nps_score is not None:
            nps_diff = current_week.nps_score - previous_week.nps_score
            if nps_diff > 0:
                messages.append(f"🚀 NPS subiu {nps_diff:.1f} pontos!")
            elif nps_diff < 0:
                messages.append(f"⚠️ NPS caiu {abs(nps_diff):.1f} pontos")

    # Breakdown
    messages.append("")
    if current_week.promoters > 0:
        messages.append(f"💚 {current_week.promoters} promotores (9-10)")
    if current_week.passives > 0:
        messages.append(f"💛 {current_week.passives} neutros (7-8)")
    if current_week.detractors > 0:
        messages.append(f"🔴 {current_week.detractors} detratores (0-6)")

    # Adaptive closing message
    is_positive = (
        (current_week.nps_score is not None and current_week.nps_score >= 0) or
        (current_week.promoters >= current_week.detractors)
    )

    has_improvement = (
        diff > 0 or
        (previous_week.nps_score is not None and
         current_week.nps_score is not None and
         current_week.nps_score > previous_week.nps_score)
    )

    messages.append("")
    if has_improvement and is_positive:
        messages.append("🎉 Parabéns pelo progresso! Continue assim!")
    elif is_positive:
        messages.append("👏 Bom trabalho! Seus clientes estão satisfeitos.")
    elif current_week.detractors > current_week.promoters:
        messages.append("💪 Semana desafiadora. Foque em resolver os feedbacks negativos.")
    else:
        messages.append("📈 Cada feedback é uma oportunidade de melhoria!")

    return "\n".join(messages)


# ============================================================================
# Business Queries
# ============================================================================

def get_businesses_for_notifications(db: Session, notification_type: str) -> List[Dict[str, Any]]:
    """
    Get businesses whose owners have the specified notification enabled.
    notification_type: 'daily' or 'weekly'
    """
    from models import Business, Project, User

    if notification_type == 'daily':
        filter_field = User.notify_daily_summary
    else:
        filter_field = User.notify_weekly_summary

    results = db.query(
        Business.id,
        Business.name,
        Business.alert_phone,
        Business.whatsapp_instance_id,
        User.uid.label("user_id")
    ).join(
        Project, Business.project_id == Project.id
    ).join(
        User, Project.owner_id == User.uid
    ).filter(
        Business.is_active == True,
        filter_field == True
    ).all()

    return [
        {
            "business_id": r.id,
            "business_name": r.name,
            "alert_phone": r.alert_phone,
            "whatsapp_instance_id": r.whatsapp_instance_id,
            "user_id": r.user_id
        }
        for r in results
    ]


# ============================================================================
# Send Notifications
# ============================================================================

async def send_daily_summary(db: Session, business_id: str, business_name: str,
                             alert_phone: str, whatsapp_instance_id: str) -> bool:
    """Send daily summary to a business owner."""
    from services.whatsapp_service import get_service

    try:
        now = datetime.now(timezone.utc)

        # Today: from midnight to now
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = now

        # Yesterday
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start

        today_metrics = get_period_metrics(db, business_id, today_start, today_end)
        yesterday_metrics = get_period_metrics(db, business_id, yesterday_start, yesterday_end)

        message = generate_daily_message(business_name, today_metrics, yesterday_metrics)

        if not alert_phone:
            logger.warning(f"No alert phone for business {business_id}")
            return False

        whatsapp = get_service()
        result = await whatsapp.send_message(
            to=alert_phone,
            message=message,
            instance_id=whatsapp_instance_id
        )

        if result.success:
            logger.info(f"Daily summary sent for business {business_id}")
            return True
        else:
            logger.error(f"Failed to send daily summary for {business_id}: {result.error}")
            return False

    except Exception as e:
        logger.error(f"Error sending daily summary for {business_id}: {e}")
        return False


async def send_weekly_summary(db: Session, business_id: str, business_name: str,
                              alert_phone: str, whatsapp_instance_id: str) -> bool:
    """Send weekly summary to a business owner."""
    from services.whatsapp_service import get_service

    try:
        now = datetime.now(timezone.utc)

        # Current week (Monday to now)
        days_since_monday = now.weekday()
        current_week_start = (now - timedelta(days=days_since_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        current_week_end = now

        # Previous week
        previous_week_start = current_week_start - timedelta(days=7)
        previous_week_end = current_week_start

        current_metrics = get_period_metrics(db, business_id, current_week_start, current_week_end)
        previous_metrics = get_period_metrics(db, business_id, previous_week_start, previous_week_end)

        message = generate_weekly_message(business_name, current_metrics, previous_metrics)

        if not alert_phone:
            logger.warning(f"No alert phone for business {business_id}")
            return False

        whatsapp = get_service()
        result = await whatsapp.send_message(
            to=alert_phone,
            message=message,
            instance_id=whatsapp_instance_id
        )

        if result.success:
            logger.info(f"Weekly summary sent for business {business_id}")
            return True
        else:
            logger.error(f"Failed to send weekly summary for {business_id}: {result.error}")
            return False

    except Exception as e:
        logger.error(f"Error sending weekly summary for {business_id}: {e}")
        return False


async def send_all_daily_summaries(db: Session) -> Dict[str, int]:
    """Send daily summaries to all eligible businesses."""
    businesses = get_businesses_for_notifications(db, 'daily')

    results = {"total": len(businesses), "sent": 0, "failed": 0, "skipped": 0}

    for biz in businesses:
        if not biz["alert_phone"]:
            results["skipped"] += 1
            continue

        success = await send_daily_summary(
            db,
            business_id=biz["business_id"],
            business_name=biz["business_name"],
            alert_phone=biz["alert_phone"],
            whatsapp_instance_id=biz["whatsapp_instance_id"]
        )

        if success:
            results["sent"] += 1
        else:
            results["failed"] += 1

    logger.info(f"Daily summaries complete: {results}")
    return results


async def send_all_weekly_summaries(db: Session) -> Dict[str, int]:
    """Send weekly summaries to all eligible businesses."""
    businesses = get_businesses_for_notifications(db, 'weekly')

    results = {"total": len(businesses), "sent": 0, "failed": 0, "skipped": 0}

    for biz in businesses:
        if not biz["alert_phone"]:
            results["skipped"] += 1
            continue

        success = await send_weekly_summary(
            db,
            business_id=biz["business_id"],
            business_name=biz["business_name"],
            alert_phone=biz["alert_phone"],
            whatsapp_instance_id=biz["whatsapp_instance_id"]
        )

        if success:
            results["sent"] += 1
        else:
            results["failed"] += 1

    logger.info(f"Weekly summaries complete: {results}")
    return results
