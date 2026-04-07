"""Facebook token encryption/decryption service.

Uses Fernet symmetric encryption with key derived from SECRET_KEY via HKDF.
"""
import base64
import logging

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy.orm import Session

from app.config import settings
from app.models.facebook_account import FacebookAccount

logger = logging.getLogger("smartland")


class FacebookAuthError(Exception):
    """Raised when FB token is missing, expired, or invalid."""


def _derive_key() -> bytes:
    """Derive a Fernet-compatible key from SECRET_KEY via HKDF."""
    hkdf = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"smartland-fb-token",
        info=b"facebook-access-token",
    )
    raw = hkdf.derive(settings.SECRET_KEY.encode())
    return base64.urlsafe_b64encode(raw)


def _get_fernet() -> Fernet:
    return Fernet(_derive_key())


def encrypt_token(plaintext: str) -> str:
    """Encrypt a plaintext token → base64 ciphertext string."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a ciphertext string → plaintext token."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise FacebookAuthError("Cannot decrypt stored token — key may have rotated")


def get_token_for_account(db: Session, account_id: int) -> str:
    """Resolve access token for a FacebookAccount.

    Priority:
    1. Encrypted token in DB (per-account)
    2. Global FB_ACCESS_TOKEN from env (fallback)
    Raises FacebookAuthError if neither available.
    """
    account = db.query(FacebookAccount).filter(
        FacebookAccount.id == account_id,
        FacebookAccount.is_active.is_(True),
    ).first()

    if not account:
        raise FacebookAuthError(f"Facebook account {account_id} not found or inactive")

    # Try per-account token first
    if account.access_token:
        try:
            return decrypt_token(account.access_token)
        except FacebookAuthError:
            logger.warning(f"Cannot decrypt token for account {account_id}, trying global fallback")

    # Fallback to global env token
    if settings.FB_ACCESS_TOKEN:
        return settings.FB_ACCESS_TOKEN

    raise FacebookAuthError(f"No access token available for account {account_id}")
