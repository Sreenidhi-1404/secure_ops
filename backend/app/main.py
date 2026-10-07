from fastapi import FastAPI

app = FastAPI(
    title="SecureOps API",
    description="Security Workforce Management & Deployment Platform",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "Welcome to SecureOps API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }