import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_ALLOWED_DOMAINS = [d.strip() for d in os.getenv("GOOGLE_ALLOWED_DOMAINS", "smartland.vn,smartrealtors.vn").split(",") if d.strip()]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_password)


def get_password_hash(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def verify_google_token(credential: str) -> dict:
    """Xác thực Google ID token và trả về thông tin user"""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID chưa được cấu hình")

    idinfo = id_token.verify_oauth2_token(credential, google_requests.Request(), GOOGLE_CLIENT_ID)

    email = idinfo.get("email", "")
    domain = email.split("@")[1] if "@" in email else ""

    if domain not in GOOGLE_ALLOWED_DOMAINS:
        raise ValueError(f"Email {email} không thuộc domain được phép")

    return {
        "email": email,
        "name": idinfo.get("name", email.split("@")[0]),
        "avatar": idinfo.get("picture", ""),
        "domain": domain
    }
