import logging

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import User, AiRule
from app.schemas.ai_rule import CreateRuleRequest, UpdateRuleRequest
from app.services.permission_service import get_user_accounts, get_user_sheets, get_user_account_ids
from app.services.activity_service import log_activity
from app.services.cache_service import cache
from app.tasks.ai_analysis import run_ai_analysis

from sheets_api import fetch_public_sheet_csv
from ai_analyzer import analyze_campaigns

logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/ai/analyze")
@limiter.limit("5/minute")
def start_ai_analysis(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Start AI analysis as background task. Returns job_id."""
    account_ids = get_user_account_ids(db, current_user)
    task = run_ai_analysis.delay(current_user.id, account_ids)
    log_activity(db, current_user, "Khởi chạy phân tích AI (background)", "data")
    return {"status": "processing", "job_id": task.id}


@router.get("/ai/analyze/{job_id}")
def get_ai_analysis_result(job_id: str, current_user: User = Depends(get_current_user)):
    """Poll AI analysis result by job_id."""
    result = AsyncResult(job_id)

    if result.ready():
        return {"status": "completed", "data": result.get()}
    if result.failed():
        return {"status": "failed", "error": str(result.result)}

    return {"status": "processing"}


@router.get("/ai/analyze")
def get_ai_analysis_cached(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    GET: Return cached AI result or run synchronously (fallback for backward compat).
    For async, use POST /ai/analyze → poll GET /ai/analyze/{job_id}.
    """
    # Check cache
    cached = cache.get(f"ai_result:{current_user.id}")
    if cached:
        return {"status": "success", **cached}

    # Fallback: run synchronously (legacy behavior)
    sheets = get_user_sheets(db, current_user)
    all_campaigns = []
    for sheet in sheets:
        try:
            data = fetch_public_sheet_csv(sheet.sheet_id)
            all_campaigns.extend(data)
        except Exception:
            pass

    fb_accounts = get_user_accounts(db, current_user)
    for acc in fb_accounts:
        all_campaigns.append({
            "name": f"Campaign - {acc.account_name}",
            "spend": 500000, "status": "ACTIVE",
            "imp": 42500, "clicks": 850, "engagements": 2125, "purchases": 25,
        })

    result = analyze_campaigns(all_campaigns)
    cache.set(f"ai_result:{current_user.id}", result, ttl=3600)
    log_activity(db, current_user, f"Phân tích AI ({result['provider']}): {len(all_campaigns)} chiến dịch", "data")
    return {"status": "success", **result}


# --- AI Rules ---

@router.get("/rules")
def list_rules(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rules = db.query(AiRule).filter(AiRule.active == True).order_by(AiRule.created_at.desc()).all()
    return {
        "status": "success",
        "data": [
            {
                "id": r.id, "name": r.name, "metric": r.metric,
                "operator": r.operator, "threshold": r.threshold,
                "min_spend": r.min_spend, "action": r.action,
                "budget_increase": r.budget_increase, "active": r.active,
                "created_by": r.created_by,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rules
        ],
    }


@router.post("/rules")
def create_rule(req: CreateRuleRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    new_rule = AiRule(
        name=req.name, metric=req.metric, operator=req.operator,
        threshold=req.threshold, min_spend=req.min_spend,
        action=req.action, budget_increase=req.budget_increase,
        created_by=current_user.id,
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    log_activity(db, current_user, f"Tạo rule AI mới: {req.name} ({req.metric} {req.operator} {req.threshold})", "config")
    return {"status": "success", "message": "Đã tạo rule thành công", "id": new_rule.id}


@router.put("/rules/{rule_id}")
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


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rule = db.query(AiRule).filter(AiRule.id == rule_id, AiRule.active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Không tìm thấy rule")

    name = rule.name
    rule.active = False
    db.commit()
    log_activity(db, current_user, f"Xóa rule AI: {name}", "config")
    return {"status": "success", "message": f"Đã xóa rule {name}"}
