from pydantic import BaseModel, Field
from typing import Optional


class CreateLeadRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field("MỚI", max_length=50)


class UpdateLeadRequest(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
