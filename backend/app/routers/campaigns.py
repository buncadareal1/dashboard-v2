import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Setting, Campaign
from app.services.permission_service import get_user_accounts, get_user_sheets
from app.services.facebook_service import (
    fetch_campaign_insights,
    parse_insights_to_campaigns,
    fetch_account_info,
)

from sheets_api import fetch_public_sheet_csv
from bitrix24 import fetch_facebook_leads as b24_fetch_leads

logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api", tags=["campaigns"])


def _get_all_campaign_data(db: Session, current_user: User, date_from: str | None = None, date_to: str | None = None) -> list:
    """Lấy toàn bộ campaign data từ Facebook API + CSV sheets."""
    all_campaigns = []

    # 1. Facebook Marketing API (data thật)
    insights = fetch_campaign_insights(date_from=date_from, date_to=date_to)
    fb_data = parse_insights_to_campaigns(insights)
    all_campaigns.extend(fb_data)

    # 2. Google Sheets CSV
    sheets = get_user_sheets(db, current_user)
    for sheet in sheets:
        try:
            data = fetch_public_sheet_csv(sheet.sheet_id)
            for row in data:
                row["source_sheet"] = sheet.sheet_name
            all_campaigns.extend(data)
        except Exception:
            pass

    return all_campaigns


def _normalize_name(name: str) -> str:
    if not name:
        return ""
    return name.lower().strip().replace("  ", " ")


@router.get("/facebook-data")
def get_fb_ads_data(
    date_from: str = Query(None, description="YYYY-MM-DD"),
    date_to: str = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy dữ liệu Facebook Ads thật từ Marketing API."""
    insights = fetch_campaign_insights(date_from=date_from, date_to=date_to)
    data = parse_insights_to_campaigns(insights)

    if not data:
        # Kiểm tra kết nối
        account = fetch_account_info()
        if account is None:
            return {"status": "error", "data": [], "message": "Không thể kết nối Facebook API. Kiểm tra Access Token."}
        return {"status": "empty", "data": [], "message": "Không có dữ liệu trong khoảng thời gian này", "account": account}

    return {"status": "success", "data": data, "total": len(data)}


@router.get("/facebook-account")
def get_fb_account_info(current_user: User = Depends(get_current_user)):
    """Kiểm tra kết nối Facebook Ads account."""
    account = fetch_account_info()
    if account is None:
        return {"status": "error", "message": "Không thể kết nối. Kiểm tra FB_ACCESS_TOKEN và FB_AD_ACCOUNT_ID."}
    return {"status": "success", "account": account}


@router.get("/my-accounts")
def get_my_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    accounts = get_user_accounts(db, current_user)
    return {
        "user": current_user.username,
        "role": current_user.role,
        "accounts": [{"id": a.id, "account_name": a.account_name, "ad_account_id": a.ad_account_id} for a in accounts],
    }


@router.get("/my-sheets")
def get_my_sheets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sheets = get_user_sheets(db, current_user)
    return {
        "user": current_user.username,
        "role": current_user.role,
        "sheets": [{"id": s.id, "sheet_name": s.sheet_name, "sheet_id": s.sheet_id} for s in sheets],
    }


@router.get("/sheet-data")
def get_sheet_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    allowed_sheets = get_user_sheets(db, current_user)

    if not allowed_sheets:
        return {"status": "empty", "data": [], "message": "Chưa được cấp quyền xem Sheet nào"}

    all_data = []
    errors = []
    for sheet in allowed_sheets:
        try:
            sheet_data = fetch_public_sheet_csv(sheet.sheet_id)
            for row in sheet_data:
                row["source_sheet"] = sheet.sheet_name
            all_data.extend(sheet_data)
        except Exception as e:
            errors.append(f"{sheet.sheet_name}: {str(e)}")

    return {"status": "success", "data": all_data, "errors": errors}


def _aggregate_attribution_from_db(db: Session) -> dict[str, dict]:
    """Build a {normalized_campaign_name: lead_buckets} map from CampaignLeadMatch.

    Returns empty dict if no rows exist (caller should fall back to inline match).
    """
    from app.models.campaign import CampaignLeadMatch
    from app.models.lead import Lead as LeadModel

    rows = (
        db.query(Campaign.name, LeadModel.status)
        .join(CampaignLeadMatch, CampaignLeadMatch.campaign_id == Campaign.id)
        .join(LeadModel, CampaignLeadMatch.lead_id == LeadModel.id)
        .all()
    )
    if not rows:
        return {}

    out: dict[str, dict] = {}
    for name, status in rows:
        key = _normalize_name(name or "")
        if not key:
            continue
        bucket = out.setdefault(
            key,
            {"total": 0, "moi": 0, "dang_tu_van": 0, "chot_don": 0, "that_bai": 0, "leads": []},
        )
        bucket["total"] += 1
        if status == "MỚI":
            bucket["moi"] += 1
        elif status == "ĐANG TƯ VẤN":
            bucket["dang_tu_van"] += 1
        elif status == "CHỐT ĐƠN":
            bucket["chot_don"] += 1
        elif status == "THẤT BẠI":
            bucket["that_bai"] += 1
    return out


@router.get("/campaigns/merged")
def get_merged_campaigns(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Gộp dữ liệu Facebook Ads với Bitrix24 leads.

    Prefers CampaignLeadMatch (populated by attribution Celery task) when present;
    falls back to inline fuzzy matching of Bitrix leads otherwise.
    """
    fb_campaigns = _get_all_campaign_data(db, current_user)
    db_attribution = _aggregate_attribution_from_db(db)

    b24_leads = []
    try:
        webhook_setting = db.query(Setting).filter(Setting.key == "webhook_url").first()
        if webhook_setting and webhook_setting.value:
            b24_result = b24_fetch_leads(webhook_setting.value)
            b24_leads = b24_result.get("leads", [])
    except Exception as e:
        logger.warning(f"Không thể kéo Bitrix24: {e}")

    # Gom leads theo campaign
    lead_by_campaign = defaultdict(
        lambda: {"total": 0, "moi": 0, "dang_tu_van": 0, "chot_don": 0, "that_bai": 0, "leads": []}
    )

    for lead in b24_leads:
        camp = lead.get("campaign", "Không xác định")
        lbc = lead_by_campaign[camp]
        lbc["total"] += 1
        lbc["leads"].append(lead)
        s = lead.get("status", "")
        if s == "MỚI":
            lbc["moi"] += 1
        elif s == "ĐANG TƯ VẤN":
            lbc["dang_tu_van"] += 1
        elif s == "CHỐT ĐƠN":
            lbc["chot_don"] += 1
        elif s == "THẤT BẠI":
            lbc["that_bai"] += 1

    # Merge: match FB campaign name với Bitrix24 campaign
    merged = []
    matched_b24_keys = set()

    for c in fb_campaigns:
        fb_name = c.get("name", "")
        fb_norm = _normalize_name(fb_name)
        spend = c.get("spend", 0)
        imp = c.get("imp", 0)
        clicks = c.get("clicks", 0)
        eng = c.get("engagements", 0)

        best_match = None
        best_score = 0
        for b24_key in lead_by_campaign:
            b24_norm = _normalize_name(b24_key)
            if not b24_norm or not fb_norm:
                continue
            if b24_norm in fb_norm or fb_norm in b24_norm:
                score = len(b24_norm)
                if score > best_score:
                    best_score = score
                    best_match = b24_key
            else:
                fb_words = set(fb_norm.split())
                b24_words = set(b24_norm.split())
                common = fb_words & b24_words
                if len(common) >= 2 or (len(common) == 1 and len(list(common)[0]) > 4):
                    score = len(common)
                    if score > best_score:
                        best_score = score
                        best_match = b24_key

        # Prefer DB attribution (populated by Celery task) if present for this name
        db_bucket = db_attribution.get(fb_norm)
        if db_bucket:
            lead_data = db_bucket
        else:
            lead_data = lead_by_campaign[best_match] if best_match else {
                "total": 0, "moi": 0, "dang_tu_van": 0, "chot_don": 0, "that_bai": 0,
            }
        if best_match:
            matched_b24_keys.add(best_match)

        total_leads = lead_data["total"]
        chot_don = lead_data["chot_don"]
        cpl_real = (spend / total_leads) if total_leads > 0 else 0
        cost_per_order = (spend / chot_don) if chot_don > 0 else 0
        close_rate = (chot_don / total_leads * 100) if total_leads > 0 else 0
        ctr = (clicks / imp * 100) if imp > 0 else 0

        merged.append({
            "name": fb_name,
            "matched_b24": best_match,
            "spend": spend, "impressions": imp, "clicks": clicks, "engagements": eng,
            "ctr": round(ctr, 2),
            "total_leads": total_leads,
            "leads_moi": lead_data["moi"],
            "leads_tu_van": lead_data["dang_tu_van"],
            "leads_chot": chot_don,
            "leads_fail": lead_data["that_bai"],
            "cpl_real": round(cpl_real, 2),
            "cost_per_order": round(cost_per_order, 2),
            "close_rate": round(close_rate, 1),
        })

    # Thêm campaigns Bitrix24 chưa match
    for b24_key in lead_by_campaign:
        if b24_key not in matched_b24_keys:
            ld = lead_by_campaign[b24_key]
            close_rate = (ld["chot_don"] / ld["total"] * 100) if ld["total"] > 0 else 0
            merged.append({
                "name": b24_key, "matched_b24": b24_key,
                "spend": 0, "impressions": 0, "clicks": 0, "engagements": 0, "ctr": 0,
                "total_leads": ld["total"],
                "leads_moi": ld["moi"], "leads_tu_van": ld["dang_tu_van"],
                "leads_chot": ld["chot_don"], "leads_fail": ld["that_bai"],
                "cpl_real": 0, "cost_per_order": 0, "close_rate": round(close_rate, 1),
            })

    total_spend = sum(m["spend"] for m in merged)
    total_leads = sum(m["total_leads"] for m in merged)
    total_orders = sum(m["leads_chot"] for m in merged)
    avg_cpl = (total_spend / total_leads) if total_leads > 0 else 0
    avg_close_rate = (total_orders / total_leads * 100) if total_leads > 0 else 0
    merged.sort(key=lambda x: x["spend"], reverse=True)

    return {
        "status": "success",
        "campaigns": merged,
        "totals": {
            "spend": total_spend, "leads": total_leads, "orders": total_orders,
            "avg_cpl": round(avg_cpl, 2), "avg_close_rate": round(avg_close_rate, 1),
        },
        "fb_count": len(fb_campaigns),
        "b24_count": len(b24_leads),
    }


@router.get("/campaigns/{campaign_ext_id}/timeseries")
def get_campaign_timeseries(
    campaign_ext_id: str,
    days: int = Query(default=30, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get daily snapshots for a campaign (spend, impressions, clicks, leads) over N days."""
    from datetime import date, timedelta
    from sqlalchemy import func

    since = date.today() - timedelta(days=days)

    rows = (
        db.query(
            Campaign.date,
            func.sum(Campaign.spend).label("spend"),
            func.sum(Campaign.impressions).label("impressions"),
            func.sum(Campaign.clicks).label("clicks"),
            func.sum(Campaign.engagements).label("engagements"),
            func.sum(Campaign.purchases).label("purchases"),
        )
        .filter(
            Campaign.campaign_ext_id == campaign_ext_id,
            Campaign.date >= since,
        )
        .group_by(Campaign.date)
        .order_by(Campaign.date)
        .all()
    )

    return {
        "status": "success",
        "campaign_ext_id": campaign_ext_id,
        "days": days,
        "data": [
            {
                "date": row.date.isoformat() if row.date else None,
                "spend": float(row.spend or 0),
                "impressions": int(row.impressions or 0),
                "clicks": int(row.clicks or 0),
                "engagements": int(row.engagements or 0),
                "purchases": int(row.purchases or 0),
            }
            for row in rows
        ],
    }
