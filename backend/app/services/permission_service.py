from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import User, FacebookAccount, GoogleSheet
from app.models.campaign import Campaign
from app.models.lead import Lead


def get_user_accounts(db: Session, user: User) -> list[FacebookAccount]:
    if user.role == "admin":
        return db.query(FacebookAccount).filter(FacebookAccount.is_active == True).all()
    return [a for a in user.accessible_accounts if a.is_active]


def get_user_sheets(db: Session, user: User) -> list[GoogleSheet]:
    if user.role == "admin":
        return db.query(GoogleSheet).filter(GoogleSheet.is_active == True).all()
    return [s for s in user.accessible_sheets if s.is_active]


def get_user_account_ids(db: Session, user: User) -> list[int]:
    return [a.id for a in get_user_accounts(db, user)]


def get_user_campaign_ids(db: Session, user: User) -> list[int]:
    """Get campaign IDs the user can access.

    Admin: all campaigns.
    Marketer: campaigns where assigned_user_id == user.id
              OR account_id in user's accessible accounts (backward compat for unassigned).
    """
    if user.role == "admin":
        return [c.id for c in db.query(Campaign.id).all()]

    account_ids = get_user_account_ids(db, user)

    campaigns = (
        db.query(Campaign.id)
        .filter(
            or_(
                Campaign.assigned_user_id == user.id,
                # Backward compat: unassigned campaigns visible if user has account access
                (Campaign.assigned_user_id.is_(None)) & (Campaign.account_id.in_(account_ids))
                if account_ids else False,
            )
        )
        .all()
    )
    return [c.id for c in campaigns]


def get_user_lead_ids(db: Session, user: User) -> list[int]:
    """Get lead IDs the user can access.

    Admin: all leads.
    Marketer: leads where assigned_user_id == user.id.
    """
    if user.role == "admin":
        return [l.id for l in db.query(Lead.id).all()]

    leads = (
        db.query(Lead.id)
        .filter(Lead.assigned_user_id == user.id)
        .all()
    )
    return [l.id for l in leads]


def can_user_access_campaign(db: Session, user: User, campaign_id: int) -> bool:
    """Check if user can access a specific campaign."""
    if user.role == "admin":
        return True
    return campaign_id in get_user_campaign_ids(db, user)


def can_user_access_lead(db: Session, user: User, lead_id: int) -> bool:
    """Check if user can access a specific lead."""
    if user.role == "admin":
        return True
    return lead_id in get_user_lead_ids(db, user)


def apply_campaign_filter(query, user: User, db: Session):
    """Apply user-scoped filter to a Campaign query. Returns filtered query."""
    if user.role == "admin":
        return query

    account_ids = get_user_account_ids(db, user)
    conditions = [Campaign.assigned_user_id == user.id]
    if account_ids:
        conditions.append(
            (Campaign.assigned_user_id.is_(None)) & (Campaign.account_id.in_(account_ids))
        )

    return query.filter(or_(*conditions))


def apply_lead_filter(query, user: User, db: Session):
    """Apply user-scoped filter to a Lead query. Returns filtered query."""
    if user.role == "admin":
        return query
    return query.filter(Lead.assigned_user_id == user.id)
