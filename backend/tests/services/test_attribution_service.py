"""Tests for attribution_service — lead → campaign matching."""
import pytest

from app.models.campaign import Campaign, CampaignLeadMatch
from app.models.lead import Lead
from app.services.attribution_service import (
    attribute_leads,
    match_lead_to_campaign,
)


@pytest.fixture
def seeded(db_session):
    db = db_session
    c1 = Campaign(id=1, name="Vinhomes Ocean Park - Lead Form")
    c2 = Campaign(id=2, name="Masteri Centre Point Q9")
    c3 = Campaign(id=3, name="Sun Group Hạ Long Marina")
    db.add_all([c1, c2, c3])

    l1 = Lead(id=1, name="Nguyen A", campaign_name="Vinhomes Ocean Park Lead Form", status="MỚI")
    l2 = Lead(id=2, name="Tran B", campaign_name="Masteri Centre Point", status="CHỐT ĐƠN")
    l3 = Lead(id=3, name="Le C", campaign_name="Một thứ hoàn toàn khác", status="MỚI")
    l4 = Lead(id=4, name="Pham D", campaign_name=None, status="MỚI")
    db.add_all([l1, l2, l3, l4])
    db.commit()
    return db


def test_match_lead_to_campaign_obvious_match(seeded):
    db = seeded
    campaigns = db.query(Campaign).all()
    lead = db.query(Lead).filter(Lead.id == 1).first()
    camp, score = match_lead_to_campaign(lead, campaigns)
    assert camp is not None
    assert camp.id == 1
    assert score >= 0.6


def test_match_lead_to_campaign_no_match_for_unrelated_text(seeded):
    db = seeded
    campaigns = db.query(Campaign).all()
    lead = db.query(Lead).filter(Lead.id == 3).first()
    camp, _score = match_lead_to_campaign(lead, campaigns)
    assert camp is None


def test_match_lead_to_campaign_handles_missing_name(seeded):
    db = seeded
    campaigns = db.query(Campaign).all()
    lead = db.query(Lead).filter(Lead.id == 4).first()
    camp, score = match_lead_to_campaign(lead, campaigns)
    assert camp is None
    assert score == 0.0


def test_attribute_leads_upserts_rows(seeded):
    db = seeded
    result = attribute_leads(db)
    assert result["leads_processed"] == 4
    assert result["matches_created"] >= 2  # l1 + l2

    matches = db.query(CampaignLeadMatch).all()
    pairs = {(m.campaign_id, m.lead_id) for m in matches}
    assert (1, 1) in pairs
    assert (2, 2) in pairs

    # Re-running should not create duplicates
    result2 = attribute_leads(db)
    assert result2["matches_created"] == 0
    assert db.query(CampaignLeadMatch).count() == len(matches)
