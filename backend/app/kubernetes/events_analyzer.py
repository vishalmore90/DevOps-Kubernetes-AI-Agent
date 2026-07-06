from typing import Dict, List, Any, Optional
from loguru import logger
from app.kubernetes.kubectl_executor import KubectlExecutor

class EventsAnalyzer:
    WARNING_REASONS = ["FailedScheduling", "BackOff", "FailedMount", "FailedPull", "ErrImagePull", "Unhealthy", "FailedCreatePodSandBox"]

    @classmethod
    def analyze(cls, context: Optional[str] = None) -> Dict[str, Any]:
        """
        Queries Kubernetes events across namespaces and isolates warning events or specific failure states.
        """
        logger.info("Starting Events Analysis...")
        success, data, err = KubectlExecutor.run_json_command(["get", "events", "-A"], context=context)
        
        if not success:
            logger.error(f"Events query failed to execute: {err}")
            return {
                "success": False,
                "error": err,
                "warnings": []
            }

        if not data or "items" not in data:
            return {
                "success": True,
                "warnings": []
            }

        warnings = []
        for item in data.get("items", []):
            event_type = item.get("type", "Normal")
            reason = item.get("reason", "")
            
            is_warning = event_type == "Warning" or reason in cls.WARNING_REASONS
            
            if is_warning:
                obj = item.get("involvedObject", {})
                metadata = item.get("metadata", {})
                
                warnings.append({
                    "namespace": obj.get("namespace", "default"),
                    "kind": obj.get("kind", "Unknown"),
                    "name": obj.get("name", "unknown"),
                    "reason": reason,
                    "message": item.get("message", ""),
                    "count": item.get("count", 1),
                    "first_timestamp": item.get("firstTimestamp") or metadata.get("creationTimestamp"),
                    "last_timestamp": item.get("lastTimestamp") or metadata.get("creationTimestamp"),
                })

        # Sort warnings by latest timestamp
        warnings.sort(key=lambda x: x.get("last_timestamp") or "", reverse=True)

        return {
            "success": True,
            "warnings": warnings[:30] # Cap at top 30 warnings
        }
