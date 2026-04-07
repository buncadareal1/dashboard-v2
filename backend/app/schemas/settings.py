from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SaveSettingsRequest(BaseModel):
    settings: dict


# --- Integration wrapper schemas ---


class FacebookIntegrationRequest(BaseModel):
    access_token: str = Field(..., min_length=10)
    ad_account_id: str = Field(..., min_length=1)
    account_name: Optional[str] = None


class FacebookIntegrationResponse(BaseModel):
    success: bool
    account_id: int
    account_name: str
    validated: bool


class GoogleSheetIntegrationRequest(BaseModel):
    sheet_id: str = Field(..., min_length=1)
    sheet_name: Optional[str] = None


class GoogleSheetIntegrationResponse(BaseModel):
    success: bool
    sheet_id: int
    validated: bool


class FacebookIntegrationState(BaseModel):
    connected: bool
    ad_account_id: Optional[str] = None
    account_name: Optional[str] = None
    last_synced_at: Optional[datetime] = None


class GoogleSheetIntegrationState(BaseModel):
    connected: bool
    sheet_id: Optional[str] = None
    sheet_name: Optional[str] = None


class Bitrix24State(BaseModel):
    connected: bool
    webhook_url_masked: Optional[str] = None
    last_test_at: Optional[datetime] = None
    last_test_ok: Optional[bool] = None


class Bitrix24SaveRequest(BaseModel):
    webhook_url: str = Field(..., min_length=10)


class IntegrationsStateResponse(BaseModel):
    facebook: FacebookIntegrationState
    google_sheet: GoogleSheetIntegrationState
    bitrix24: Bitrix24State
