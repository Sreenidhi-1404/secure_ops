from pydantic import BaseModel, ConfigDict, Field


class SiteCreate(BaseModel):
    site_code: str = Field(min_length=3, max_length=30)
    site_name: str = Field(min_length=2, max_length=150)
    branch_id: int = Field(gt=0)

    address: str = Field(min_length=3)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)

    site_contact: str | None = None
    contact_phone: str | None = None


class SiteUpdate(BaseModel):
    site_name: str | None = Field(default=None, max_length=150)
    address: str | None = None
    city: str | None = None
    state: str | None = None
    site_contact: str | None = None
    contact_phone: str | None = None


class SiteResponse(BaseModel):
    id: int
    site_code: str
    site_name: str
    branch_id: int
    address: str
    city: str
    state: str
    site_contact: str | None
    contact_phone: str | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)