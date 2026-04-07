from pydantic import BaseModel, Field
from typing import Optional


class CreateRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    metric: str = Field(min_length=1, max_length=20)
    operator: str = Field(min_length=1, max_length=5)
    threshold: str = Field(min_length=1, max_length=50)
    min_spend: int = 50
    action: str = Field(min_length=1, max_length=20)
    budget_increase: int = 20


class UpdateRuleRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    metric: Optional[str] = Field(None, max_length=20)
    operator: Optional[str] = Field(None, max_length=5)
    threshold: Optional[str] = Field(None, max_length=50)
    min_spend: Optional[int] = None
    action: Optional[str] = Field(None, max_length=20)
    budget_increase: Optional[int] = None
    active: Optional[bool] = None
