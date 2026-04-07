"""Tests for Facebook token encryption/decryption service."""
import pytest
from unittest.mock import patch

from app.services.fb_token import (
    encrypt_token,
    decrypt_token,
    get_token_for_account,
    FacebookAuthError,
)
from app.models.facebook_account import FacebookAccount


class TestEncryptDecrypt:
    def test_roundtrip(self):
        """Encrypt then decrypt should return original token."""
        original = "EAABsbCS1iHgBO0ZCJmUtest123"
        encrypted = encrypt_token(original)
        assert encrypted != original
        assert decrypt_token(encrypted) == original

    def test_different_tokens_produce_different_ciphertexts(self):
        """Two different tokens should not produce same ciphertext."""
        a = encrypt_token("token_a")
        b = encrypt_token("token_b")
        assert a != b

    def test_decrypt_invalid_raises(self):
        """Decrypting garbage should raise FacebookAuthError."""
        with pytest.raises(FacebookAuthError, match="Cannot decrypt"):
            decrypt_token("not-a-valid-fernet-token")

    def test_empty_token_roundtrip(self):
        """Empty string should encrypt/decrypt correctly."""
        encrypted = encrypt_token("")
        assert decrypt_token(encrypted) == ""


class TestGetTokenForAccount:
    def test_account_not_found_raises(self, db_session):
        """Non-existent account should raise FacebookAuthError."""
        with pytest.raises(FacebookAuthError, match="not found"):
            get_token_for_account(db_session, 999)

    def test_inactive_account_raises(self, db_session):
        """Inactive account should raise FacebookAuthError."""
        acc = FacebookAccount(
            account_name="Test", ad_account_id="act_123", is_active=False,
        )
        db_session.add(acc)
        db_session.commit()

        with pytest.raises(FacebookAuthError, match="not found or inactive"):
            get_token_for_account(db_session, acc.id)

    def test_per_account_token_decrypted(self, db_session):
        """Should return decrypted per-account token when available."""
        token = "EAABreal_token_here"
        acc = FacebookAccount(
            account_name="Test", ad_account_id="act_456",
            is_active=True, access_token=encrypt_token(token),
        )
        db_session.add(acc)
        db_session.commit()

        result = get_token_for_account(db_session, acc.id)
        assert result == token

    @patch("app.services.fb_token.settings")
    def test_fallback_to_global_token(self, mock_settings, db_session):
        """Should fallback to global FB_ACCESS_TOKEN if per-account token is None."""
        mock_settings.FB_ACCESS_TOKEN = "global_fallback_token"
        mock_settings.SECRET_KEY = "test-secret-key-for-testing"

        acc = FacebookAccount(
            account_name="Test", ad_account_id="act_789",
            is_active=True, access_token=None,
        )
        db_session.add(acc)
        db_session.commit()

        result = get_token_for_account(db_session, acc.id)
        assert result == "global_fallback_token"

    @patch("app.services.fb_token.settings")
    def test_no_token_raises(self, mock_settings, db_session):
        """Should raise when no per-account token and no global token."""
        mock_settings.FB_ACCESS_TOKEN = ""
        mock_settings.SECRET_KEY = "test-secret-key-for-testing"

        acc = FacebookAccount(
            account_name="Test", ad_account_id="act_000",
            is_active=True, access_token=None,
        )
        db_session.add(acc)
        db_session.commit()

        with pytest.raises(FacebookAuthError, match="No access token"):
            get_token_for_account(db_session, acc.id)
