import base64
from pydantic import BaseModel
from typing import Any


class CursorPage(BaseModel):
    items: list[Any]
    next_cursor: str | None
    has_more: bool
    total: int


def encode_cursor(id_value: int) -> str:
    return base64.urlsafe_b64encode(str(id_value).encode()).decode()


def decode_cursor(cursor: str) -> int:
    return int(base64.urlsafe_b64decode(cursor.encode()).decode())
