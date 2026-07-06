from typing import Dict, List, Any, Optional
from loguru import logger
from app.kubernetes.kubectl_executor import KubectlExecutor

class DeploymentInspector:
    @staticmethod
    def inspect(context: Optional[str] = None) -> Dict[str, Any]:
        """
        Inspects all deployments in the cluster and flags those with mismatched replicas or rollout failures.
        """
        logger.info("Starting Deployment Inspection...")
        success, data, err = KubectlExecutor.run_json_command(["get", "deployments", "-A"], context=context)
        
        if not success:
            logger.error(f"Deployments inspection failed to execute: {err}")
            return {
                "success": False,
                "error": err,
                "unhealthy_deployments": []
            }

        if not data or "items" not in data:
            return {
                "success": True,
                "healthy": True,
                "unhealthy_deployments": []
            }

        unhealthy_deployments = []
        
        for item in data.get("items", []):
            metadata = item.get("metadata", {})
            name = metadata.get("name", "unknown")
            namespace = metadata.get("namespace", "default")
            spec = item.get("spec", {})
            status = item.get("status", {})
            
            desired_replicas = spec.get("replicas", 1)
            ready_replicas = status.get("readyReplicas", 0)
            unavailable_replicas = status.get("unavailableReplicas", 0)
            
            is_unhealthy = False
            reason = ""
            
            # Check for replica mismatches
            if desired_replicas != ready_replicas or unavailable_replicas > 0:
                is_unhealthy = True
                reason = f"ReplicaMismatch: desired={desired_replicas}, ready={ready_replicas}, unavailable={unavailable_replicas}"

            # Check deployment conditions
            conditions = status.get("conditions", [])
            for cond in conditions:
                cond_type = cond.get("type", "")
                cond_status = cond.get("status", "")
                cond_reason = cond.get("reason", "")
                cond_message = cond.get("message", "")
                
                if cond_type == "Progressing" and cond_status == "False" and cond_reason == "ProgressDeadlineExceeded":
                    is_unhealthy = True
                    reason = f"RolloutTimeout: {cond_message}"
                    break
                elif cond_type == "ReplicaFailure" and cond_status == "True":
                    is_unhealthy = True
                    reason = f"ReplicaFailure: {cond_message}"
                    break

            if is_unhealthy:
                unhealthy_deployments.append({
                    "name": name,
                    "namespace": namespace,
                    "desired_replicas": desired_replicas,
                    "ready_replicas": ready_replicas,
                    "unavailable_replicas": unavailable_replicas,
                    "reason": reason
                })

        return {
            "success": True,
            "healthy": len(unhealthy_deployments) == 0,
            "unhealthy_deployments": unhealthy_deployments
        }
