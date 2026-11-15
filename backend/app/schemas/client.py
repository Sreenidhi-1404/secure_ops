from pydantic import BaseModel, ConfigDict, Field


class ClientCreate(BaseModel):
    client_code: str = Field(min_length=3, max_length=30)
    company_name: str = Field(min_length=2, max_length=150)
    industry: str | None = None

    contact_person: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=150)
    phone: str = Field(min_length=7, max_length=20)

    address: str | None = None
    city: str
    state: str
    pincode: str | None = None


class ClientUpdate(BaseModel):
    company_name: str | None = Field(default=None, max_length=150)
    industry: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None


class ClientResponse(BaseModel):
    id: int
    client_code: str
    company_name: str
    industry: str | None
    contact_person: str
    email: str
    phone: str
    address: str | None
    city: str
    state: str
    pincode: str | None
    is_active: bool
    created_by: int

    model_config = ConfigDict(from_attributes=True)