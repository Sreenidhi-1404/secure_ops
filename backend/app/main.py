from fastapi import FastAPI

from app.database import Base, engine


from app.models import (
    User, Client, Branch, Site, SecurityPost, Guard, Deployment
)

from app.routers import (
    auth, admin, clients, branches, sites,
    security_posts, guards,deployments,attendance,payroll,operations_dashboard,leave,operations_exceptions,guard_history,client_portal,client_accounts
)
from app.models.guard_replacement import GuardReplacement
from app.models.leave import GuardLeave


Base.metadata.create_all(bind=engine)
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(
    title="SecureOps API",
    description="Security Workforce Management & Deployment Platform",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)   

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(clients.router)
app.include_router(branches.router)
app.include_router(sites.router)
app.include_router(security_posts.router)
app.include_router(guards.router)
app.include_router(deployments.router)
app.include_router(attendance.router)
app.include_router(payroll.router)
app.include_router(operations_dashboard.router)
app.include_router(leave.router)
app.include_router(operations_exceptions.router)
app.include_router(guard_history.router)
app.include_router(client_portal.router)
app.include_router(client_accounts.router)


@app.get("/")
def root():
    return {
        "message": "Welcome to SecureOps API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}

