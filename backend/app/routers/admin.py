from fastapi import APIRouter, Depends

from app.models.user import User, UserRole
from app.utils.dependencies import require_roles

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@router.get("/dashboard")
def admin_dashboard(
    current_user: User = Depends(
        require_roles(UserRole.SUPER_ADMIN)
    )
):
    return {
        "message": "Welcome to the SecureOps admin dashboard",
        "user": current_user.full_name,
        "role": current_user.role.value
    }