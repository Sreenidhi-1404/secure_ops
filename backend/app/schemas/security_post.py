from pydantic import BaseModel, ConfigDict, Field


class SecurityPostCreate(BaseModel):
    post_code: str = Field(min_length=3, max_length=30)
    post_name: str = Field(min_length=2, max_length=120)
    site_id: int = Field(gt=0)

    description: str | None = None
    required_guards: int = Field(default=1, ge=1, le=500)
    shift_type: str = Field(default="GENERAL", max_length=30)
    is_armed: bool = False


class SecurityPostUpdate(BaseModel):
    post_name: str | None = Field(default=None, max_length=120)
    description: str | None = None
    required_guards: int | None = Field(default=None, ge=1, le=500)
    shift_type: str | None = Field(default=None, max_length=30)
    is_armed: bool | None = None


class SecurityPostResponse(BaseModel):
    id: int
    post_code: str
    post_name: str
    site_id: int
    description: str | None
    required_guards: int
    shift_type: str
    is_armed: bool
    is_active: bool

    model_config = ConfigDict(from_attributes=True)