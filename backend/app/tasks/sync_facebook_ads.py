"""
Celery tasks to sync campaign data from Facebook Ads API into DB.
Runs every 10 minutes via Celery Beat.
"""
import logging
from datetime import date, datetime, timezone

from app.celery_app import celery
from app.database import SessionLocal
from app.models import Campaign, FacebookAccount
from app.services.cache_service import cache
from app.services.facebook_service import (
    fetch_campaigns,
    fetch_campaign_insights,
    parse_insights_to_campaigns,
)
from app.services.fb_token import FacebookAuthError, get_token_for_account
import asyncio
from app.services.websocket_service import publish_event

logger = logging.getLogger("smartland.tasks.sync_fb")


@celery.task(bind=True, max_retries=3, default_retry_delay=120)
def sync_facebook_account(self, account_id: int) -> dict:
    """Sync campaigns + insights for a single Facebook ad account into DB."""
    db = SessionLocal()
    try:
        account = db.query(FacebookAccount).filter(
            FacebookAccount.id == account_id,
            FacebookAccount.is_active.is_(True),
        ).first()
        if not account:
            return {"status": "skipped", "reason": f"Account {account_id} not found or inactive"}

        # 1. Resolve token
        try:
            token = get_token_for_account(db, account_id)
        except FacebookAuthError as e:
            account.last_sync_error = "TOKEN_MISSING"
            db.commit()
            logger.error(f"Account {account_id}: {e}")
            return {"status": "error", "reason": str(e)}

        ad_account_id = account.ad_account_id

        # 2. Fetch campaigns list (for status mapping)
        try:
            raw_campaigns = fetch_campaigns(
                access_token=token,
                ad_account_id=ad_account_id,
            )
        except FacebookAuthError as e:
            account.last_sync_error = "TOKEN_EXPIRED"
            db.commit()
            logger.error(f"Account {account_id} token expired: {e}")
            return {"status": "error", "reason": "TOKEN_EXPIRED"}

        # Build status map: campaign_id → effective_status
        status_map = {
            c["id"]: c.get("effective_status", "ACTIVE")
            for c in raw_campaigns
        }

        # 3. Fetch insights
        try:
            raw_insights = fetch_campaign_insights(
                access_token=token,
                ad_account_id=ad_account_id,
            )
        except FacebookAuthError as e:
            account.last_sync_error = "TOKEN_EXPIRED"
            db.commit()
            return {"status": "error", "reason": "TOKEN_EXPIRED"}

        # 4. Parse and upsert
        parsed = parse_insights_to_campaigns(raw_insights, campaign_statuses=status_map)
        now = datetime.now(timezone.utc)
        today = date.today()
        synced_count = 0

        for c in parsed:
            campaign_ext_id = c.get("campaign_id", "")
            if not campaign_ext_id:
                continue

            # Upsert by (account_id, campaign_ext_id, snapshot_date)
            existing = (
                db.query(Campaign)
                .filter(
                    Campaign.account_id == account_id,
                    Campaign.campaign_ext_id == campaign_ext_id,
                    Campaign.date == today,
                )
                .first()
            )

            if existing:
                existing.name = c.get("name", existing.name)
                existing.spend = c.get("spend", 0)
                existing.impressions = c.get("impressions", 0)
                existing.clicks = c.get("clicks", 0)
                existing.engagements = c.get("engagements", 0)
                existing.purchases = c.get("purchases", 0)
                existing.status = c.get("status", "running")
                existing.ctr = c.get("ctr", 0)
                existing.cpc = c.get("cpc", 0)
                existing.campaign_objective = c.get("objective", "")
                existing.synced_at = now
            else:
                campaign = Campaign(
                    account_id=account_id,
                    campaign_ext_id=campaign_ext_id,
                    name=c.get("name", "Unknown"),
                    spend=c.get("spend", 0),
                    impressions=c.get("impressions", 0),
                    clicks=c.get("clicks", 0),
                    engagements=c.get("engagements", 0),
                    purchases=c.get("purchases", 0),
                    status=c.get("status", "running"),
                    ctr=c.get("ctr", 0),
                    cpc=c.get("cpc", 0),
                    campaign_objective=c.get("objective", ""),
                    date=today,
                    synced_at=now,
                )
                db.add(campaign)

            synced_count += 1

        # 5. Update account sync status
        account.last_synced_at = now
        account.last_sync_error = None
        db.commit()

        # 6. Invalidate caches
        cache.delete_pattern("campaigns:*")
        cache.delete_pattern("kpi:*")

        # 7. Broadcast via WebSocket (async call from sync context)
        try:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(publish_event("campaign_synced", {
                "account_id": account_id,
                "account_name": account.account_name,
                "synced_count": synced_count,
            }))
            loop.close()
        except Exception:
            pass  # non-critical

        logger.info(f"Synced {synced_count} campaigns for account '{account.account_name}' (id={account_id})")
        return {"status": "success", "synced": synced_count, "account": account.account_name}

    except FacebookAuthError as e:
        account = db.query(FacebookAccount).filter(FacebookAccount.id == account_id).first()
        if account:
            account.last_sync_error = "TOKEN_EXPIRED"
            db.commit()
        logger.error(f"FB auth error for account {account_id}: {e}")
        return {"status": "error", "reason": str(e)}

    except Exception as e:
        db.rollback()
        logger.error(f"Sync FB account {account_id} failed: {e}", exc_info=True)
        raise self.retry(exc=e)
    finally:
        db.close()


@celery.task
def sync_all_facebook_accounts() -> dict:
    """Fan-out: dispatch sync task for each active Facebook account."""
    db = SessionLocal()
    try:
        accounts = (
            db.query(FacebookAccount)
            .filter(FacebookAccount.is_active.is_(True))
            .all()
        )
        account_ids = [a.id for a in accounts]
    finally:
        db.close()

    for aid in account_ids:
        sync_facebook_account.delay(aid)

    logger.info(f"Dispatched FB sync tasks for {len(account_ids)} accounts")
    return {"dispatched": len(account_ids)}
