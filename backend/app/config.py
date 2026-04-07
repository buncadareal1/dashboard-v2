import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./sql_app.db")
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    SECRET_KEY: str = os.environ["SECRET_KEY"]  # Required — raises KeyError if missing
    ALGORITHM: str = os.environ.get("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    GOOGLE_CLIENT_ID: str = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_ALLOWED_DOMAINS: list[str] = [
        d.strip()
        for d in os.environ.get("GOOGLE_ALLOWED_DOMAINS", "smartland.vn,smartrealtors.vn,smartproperty.vn").split(",")
        if d.strip()
    ]

    ALLOWED_ORIGINS: list[str] = [
        o.strip()
        for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    ]

    UPLOAD_DIR: str = os.environ.get("UPLOAD_DIR", "uploads")
    MAX_UPLOAD_SIZE: int = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "10")) * 1024 * 1024
    AVG_ORDER_VALUE: int = int(os.environ.get("AVG_ORDER_VALUE", "50000000"))

    ADMIN_DEFAULT_PASSWORD: str | None = os.environ.get("ADMIN_DEFAULT_PASSWORD")

    FB_AD_ACCOUNT_ID: str = os.environ.get("FB_AD_ACCOUNT_ID", "")
    FB_ACCESS_TOKEN: str = os.environ.get("FB_ACCESS_TOKEN", "")


settings = Settings()
