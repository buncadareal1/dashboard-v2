"""Facebook Ads CSV import service.

Parses Facebook Ads Manager CSV exports and upserts rows into the
``campaigns`` table. Stdlib only — no pandas.
"""
from __future__ import annotations

import csv
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import Campaign, FacebookAccount

logger = logging.getLogger("smartland")

# Map our internal Campaign field names to a list of accepted FB export header
# variants. The first one in each list is the canonical FB export header.
EXPECTED_HEADERS: dict[str, list[str]] = {
    "campaign_name": ["Campaign name", "Campaign Name", "campaign_name"],
    "ad_set_name": ["Ad set name", "Ad Set Name", "adset_name"],
    "ad_name": ["Ad name", "Ad Name", "ad_name"],
    "spend": [
        "Amount spent (VND)",
        "Amount spent (USD)",
        "Amount spent",
        "Spend",
    ],
    "impressions": ["Impressions"],
    "reach": ["Reach"],
    "clicks": ["Clicks (all)", "Link clicks", "Clicks"],
    "ctr": ["CTR (all)", "CTR (link click-through rate)", "CTR"],
    "cpc": ["CPC (all)", "Cost per click", "CPC"],
    "cpm": ["CPM (cost per 1,000 impressions)", "CPM"],
    "results": ["Results"],
    "cost_per_result": ["Cost per result"],
    "reporting_starts": ["Reporting starts", "Day", "Date"],
    "reporting_ends": ["Reporting ends"],
    "campaign_ext_id": ["Campaign ID", "Campaign Id", "campaign_id"],
    "objective": ["Objective", "Campaign objective"],
}

REQUIRED_INTERNAL_FIELDS: tuple[str, ...] = ("campaign_name", "spend", "impressions")

_NUMERIC_FIELDS_FLOAT = {"spend", "ctr", "cpc", "cpm", "cost_per_result"}
_NUMERIC_FIELDS_INT = {"impressions", "reach", "clicks", "results"}
_DATE_FIELDS = {"reporting_starts", "reporting_ends"}


@dataclass(frozen=True)
class ParsedFbCsv:
    headers: list[str]
    mapped_fields: dict[str, str]  # internal -> raw header name
    unmapped_headers: list[str]
    missing_required: list[str]
    rows: list[dict[str, Any]]
    row_count: int
    errors: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ImportResult:
    created: int
    updated: int
    skipped: int
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _decode(file_bytes: bytes, encoding: str) -> str:
    for enc in (encoding, "utf-8-sig", "utf-8", "latin-1"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("latin-1", errors="replace")


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _build_header_map(headers: list[str]) -> tuple[dict[str, str], list[str]]:
    """Return (internal_field -> raw_header, unmapped_headers)."""
    mapped: dict[str, str] = {}
    used: set[str] = set()
    norm_headers = {_normalize(h): h for h in headers}

    for internal, variants in EXPECTED_HEADERS.items():
        for variant in variants:
            key = _normalize(variant)
            if key in norm_headers:
                raw = norm_headers[key]
                mapped[internal] = raw
                used.add(raw)
                break

    unmapped = [h for h in headers if h not in used]
    return mapped, unmapped


_NUM_RE = re.compile(r"[^\d\-.,]")


def _parse_number(value: str) -> float | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() in {"-", "n/a", "na", "null", "none"}:
        return None
    # Strip currency symbols and unit text; keep digits/sign/sep
    s = _NUM_RE.sub("", s)
    if not s or s in {"-", ".", ","}:
        return None
    # Handle "1,234.56" vs "1.234,56" — assume comma is thousand sep when both
    if "," in s and "." in s:
        s = s.replace(",", "")
    elif "," in s:
        # Treat comma as thousand sep if it looks like grouping
        if re.match(r"^-?\d{1,3}(,\d{3})+$", s):
            s = s.replace(",", "")
        else:
            s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_int(value: str) -> int | None:
    n = _parse_number(value)
    if n is None:
        return None
    return int(round(n))


def _parse_date(value: str) -> date | None:
    if not value:
        return None
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _coerce_row(raw_row: dict[str, str], mapped: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for internal, raw_header in mapped.items():
        raw_value = raw_row.get(raw_header, "")
        if internal in _NUMERIC_FIELDS_INT:
            out[internal] = _parse_int(raw_value) or 0
        elif internal in _NUMERIC_FIELDS_FLOAT:
            v = _parse_number(raw_value)
            out[internal] = float(v) if v is not None else 0.0
        elif internal in _DATE_FIELDS:
            out[internal] = _parse_date(raw_value)
        else:
            out[internal] = (raw_value or "").strip() or None
    return out


def parse_fb_csv(file_bytes: bytes, encoding: str = "utf-8") -> ParsedFbCsv:
    """Parse a Facebook Ads CSV export into a ``ParsedFbCsv``."""
    text = _decode(file_bytes, encoding)
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    mapped, unmapped = _build_header_map(headers)
    missing_required = [f for f in REQUIRED_INTERNAL_FIELDS if f not in mapped]

    rows: list[dict[str, Any]] = []
    errors: list[str] = []

    if missing_required:
        # Still return — caller decides whether to abort
        return ParsedFbCsv(
            headers=headers,
            mapped_fields=mapped,
            unmapped_headers=unmapped,
            missing_required=missing_required,
            rows=[],
            row_count=0,
            errors=[
                f"Thiếu cột bắt buộc: {', '.join(missing_required)}",
            ],
        )

    for idx, raw_row in enumerate(reader, start=2):  # header is row 1
        try:
            coerced = _coerce_row(raw_row, mapped)
            if not coerced.get("campaign_name"):
                if len(errors) < 20:
                    errors.append(f"Dòng {idx}: thiếu tên chiến dịch, bỏ qua")
                continue
            rows.append(coerced)
        except Exception as e:  # pragma: no cover - defensive
            if len(errors) < 20:
                errors.append(f"Dòng {idx}: lỗi parse - {e}")

    return ParsedFbCsv(
        headers=headers,
        mapped_fields=mapped,
        unmapped_headers=unmapped,
        missing_required=[],
        rows=rows,
        row_count=len(rows),
        errors=errors,
    )


# ---------------------------------------------------------------------------
# DB upsert
# ---------------------------------------------------------------------------


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def _find_existing_campaign(
    db: Session,
    *,
    campaign_ext_id: str | None,
    name: str,
    reporting_start: date | None,
    account_id: int | None,
) -> Campaign | None:
    q = db.query(Campaign)
    if campaign_ext_id:
        existing = q.filter(Campaign.campaign_ext_id == campaign_ext_id).first()
        if existing:
            return existing
    # fallback: name + date + account
    candidates = q.filter(Campaign.name == name)
    if reporting_start is not None:
        candidates = candidates.filter(Campaign.date == reporting_start)
    if account_id is not None:
        candidates = candidates.filter(Campaign.account_id == account_id)
    return candidates.first()


def import_parsed_to_db(
    db: Session,
    parsed: ParsedFbCsv,
    account_id: int | None,
    dry_run: bool = False,
) -> ImportResult:
    """Upsert parsed rows into the campaigns table."""
    if parsed.missing_required:
        return ImportResult(
            created=0,
            updated=0,
            skipped=0,
            errors=[f"Thiếu cột bắt buộc: {', '.join(parsed.missing_required)}"],
        )

    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for idx, row in enumerate(parsed.rows, start=1):
        try:
            name = row.get("campaign_name") or ""
            if not name:
                skipped += 1
                continue
            reporting_start = row.get("reporting_starts")
            campaign_ext_id = row.get("campaign_ext_id")

            existing = _find_existing_campaign(
                db,
                campaign_ext_id=campaign_ext_id,
                name=name,
                reporting_start=reporting_start,
                account_id=account_id,
            )

            spend = float(row.get("spend") or 0)
            impressions = int(row.get("impressions") or 0)
            clicks = int(row.get("clicks") or 0)
            ctr = row.get("ctr")
            cpc = row.get("cpc")
            results = int(row.get("results") or 0)

            if existing:
                # Sum numeric fields when same period — treat as additional data
                existing.spend = (existing.spend or 0) + spend
                existing.impressions = (existing.impressions or 0) + impressions
                existing.clicks = (existing.clicks or 0) + clicks
                if results:
                    existing.conversions = (existing.conversions or 0) + results
                if ctr is not None:
                    existing.ctr = float(ctr) if ctr else existing.ctr
                if cpc is not None:
                    existing.cpc = float(cpc) if cpc else existing.cpc
                if account_id is not None and existing.account_id is None:
                    existing.account_id = account_id
                if campaign_ext_id and not existing.campaign_ext_id:
                    existing.campaign_ext_id = campaign_ext_id
                existing.synced_at = datetime.utcnow()
                existing.source_sheet = "facebook_csv_import"
                if not dry_run:
                    db.add(existing)
                updated += 1
            else:
                campaign = Campaign(
                    account_id=account_id,
                    campaign_ext_id=campaign_ext_id,
                    name=name,
                    spend=spend,
                    impressions=impressions,
                    clicks=clicks,
                    conversions=results,
                    ctr=float(ctr) if ctr else None,
                    cpc=float(cpc) if cpc else None,
                    date=reporting_start,
                    platform="facebook",
                    campaign_objective=row.get("objective"),
                    source_sheet="facebook_csv_import",
                    synced_at=datetime.utcnow(),
                )
                if not dry_run:
                    db.add(campaign)
                created += 1
        except Exception as e:
            if len(errors) < 20:
                errors.append(f"Dòng {idx}: {e}")
            skipped += 1

    if not dry_run:
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            errors.append(f"Lỗi commit DB: {e}")
            return ImportResult(created=0, updated=0, skipped=len(parsed.rows), errors=errors)
    else:
        db.rollback()

    # Best-effort touch FacebookAccount.last_synced_at
    if not dry_run and account_id is not None:
        try:
            acc = db.query(FacebookAccount).filter(FacebookAccount.id == account_id).first()
            if acc:
                acc.last_synced_at = datetime.utcnow()
                db.commit()
        except Exception as e:  # pragma: no cover
            logger.warning(f"Failed to update FacebookAccount.last_synced_at: {e}")
            db.rollback()

    return ImportResult(created=created, updated=updated, skipped=skipped, errors=errors)
