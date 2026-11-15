
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PayrollGenerate(BaseModel):
    guard_id: int = Field(gt=0)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)


class PayrollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    guard_id: int
    month: int
    year: int
    monthly_salary: Decimal
    days_in_month: int
    present_days: int
    payable_amount: Decimal
    status: str
    created_at: datetime
    
    approved_by: int | None = None
    approved_at: datetime | None = None
    paid_at: datetime | None = None
    payment_reference: str | None = None
