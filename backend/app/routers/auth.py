import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas.auth import LoginRequest, GoogleAuthRequest, ChangePasswordRequest
from app.services.activity_service import log_activity
from app.config import settings

from app.security import verify_password, get_password_hash, create_access_token, verify_google_token

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/login")
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
        "role": user.role,
    }


@router.post("/auth/google")
@limiter.limit("10/minute")
def google_auth(request: Request, req: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        google_user = verify_google_token(req.credential)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    email = google_user["email"]
    user = db.query(User).filter(User.email == email).first()

    if not user:
        username = email.split("@")[0]
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
            password_hash=None,
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
        "role": user.role,
    }


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.password_hash:
        raise HTTPException(status_code=400, detail="Tài khoản Google không sử dụng mật khẩu")
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")

    current_user.password_hash = get_password_hash(req.new_password)
    db.commit()
    log_activity(db, current_user, "Đổi mật khẩu", "config")
    return {"message": "Đổi mật khẩu thành công"}
