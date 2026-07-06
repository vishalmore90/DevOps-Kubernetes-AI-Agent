from typing import Dict, List, Any, Optional
from loguru import logger
from app.kubernetes.kubectl_executor import KubectlExecutor

class PodInspector:
    @staticmethod
    def inspect(context: Optional[str] = None) -> Dict[str, Any]:
        """
        Inspects all pods in the cluster, identifies unhealthy ones, and categorizes their problems.
        Returns: A dict with pod counts, overall health, and a list of problematic pods.
        """
        logger.info("Starting Pod Inspection...")
        success, data, err = KubectlExecutor.run_json_command(["get", "pods", "-A"], context=context)
        
        if not success:
            logger.error(f"Pod inspection failed to execute: {err}")
            return {
                "success": False,
                "error": err,
                "healthy": False,
                "problematic_pods": []
            }

        if not data or "items" not in data:
            return {
                "success": True,
                "healthy": True,
                "total_pods": 0,
                "running_pods": 0,
                "failed_pods": 0,
                "problematic_pods": []
            }

        problematic_pods = []
        total_pods = 0
        running_pods = 0
        failed_pods = 0
        
        for item in data.get("items", []):
            total_pods += 1
            metadata = item.get("metadata", {})
            name = metadata.get("name", "unknown")
            namespace = metadata.get("namespace", "default")
            status_obj = item.get("status", {})
            
            phase = status_obj.get("phase", "Unknown")
            
            pod_healthy = True
            reason = ""
            
            if phase in ["Failed", "Pending"]:
                pod_healthy = False
                reason = phase
            
            # Inspect container statuses for detailed failure modes
            container_statuses = status_obj.get("containerStatuses", [])
            for c_status in container_statuses:
                state = c_status.get("state", {})
                
                # Check waiting states
                if "waiting" in state:
                    waiting_reason = state["waiting"].get("reason", "")
                    if waiting_reason in [
                        "CrashLoopBackOff", 
                        "ImagePullBackOff", 
                        "ErrImagePull", 
                        "ContainerCreating", 
                        "CreateContainerConfigError",
                        "CreateContainerError"
                    ]:
                        pod_healthy = False
                        reason = waiting_reason
                        break
                
                # Check terminated states
                elif "terminated" in state:
                    term_reason = state["terminated"].get("reason", "")
                    exit_code = state["terminated"].get("exitCode", 0)
                    if term_reason == "OOMKilled":
                        pod_healthy = False
                        reason = "OOMKilled"
                        break
                    elif exit_code != 0 or term_reason in ["Error", "ContainerCannotRun"]:
                        pod_healthy = False
                        reason = term_reason or f"Error (Exit Code {exit_code})"
                        break
                        
            if not pod_healthy:
                failed_pods += 1
                problematic_pods.append({
                    "name": name,
                    "namespace": namespace,
                    "status": reason or phase,
                    "phase": phase
                })
            else:
                running_pods += 1

        is_cluster_pods_healthy = len(problematic_pods) == 0

        return {
            "success": True,
            "healthy": is_cluster_pods_healthy,
            "total_pods": total_pods,
            "running_pods": running_pods,
            "failed_pods": failed_pods,
            "problematic_pods": problematic_pods
        }
