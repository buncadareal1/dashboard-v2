import logging
from datetime import datetime, timedelta

import requests
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

from app.config import settings
from app.services.fb_token import FacebookAuthError

logger = logging.getLogger("smartland")

FB_GRAPH_URL = "https://graph.facebook.com/v21.0"

# Map Facebook effective_status → internal status
_FB_STATUS_MAP = {
    "ACTIVE": "running",
    "PAUSED": "paused",
    "DELETED": "paused",
    "ARCHIVED": "paused",
    "IN_PROCESS": "running",
    "WITH_ISSUES": "warning",
    "CAMPAIGN_PAUSED": "paused",
    "ADSET_PAUSED": "paused",
    "DISAPPROVED": "warning",
    "PREAPPROVED": "running",
    "PENDING_REVIEW": "running",
    "PENDING_BILLING_INFO": "warning",
}


def _should_retry(exc: BaseException) -> bool:
    """Retry on transient HTTP errors (429, 5xx) but NOT on auth errors."""
    if isinstance(exc, FacebookAuthError):
        return False
    if isinstance(exc, requests.HTTPError):
        code = exc.response.status_code if exc.response is not None else 0
        return code in (429, 500, 502, 503)
    if isinstance(exc, (requests.ConnectionError, requests.Timeout)):
        return True
    return False


def _check_fb_error(resp: requests.Response) -> None:
    """Check FB API response for errors. Raise appropriate exception."""
    if resp.status_code == 200:
        return
    try:
        error_data = resp.json().get("error", {})
        error_code = error_data.get("code", 0)
        error_msg = error_data.get("message", resp.text)
    except ValueError:
        error_code = 0
        error_msg = resp.text

    # Code 190 = expired/invalid token
    if error_code == 190:
        raise FacebookAuthError(f"Token expired or invalid: {error_msg}")

    # Raise HTTPError for retry logic
    resp.raise_for_status()


@retry(
    retry=retry_if_exception(_should_retry),
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def _fb_get(url: str, params: dict, timeout: int = 30) -> dict:
    """Perform a GET request to FB API with retry logic."""
    resp = requests.get(url, params=params, timeout=timeout)
    _check_fb_error(resp)
    return resp.json()


def _resolve_token(access_token: str | None = None) -> str:
    """Resolve token: explicit param > global env. Raise if neither."""
    token = access_token or settings.FB_ACCESS_TOKEN
    if not token:
        raise FacebookAuthError("No Facebook access token configured")
    return token


def _resolve_account_id(ad_account_id: str | None = None) -> str:
    """Resolve account ID: explicit param > global env."""
    account_id = ad_account_id or settings.FB_AD_ACCOUNT_ID
    if not account_id:
        raise FacebookAuthError("No Facebook ad account ID configured")
    return account_id


def fetch_campaigns(
    access_token: str | None = None,
    ad_account_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 500,
) -> list[dict]:
    """Lấy danh sách campaigns từ Facebook Marketing API."""
    token = _resolve_token(access_token)
    account = _resolve_account_id(ad_account_id)

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    url = f"{FB_GRAPH_URL}/{account}/campaigns"
    params = {
        "access_token": token,
        "fields": "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
        "limit": limit,
    }

    try:
        data = _fb_get(url, params)
        campaigns = data.get("data", [])
        logger.info(f"Facebook API: lấy được {len(campaigns)} campaigns")
        return campaigns
    except FacebookAuthError:
        raise
    except Exception as e:
        logger.error(f"Facebook API error (campaigns): {e}")
        return []


def fetch_campaign_insights(
    access_token: str | None = None,
    ad_account_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    level: str = "campaign",
    limit: int = 500,
) -> list[dict]:
    """Lấy insights (metrics) từ Facebook Marketing API."""
    token = _resolve_token(access_token)
    account = _resolve_account_id(ad_account_id)

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    url = f"{FB_GRAPH_URL}/{account}/insights"
    params = {
        "access_token": token,
        "fields": ",".join([
            "campaign_id", "campaign_name",
            "spend", "impressions", "clicks", "cpc", "cpm", "ctr", "cpp",
            "actions", "action_values",
            "reach", "frequency",
            "objective",
            "conversions", "cost_per_action_type",
        ]),
        "time_range": f'{{"since":"{date_from}","until":"{date_to}"}}',
        "level": level,
        "limit": limit,
    }

    all_insights = []
    try:
        data = _fb_get(url, params, timeout=60)
        all_insights.extend(data.get("data", []))

        # Pagination
        while "paging" in data and "next" in data["paging"]:
            next_url = data["paging"]["next"]
            data = _fb_get(next_url, {}, timeout=30)
            all_insights.extend(data.get("data", []))

        logger.info(f"Facebook API: lấy được {len(all_insights)} insights")
        return all_insights
    except FacebookAuthError:
        raise
    except Exception as e:
        logger.error(f"Facebook API error (insights): {e}")
        return []


def map_fb_status(effective_status: str | None) -> str:
    """Map Facebook effective_status to internal status."""
    if not effective_status:
        return "running"
    return _FB_STATUS_MAP.get(effective_status.upper(), "running")


def parse_insights_to_campaigns(
    insights: list[dict],
    campaign_statuses: dict[str, str] | None = None,
) -> list[dict]:
    """Chuyển Facebook insights thành format dashboard dùng.

    Args:
        insights: raw insights from FB API
        campaign_statuses: optional dict {campaign_id: effective_status} for status mapping
    """
    results = []
    statuses = campaign_statuses or {}

    for row in insights:
        spend = float(row.get("spend", 0))
        impressions = int(row.get("impressions", 0))
        clicks = int(row.get("clicks", 0))
        reach = int(row.get("reach", 0))
        frequency = float(row.get("frequency", 0))
        cpc = float(row.get("cpc", 0))
        cpm = float(row.get("cpm", 0))
        ctr = float(row.get("ctr", 0))

        # Extract actions (purchases, leads, etc.)
        actions = row.get("actions", [])
        purchases = 0
        leads = 0
        engagements = 0
        for action in actions:
            action_type = action.get("action_type", "")
            value = int(action.get("value", 0))
            if action_type == "purchase":
                purchases += value
            elif action_type == "lead":
                leads += value
            elif action_type in (
                "post_engagement", "page_engagement",
                "post_reaction", "comment", "post",
                "link_click", "video_view",
                "onsite_conversion.post_save",
            ):
                engagements += value

        if engagements == 0:
            engagements = clicks  # fallback

        campaign_id = row.get("campaign_id", "")
        effective_status = statuses.get(campaign_id)
        status = map_fb_status(effective_status)

        results.append({
            "campaign_id": campaign_id,
            "name": row.get("campaign_name", "Unknown"),
            "objective": row.get("objective", ""),
            "spend": spend,
            "impressions": impressions,
            "imp": impressions,
            "clicks": clicks,
            "reach": reach,
            "frequency": frequency,
            "cpc": cpc,
            "cpm": cpm,
            "ctr": ctr,
            "engagements": engagements,
            "purchases": purchases,
            "leads": leads,
            "status": status,
        })

    return results


def fetch_account_info(access_token: str | None = None, ad_account_id: str | None = None) -> dict | None:
    """Kiểm tra kết nối và lấy thông tin tài khoản."""
    try:
        token = _resolve_token(access_token)
        account = _resolve_account_id(ad_account_id)
    except FacebookAuthError:
        return None

    url = f"{FB_GRAPH_URL}/{account}"
    params = {
        "access_token": token,
        "fields": "name,account_id,account_status,currency,timezone_name,amount_spent",
    }

    try:
        return _fb_get(url, params, timeout=15)
    except Exception as e:
        logger.error(f"Facebook API error (account): {e}")
        return None
