"""Tests for Facebook service — status mapping and retry logic."""
import pytest
from unittest.mock import patch, MagicMock

from app.services.facebook_service import (
    map_fb_status,
    parse_insights_to_campaigns,
    _should_retry,
    _check_fb_error,
)
from app.services.fb_token import FacebookAuthError
import requests


class TestMapFbStatus:
    @pytest.mark.parametrize("fb_status,expected", [
        ("ACTIVE", "running"),
        ("PAUSED", "paused"),
        ("DELETED", "paused"),
        ("ARCHIVED", "paused"),
        ("WITH_ISSUES", "warning"),
        ("CAMPAIGN_PAUSED", "paused"),
        ("DISAPPROVED", "warning"),
        ("PENDING_BILLING_INFO", "warning"),
        ("IN_PROCESS", "running"),
        (None, "running"),
        ("UNKNOWN_STATUS", "running"),
    ])
    def test_status_mapping(self, fb_status, expected):
        assert map_fb_status(fb_status) == expected

    def test_case_insensitive(self):
        assert map_fb_status("active") == "running"
        assert map_fb_status("Paused") == "paused"


class TestParseInsightsToCampaigns:
    def test_basic_parsing(self):
        insights = [{
            "campaign_id": "123",
            "campaign_name": "Test Campaign",
            "spend": "150.50",
            "impressions": "10000",
            "clicks": "500",
            "reach": "8000",
            "frequency": "1.25",
            "cpc": "0.30",
            "cpm": "15.05",
            "ctr": "5.0",
            "actions": [
                {"action_type": "purchase", "value": "10"},
                {"action_type": "lead", "value": "25"},
                {"action_type": "post_engagement", "value": "100"},
            ],
        }]

        result = parse_insights_to_campaigns(insights)
        assert len(result) == 1
        c = result[0]
        assert c["campaign_id"] == "123"
        assert c["name"] == "Test Campaign"
        assert c["spend"] == 150.50
        assert c["impressions"] == 10000
        assert c["clicks"] == 500
        assert c["purchases"] == 10
        assert c["leads"] == 25
        assert c["engagements"] == 100

    def test_status_from_map(self):
        insights = [{"campaign_id": "456", "campaign_name": "Paused Camp"}]
        statuses = {"456": "PAUSED"}
        result = parse_insights_to_campaigns(insights, campaign_statuses=statuses)
        assert result[0]["status"] == "paused"

    def test_default_status_running(self):
        insights = [{"campaign_id": "789", "campaign_name": "Active Camp"}]
        result = parse_insights_to_campaigns(insights)
        assert result[0]["status"] == "running"

    def test_empty_insights(self):
        result = parse_insights_to_campaigns([])
        assert result == []

    def test_engagements_fallback_to_clicks(self):
        insights = [{
            "campaign_id": "999",
            "campaign_name": "No Engagement",
            "clicks": "200",
            "actions": [],
        }]
        result = parse_insights_to_campaigns(insights)
        assert result[0]["engagements"] == 200  # fallback to clicks


class TestRetryLogic:
    def test_should_retry_on_429(self):
        resp = MagicMock()
        resp.status_code = 429
        exc = requests.HTTPError(response=resp)
        assert _should_retry(exc) is True

    def test_should_retry_on_500(self):
        resp = MagicMock()
        resp.status_code = 500
        exc = requests.HTTPError(response=resp)
        assert _should_retry(exc) is True

    def test_should_not_retry_on_400(self):
        resp = MagicMock()
        resp.status_code = 400
        exc = requests.HTTPError(response=resp)
        assert _should_retry(exc) is False

    def test_should_not_retry_on_auth_error(self):
        exc = FacebookAuthError("Token expired")
        assert _should_retry(exc) is False

    def test_should_retry_on_connection_error(self):
        exc = requests.ConnectionError()
        assert _should_retry(exc) is True

    def test_should_retry_on_timeout(self):
        exc = requests.Timeout()
        assert _should_retry(exc) is True


class TestCheckFbError:
    def test_200_ok(self):
        resp = MagicMock()
        resp.status_code = 200
        _check_fb_error(resp)  # should not raise

    def test_190_raises_auth_error(self):
        resp = MagicMock()
        resp.status_code = 400
        resp.json.return_value = {"error": {"code": 190, "message": "Token expired"}}
        with pytest.raises(FacebookAuthError, match="Token expired"):
            _check_fb_error(resp)

    def test_other_error_raises_http_error(self):
        resp = MagicMock()
        resp.status_code = 500
        resp.json.return_value = {"error": {"code": 2, "message": "Server error"}}
        resp.raise_for_status.side_effect = requests.HTTPError(response=resp)
        with pytest.raises(requests.HTTPError):
            _check_fb_error(resp)
