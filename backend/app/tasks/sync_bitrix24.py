"""
Celery task to sync Bitrix24 leads into the leads DB table.
Runs as backup every 30 minutes (primary ingestion is via webhook).
"""
import logging
from datetime import datetime, timezone

from app.celery_app import celery
from app.database import SessionLocal
from app.models import Lead, Setting
from app.services.cache_service import cache

from bitrix24 import fetch_facebook_leads

logger = logging.getLogger("smartland.tasks.bitrix24")


@celery.task(bind=True, max_retries=2, default_retry_delay=120)
def sync_bitrix24_leads(self):
    """Pull all leads from Bitrix24 and upsert into leads table."""
    db = SessionLocal()
    try:
        setting = db.query(Setting).filter(Setting.key == "webhook_url").first()
        if not setting or not setting.value:
            return {"status": "skipped", "reason": "No webhook_url configured"}

        result = fetch_facebook_leads(setting.value)
        leads_data = result.get("leads", [])

        created = 0
        updated = 0
        now = datetime.now(timezone.utc)

        for ld in leads_data:
            bitrix_id = str(ld.get("id", ""))
            if not bitrix_id:
                continue

            existing = db.query(Lead).filter(Lead.bitrix_id == bitrix_id).first()

            if existing:
                existing.status = ld.get("status", existing.status)
                existing.name = ld.get("name", existing.name)
                existing.source = ld.get("campaign", existing.source)
                existing.campaign_name = ld.get("campaign", existing.campaign_name)
                updated += 1
            else:
                new_lead = Lead(
                    bitrix_id=bitrix_id,
                    name=ld.get("name", "Không rõ"),
                    phone="",
                    source=ld.get("campaign", ""),
                    campaign_name=ld.get("campaign", ""),
                    status=ld.get("status", "MỚI"),
                    created_at=now,
                )
                db.add(new_lead)
                created += 1

        db.commit()
        logger.info(f"Bitrix24 sync: {created} created, {updated} updated out of {len(leads_data)} leads")

        # Invalidate caches
        cache.delete_pattern("lead_stats:*")
        cache.delete_pattern("kpi:*")

        return {"status": "success", "created": created, "updated": updated, "total": len(leads_data)}

    except Exception as e:
        db.rollback()
        logger.error(f"Bitrix24 sync failed: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()
