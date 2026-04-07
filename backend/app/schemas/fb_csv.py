"""Pydantic schemas for Facebook Ads CSV import endpoints."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FbCsvPreviewResponse(BaseModel):
    headers: list[str] = Field(default_factory=list)
    mapped_fields: dict[str, str] = Field(default_factory=dict)
    unmapped_headers: list[str] = Field(default_factory=list)
    missing_required: list[str] = Field(default_factory=list)
    row_count: int = 0
    sample_rows: list[dict[str, Any]] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class FbCsvImportResponse(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)
    account_id: int | None = None
    account_name: str | None = None
