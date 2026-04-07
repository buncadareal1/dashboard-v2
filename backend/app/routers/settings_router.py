import logging
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings as app_settings
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import User, Setting, FacebookAccount, GoogleSheet
from app.schemas.fb_csv import FbCsvImportResponse, FbCsvPreviewResponse
from app.services import fb_csv_import_service
from app.schemas.settings import (
    SaveSettingsRequest,
    FacebookIntegrationRequest,
    FacebookIntegrationResponse,
    GoogleSheetIntegrationRequest,
    GoogleSheetIntegrationResponse,
    IntegrationsStateResponse,
    FacebookIntegrationState,
    GoogleSheetIntegrationState,
    Bitrix24State,
    Bitrix24SaveRequest,
)
from urllib.parse import urlparse
from bitrix24 import test_connection as b24_test_connection
from app.services.activity_service import log_activity
from app.services.fb_token import encrypt_token
from app.services import facebook_service

logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api", tags=["settings"])

BITRIX24_SETTING_KEY = "webhook_url"


def _mask_bitrix_url(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url)
        host = parsed.netloc or "bitrix24"
        tail = url[-8:] if len(url) >= 8 else url
        return f"{host}/.../{tail}"
    except Exception:
        return "***"


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    all_settings = db.query(Setting).all()
    result = {s.key: s.value for s in all_settings}
    return {"status": "success", "data": result}


@router.put("/settings")
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


# --- Integration wrappers (Settings UI → Tích hợp tab) ---


@router.post("/settings/integrations/facebook", response_model=FacebookIntegrationResponse)
def upsert_facebook_integration(
    req: FacebookIntegrationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> FacebookIntegrationResponse:
    """Upsert a FacebookAccount from Settings UI. Validates token via FB API."""
    # Validate token (best effort): call account info
    validated = False
    try:
        info = facebook_service.fetch_account_info(
            access_token=req.access_token, ad_account_id=req.ad_account_id
        )
        if info is None:
            raise HTTPException(
                status_code=400,
                detail="Không thể xác thực token Facebook hoặc Ad Account ID không hợp lệ",
            )
        validated = True
        derived_name = info.get("name") or req.account_name or req.ad_account_id
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Facebook validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Lỗi xác thực Facebook: {e}")

    encrypted = encrypt_token(req.access_token)
    account_name = req.account_name or derived_name

    existing = (
        db.query(FacebookAccount)
        .filter(FacebookAccount.ad_account_id == req.ad_account_id)
        .first()
    )
    if existing:
        existing.account_name = account_name
        existing.access_token = encrypted
        existing.is_active = True
        existing.last_sync_error = None
        db.commit()
        db.refresh(existing)
        log_activity(db, current_user, f"Cập nhật tích hợp FB: {account_name}", "config")
        return FacebookIntegrationResponse(
            success=True,
            account_id=existing.id,
            account_name=existing.account_name,
            validated=validated,
        )

    new_acc = FacebookAccount(
        account_name=account_name,
        ad_account_id=req.ad_account_id,
        access_token=encrypted,
        is_active=True,
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)
    log_activity(db, current_user, f"Kết nối tích hợp FB: {account_name}", "config")
    return FacebookIntegrationResponse(
        success=True,
        account_id=new_acc.id,
        account_name=new_acc.account_name,
        validated=validated,
    )


@router.post("/settings/integrations/google-sheet", response_model=GoogleSheetIntegrationResponse)
def upsert_google_sheet_integration(
    req: GoogleSheetIntegrationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> GoogleSheetIntegrationResponse:
    """Upsert a GoogleSheet row from Settings UI. Best-effort validation."""
    validated = False
    try:
        # Optional validation: try the legacy fetcher if available
        from sheets_api import fetch_public_sheet_csv  # type: ignore

        rows = fetch_public_sheet_csv(req.sheet_id)
        validated = rows is not None
    except Exception as e:
        logger.info(f"Google sheet validation skipped/failed: {e}")
        validated = False

    sheet_name = req.sheet_name or req.sheet_id
    existing = db.query(GoogleSheet).filter(GoogleSheet.sheet_id == req.sheet_id).first()
    if existing:
        existing.sheet_name = sheet_name
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        log_activity(db, current_user, f"Cập nhật tích hợp Sheet: {sheet_name}", "config")
        return GoogleSheetIntegrationResponse(
            success=True, sheet_id=existing.id, validated=validated
        )

    new_sheet = GoogleSheet(sheet_name=sheet_name, sheet_id=req.sheet_id, is_active=True)
    db.add(new_sheet)
    db.commit()
    db.refresh(new_sheet)
    log_activity(db, current_user, f"Kết nối tích hợp Sheet: {sheet_name}", "config")
    return GoogleSheetIntegrationResponse(
        success=True, sheet_id=new_sheet.id, validated=validated
    )


# --- Facebook Ads CSV import ---


async def _read_csv_upload(file: UploadFile) -> bytes:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File phải có định dạng .csv")
    data = await file.read()
    if len(data) > app_settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File vượt quá dung lượng cho phép ({app_settings.MAX_UPLOAD_SIZE // (1024*1024)} MB)",
        )
    if not data:
        raise HTTPException(status_code=400, detail="File rỗng")
    return data


@router.post(
    "/settings/integrations/facebook-csv/preview",
    response_model=FbCsvPreviewResponse,
)
async def preview_facebook_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> FbCsvPreviewResponse:
    """Parse a Facebook Ads CSV export and return a preview without writing to DB."""
    data = await _read_csv_upload(file)
    try:
        parsed = fb_csv_import_service.parse_fb_csv(data)
    except Exception as e:
        logger.exception("FB CSV parse error")
        raise HTTPException(status_code=400, detail=f"Lỗi phân tích CSV: {e}")

    if parsed.missing_required:
        # Return preview but signal missing required cols
        return FbCsvPreviewResponse(
            headers=parsed.headers,
            mapped_fields=parsed.mapped_fields,
            unmapped_headers=parsed.unmapped_headers,
            missing_required=parsed.missing_required,
            row_count=0,
            sample_rows=[],
            errors=parsed.errors,
        )

    return FbCsvPreviewResponse(
        headers=parsed.headers,
        mapped_fields=parsed.mapped_fields,
        unmapped_headers=parsed.unmapped_headers,
        missing_required=parsed.missing_required,
        row_count=parsed.row_count,
        sample_rows=[
            {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in r.items()}
            for r in parsed.rows[:10]
        ],
        errors=parsed.errors,
    )


@router.post(
    "/settings/integrations/facebook-csv/import",
    response_model=FbCsvImportResponse,
)
async def import_facebook_csv(
    file: UploadFile = File(...),
    account_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> FbCsvImportResponse:
    """Parse and import a Facebook Ads CSV export into the campaigns table."""
    data = await _read_csv_upload(file)
    try:
        parsed = fb_csv_import_service.parse_fb_csv(data)
    except Exception as e:
        logger.exception("FB CSV parse error")
        raise HTTPException(status_code=400, detail=f"Lỗi phân tích CSV: {e}")

    if parsed.missing_required:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Thiếu cột bắt buộc trong CSV",
                "missing_required": parsed.missing_required,
                "errors": parsed.errors,
            },
        )

    account_name: str | None = None
    if account_id is not None:
        acc = db.query(FacebookAccount).filter(FacebookAccount.id == account_id).first()
        if not acc:
            raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản Facebook")
        account_name = acc.account_name

    result = fb_csv_import_service.import_parsed_to_db(
        db, parsed, account_id=account_id, dry_run=False
    )

    try:
        log_activity(
            db,
            current_user,
            f"Import FB CSV: {result.created} tạo mới, {result.updated} cập nhật",
            "config",
        )
    except Exception as e:  # pragma: no cover
        logger.warning(f"Activity log failed: {e}")

    return FbCsvImportResponse(
        created=result.created,
        updated=result.updated,
        skipped=result.skipped,
        errors=result.errors,
        account_id=account_id,
        account_name=account_name,
    )


@router.get("/settings/integrations", response_model=IntegrationsStateResponse)
def get_integrations_state(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationsStateResponse:
    """Return latest active Facebook + Google Sheet integration state."""
    fb = (
        db.query(FacebookAccount)
        .filter(FacebookAccount.is_active.is_(True))
        .order_by(FacebookAccount.created_at.desc())
        .first()
    )
    sheet = (
        db.query(GoogleSheet)
        .filter(GoogleSheet.is_active.is_(True))
        .order_by(GoogleSheet.created_at.desc())
        .first()
    )

    b24_setting = (
        db.query(Setting).filter(Setting.key == BITRIX24_SETTING_KEY).first()
    )
    b24_url = b24_setting.value if b24_setting else None

    return IntegrationsStateResponse(
        facebook=FacebookIntegrationState(
            connected=fb is not None,
            ad_account_id=fb.ad_account_id if fb else None,
            account_name=fb.account_name if fb else None,
            last_synced_at=fb.last_synced_at if fb else None,
        ),
        google_sheet=GoogleSheetIntegrationState(
            connected=sheet is not None,
            sheet_id=sheet.sheet_id if sheet else None,
            sheet_name=sheet.sheet_name if sheet else None,
        ),
        bitrix24=Bitrix24State(
            connected=bool(b24_url),
            webhook_url_masked=_mask_bitrix_url(b24_url),
        ),
    )


@router.post("/settings/integrations/bitrix24")
def upsert_bitrix24_integration(
    req: Bitrix24SaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lưu webhook URL Bitrix24 và (best-effort) xác thực kết nối."""
    url = req.webhook_url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(
            status_code=400, detail="URL phải bắt đầu bằng http:// hoặc https://"
        )
    if "/rest/" not in url:
        raise HTTPException(
            status_code=400,
            detail="URL không hợp lệ: thiếu '/rest/' trong webhook Bitrix24",
        )

    validated = False
    try:
        result = b24_test_connection(url)
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Không thể xác thực Bitrix24: {result.get('error', 'lỗi không xác định')}",
            )
        validated = True
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Bitrix24 validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Lỗi xác thực Bitrix24: {e}")

    existing = db.query(Setting).filter(Setting.key == BITRIX24_SETTING_KEY).first()
    if existing:
        existing.value = url
    else:
        db.add(Setting(key=BITRIX24_SETTING_KEY, value=url))
    db.commit()

    try:
        log_activity(db, current_user, "Cập nhật webhook Bitrix24", "config")
    except Exception as e:  # pragma: no cover
        logger.warning(f"Activity log failed: {e}")

    return {
        "success": True,
        "validated": validated,
        "webhook_url_masked": _mask_bitrix_url(url),
    }


@router.post("/settings/integrations/bitrix24/test")
def test_bitrix24_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Kiểm tra kết nối với webhook Bitrix24 đang lưu."""
    setting = db.query(Setting).filter(Setting.key == BITRIX24_SETTING_KEY).first()
    if not setting or not setting.value:
        raise HTTPException(
            status_code=400, detail="Chưa cấu hình Bitrix24 Webhook URL"
        )
    try:
        result = b24_test_connection(setting.value)
    except Exception as e:
        logger.warning(f"Bitrix24 test error: {e}")
        return {"ok": False, "message": f"Lỗi: {e}", "sample_lead_count": None}

    if not result.get("success"):
        return {
            "ok": False,
            "message": result.get("error", "Kết nối thất bại"),
            "sample_lead_count": None,
        }
    return {
        "ok": True,
        "message": result.get("message", "Kết nối thành công"),
        "sample_lead_count": None,
    }
