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
    If no external cloud or local cluster contexts are detected, provides the Sandbox
    Cluster environments for a 100% free, cardless, and instant live demo experience.
    """
    import os
    kubeconfig_path = os.getenv("KUBECONFIG_PATH") or "~/.kube/config"
    
    contexts = []
    current_context = None

    try:
        success, data, err = KubectlExecutor.run_json_command(["config", "view"])
        if success and data:
            raw_contexts = data.get("contexts", [])
            contexts = [c.get("name") for c in raw_contexts if c and c.get("name")]
            current_context = data.get("current-context")
        else:
            success_ctx, stdout_ctx, _ = KubectlExecutor.run_command(["config", "get-contexts", "-o", "name"])
            if success_ctx and stdout_ctx.strip():
                contexts = [line.strip() for line in stdout_ctx.splitlines() if line.strip()]
                current_context = contexts[0] if contexts else None
    except Exception as exc:
        logger.warning(f"Unable to query live kubectl contexts: {exc}")

    sandbox_contexts = [
        "k8s-sandbox-cluster",
        "k8s-sandbox-oom",
        "k8s-sandbox-imagepull",
        "k8s-sandbox-service-selector",
        "k8s-sandbox-liveness-probe",
        "k8s-sandbox-pending-resources"
    ]

    # If no live cluster contexts exist (e.g. Render cloud container without cloud kubeconfig),
    # return the sandbox contexts
    if not contexts:
        return {
            "contexts": sandbox_contexts,
            "current_context": sandbox_contexts[0],
            "kubeconfig_path": "k8s-sandbox-cluster-mode"
        }

    # If live cluster contexts exist, include them alongside sandbox options
    return {
        "contexts": contexts + [c for c in sandbox_contexts if c not in contexts],
        "current_context": current_context or contexts[0],
        "kubeconfig_path": kubeconfig_path
    }

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


