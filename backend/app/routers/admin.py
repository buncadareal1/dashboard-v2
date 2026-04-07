import os
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query, Request
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from app.database import get_db
from app.dependencies import require_admin
from app.models import User, FacebookAccount, GoogleSheet, ActivityLog
from app.models.campaign import Campaign
from app.models.lead import Lead
from app.schemas.admin import CreateUserRequest, UpdateUserRequest, AddAccountRequest, AssignPermissionsRequest, RotateTokenRequest
from app.services.activity_service import log_activity
from app.config import settings

from app.security import get_password_hash
from app.services.fb_token import encrypt_token, decrypt_token, FacebookAuthError

logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api/admin", tags=["admin"])


# --- User Management ---

@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = (
        db.query(User)
        .options(joinedload(User.accessible_accounts), joinedload(User.accessible_sheets))
        .filter(User.is_active == True)
        .all()
    )
    return [
        {
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role, "avatar": u.avatar, "is_active": u.is_active,
            "accounts_count": len(u.accessible_accounts),
            "sheets_count": len(u.accessible_sheets),
            "account_ids": [a.id for a in u.accessible_accounts],
            "sheet_ids": [s.id for s in u.accessible_sheets],
        }
        for u in users
    ]


@router.post("/users")
@limiter.limit("20/minute")
def create_user(request: Request, req: CreateUserRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tên đăng nhập '{req.username}' đã tồn tại")

    user = User(username=req.username, password_hash=get_password_hash(req.password), role=req.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, current_user, f"Tạo người dùng mới: {req.username} ({req.role})", "user")
    return {"message": f"Đã tạo người dùng {req.username}", "id": user.id}


@router.put("/users/{user_id}")
def update_user(user_id: int, req: UpdateUserRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if req.username and req.username != user.username:
        existing = db.query(User).filter(User.username == req.username).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Tên '{req.username}' đã tồn tại")
        user.username = req.username
    if req.role:
        user.role = req.role

    db.commit()
    log_activity(db, current_user, f"Cập nhật người dùng: {user.username}", "user")
    return {"message": f"Đã cập nhật người dùng {user.username}"}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể xóa chính mình")

    username = user.username
    user.is_active = False
    db.commit()
    log_activity(db, current_user, f"Xóa người dùng: {username}", "user")
    return {"message": f"Đã xóa người dùng {username}"}


@router.post("/assign-permissions")
def assign_permissions(req: AssignPermissionsRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    user.accessible_accounts = []
    for acc_id in req.account_ids:
        acc = db.query(FacebookAccount).filter(FacebookAccount.id == acc_id).first()
        if acc:
            user.accessible_accounts.append(acc)

    user.accessible_sheets = []
    for sheet_id in req.sheet_ids:
        sheet = db.query(GoogleSheet).filter(GoogleSheet.id == sheet_id).first()
        if sheet:
            user.accessible_sheets.append(sheet)

    db.commit()
    log_activity(db, current_user, f"Cập nhật phân quyền: {user.username} ({len(req.account_ids)} TK, {len(req.sheet_ids)} Sheet)", "user")
    return {"message": f"Đã cập nhật phân quyền cho {user.username}"}


# --- Facebook Accounts ---

@router.post("/connect-facebook")
@limiter.limit("30/minute")
def connect_facebook(request: Request, req: AddAccountRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    encrypted = encrypt_token(req.access_token)

    existing = db.query(FacebookAccount).filter(FacebookAccount.ad_account_id == req.ad_account_id).first()
    if existing:
        existing.account_name = req.account_name
        existing.access_token = encrypted
        existing.last_sync_error = None
        db.commit()
        log_activity(db, current_user, f"Cập nhật tài khoản FB: {req.account_name}", "api")
        return {"message": "Đã cập nhật tài khoản"}

    new_acc = FacebookAccount(
        account_name=req.account_name,
        ad_account_id=req.ad_account_id,
        access_token=encrypted,
    )
    db.add(new_acc)
    db.commit()
    log_activity(db, current_user, f"Kết nối tài khoản FB mới: {req.account_name} ({req.ad_account_id})", "api")
    return {"message": "Kết nối thành công"}


@router.put("/accounts/{account_id}/token")
def rotate_fb_token(
    account_id: int,
    req: RotateTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Rotate (update) access token for a Facebook account."""
    acc = db.query(FacebookAccount).filter(FacebookAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    acc.access_token = encrypt_token(req.access_token)
    acc.last_sync_error = None
    db.commit()
    log_activity(db, current_user, f"Rotate token tài khoản FB: {acc.account_name}", "api")
    return {"message": f"Đã cập nhật token cho {acc.account_name}"}


@router.get("/accounts/{account_id}/test-token")
def test_fb_token(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Test if stored token for an account is valid by calling FB /me."""
    from app.services.fb_token import get_token_for_account
    import requests as http_requests

    acc = db.query(FacebookAccount).filter(FacebookAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    try:
        token = get_token_for_account(db, account_id)
    except FacebookAuthError as e:
        return {"ok": False, "error": str(e)}

    try:
        resp = http_requests.get(
            "https://graph.facebook.com/v21.0/me",
            params={"access_token": token, "fields": "id,name"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"ok": True, "fb_user_id": data.get("id"), "fb_user_name": data.get("name")}
        error_data = resp.json().get("error", {})
        return {"ok": False, "error": error_data.get("message", resp.text)}
    except http_requests.RequestException as e:
        return {"ok": False, "error": str(e)}


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    acc = db.query(FacebookAccount).filter(FacebookAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    name = acc.account_name
    acc.is_active = False
    db.commit()
    log_activity(db, current_user, f"Xóa tài khoản FB: {name}", "api")
    return {"message": f"Đã xóa tài khoản {name}"}


# --- Google Sheets ---

@router.post("/connect-sheet")
async def connect_google_sheet(
    sheet_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file CSV (.csv)")

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File vượt quá giới hạn {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
        )

    unique_filename = f"{uuid.uuid4().hex}.csv"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    new_sheet = GoogleSheet(sheet_name=sheet_name, sheet_id=unique_filename)
    db.add(new_sheet)
    db.commit()
    log_activity(db, current_user, f"Tải lên bộ dữ liệu: {sheet_name}", "data")
    return {"message": "Đã lưu bộ dữ liệu thành công"}


@router.delete("/sheets/{sheet_id}")
def delete_sheet(sheet_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    sheet = db.query(GoogleSheet).filter(GoogleSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ dữ liệu")

    name = sheet.sheet_name
    sheet.is_active = False
    db.commit()
    log_activity(db, current_user, f"Xóa bộ dữ liệu: {name}", "data")
    return {"message": f"Đã xóa bộ dữ liệu {name}"}


# --- Activity Log ---

@router.get("/activity-log")
def get_activity_log(
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    action_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(ActivityLog).order_by(ActivityLog.created_at.desc())

    if action_type:
        query = query.filter(ActivityLog.action_type == action_type)

    total = query.count()
    logs = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "logs": [
            {
                "id": l.id, "username": l.username, "action": l.action,
                "action_type": l.action_type, "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
    }


# --- Campaign Assignment ---

@router.post("/campaigns/{campaign_id}/assign")
def assign_campaign_to_user(
    campaign_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Assign a campaign to a user."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy campaign")

    user_id = body.get("user_id")
    if user_id is not None:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    campaign.assigned_user_id = user_id
    db.commit()

    action = f"Gán campaign '{campaign.name}' cho user {user_id}" if user_id else f"Bỏ gán campaign '{campaign.name}'"
    log_activity(db, current_user, action, "user")
    return {"message": "Đã cập nhật phân công campaign"}


@router.delete("/campaigns/{campaign_id}/assign")
def unassign_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Remove user assignment from a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy campaign")

    campaign.assigned_user_id = None
    db.commit()
    log_activity(db, current_user, f"Bỏ gán campaign '{campaign.name}'", "user")
    return {"message": "Đã bỏ phân công campaign"}


@router.post("/campaigns/bulk-assign")
def bulk_assign_campaigns(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Bulk assign campaigns to a user."""
    campaign_ids = body.get("campaign_ids", [])
    user_id = body.get("user_id")

    if not campaign_ids:
        raise HTTPException(status_code=400, detail="campaign_ids is required")
    if user_id is not None:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    updated = (
        db.query(Campaign)
        .filter(Campaign.id.in_(campaign_ids))
        .update({Campaign.assigned_user_id: user_id}, synchronize_session="fetch")
    )
    db.commit()
    log_activity(db, current_user, f"Bulk gán {updated} campaigns cho user {user_id}", "user")
    return {"message": f"Đã gán {updated} campaigns", "updated": updated}


@router.get("/users/{user_id}/campaigns")
def get_user_campaigns(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List campaigns assigned to a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    campaigns = db.query(Campaign).filter(Campaign.assigned_user_id == user_id).all()
    return {
        "user_id": user_id,
        "username": user.username,
        "campaigns": [
            {
                "id": c.id, "name": c.name, "spend": c.spend,
                "status": c.status, "date": c.date.isoformat() if c.date else None,
            }
            for c in campaigns
        ],
    }


# --- Campaign → Project Assignment ---

@router.post("/campaigns/{campaign_id}/project")
def assign_campaign_to_project(
    campaign_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Assign a campaign to a project."""
    from app.models.project import Project

    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Không tìm thấy campaign")

    project_id = body.get("project_id")
    if project_id is not None:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án")

    campaign.project_id = project_id
    db.commit()
    log_activity(db, current_user, f"Gán campaign '{campaign.name}' vào project {project_id}", "data")
    return {"message": "Đã cập nhật dự án cho campaign"}


@router.post("/campaigns/bulk-project")
def bulk_assign_campaigns_to_project(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Bulk assign campaigns to a project."""
    from app.models.project import Project

    campaign_ids = body.get("campaign_ids", [])
    project_id = body.get("project_id")

    if not campaign_ids:
        raise HTTPException(status_code=400, detail="campaign_ids is required")
    if project_id is not None:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án")

    updated = (
        db.query(Campaign)
        .filter(Campaign.id.in_(campaign_ids))
        .update({Campaign.project_id: project_id}, synchronize_session="fetch")
    )
    db.commit()
    log_activity(db, current_user, f"Bulk gán {updated} campaigns vào project {project_id}", "data")
    return {"message": f"Đã gán {updated} campaigns vào dự án", "updated": updated}


# --- Attribution ---


@router.post("/attribution/run")
def trigger_attribution(current_user: User = Depends(require_admin)):
    """Manually enqueue the lead → campaign attribution task."""
    from app.tasks.attribution import run_attribution_task

    async_result = run_attribution_task.delay()
    return {"task_id": async_result.id}


# --- Lead Assignment ---

@router.post("/leads/{lead_id}/assign")
def assign_lead_to_user(
    lead_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Assign a lead to a user."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Không tìm thấy lead")

    user_id = body.get("user_id")
    if user_id is not None:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    lead.assigned_user_id = user_id
    db.commit()
    log_activity(db, current_user, f"Gán lead '{lead.name}' cho user {user_id}", "user")
    return {"message": "Đã phân công lead"}
