from sqlalchemy.orm import Session

from app.models import User, ActivityLog


def log_activity(
    db: Session,
    user: User,
    action: str,
    action_type: str,
    ip: str | None = None,
) -> None:
    log = ActivityLog(
        user_id=user.id,
        username=user.username,
        action=action,
        action_type=action_type,
        ip_address=ip,
    )
    db.add(log)
    db.commit()
