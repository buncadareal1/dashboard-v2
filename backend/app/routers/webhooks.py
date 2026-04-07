"""
Webhook receiver for Bitrix24 outbound events.
When a lead is created/updated in Bitrix24, it POSTs to this endpoint.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Lead, Setting
from app.models.campaign import Campaign
from app.services.cache_service import cache
from app.services.websocket_service import publish_event

from bitrix24 import STATUS_MAP, build_vietnamese_name

logger = logging.getLogger("smartland.webhooks")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Map Bitrix24 STATUS_ID → dashboard status
_STATUS_MAP = {
    "NEW": "MỚI",
    "IN_PROCESS": "ĐANG TƯ VẤN",
    "PROCESSED": "ĐANG TƯ VẤN",
    "CONVERTED": "CHỐT ĐƠN",
    "JUNK": "THẤT BẠI",
}


def _map_status(status_id: str, semantic_id: str = "P") -> str:
    if semantic_id == "S":
        return "CHỐT ĐƠN"
    if semantic_id == "F":
        return "THẤT BẠI"
    return _STATUS_MAP.get(status_id, "MỚI")


@router.post("/bitrix24/{webhook_token}")
async def receive_bitrix24_webhook(
    webhook_token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Receive webhook from Bitrix24 when a lead is created or updated.
    Events: ONCRMLEADADD, ONCRMLEADUPDATE, ONCRMLEADDELETE
    """
    # 1. Validate webhook token
    setting = db.query(Setting).filter(Setting.key == "bitrix24_webhook_token").first()
    if not setting or setting.value != webhook_token:
        raise HTTPException(status_code=403, detail="Invalid webhook token")

    # 2. Parse request
    try:
        body = await request.form()
        body = dict(body)
    except Exception:
        try:
            body = await request.json()
        except Exception:
            body = {}

    event = body.get("event", "")
    lead_id = body.get("data[FIELDS][ID]") or body.get("data", {}).get("FIELDS", {}).get("ID", "")

    logger.info(f"Bitrix24 webhook: event={event}, lead_id={lead_id}")

    if not lead_id:
        return {"status": "ok", "message": "No lead ID"}

    bitrix_id = str(lead_id)

    # 3. Handle events
    if event == "ONCRMLEADDELETE":
        existing = db.query(Lead).filter(Lead.bitrix_id == bitrix_id).first()
        if existing:
            db.delete(existing)
            db.commit()
            cache.delete_pattern("lead_stats:*")
            cache.delete_pattern("kpi:*")
            await publish_event("lead_deleted", {"id": bitrix_id})
        return {"status": "ok"}

    # For ADD/UPDATE: fetch lead details from Bitrix24
    # Bitrix24 webhooks only send the ID, we need to fetch full data
    webhook_url_setting = db.query(Setting).filter(Setting.key == "webhook_url").first()
    if not webhook_url_setting or not webhook_url_setting.value:
        return {"status": "ok", "message": "No webhook_url configured, cannot fetch lead details"}

    import requests as http_requests
    try:
        webhook_url = webhook_url_setting.value.rstrip("/")
        r = http_requests.get(
            f"{webhook_url}/crm.lead.get",
            params={"ID": bitrix_id},
            timeout=10,
        )
        r.raise_for_status()
        lead_data = r.json().get("result", {})
    except Exception as e:
        logger.error(f"Failed to fetch lead {bitrix_id} from Bitrix24: {e}")
        return {"status": "error", "message": str(e)}

    if not lead_data:
        return {"status": "ok", "message": "Lead not found in Bitrix24"}

    # 4. Build lead fields - ghép tên theo thứ tự Việt Nam: Họ + Tên đệm + Tên
    name = build_vietnamese_name(lead_data)

    status_id = lead_data.get("STATUS_ID", "NEW")
    semantic_id = lead_data.get("STATUS_SEMANTIC_ID", "P")
    status = _map_status(status_id, semantic_id)

    campaign = lead_data.get("UTM_CAMPAIGN") or ""
    if not campaign:
        title = lead_data.get("TITLE", "")
        if " - " in title:
            campaign = title.split(" - ", 1)[1].strip()
        else:
            campaign = title or "Không xác định"

    # 5. Auto-assign: find matching campaign and inherit assigned_user_id
    matched_campaign = None
    if campaign:
        # Try exact match on campaign name first
        matched_campaign = (
            db.query(Campaign)
            .filter(Campaign.name == campaign)
            .first()
        )
        # Fallback: partial match (campaign name contained in DB campaign name)
        if not matched_campaign:
            matched_campaign = (
                db.query(Campaign)
                .filter(Campaign.name.ilike(f"%{campaign}%"))
                .first()
            )

    auto_assigned_user_id = matched_campaign.assigned_user_id if matched_campaign else None
    matched_campaign_id = matched_campaign.id if matched_campaign else None

    # 6. Upsert lead
    existing = db.query(Lead).filter(Lead.bitrix_id == bitrix_id).first()

    if existing:
        existing.name = name
        existing.status = status
        existing.campaign_name = campaign
        existing.source = campaign
        existing.campaign_id = matched_campaign_id or existing.campaign_id
        # Only auto-assign if not already manually assigned
        if existing.assigned_user_id is None and auto_assigned_user_id is not None:
            existing.assigned_user_id = auto_assigned_user_id
        event_type = "lead_updated"
    else:
        new_lead = Lead(
            bitrix_id=bitrix_id,
            name=name,
            phone="",
            source=campaign,
            campaign_name=campaign,
            campaign_id=matched_campaign_id,
            assigned_user_id=auto_assigned_user_id,
            status=status,
            created_at=datetime.now(timezone.utc),
        )
        db.add(new_lead)
        event_type = "new_lead"

    db.commit()

    # 6. Invalidate caches
    cache.delete_pattern("lead_stats:*")
    cache.delete_pattern("kpi:*")

    # 7. Push real-time update to all connected clients
    await publish_event(event_type, {
        "id": bitrix_id,
        "name": name,
        "status": status,
        "campaign": campaign,
        "event": event,
    })

    logger.info(f"Bitrix24 lead {event_type}: id={bitrix_id}, name={name}, status={status}")
    return {"status": "ok", "event": event_type}
