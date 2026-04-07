"""Attribution service: match Bitrix leads → Facebook campaigns.

Provides:
- match_lead_to_campaign: pure function returning best (Campaign, score)
- attribute_leads: bulk worker that upserts CampaignLeadMatch rows
"""
from __future__ import annotations

import logging
import unicodedata
from datetime import datetime
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignLeadMatch
from app.models.lead import Lead

logger = logging.getLogger("smartland.attribution")

MATCH_THRESHOLD = 0.6


def _strip_diacritics(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


def _normalize(text: str | None) -> str:
    if not text:
        return ""
    text = _strip_diacritics(text).lower()
    return " ".join(text.split())


def _similarity(a: str, b: str) -> float:
    """Token overlap (Jaccard) + substring boost. Range 0..1."""
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        # Substring → strong, scaled by length ratio
        ratio = min(len(na), len(nb)) / max(len(na), len(nb))
        return max(0.75, ratio)

    tokens_a = set(na.split())
    tokens_b = set(nb.split())
    if not tokens_a or not tokens_b:
        return 0.0
    inter = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(inter) / len(union)


def match_lead_to_campaign(
    lead: Lead, campaigns: Iterable[Campaign]
) -> tuple[Campaign | None, float]:
    """Return the best matching campaign for a lead and the match score.

    Match key is the lead.campaign_name vs campaign.name. Returns (None, 0.0)
    if no campaign clears MATCH_THRESHOLD.
    """
    lead_name = lead.campaign_name or ""
    if not lead_name:
        return None, 0.0

    best: Campaign | None = None
    best_score = 0.0
    for camp in campaigns:
        score = _similarity(lead_name, camp.name or "")
        if score > best_score:
            best_score = score
            best = camp

    if best_score < MATCH_THRESHOLD:
        return None, best_score
    return best, best_score


def attribute_leads(db: Session, since: datetime | None = None) -> dict:
    """Run attribution across leads + campaigns; upsert CampaignLeadMatch rows.

    Returns counters for observability.
    """
    leads_query = db.query(Lead)
    if since is not None:
        leads_query = leads_query.filter(Lead.created_at >= since)
    leads = leads_query.all()
    campaigns = db.query(Campaign).all()

    matches_created = 0
    matches_updated = 0
    leads_processed = 0

    for lead in leads:
        leads_processed += 1
        camp, score = match_lead_to_campaign(lead, campaigns)
        if camp is None:
            continue

        existing = (
            db.query(CampaignLeadMatch)
            .filter(
                CampaignLeadMatch.campaign_id == camp.id,
                CampaignLeadMatch.lead_id == lead.id,
            )
            .first()
        )
        if existing is None:
            db.add(
                CampaignLeadMatch(
                    campaign_id=camp.id,
                    lead_id=lead.id,
                    match_score=score,
                )
            )
            matches_created += 1
        elif existing.match_score != score:
            existing.match_score = score
            matches_updated += 1

    db.commit()
    result = {
        "leads_processed": leads_processed,
        "matches_created": matches_created,
        "matches_updated": matches_updated,
    }
    logger.info(f"Attribution run complete: {result}")
    return result
