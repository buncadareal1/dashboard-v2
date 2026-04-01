from sqlalchemy import Column, Integer, String, ForeignKey, Table, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

# === BẢNG TRUNG GIAN MANY-TO-MANY ===

user_account_access = Table(
    'user_account_access',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete="CASCADE"), primary_key=True),
    Column('account_id', Integer, ForeignKey('facebook_accounts.id', ondelete="CASCADE"), primary_key=True)
)

user_sheet_access = Table(
    'user_sheet_access',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete="CASCADE"), primary_key=True),
    Column('sheet_id', Integer, ForeignKey('google_sheets.id', ondelete="CASCADE"), primary_key=True)
)

# === BẢNG CHÍNH ===

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)  # Nullable cho Google OAuth users
    role = Column(String(20), default="marketer", nullable=False)
    avatar = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    accessible_accounts = relationship("FacebookAccount", secondary=user_account_access, back_populates="authorized_users")
    accessible_sheets = relationship("GoogleSheet", secondary=user_sheet_access, back_populates="authorized_users")


class FacebookAccount(Base):
    __tablename__ = "facebook_accounts"
    id = Column(Integer, primary_key=True, index=True)
    account_name = Column(String(200), nullable=False)
    ad_account_id = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    authorized_users = relationship("User", secondary=user_account_access, back_populates="accessible_accounts")


class GoogleSheet(Base):
    __tablename__ = "google_sheets"
    id = Column(Integer, primary_key=True, index=True)
    sheet_name = Column(String(200), nullable=False)
    sheet_id = Column(String(255), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    authorized_users = relationship("User", secondary=user_sheet_access, back_populates="accessible_sheets")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    username = Column(String(100), nullable=False)
    action = Column(String(500), nullable=False)
    action_type = Column(String(50), nullable=False)  # auth, user, api, data, config
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AiRule(Base):
    __tablename__ = "ai_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    metric = Column(String(20), nullable=False)  # CPL, ROAS, CTR, CPC
    operator = Column(String(5), nullable=False)  # >, <, >=, <=
    threshold = Column(String(50), nullable=False)
    min_spend = Column(Integer, default=50)
    action = Column(String(20), nullable=False)  # PAUSE, SCALE
    budget_increase = Column(Integer, default=20)
    active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(2000), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(50), nullable=True)
    source = Column(String(200), nullable=True)
    status = Column(String(50), default="MỚI")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
