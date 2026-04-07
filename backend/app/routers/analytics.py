import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, MarketingAnalytics, DashboardCampaign, FbBitrix24Merged

logger = logging.getLogger("smartland")
router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics/marketing")
def get_marketing_analytics(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    objective: str = Query(None),
    placement: str = Query(None),
    device: str = Query(None),
    sort_by: str = Query("id"),
    sort_dir: str = Query("asc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(MarketingAnalytics)

    if objective:
        query = query.filter(MarketingAnalytics.campaign_objective == objective)
    if placement:
        query = query.filter(MarketingAnalytics.ad_placement == placement)
    if device:
        query = query.filter(MarketingAnalytics.device_type == device)

    total = query.count()

    sort_col = getattr(MarketingAnalytics, sort_by, MarketingAnalytics.id)
    if sort_dir == "desc":
        sort_col = sort_col.desc()
    query = query.order_by(sort_col)

    rows = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "status": "success",
        "data": [_serialize_marketing(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/analytics/marketing/summary")
def get_marketing_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = db.query(
        func.count(MarketingAnalytics.id).label("total_campaigns"),
        func.sum(MarketingAnalytics.ad_spend).label("total_spend"),
        func.sum(MarketingAnalytics.revenue).label("total_revenue"),
        func.sum(MarketingAnalytics.profit).label("total_profit"),
        func.sum(MarketingAnalytics.impressions).label("total_impressions"),
        func.sum(MarketingAnalytics.clicks).label("total_clicks"),
        func.sum(MarketingAnalytics.conversions).label("total_conversions"),
        func.avg(MarketingAnalytics.roas).label("avg_roas"),
        func.avg(MarketingAnalytics.ctr).label("avg_ctr"),
        func.avg(MarketingAnalytics.cpc).label("avg_cpc"),
    ).first()

    by_objective = db.query(
        MarketingAnalytics.campaign_objective,
        func.count(MarketingAnalytics.id).label("count"),
        func.sum(MarketingAnalytics.ad_spend).label("spend"),
        func.sum(MarketingAnalytics.revenue).label("revenue"),
        func.avg(MarketingAnalytics.roas).label("avg_roas"),
    ).group_by(MarketingAnalytics.campaign_objective).all()

    by_placement = db.query(
        MarketingAnalytics.ad_placement,
        func.count(MarketingAnalytics.id).label("count"),
        func.sum(MarketingAnalytics.ad_spend).label("spend"),
        func.avg(MarketingAnalytics.ctr).label("avg_ctr"),
    ).group_by(MarketingAnalytics.ad_placement).all()

    by_device = db.query(
        MarketingAnalytics.device_type,
        func.count(MarketingAnalytics.id).label("count"),
        func.sum(MarketingAnalytics.clicks).label("clicks"),
        func.sum(MarketingAnalytics.conversions).label("conversions"),
    ).group_by(MarketingAnalytics.device_type).all()

    return {
        "status": "success",
        "data": {
            "overview": {
                "total_campaigns": result.total_campaigns or 0,
                "total_spend": float(result.total_spend or 0),
                "total_revenue": float(result.total_revenue or 0),
                "total_profit": float(result.total_profit or 0),
                "total_impressions": result.total_impressions or 0,
                "total_clicks": result.total_clicks or 0,
                "total_conversions": result.total_conversions or 0,
                "avg_roas": round(float(result.avg_roas or 0), 2),
                "avg_ctr": round(float(result.avg_ctr or 0), 3),
                "avg_cpc": round(float(result.avg_cpc or 0), 2),
            },
            "by_objective": [
                {
                    "objective": r.campaign_objective,
                    "count": r.count,
                    "spend": float(r.spend or 0),
                    "revenue": float(r.revenue or 0),
                    "avg_roas": round(float(r.avg_roas or 0), 2),
                }
                for r in by_objective
            ],
            "by_placement": [
                {
                    "placement": r.ad_placement,
                    "count": r.count,
                    "spend": float(r.spend or 0),
                    "avg_ctr": round(float(r.avg_ctr or 0), 3),
                }
                for r in by_placement
            ],
            "by_device": [
                {
                    "device": r.device_type,
                    "count": r.count,
                    "clicks": r.clicks or 0,
                    "conversions": r.conversions or 0,
                }
                for r in by_device
            ],
        },
    }


@router.get("/analytics/dashboard-campaigns")
def get_dashboard_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(DashboardCampaign).all()
    return {
        "status": "success",
        "data": [
            {
                "id": r.id,
                "campaign_name": r.campaign_name,
                "spend": float(r.spend or 0),
                "impressions": r.impressions or 0,
                "clicks": r.clicks or 0,
                "ctr": float(r.ctr or 0),
                "engagements": r.engagements or 0,
                "orders": r.orders or 0,
                "conversion_rate": float(r.conversion_rate or 0),
                "cpl": float(r.cpl or 0),
                "cpc": float(r.cpc or 0),
                "roas": float(r.roas or 0),
            }
            for r in rows
        ],
    }


@router.get("/analytics/fb-bitrix24")
def get_fb_bitrix24(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(FbBitrix24Merged).all()
    return {
        "status": "success",
        "data": [
            {
                "id": r.id,
                "campaign_name": r.campaign_name,
                "spend": float(r.spend or 0),
                "impressions": r.impressions or 0,
                "clicks": r.clicks or 0,
                "ctr": float(r.ctr or 0),
                "leads_b24": r.leads_b24 or 0,
                "closed_deals": r.closed_deals or 0,
                "close_rate": float(r.close_rate or 0),
                "real_cpl": float(r.real_cpl or 0),
                "cost_per_deal": float(r.cost_per_deal or 0),
            }
            for r in rows
        ],
    }


def _serialize_marketing(r: MarketingAnalytics) -> dict:
    return {
        "id": r.id,
        "campaign_id": r.campaign_id,
        "campaign_objective": r.campaign_objective,
        "platform": r.platform,
        "ad_placement": r.ad_placement,
        "device_type": r.device_type,
        "operating_system": r.operating_system,
        "creative_format": r.creative_format,
        "creative_size": r.creative_size,
        "ad_copy_length": r.ad_copy_length,
        "has_call_to_action": r.has_call_to_action,
        "creative_emotion": r.creative_emotion,
        "creative_age_days": r.creative_age_days,
        "target_audience_age": r.target_audience_age,
        "target_audience_gender": r.target_audience_gender,
        "audience_interest_category": r.audience_interest_category,
        "income_bracket": r.income_bracket,
        "purchase_intent_score": r.purchase_intent_score,
        "retargeting_flag": r.retargeting_flag,
        "start_date": str(r.start_date) if r.start_date else None,
        "quarter": r.quarter,
        "day_of_week": r.day_of_week,
        "hour_of_day": r.hour_of_day,
        "campaign_day": r.campaign_day,
        "quality_score": r.quality_score,
        "actual_cpc": float(r.actual_cpc or 0),
        "impressions": r.impressions or 0,
        "clicks": r.clicks or 0,
        "conversions": r.conversions or 0,
        "ad_spend": float(r.ad_spend or 0),
        "revenue": float(r.revenue or 0),
        "bounce_rate": float(r.bounce_rate or 0),
        "avg_session_duration": float(r.avg_session_duration_seconds or 0),
        "pages_per_session": float(r.pages_per_session or 0),
        "industry_vertical": r.industry_vertical,
        "budget_tier": r.budget_tier,
        "ctr": float(r.ctr or 0),
        "cpc": float(r.cpc or 0),
        "conversion_rate": float(r.conversion_rate or 0),
        "cpa": float(r.cpa or 0),
        "roas": float(r.roas or 0),
        "profit": float(r.profit or 0),
    }
