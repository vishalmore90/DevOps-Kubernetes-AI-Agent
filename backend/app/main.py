from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys
import time

from app.core.config import settings
from app.api.routes import router as api_router

# Configure Loguru
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level:<8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)

def init_kubeconfig():
    import os
    import base64
    from pathlib import Path

    # 1. Handle inline KUBECONFIG_DATA / KUBECONFIG_CONTENT (base64 or raw yaml) for cloud deployments (e.g., Render)
    kubeconfig_data = os.getenv("KUBECONFIG_DATA") or os.getenv("KUBECONFIG_CONTENT")
    if kubeconfig_data:
        try:
            try:
                decoded = base64.b64decode(kubeconfig_data).decode("utf-8")
                if "apiVersion" in decoded:
                    kubeconfig_data = decoded
            except Exception:
                pass
            
            kube_dir = Path(os.path.expanduser("~/.kube"))
            kube_dir.mkdir(parents=True, exist_ok=True)
            kube_file = kube_dir / "config"
            kube_file.write_text(kubeconfig_data, encoding="utf-8")
            os.environ["KUBECONFIG"] = str(kube_file)
            logger.info(f"Initialized KUBECONFIG from environment data to {kube_file}")
            return
        except Exception as e:
            logger.warning(f"Could not parse/write KUBECONFIG_DATA: {e}")

    # 2. Check for configured file path
    if settings.KUBECONFIG_PATH and not os.getenv("KUBECONFIG"):
        expanded = os.path.expanduser(settings.KUBECONFIG_PATH)
        if os.path.exists(expanded):
            os.environ["KUBECONFIG"] = expanded
            logger.info(f"Configured KUBECONFIG={expanded}")
        else:
            logger.warning(f"Kubeconfig path not found at {expanded}. Cluster operations will require a valid kubeconfig.")

init_kubeconfig()

app = FastAPI(
    title="AI Kubernetes Troubleshooting Agent Backend",
    version="0.1.0",
    description="Backend orchestration service for AI Kubernetes Troubleshooting Agent",
    debug=False
)

# Rate limiting middleware (120 req/min per client IP)
RATE_LIMIT_WINDOW = 60
MAX_REQUESTS_PER_WINDOW = 120
request_timestamps = {}

@app.middleware("http")
async def security_and_rate_limit(request, call_next):
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    # Prune old timestamps
    timestamps = [t for t in request_timestamps.get(client_ip, []) if now - t < RATE_LIMIT_WINDOW]
    if len(timestamps) >= MAX_REQUESTS_PER_WINDOW:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please wait before making more requests."}
        )
    
    timestamps.append(now)
    request_timestamps[client_ip] = timestamps
    
    response = await call_next(request)
    # Add Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

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
