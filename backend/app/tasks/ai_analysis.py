"""
Celery task for AI campaign analysis.
Runs in background, stores result in Redis cache.
"""
import logging

from app.celery_app import celery
from app.database import SessionLocal
from app.models import Campaign
from app.services.cache_service import cache

from ai_analyzer import analyze_campaigns as _analyze

logger = logging.getLogger("smartland.tasks.ai")


@celery.task(bind=True, time_limit=120, soft_time_limit=90)
def run_ai_analysis(self, user_id: int, account_ids: list[int] | None = None):
    """
    Run AI analysis on campaigns in background.
    Result stored in cache with key ai_result:{user_id}.
    """
    db = SessionLocal()
    try:
        query = db.query(Campaign)
        if account_ids:
            query = query.filter(Campaign.account_id.in_(account_ids))

        campaigns = query.all()

        # Convert ORM objects to dicts for the analyzer
        campaign_dicts = [
            {
                "name": c.name,
                "spend": c.spend or 0,
                "imp": c.impressions or 0,
                "clicks": c.clicks or 0,
                "engagements": c.engagements or 0,
                "purchases": c.purchases or 0,
                "status": c.status or "ACTIVE",
            }
            for c in campaigns
        ]

        if not campaign_dicts:
            result = {"provider": "none", "analysis": "Chưa có dữ liệu chiến dịch trong hệ thống."}
        else:
            result = _analyze(campaign_dicts)

        # Store result in cache (TTL 1 hour)
        cache.set(f"ai_result:{user_id}", result, ttl=3600)

        logger.info(f"AI analysis complete for user {user_id}: {len(campaign_dicts)} campaigns, provider={result.get('provider')}")
        return result

    except Exception as e:
        logger.error(f"AI analysis failed for user {user_id}: {e}")
        error_result = {
            "provider": "error",
            "analysis": f"Phân tích AI bị lỗi: {str(e)}",
            "error": str(e),
        }
        cache.set(f"ai_result:{user_id}", error_result, ttl=300)
        return error_result
    finally:
        db.close()
