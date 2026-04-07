import os
import json
import secrets
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, SessionLocal
from app.models import Base, User
from app.routers import auth, dashboard, campaigns, leads, admin, ai, settings_router, webhooks, ws, analytics, projects

from app.security import get_password_hash


def _setup_logging():
    """Configure structured JSON logging for production, readable for dev."""
    log_format = os.environ.get("LOG_FORMAT", "text")

    if log_format == "json":

        class JsonFormatter(logging.Formatter):
            def format(self, record):
                return json.dumps({
                    "ts": self.formatTime(record),
                    "level": record.levelname,
                    "logger": record.name,
                    "msg": record.getMessage(),
                }, default=str)

        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        logging.root.handlers = [handler]
        logging.root.setLevel(logging.INFO)
    else:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )


_setup_logging()
logger = logging.getLogger("smartland")


def create_initial_admin(db):
    existing = db.query(User).filter(User.username == "admin").first()
    if not existing:
        password = settings.ADMIN_DEFAULT_PASSWORD or secrets.token_urlsafe(12)
        new_admin = User(
            username="admin",
            password_hash=get_password_hash(password),
            role="admin",
        )
        db.add(new_admin)
        db.commit()
        logger.info("Admin user created.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with SessionLocal() as db:
        create_initial_admin(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="SmartLand AI Backend", version="2.0.0", lifespan=lifespan)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Rate limiting
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Register routers
    app.include_router(auth.router)
    app.include_router(dashboard.router)
    app.include_router(campaigns.router)
    app.include_router(leads.router)
    app.include_router(admin.router)
    app.include_router(ai.router)
    app.include_router(settings_router.router)
    app.include_router(webhooks.router)
    app.include_router(ws.router)
    app.include_router(analytics.router)
    app.include_router(projects.router)

    return app


app = create_app()
