import os
import uuid
import shutil
import secrets
import logging
from contextlib import asynccontextmanager

import uvicorn
import jwt
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional, List
from dotenv import load_dotenv

from database import engine, SessionLocal, get_db, Base
from models import User, FacebookAccount, GoogleSheet, ActivityLog, AiRule, Setting, Lead
from security import (
    verify_password, get_password_hash, create_access_token,
    decode_access_token, verify_google_token,
    SECRET_KEY, ALGORITHM, GOOGLE_CLIENT_ID
)
from sheets_api import fetch_public_sheet_csv

load_dotenv()

# === LOGGING ===
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smartland")

# === DATABASE INIT ===
Base.metadata.create_all(bind=engine)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
AVG_ORDER_VALUE = int(os.getenv("AVG_ORDER_VALUE", 50000000))
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_MB", 10)) * 1024 * 1024
os.makedirs(UPLOAD_DIR, exist_ok=True)


def create_initial_admin(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        password = os.getenv("ADMIN_DEFAULT_PASSWORD") or secrets.token_urlsafe(12)
        hashed_pw = get_password_hash(password)
        new_admin = User(username="admin", password_hash=hashed_pw, role="admin")
        db.add(new_admin)
        db.commit()
        logger.info(f"Admin user created. Password: {password}")
        logger.info("⚠️  Hãy đổi mật khẩu admin ngay sau khi đăng nhập!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    with SessionLocal() as db:
        create_initial_admin(db)
    yield


app = FastAPI(title="SmartLand AI Backend", version="1.0.0", lifespan=lifespan)

# === CORS ===
allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === RATE LIMITING ===
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# === AUTH DEPENDENCY ===
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token không hợp lệ",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn")
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên mới có quyền truy cập")
    return current_user


def log_activity(db: Session, user: User, action: str, action_type: str, ip: str = None):
    log = ActivityLog(user_id=user.id, username=user.username, action=action, action_type=action_type, ip_address=ip)
    db.add(log)
    db.commit()


# ==============================================
# SCHEMAS
# ==============================================

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)

class GoogleAuthRequest(BaseModel):
    credential: str

class CreateUserRequest(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=200)
    role: str = Field(default="marketer", pattern="^(admin|marketer)$")

class UpdateUserRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, pattern="^(admin|marketer)$")

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=200)

class AddAccountRequest(BaseModel):
    account_name: str = Field(min_length=1, max_length=200)
    ad_account_id: str = Field(min_length=1, max_length=100)
    access_token: str = Field(min_length=1)

class AssignPermissionsRequest(BaseModel):
    user_id: int
    account_ids: List[int] = []
    sheet_ids: List[int] = []


# ==============================================
# HEALTH CHECK
# ==============================================

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "SmartLand AI Backend"}


# ==============================================
# AUTHENTICATION
# ==============================================

@app.post("/api/login")
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Sai tên đăng nhập hoặc mật khẩu")

    token = create_access_token(data={"sub": user.username, "role": user.role})
    log_activity(db, user, "Đăng nhập hệ thống", "auth", request.client.host)
    logger.info(f"User '{user.username}' logged in from {request.client.host}")

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "email": user.email,
        "avatar": user.avatar,
        "role": user.role
    }


@app.post("/api/auth/google")
@limiter.limit("10/minute")
def google_auth(request: Request, req: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        google_user = verify_google_token(req.credential)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    email = google_user["email"]
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Tạo user mới từ Google OAuth
        username = email.split("@")[0]
        # Đảm bảo username unique
        base_username = username
        counter = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=email,
            avatar=google_user.get("avatar"),
            role="marketer",
            password_hash=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"New Google user created: {email}")

    token = create_access_token(data={"sub": user.username, "role": user.role})
    log_activity(db, user, f"Đăng nhập qua Google ({email})", "auth", request.client.host)

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "email": user.email,
        "avatar": user.avatar,
        "role": user.role
    }


@app.put("/api/change-password")
def change_password(req: ChangePasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.password_hash:
        raise HTTPException(status_code=400, detail="Tài khoản Google không sử dụng mật khẩu")
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")

    current_user.password_hash = get_password_hash(req.new_password)
    db.commit()
    log_activity(db, current_user, "Đổi mật khẩu", "config")
    return {"message": "Đổi mật khẩu thành công"}


# ==============================================
# DASHBOARD & DATA
# ==============================================

@app.get("/api/dashboard-stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Tính toán từ dữ liệu thật trong DB
    if current_user.role == "admin":
        sheets = db.query(GoogleSheet).all()
    else:
        sheets = current_user.accessible_sheets

    total_spend = 0
    total_purchases = 0
    for sheet in sheets:
        try:
            data = fetch_public_sheet_csv(sheet.sheet_id)
            for row in data:
                total_spend += row.get("spend", 0)
                total_purchases += row.get("purchases", 0)
        except Exception:
            pass

    roas = f"{(total_purchases * AVG_ORDER_VALUE / total_spend):.1f}x" if total_spend > 0 else "0x"

    return {
        "status": "success",
        "data": {
            "total_spend": f"{total_spend:,.0f}đ",
            "total_revenue": f"{total_purchases * AVG_ORDER_VALUE:,.0f}đ",
            "roas": roas,
            "total_purchases": total_purchases
        }
    }


@app.get("/api/my-accounts")
def get_my_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        accounts = db.query(FacebookAccount).filter(FacebookAccount.is_active == True).all()
    else:
        accounts = [a for a in current_user.accessible_accounts if a.is_active]

    return {
        "user": current_user.username,
        "role": current_user.role,
        "accounts": [{"id": a.id, "account_name": a.account_name, "ad_account_id": a.ad_account_id} for a in accounts]
    }


@app.get("/api/facebook-data")
def get_fb_ads_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        allowed_accounts = db.query(FacebookAccount).filter(FacebookAccount.is_active == True).all()
    else:
        allowed_accounts = [a for a in current_user.accessible_accounts if a.is_active]

    allowed_ids = [acc.ad_account_id for acc in allowed_accounts]

    if not allowed_ids:
        return {"status": "empty", "data": [], "message": "Chưa được cấp quyền xem tài khoản nào"}

    # TODO: Gọi Facebook Marketing API thật ở đây
    # Hiện tại trả mock data dựa trên accounts đã kết nối
    data = []
    for acc in allowed_accounts:
        data.append({
            "name": f"Campaign - {acc.account_name}",
            "spend": 500000,
            "status": "ACTIVE",
            "imp": 42500,
            "clicks": 850,
            "engagements": 2125,
            "purchases": 25
        })

    return {"status": "success", "allowed_ids": allowed_ids, "data": data}


@app.get("/api/my-sheets")
def get_my_sheets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        sheets = db.query(GoogleSheet).filter(GoogleSheet.is_active == True).all()
    else:
        sheets = [s for s in current_user.accessible_sheets if s.is_active]

    return {
        "user": current_user.username,
        "role": current_user.role,
        "sheets": [{"id": s.id, "sheet_name": s.sheet_name, "sheet_id": s.sheet_id} for s in sheets]
    }


@app.get("/api/sheet-data")
def get_sheet_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        allowed_sheets = db.query(GoogleSheet).filter(GoogleSheet.is_active == True).all()
    else:
        allowed_sheets = [s for s in current_user.accessible_sheets if s.is_active]

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


# ==============================================
# ADMIN - USER MANAGEMENT
# ==============================================

@app.get("/api/admin/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "avatar": u.avatar,
            "is_active": u.is_active,
            "accounts_count": len(u.accessible_accounts),
            "sheets_count": len(u.accessible_sheets),
            "account_ids": [a.id for a in u.accessible_accounts],
            "sheet_ids": [s.id for s in u.accessible_sheets],
        }
        for u in users
    ]


@app.post("/api/admin/users")
def create_user(req: CreateUserRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tên đăng nhập '{req.username}' đã tồn tại")

    user = User(
        username=req.username,
        password_hash=get_password_hash(req.password),
        role=req.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, current_user, f"Tạo người dùng mới: {req.username} ({req.role})", "user")
    return {"message": f"Đã tạo người dùng {req.username}", "id": user.id}


@app.put("/api/admin/users/{user_id}")
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


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Không thể xóa chính mình")

    username = user.username
    user.is_active = False  # Soft delete
    db.commit()
    log_activity(db, current_user, f"Xóa người dùng: {username}", "user")
    return {"message": f"Đã xóa người dùng {username}"}


@app.post("/api/admin/assign-permissions")
def assign_permissions(req: AssignPermissionsRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    # Reset và gán lại accounts
    user.accessible_accounts = []
    for acc_id in req.account_ids:
        acc = db.query(FacebookAccount).filter(FacebookAccount.id == acc_id).first()
        if acc:
            user.accessible_accounts.append(acc)

    # Reset và gán lại sheets
    user.accessible_sheets = []
    for sheet_id in req.sheet_ids:
        sheet = db.query(GoogleSheet).filter(GoogleSheet.id == sheet_id).first()
        if sheet:
            user.accessible_sheets.append(sheet)

    db.commit()
    log_activity(db, current_user, f"Cập nhật phân quyền: {user.username} ({len(req.account_ids)} TK, {len(req.sheet_ids)} Sheet)", "user")
    return {"message": f"Đã cập nhật phân quyền cho {user.username}"}


# ==============================================
# ADMIN - FACEBOOK ACCOUNTS
# ==============================================

@app.post("/api/admin/connect-facebook")
def connect_facebook(req: AddAccountRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    existing = db.query(FacebookAccount).filter(FacebookAccount.ad_account_id == req.ad_account_id).first()
    if existing:
        existing.account_name = req.account_name
        db.commit()
        log_activity(db, current_user, f"Cập nhật tài khoản FB: {req.account_name}", "api")
        return {"message": "Đã cập nhật tài khoản"}

    new_acc = FacebookAccount(account_name=req.account_name, ad_account_id=req.ad_account_id)
    db.add(new_acc)
    db.commit()
    log_activity(db, current_user, f"Kết nối tài khoản FB mới: {req.account_name} ({req.ad_account_id})", "api")
    return {"message": "Kết nối thành công"}


@app.delete("/api/admin/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    acc = db.query(FacebookAccount).filter(FacebookAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    name = acc.account_name
    acc.is_active = False  # Soft delete
    db.commit()
    log_activity(db, current_user, f"Xóa tài khoản FB: {name}", "api")
    return {"message": f"Đã xóa tài khoản {name}"}


# ==============================================
# ADMIN - GOOGLE SHEETS
# ==============================================

@app.post("/api/admin/connect-sheet")
async def connect_google_sheet(
    sheet_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file CSV (.csv)")

    # Kiểm tra kích thước
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail=f"File vượt quá giới hạn {MAX_UPLOAD_SIZE // (1024*1024)}MB")

    unique_filename = f"{uuid.uuid4().hex}.csv"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    new_sheet = GoogleSheet(sheet_name=sheet_name, sheet_id=unique_filename)
    db.add(new_sheet)
    db.commit()
    log_activity(db, current_user, f"Tải lên bộ dữ liệu: {sheet_name}", "data")
    return {"message": "Đã lưu bộ dữ liệu thành công"}


@app.delete("/api/admin/sheets/{sheet_id}")
def delete_sheet(sheet_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    sheet = db.query(GoogleSheet).filter(GoogleSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ dữ liệu")

    name = sheet.sheet_name
    sheet.is_active = False  # Soft delete
    db.commit()
    log_activity(db, current_user, f"Xóa bộ dữ liệu: {name}", "data")
    return {"message": f"Đã xóa bộ dữ liệu {name}"}


# ==============================================
# ACTIVITY LOG
# ==============================================

@app.get("/api/admin/activity-log")
def get_activity_log(
    limit: int = 50,
    offset: int = 0,
    action_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
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
                "id": l.id,
                "username": l.username,
                "action": l.action,
                "action_type": l.action_type,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in logs
        ]
    }


# ==============================================
# SCHEMAS - SETTINGS, LEADS, AI RULES
# ==============================================

class CreateLeadRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field("MỚI", max_length=50)

class UpdateLeadRequest(BaseModel):
    status: Optional[str] = Field(None, max_length=50)

class CreateRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    metric: str = Field(min_length=1, max_length=20)
    operator: str = Field(min_length=1, max_length=5)
    threshold: str = Field(min_length=1, max_length=50)
    min_spend: int = 50
    action: str = Field(min_length=1, max_length=20)
    budget_increase: int = 20

class UpdateRuleRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    metric: Optional[str] = Field(None, max_length=20)
    operator: Optional[str] = Field(None, max_length=5)
    threshold: Optional[str] = Field(None, max_length=50)
    min_spend: Optional[int] = None
    action: Optional[str] = Field(None, max_length=20)
    budget_increase: Optional[int] = None
    active: Optional[bool] = None

class SaveSettingsRequest(BaseModel):
    settings: dict


# ==============================================
# SETTINGS
# ==============================================

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    all_settings = db.query(Setting).all()
    result = {}
    for s in all_settings:
        result[s.key] = s.value
    return {"status": "success", "data": result}


@app.put("/api/settings")
def save_settings(req: SaveSettingsRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    for key, value in req.settings.items():
        existing = db.query(Setting).filter(Setting.key == key).first()
        if existing:
            existing.value = str(value) if value is not None else None
        else:
            new_setting = Setting(key=key, value=str(value) if value is not None else None)
            db.add(new_setting)
    db.commit()
    log_activity(db, current_user, f"Cập nhật cài đặt: {', '.join(req.settings.keys())}", "config")
    return {"status": "success", "message": "Đã lưu cài đặt thành công"}


# ==============================================
# LEADS
# ==============================================

@app.get("/api/leads")
def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Lead).order_by(Lead.created_at.desc())

    if status:
        query = query.filter(Lead.status == status)
    if source:
        query = query.filter(Lead.source == source)
    if search:
        query = query.filter(
            (Lead.name.ilike(f"%{search}%")) | (Lead.phone.ilike(f"%{search}%"))
        )

    total = query.count()
    leads = query.offset(offset).limit(limit).all()

    return {
        "status": "success",
        "total": total,
        "data": [
            {
                "id": l.id,
                "name": l.name,
                "phone": l.phone,
                "source": l.source,
                "status": l.status,
                "created_at": l.created_at.isoformat() if l.created_at else None
            }
            for l in leads
        ]
    }


@app.post("/api/leads")
def create_lead(req: CreateLeadRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_lead = Lead(
        name=req.name,
        phone=req.phone,
        source=req.source,
        status=req.status or "MỚI"
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    log_activity(db, current_user, f"Tạo lead mới: {req.name}", "data")
    return {"status": "success", "message": "Đã tạo lead thành công", "id": new_lead.id}


@app.get("/api/leads/{lead_id}")
def get_lead(lead_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Không tìm thấy lead")

    return {
        "status": "success",
        "data": {
            "id": lead.id,
            "name": lead.name,
            "phone": lead.phone,
            "source": lead.source,
            "status": lead.status,
            "created_at": lead.created_at.isoformat() if lead.created_at else None
        }
    }


@app.put("/api/leads/{lead_id}")
def update_lead(lead_id: int, req: UpdateLeadRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Không tìm thấy lead")

    if req.status is not None:
        lead.status = req.status

    db.commit()
    log_activity(db, current_user, f"Cập nhật lead #{lead_id}: trạng thái → {req.status}", "data")
    return {"status": "success", "message": "Đã cập nhật lead thành công"}


# ==============================================
# AI RULES (Admin only)
# ==============================================

@app.get("/api/rules")
def list_rules(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rules = db.query(AiRule).filter(AiRule.active == True).order_by(AiRule.created_at.desc()).all()
    return {
        "status": "success",
        "data": [
            {
                "id": r.id,
                "name": r.name,
                "metric": r.metric,
                "operator": r.operator,
                "threshold": r.threshold,
                "min_spend": r.min_spend,
                "action": r.action,
                "budget_increase": r.budget_increase,
                "active": r.active,
                "created_by": r.created_by,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in rules
        ]
    }


@app.post("/api/rules")
def create_rule(req: CreateRuleRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    new_rule = AiRule(
        name=req.name,
        metric=req.metric,
        operator=req.operator,
        threshold=req.threshold,
        min_spend=req.min_spend,
        action=req.action,
        budget_increase=req.budget_increase,
        created_by=current_user.id
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    log_activity(db, current_user, f"Tạo rule AI mới: {req.name} ({req.metric} {req.operator} {req.threshold})", "config")
    return {"status": "success", "message": "Đã tạo rule thành công", "id": new_rule.id}


@app.put("/api/rules/{rule_id}")
def update_rule(rule_id: int, req: UpdateRuleRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rule = db.query(AiRule).filter(AiRule.id == rule_id, AiRule.active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Không tìm thấy rule")

    if req.name is not None:
        rule.name = req.name
    if req.metric is not None:
        rule.metric = req.metric
    if req.operator is not None:
        rule.operator = req.operator
    if req.threshold is not None:
        rule.threshold = req.threshold
    if req.min_spend is not None:
        rule.min_spend = req.min_spend
    if req.action is not None:
        rule.action = req.action
    if req.budget_increase is not None:
        rule.budget_increase = req.budget_increase
    if req.active is not None:
        rule.active = req.active

    db.commit()
    log_activity(db, current_user, f"Cập nhật rule AI: {rule.name}", "config")
    return {"status": "success", "message": "Đã cập nhật rule thành công"}


@app.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rule = db.query(AiRule).filter(AiRule.id == rule_id, AiRule.active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Không tìm thấy rule")

    name = rule.name
    rule.active = False  # Soft delete
    db.commit()
    log_activity(db, current_user, f"Xóa rule AI: {name}", "config")
    return {"status": "success", "message": f"Đã xóa rule {name}"}


# ==============================================
# AI PHÂN TÍCH
# ==============================================

from ai_analyzer import analyze_campaigns

@app.get("/api/ai/analyze")
def ai_analyze_campaigns(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """AI phân tích toàn bộ chiến dịch và đưa gợi ý."""
    # Lấy data campaigns giống dashboard
    if current_user.role == "admin":
        sheets = db.query(GoogleSheet).filter(GoogleSheet.is_active == True).all()
    else:
        sheets = [s for s in current_user.accessible_sheets if s.is_active]

    all_campaigns = []
    for sheet in sheets:
        try:
            data = fetch_public_sheet_csv(sheet.sheet_id)
            all_campaigns.extend(data)
        except Exception:
            pass

    # Thêm FB data
    if current_user.role == "admin":
        fb_accounts = db.query(FacebookAccount).filter(FacebookAccount.is_active == True).all()
    else:
        fb_accounts = [a for a in current_user.accessible_accounts if a.is_active]

    for acc in fb_accounts:
        all_campaigns.append({
            "name": f"Campaign - {acc.account_name}",
            "spend": 500000, "status": "ACTIVE",
            "imp": 42500, "clicks": 850, "engagements": 2125, "purchases": 25
        })

    result = analyze_campaigns(all_campaigns)
    log_activity(db, current_user, f"Phân tích AI ({result['provider']}): {len(all_campaigns)} chiến dịch", "data")
    return {"status": "success", **result}


# ==============================================
# ĐỒNG BỘ FACEBOOK ADS + BITRIX24
# ==============================================

def _get_all_campaign_data(db: Session, current_user: User) -> list:
    """Lấy toàn bộ campaign data từ CSV + FB accounts."""
    all_campaigns = []
    if current_user.role == "admin":
        sheets = db.query(GoogleSheet).filter(GoogleSheet.is_active == True).all()
        fb_accounts = db.query(FacebookAccount).filter(FacebookAccount.is_active == True).all()
    else:
        sheets = [s for s in current_user.accessible_sheets if s.is_active]
        fb_accounts = [a for a in current_user.accessible_accounts if a.is_active]

    for sheet in sheets:
        try:
            data = fetch_public_sheet_csv(sheet.sheet_id)
            for row in data:
                row["source_sheet"] = sheet.sheet_name
            all_campaigns.extend(data)
        except Exception:
            pass

    for acc in fb_accounts:
        all_campaigns.append({
            "name": f"Campaign - {acc.account_name}",
            "spend": 500000, "status": "ACTIVE",
            "imp": 42500, "clicks": 850, "engagements": 2125, "purchases": 25
        })
    return all_campaigns


def _normalize_name(name: str) -> str:
    """Chuẩn hóa tên campaign để so sánh."""
    if not name:
        return ""
    return name.lower().strip().replace("  ", " ")


@app.get("/api/campaigns/merged")
def get_merged_campaigns(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Gộp dữ liệu Facebook Ads (spend, impressions, clicks) với Bitrix24 (leads, trạng thái).
    Match theo tên campaign / dự án.
    """
    # 1. Lấy Facebook/CSV data
    fb_campaigns = _get_all_campaign_data(db, current_user)

    # 2. Lấy Bitrix24 leads
    b24_leads = []
    try:
        webhook_setting = db.query(Setting).filter(Setting.key == "webhook_url").first()
        if webhook_setting and webhook_setting.value:
            b24_result = b24_fetch_leads(webhook_setting.value)
            b24_leads = b24_result.get("leads", [])
    except Exception as e:
        logger.warning(f"Không thể kéo Bitrix24: {e}")

    # 3. Gom leads theo campaign
    from collections import defaultdict
    lead_by_campaign = defaultdict(lambda: {"total": 0, "moi": 0, "dang_tu_van": 0, "chot_don": 0, "that_bai": 0, "leads": []})

    for lead in b24_leads:
        camp = lead.get("campaign", "Không xác định")
        lbc = lead_by_campaign[camp]
        lbc["total"] += 1
        lbc["leads"].append(lead)
        s = lead.get("status", "")
        if s == "MỚI": lbc["moi"] += 1
        elif s == "ĐANG TƯ VẤN": lbc["dang_tu_van"] += 1
        elif s == "CHỐT ĐƠN": lbc["chot_don"] += 1
        elif s == "THẤT BẠI": lbc["that_bai"] += 1

    # 4. Merge: match FB campaign name với Bitrix24 campaign
    merged = []
    matched_b24_keys = set()

    for c in fb_campaigns:
        fb_name = c.get("name", "")
        fb_norm = _normalize_name(fb_name)
        spend = c.get("spend", 0)
        imp = c.get("imp", 0)
        clicks = c.get("clicks", 0)
        eng = c.get("engagements", 0)

        # Tìm match trong Bitrix24
        best_match = None
        best_score = 0
        for b24_key in lead_by_campaign:
            b24_norm = _normalize_name(b24_key)
            # Match: chứa nhau hoặc giống nhau
            if not b24_norm or not fb_norm:
                continue
            if b24_norm in fb_norm or fb_norm in b24_norm:
                score = len(b24_norm)
                if score > best_score:
                    best_score = score
                    best_match = b24_key
            # Match từng từ
            else:
                fb_words = set(fb_norm.split())
                b24_words = set(b24_norm.split())
                common = fb_words & b24_words
                if len(common) >= 2 or (len(common) == 1 and len(list(common)[0]) > 4):
                    score = len(common)
                    if score > best_score:
                        best_score = score
                        best_match = b24_key

        lead_data = lead_by_campaign[best_match] if best_match else {"total": 0, "moi": 0, "dang_tu_van": 0, "chot_don": 0, "that_bai": 0}
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
            # Facebook data
            "spend": spend,
            "impressions": imp,
            "clicks": clicks,
            "engagements": eng,
            "ctr": round(ctr, 2),
            # Bitrix24 data
            "total_leads": total_leads,
            "leads_moi": lead_data["moi"],
            "leads_tu_van": lead_data["dang_tu_van"],
            "leads_chot": chot_don,
            "leads_fail": lead_data["that_bai"],
            # Chỉ số tổng hợp
            "cpl_real": round(cpl_real, 2),
            "cost_per_order": round(cost_per_order, 2),
            "close_rate": round(close_rate, 1),
        })

    # 5. Thêm campaigns Bitrix24 chưa match (leads không có FB data)
    for b24_key in lead_by_campaign:
        if b24_key not in matched_b24_keys:
            ld = lead_by_campaign[b24_key]
            close_rate = (ld["chot_don"] / ld["total"] * 100) if ld["total"] > 0 else 0
            merged.append({
                "name": b24_key,
                "matched_b24": b24_key,
                "spend": 0, "impressions": 0, "clicks": 0, "engagements": 0, "ctr": 0,
                "total_leads": ld["total"],
                "leads_moi": ld["moi"],
                "leads_tu_van": ld["dang_tu_van"],
                "leads_chot": ld["chot_don"],
                "leads_fail": ld["that_bai"],
                "cpl_real": 0, "cost_per_order": 0,
                "close_rate": round(close_rate, 1),
            })

    # Tổng
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
            "spend": total_spend,
            "leads": total_leads,
            "orders": total_orders,
            "avg_cpl": round(avg_cpl, 2),
            "avg_close_rate": round(avg_close_rate, 1),
        },
        "fb_count": len(fb_campaigns),
        "b24_count": len(b24_leads),
    }


# ==============================================
# BITRIX24 CRM
# ==============================================

from bitrix24 import fetch_facebook_leads as b24_fetch_leads, test_connection as b24_test

def _get_webhook_url(db: Session) -> str:
    setting = db.query(Setting).filter(Setting.key == "webhook_url").first()
    if not setting or not setting.value:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Bitrix24 Webhook URL. Vào Cài đặt để thiết lập.")
    return setting.value


@app.get("/api/bitrix24/leads")
def get_bitrix24_leads(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Kéo leads Facebook Ads từ Bitrix24 + thống kê theo campaign."""
    webhook_url = _get_webhook_url(db)
    try:
        result = b24_fetch_leads(webhook_url)
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/bitrix24/test")
def test_bitrix24_connection(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    webhook_url = _get_webhook_url(db)
    result = b24_test(webhook_url)
    if result["success"]:
        log_activity(db, current_user, "Kiểm tra kết nối Bitrix24 thành công", "api")
    return result


# ==============================================
# RUN SERVER
# ==============================================

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
