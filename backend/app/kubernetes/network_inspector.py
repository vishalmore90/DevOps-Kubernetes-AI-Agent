from typing import Dict, List, Any, Optional
from loguru import logger
from app.kubernetes.kubectl_executor import KubectlExecutor

class NetworkInspector:
    @staticmethod
    def inspect(context: Optional[str] = None) -> Dict[str, Any]:
        """
        Inspects Kubernetes services and endpoints. Identifies selector mismatches or missing endpoints.
        """
        logger.info("Starting Network Inspection...")
        
        success_svc, svc_data, err_svc = KubectlExecutor.run_json_command(["get", "services", "-A"], context=context)
        success_ep, ep_data, err_ep = KubectlExecutor.run_json_command(["get", "endpoints", "-A"], context=context)
        
        if not success_svc or not success_ep:
            err = err_svc or err_ep
            logger.error(f"Network inspection failed to execute: {err}")
            return {
                "success": False,
                "error": err,
                "unhealthy_services": []
            }

        if not svc_data or "items" not in svc_data:
            return {
                "success": True,
                "healthy": True,
                "unhealthy_services": []
            }

        # Build endpoints map for fast lookup: key is namespace/name
        ep_map = {}
        for ep in ep_data.get("items", []):
            meta = ep.get("metadata", {})
            name = meta.get("name", "")
            namespace = meta.get("namespace", "")
            subsets = ep.get("subsets", [])
            
            addresses_count = 0
            for subset in subsets:
                addresses_count += len(subset.get("addresses", []))
                
            ep_map[f"{namespace}/{name}"] = {
                "addresses_count": addresses_count,
                "subsets": subsets
            }

        unhealthy_services = []

        for item in svc_data.get("items", []):
            metadata = item.get("metadata", {})
            name = metadata.get("name", "")
            namespace = metadata.get("namespace", "")
            spec = item.get("spec", {})
            svc_type = spec.get("type", "ClusterIP")
            
            if name == "kubernetes" and namespace == "default":
                continue
                
            selector = spec.get("selector", {})
            
            if svc_type == "ExternalName":
                continue
                
            svc_key = f"{namespace}/{name}"
            ep_info = ep_map.get(svc_key)
            
            is_unhealthy = False
            reason = ""
            
            if selector:
                if not ep_info or ep_info["addresses_count"] == 0:
                    is_unhealthy = True
                    reason = "MissingEndpoints: selector exists but no backing pods are active/running"

            if is_unhealthy:
                unhealthy_services.append({
                    "name": name,
                    "namespace": namespace,
                    "type": svc_type,
                    "selector": selector,
                    "reason": reason
                })

        return {
            "success": True,
            "healthy": len(unhealthy_services) == 0,
            "unhealthy_services": unhealthy_services
        }
