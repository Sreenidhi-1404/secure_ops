

from pydantic import BaseModel, ConfigDict, Field


class BranchCreate(BaseModel):
    branch_code: str = Field(min_length=3, max_length=30)
    branch_name: str = Field(min_length=2, max_length=150)
    client_id: int = Field(gt=0)

    address: str | None = None
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    pincode: str | None = None
    contact_person: str | None = None
    contact_phone: str | None = None


class BranchUpdate(BaseModel):
    branch_name: str | None = Field(default=None, max_length=150)
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    contact_person: str | None = None
    contact_phone: str | None = None


class BranchResponse(BaseModel):
    id: int
    branch_code: str
    branch_name: str
    client_id: int
    address: str | None
    city: str
    state: str
    pincode: str | None
    contact_person: str | None
    contact_phone: str | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)