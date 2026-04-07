"""Tests for app.services.fb_csv_import_service."""
from __future__ import annotations

import pytest

from app.models import Campaign
from app.services import fb_csv_import_service as svc


GOOD_CSV = (
    "Campaign name,Amount spent (VND),Impressions,Clicks (all),CTR (all),"
    "CPC (all),Reporting starts,Results\n"
    'Test Campaign A,"1,247",10000,250,2.5,5.0,2025-01-01,12\n'
    'Test Campaign B,"3,500",20000,600,3.0,5.83,2025-01-02,30\n'
    'Test Campaign C,"500",4000,40,1.0,12.5,2025-01-03,4\n'
)

MISSING_SPEND_CSV = (
    "Campaign name,Impressions,Clicks (all)\n"
    "Camp X,1000,10\n"
)


@pytest.fixture
def good_bytes() -> bytes:
    return GOOD_CSV.encode("utf-8")


@pytest.fixture
def missing_spend_bytes() -> bytes:
    return MISSING_SPEND_CSV.encode("utf-8")


def test_parse_succeeds_and_maps_headers(good_bytes: bytes) -> None:
    parsed = svc.parse_fb_csv(good_bytes)
    assert parsed.row_count == 3
    assert parsed.missing_required == []
    assert "campaign_name" in parsed.mapped_fields
    assert "spend" in parsed.mapped_fields
    assert "impressions" in parsed.mapped_fields
    assert parsed.mapped_fields["spend"] == "Amount spent (VND)"


def test_parse_missing_required(missing_spend_bytes: bytes) -> None:
    parsed = svc.parse_fb_csv(missing_spend_bytes)
    assert "spend" in parsed.missing_required
    assert parsed.row_count == 0


def test_numbers_with_commas_parsed(good_bytes: bytes) -> None:
    parsed = svc.parse_fb_csv(good_bytes)
    assert parsed.rows[0]["spend"] == 1247.0
    assert parsed.rows[0]["impressions"] == 10000
    assert parsed.rows[1]["spend"] == 3500.0


def test_dry_run_does_not_write(db_session, good_bytes: bytes) -> None:
    parsed = svc.parse_fb_csv(good_bytes)
    result = svc.import_parsed_to_db(db_session, parsed, account_id=None, dry_run=True)
    assert result.created == 3
    assert db_session.query(Campaign).count() == 0


def test_import_creates_campaigns(db_session, good_bytes: bytes) -> None:
    parsed = svc.parse_fb_csv(good_bytes)
    result = svc.import_parsed_to_db(db_session, parsed, account_id=None, dry_run=False)
    assert result.created == 3
    assert result.updated == 0
    assert db_session.query(Campaign).count() == 3
    a = db_session.query(Campaign).filter(Campaign.name == "Test Campaign A").first()
    assert a is not None
    assert a.spend == 1247.0
    assert a.impressions == 10000
    assert a.platform == "facebook"


def test_reimport_updates_existing(db_session, good_bytes: bytes) -> None:
    parsed = svc.parse_fb_csv(good_bytes)
    svc.import_parsed_to_db(db_session, parsed, account_id=None, dry_run=False)
    parsed2 = svc.parse_fb_csv(good_bytes)
    result = svc.import_parsed_to_db(db_session, parsed2, account_id=None, dry_run=False)
    assert result.updated == 3
    assert result.created == 0
    assert db_session.query(Campaign).count() == 3
    a = db_session.query(Campaign).filter(Campaign.name == "Test Campaign A").first()
    # spend was summed
    assert a.spend == 1247.0 * 2
