import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Lead, Campaign
from app.services.permission_service import get_user_sheets, get_user_campaign_ids, apply_lead_filter
from app.services.cache_service import cache
from app.services.facebook_service import fetch_campaign_insights, parse_insights_to_campaigns
from app.config import settings

from sheets_api import fetch_public_sheet_csv

logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard-stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Try cache first
    cache_key = f"kpi:{current_user.id}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Admin can use global cache; marketer needs per-user scope
    if current_user.role == "admin":
        global_cached = cache.get("kpi:global")
        if global_cached:
            cache.set(cache_key, global_cached, ttl=120)
            return global_cached

    # Scope campaigns by user permissions
    user_campaign_ids = get_user_campaign_ids(db, current_user)

    total_spend = 0.0
    total_clicks = 0
    total_purchases = 0
    total_impressions = 0
    total_engagements = 0

    # 1. Aggregate from DB campaigns (synced from FB by Celery task)
    if user_campaign_ids:
        result = db.query(
            func.coalesce(func.sum(Campaign.spend), 0),
            func.coalesce(func.sum(Campaign.clicks), 0),
            func.coalesce(func.sum(Campaign.purchases), 0),
            func.coalesce(func.sum(Campaign.impressions), 0),
        ).filter(Campaign.id.in_(user_campaign_ids)).first()
        total_spend = float(result[0])
        total_clicks = int(result[1])
        total_purchases = int(result[2])
        total_impressions = int(result[3])

    # 2. Fallback: on-demand FB API + CSV (when DB has no synced data)
    if total_spend == 0:
        insights = fetch_campaign_insights()
        fb_data = parse_insights_to_campaigns(insights)
        for c in fb_data:
            total_spend += c.get("spend", 0)
            total_clicks += c.get("clicks", 0)
            total_purchases += c.get("purchases", 0)
            total_impressions += c.get("impressions", 0)

    if total_spend == 0:
        sheets = get_user_sheets(db, current_user)
        for sheet in sheets:
            try:
                data = fetch_public_sheet_csv(sheet.sheet_id)
                for row in data:
                    total_spend += row.get("spend", 0)
                    total_purchases += row.get("purchases", 0)
                    total_clicks += row.get("clicks", 0)
            except Exception:
                pass

    avg_order = settings.AVG_ORDER_VALUE
    roas_raw = (total_purchases * avg_order / total_spend) if total_spend > 0 else 0
    avg_cpc = total_spend / total_clicks if total_clicks > 0 else 0
    ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0

    # Leads count: scoped to user
    lead_query = db.query(Lead)
    lead_query = apply_lead_filter(lead_query, current_user, db)
    verified_leads = lead_query.count()

    response = {
        "status": "success",
        "data": {
            "total_spend": round(total_spend, 2),
            "total_revenue": round(total_purchases * avg_order, 2),
            "roas": round(roas_raw, 2),
            "total_purchases": total_purchases,
            "total_impressions": total_impressions,
            "total_clicks": total_clicks,
            "ctr": round(ctr, 2),
            "verified_leads": verified_leads,
            "avg_cpc": round(avg_cpc, 2),
            "total_campaigns": len(user_campaign_ids),
        },
    }

    cache.set(cache_key, response, ttl=300)
    return response


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Expanded health check: DB + Redis + basic status."""
    checks = {"service": "SmartLand AI Backend", "version": "2.0.0"}

    # Database check
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Redis check
    try:
        from app.services.cache_service import _get_redis
        redis_client = _get_redis()
        redis_client.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unavailable"

    # Overall status
    checks["status"] = "ok" if checks["database"] == "ok" else "degraded"

    return checks
