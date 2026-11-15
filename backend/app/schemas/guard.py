from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class GuardCreate(BaseModel):
    full_name: str
    gender: str | None = None
    date_of_birth: date | None = None
    phone: str
    email: EmailStr | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    joining_date: date
    monthly_salary: Decimal = Field(gt=0)


class GuardUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    monthly_salary: Decimal | None = Field(default=None, gt=0)
    verification_status: str | None = None


class GuardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    security_id: str
    full_name: str
    phone: str
    email: EmailStr | None = None
    joining_date: date
    monthly_salary: Decimal
    employment_status: str
    verification_status: str
    is_active: bool