"""
Celery tasks to sync campaign data from CSV files into DB
and refresh dashboard KPI cache.
"""
import logging
from datetime import datetime, timezone

from app.celery_app import celery
from app.database import SessionLocal
from app.models import GoogleSheet, FacebookAccount, Campaign, Lead
from app.services.cache_service import cache
from app.config import settings

from sheets_api import fetch_public_sheet_csv

logger = logging.getLogger("smartland.tasks.sync")


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_sheet_campaigns(self, sheet_id: int):
    """Sync campaign data from a single CSV sheet into campaigns table."""
    db = SessionLocal()
    try:
        sheet = db.query(GoogleSheet).filter(GoogleSheet.id == sheet_id, GoogleSheet.is_active == True).first()
        if not sheet:
            return {"status": "skipped", "reason": "Sheet not found or inactive"}

        rows = fetch_public_sheet_csv(sheet.sheet_id)
        synced = 0
        now = datetime.now(timezone.utc)

        for row in rows:
            name = row.get("name", "")
            if not name:
                continue

            # Upsert: check by name + source_sheet
            existing = (
                db.query(Campaign)
                .filter(Campaign.name == name, Campaign.source_sheet == sheet.sheet_name)
                .first()
            )

            if existing:
                existing.spend = row.get("spend", 0)
                existing.impressions = row.get("imp", 0) or row.get("impressions", 0)
                existing.clicks = row.get("clicks", 0)
                existing.engagements = row.get("engagements", 0)
                existing.purchases = row.get("purchases", 0)
                existing.status = row.get("status", "ACTIVE")
                existing.synced_at = now
            else:
                campaign = Campaign(
                    name=name,
                    spend=row.get("spend", 0),
                    impressions=row.get("imp", 0) or row.get("impressions", 0),
                    clicks=row.get("clicks", 0),
                    engagements=row.get("engagements", 0),
                    purchases=row.get("purchases", 0),
                    status=row.get("status", "ACTIVE"),
                    source_sheet=sheet.sheet_name,
                    synced_at=now,
                )
                db.add(campaign)
            synced += 1

        db.commit()
        logger.info(f"Synced {synced} campaigns from sheet '{sheet.sheet_name}'")

        # Invalidate related caches
        cache.delete_pattern("campaigns:*")
        cache.delete_pattern("kpi:*")

        return {"status": "success", "synced": synced, "sheet": sheet.sheet_name}

    except Exception as e:
        db.rollback()
        logger.error(f"Sync sheet {sheet_id} failed: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()


@celery.task
def sync_all_campaign_data():
    """Fan-out: dispatch sync task for each active sheet in parallel."""
    db = SessionLocal()
    try:
        sheets = db.query(GoogleSheet).filter(GoogleSheet.is_active == True).all()
        sheet_ids = [s.id for s in sheets]
    finally:
        db.close()

    for sid in sheet_ids:
        sync_sheet_campaigns.delay(sid)

    logger.info(f"Dispatched sync tasks for {len(sheet_ids)} sheets")
    return {"dispatched": len(sheet_ids)}


@celery.task
def refresh_dashboard_cache():
    """Pre-compute dashboard KPIs and store in cache."""
    db = SessionLocal()
    try:
        from sqlalchemy import func

        # Aggregate from campaigns table
        result = db.query(
            func.coalesce(func.sum(Campaign.spend), 0),
            func.coalesce(func.sum(Campaign.clicks), 0),
            func.coalesce(func.sum(Campaign.purchases), 0),
        ).first()

        total_spend = float(result[0])
        total_clicks = int(result[1])
        total_purchases = int(result[2])

        avg_order = settings.AVG_ORDER_VALUE
        roas_raw = (total_purchases * avg_order / total_spend) if total_spend > 0 else 0
        avg_cpc = total_spend / total_clicks if total_clicks > 0 else 0
        verified_leads = db.query(Lead).count()

        kpi_data = {
            "total_spend": round(total_spend, 2),
            "total_revenue": round(total_purchases * avg_order, 2),
            "roas": round(roas_raw, 2),
            "total_purchases": total_purchases,
            "verified_leads": verified_leads,
            "avg_cpc": round(avg_cpc, 2),
        }

        # Store as global cache (all users see same aggregated data)
        cache.set("kpi:global", {"status": "success", "data": kpi_data}, ttl=300)
        logger.info("Dashboard KPI cache refreshed")
        return kpi_data

    except Exception as e:
        logger.error(f"Refresh dashboard cache failed: {e}")
        return {"error": str(e)}
    finally:
        db.close()
