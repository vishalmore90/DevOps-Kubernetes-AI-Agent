from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel
from typing import Optional
from app.services.investigation_service import InvestigationService
from app.services.realtime_service import RealtimeService
from app.ai.agent import run_ai_diagnose
from app.kubernetes.kubectl_executor import KubectlExecutor

import re
from pydantic import BaseModel, Field, field_validator

router = APIRouter()

class InvestigateRequest(BaseModel):
    userId: Optional[str] = Field(None, max_length=128)
    context: Optional[str] = Field(None, max_length=128)

    @field_validator("context")
    @classmethod
    def sanitize_context(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and not re.match(r"^[a-zA-Z0-9_\-\.:/@]+$", v):
                raise ValueError("Invalid Kubernetes context format.")
        return v

    @field_validator("userId")
    @classmethod
    def sanitize_user_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and not re.match(r"^[a-zA-Z0-9_\-]+$", v):
                raise ValueError("Invalid user identifier format.")
        return v

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-kubernetes-agent"
    }

@router.get("/contexts")
async def get_contexts():
    """
    Returns the list of available Kubernetes contexts from the kubeconfig file,
    along with the default/current context and the path of the kubeconfig file.
    """
    import os
    kubeconfig_path = os.getenv("KUBECONFIG_PATH") or "~/.kube/config"
    
    success, data, err = KubectlExecutor.run_json_command(["config", "view"])
    if not success:
        logger.error(f"Failed to run config view: {err}")
        # fallback to config get-contexts -o name
        success_ctx, stdout_ctx, stderr_ctx = KubectlExecutor.run_command(["config", "get-contexts", "-o", "name"])
        if success_ctx:
            names = [line.strip() for line in stdout_ctx.splitlines() if line.strip()]
            return {"contexts": names, "current_context": names[0] if names else None, "kubeconfig_path": kubeconfig_path}
        raise HTTPException(status_code=500, detail=f"Failed to get contexts: {err or stderr_ctx}")
    
    contexts = data.get("contexts", []) if data else []
    names = [c.get("name") for c in contexts if c.get("name")]
    current_context = data.get("current-context") if data else None
    return {"contexts": names, "current_context": current_context, "kubeconfig_path": kubeconfig_path}

@router.post("/investigate")
async def investigate_cluster(req_payload: Optional[InvestigateRequest] = None):
    """
    Executes the Kubernetes investigation workflow, publishes realtime progress steps,
    passes evidence to the AI SRE agent, and returns the structured diagnosis report.
    """
    logger.info("Investigation POST request received")
    user_id = req_payload.userId if req_payload else None
    context = req_payload.context if req_payload else None
    try:
        # 1. Gather cluster evidence (streams progress inside)
        evidence = InvestigationService.run_investigation(user_id=user_id, context=context)
        pod_results = evidence.get("pods", {})
        log_results = evidence.get("logs", {})
        
        # 2. Run AI diagnosis on gathered evidence
        RealtimeService.publish_progress(user_id, "AI Reasoning")
        logger.info("Triggering SRE AI diagnosis on gathered evidence...")
        diagnosis = await run_ai_diagnose(evidence)
        
        # 3. Finalize progress
        RealtimeService.publish_progress(user_id, "Root Cause Found", "completed")
        
        # 4. Return combined response for frontend compatibility
        return {
            "status": "success",
            "message": diagnosis.get("explanation", "No explanation provided."),
            "result": {
                "root_cause": diagnosis.get("root_cause", "N/A"),
                "suggested_fix": diagnosis.get("fix", "N/A"),
                "pods_inspected": pod_results.get("total_pods", 0),
                "logs_analyzed": len(log_results)
            },
            "diagnosis": diagnosis,
            "investigation": evidence
        }
    except Exception as exc:
        logger.exception("Investigation failed")
        if user_id:
            RealtimeService.publish_progress(user_id, f"Error: {exc}", "completed")
        raise HTTPException(
            status_code=500,
            detail=f"Investigation failed: {exc}"
        ) from exc


