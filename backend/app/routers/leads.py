import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Lead, Setting
from app.schemas.lead import CreateLeadRequest, UpdateLeadRequest
from app.services.activity_service import log_activity
from app.services.permission_service import apply_lead_filter, can_user_access_lead

from bitrix24 import fetch_facebook_leads as b24_fetch_leads, test_connection as b24_test

logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api", tags=["leads"])


def _get_webhook_url(db: Session) -> str:
    setting = db.query(Setting).filter(Setting.key == "webhook_url").first()
    if not setting or not setting.value:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Bitrix24 Webhook URL. Vào Cài đặt để thiết lập.")
    return setting.value


@router.get("/leads")
def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.schemas.pagination import encode_cursor, decode_cursor

    query = db.query(Lead).order_by(Lead.id.desc())
    query = apply_lead_filter(query, current_user, db)

    if cursor:
        cursor_id = decode_cursor(cursor)
        query = query.filter(Lead.id < cursor_id)
    elif offset > 0:
        query = query.offset(offset)

    if status:
        query = query.filter(Lead.status == status)
    if source:
        query = query.filter(Lead.source == source)
    if search:
        query = query.filter(
            (Lead.name.ilike(f"%{search}%")) | (Lead.phone.ilike(f"%{search}%"))
        )

    total = query.count()
    items = query.limit(limit + 1).all()
    has_more = len(items) > limit
    items = items[:limit]

    return {
        "status": "success",
        "total": total,
        "has_more": has_more,
        "next_cursor": encode_cursor(items[-1].id) if has_more and items else None,
        "data": [
            {
                "id": l.id, "name": l.name, "phone": l.phone,
                "source": l.source, "status": l.status,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in items
        ],
    }


@router.post("/leads")
def create_lead(
    req: CreateLeadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_lead = Lead(
        name=req.name, phone=req.phone,
        source=req.source, status=req.status or "MỚI",
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    log_activity(db, current_user, f"Tạo lead mới: {req.name}", "data")
    return {"status": "success", "message": "Đã tạo lead thành công", "id": new_lead.id}


@router.get("/leads/{lead_id}")
def get_lead(lead_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Không tìm thấy lead")
    if not can_user_access_lead(db, current_user, lead_id):
        raise HTTPException(status_code=403, detail="Không có quyền truy cập lead này")
    return {
        "status": "success",
        "data": {
            "id": lead.id, "name": lead.name, "phone": lead.phone,
            "source": lead.source, "status": lead.status,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        },
    }


@router.put("/leads/{lead_id}")
def update_lead(
    lead_id: int,
    req: UpdateLeadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Không tìm thấy lead")
    if not can_user_access_lead(db, current_user, lead_id):
        raise HTTPException(status_code=403, detail="Không có quyền cập nhật lead này")

    if req.status is not None:
        lead.status = req.status
    db.commit()
    log_activity(db, current_user, f"Cập nhật lead #{lead_id}: trạng thái → {req.status}", "data")
    return {"status": "success", "message": "Đã cập nhật lead thành công"}


# --- Bitrix24 CRM ---

@router.get("/bitrix24/leads")
def get_bitrix24_leads(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    webhook_url = _get_webhook_url(db)
    try:
        result = b24_fetch_leads(webhook_url)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bitrix24/test")
def test_bitrix24_connection(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    webhook_url = _get_webhook_url(db)
    result = b24_test(webhook_url)
    if result["success"]:
        log_activity(db, current_user, "Kiểm tra kết nối Bitrix24 thành công", "api")
    return result
