from pydantic import BaseModel, Field
from typing import Optional


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=200)
    role: str = Field(default="marketer", pattern="^(admin|marketer)$")


class UpdateUserRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, pattern="^(admin|marketer)$")


class AddAccountRequest(BaseModel):
    account_name: str = Field(min_length=1, max_length=200)
    ad_account_id: str = Field(min_length=1, max_length=100)
    access_token: str = Field(min_length=1)


class RotateTokenRequest(BaseModel):
    access_token: str = Field(min_length=1)


class AssignPermissionsRequest(BaseModel):
    user_id: int
    account_ids: list[int] = []
    sheet_ids: list[int] = []
