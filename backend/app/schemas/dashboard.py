
from decimal import Decimal
from pydantic import BaseModel


class OperationsDashboardResponse(BaseModel):
    total_guards: int
    active_guards: int
    active_deployments: int
    active_posts: int
    required_guard_positions: int
    deployed_guard_positions: int
    vacant_positions: int
    present_today: int
    guards_on_leave_today: int
    monthly_payroll_total: Decimal
    monthly_payroll_paid: Decimal
    monthly_payroll_pending: Decimal
