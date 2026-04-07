"""Celery task: periodic lead → campaign attribution."""
import logging

from app.celery_app import celery
from app.database import SessionLocal
from app.services.attribution_service import attribute_leads

logger = logging.getLogger("smartland.tasks.attribution")


@celery.task(name="app.tasks.attribution.run_attribution_task", bind=True, max_retries=2)
def run_attribution_task(self) -> dict:
    """Run lead attribution and log the result."""
    db = SessionLocal()
    try:
        result = attribute_leads(db)
        logger.info(f"run_attribution_task: {result}")
        return {"status": "success", **result}
    except Exception as exc:
        logger.exception(f"Attribution task failed: {exc}")
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()
