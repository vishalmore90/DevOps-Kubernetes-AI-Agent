from typing import Dict, Any
from loguru import logger

from app.kubernetes.pod_inspector import PodInspector
from app.kubernetes.logs_collector import LogsCollector
from app.kubernetes.events_analyzer import EventsAnalyzer
from app.kubernetes.deployment_inspector import DeploymentInspector
from app.kubernetes.network_inspector import NetworkInspector
from app.services.realtime_service import RealtimeService

class InvestigationService:
    @staticmethod
    def run_investigation(user_id: str = None, context: str = None) -> Dict[str, Any]:
        """
        Orchestrates pod, logs, events, deployments, and network checks to compile evidence.
        """
        logger.info(f"Executing cluster investigation on context '{context}'...")
        
        # 1. Inspect Pods
        RealtimeService.publish_progress(user_id, "Checking Pods")
        pod_results = PodInspector.inspect(context=context)
        
        # Early fail-fast if cluster connectivity or kubectl command failed
        if not pod_results.get("success", False):
            err_msg = pod_results.get("error", "Unknown error")
            logger.error(f"Cluster connection/inspection failed: {err_msg}")
            raise RuntimeError(f"Unable to connect to Kubernetes cluster.\n\nVerify path configuration, credentials, and context availability: {err_msg}")
        
        # 2. Collect Logs for problematic pods
        RealtimeService.publish_progress(user_id, "Reading Logs")
        problematic_pods = pod_results.get("problematic_pods", [])
        log_results = {}
        if problematic_pods:
            log_results = LogsCollector.collect(problematic_pods, context=context)
            
        # 3. Analyze Events
        RealtimeService.publish_progress(user_id, "Analyzing Events")
        event_results = EventsAnalyzer.analyze(context=context)
        
        # 4. Inspect Deployments
        RealtimeService.publish_progress(user_id, "Inspecting Deployments")
        deploy_results = DeploymentInspector.inspect(context=context)
        
        # 5. Inspect Networking
        RealtimeService.publish_progress(user_id, "Checking Networking")
        net_results = NetworkInspector.inspect(context=context)
        
        logger.info("Cluster investigation complete. Packaging evidence...")
        
        return {
            "pods": pod_results,
            "logs": log_results,
            "events": event_results,
            "deployments": deploy_results,
            "network": net_results
        }
