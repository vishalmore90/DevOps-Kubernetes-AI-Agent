from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys

from app.core.config import settings
from app.api.routes import router as api_router

# Configure Loguru
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level:<8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)

app = FastAPI(
    title="AI Kubernetes Troubleshooting Agent Backend",
    version="0.1.0",
    description="Backend orchestration service for AI Kubernetes Troubleshooting Agent"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes directly at root level
app.include_router(api_router)

# Also expose health check directly at /health as requested
@app.get("/health")
async def root_health_check():
    return {
        "status": "healthy",
        "service": "ai-kubernetes-agent"
    }

@app.get("/")
async def index():
    return {
        "service": "AI Kubernetes Troubleshooting Agent API",
        "health": "/health",
        "version": "0.1.0"
    }

logger.info("FastAPI application initialized successfully.")
