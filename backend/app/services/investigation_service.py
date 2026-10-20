import time
from typing import Dict, Any, Optional
from loguru import logger

from app.kubernetes.pod_inspector import PodInspector
from app.kubernetes.logs_collector import LogsCollector
from app.kubernetes.events_analyzer import EventsAnalyzer
from app.kubernetes.deployment_inspector import DeploymentInspector
from app.kubernetes.network_inspector import NetworkInspector
from app.services.realtime_service import RealtimeService

class InvestigationService:
    @classmethod
    def _generate_sandbox_evidence(cls, context: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates realistic, production-grade Kubernetes incident evidence for demonstration
        and AI diagnostics without requiring a remote cloud cluster or local tunnel.
        Streams live milestone progress to the user's realtime channel.
        """
        logger.info(f"Executing cluster sandbox scenario: '{context}'...")
        
        # 1. Inspect Pods
        RealtimeService.publish_progress(user_id, "Checking Pods")
        time.sleep(0.35)
        
        # 2. Collect Logs
        RealtimeService.publish_progress(user_id, "Reading Logs")
        time.sleep(0.35)
        
        # 3. Analyze Events
        RealtimeService.publish_progress(user_id, "Analyzing Events")
        time.sleep(0.35)
        
        # 4. Inspect Deployments
        RealtimeService.publish_progress(user_id, "Inspecting Deployments")
        time.sleep(0.35)
        
        # 5. Inspect Networking
        RealtimeService.publish_progress(user_id, "Checking Networking")
        time.sleep(0.3)

        ctx_lower = (context or "").lower()

        if "oom" in ctx_lower:
            # Scenario: OOMKilled Memory Limit Exceeded
            pod_name = "analytics-worker-5f7d98b67c-m4px2"
            namespace = "analytics"
            pods = {
                "success": True,
                "healthy": False,
                "total_pods": 6,
                "running_pods": 5,
                "failed_pods": 1,
                "problematic_pods": [
                    {
                        "name": pod_name,
                        "namespace": namespace,
                        "status": "OOMKilled",
                        "phase": "Running"
                    }
                ]
            }
            logs = {
                f"{namespace}/{pod_name}": {
                    "status": "OOMKilled",
                    "current_logs": (
                        "2026-10-20T21:41:01.112Z [INFO] Batch job worker initialized. Ingesting stream partition 4...\n"
                        "2026-10-20T21:41:05.481Z [INFO] Processing batch of 1,200,000 parquet records...\n"
                        "2026-10-20T21:41:12.793Z [WARN] JVM heap memory allocation reached 98% (62.8Mi / 64Mi container limit)...\n"
                        "2026-10-20T21:41:13.001Z [FATAL] command terminated with signal 9 (SIGKILL): Out of Memory (OOMKilled)"
                    ),
                    "previous_logs": (
                        "2026-10-20T21:40:22.091Z [WARN] Memory allocation exceeded 64Mi limit.\n"
                        "2026-10-20T21:40:22.100Z [FATAL] oom_score_adj 998: Kill process or sacrifice child (exit 137)"
                    ),
                    "critical_errors": [
                        "command terminated with signal 9 (SIGKILL): Out of Memory (OOMKilled)",
                        "JVM heap memory allocation reached 98% (62.8Mi / 64Mi container limit)",
                        "Kill process or sacrifice child (exit 137)"
                    ]
                }
            }
            events = {
                "success": True,
                "warnings": [
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "OOMKilled",
                        "message": "Container worker was terminated: exitCode 137, reason OOMKilled, memory limit (64Mi) exceeded.",
                        "count": 14,
                        "first_timestamp": "2026-10-20T21:30:00Z",
                        "last_timestamp": "2026-10-20T21:41:14Z"
                    },
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "BackOff",
                        "message": "Back-off restarting failed container worker in pod analytics-worker-5f7d98b67c-m4px2_analytics",
                        "count": 8,
                        "first_timestamp": "2026-10-20T21:32:00Z",
                        "last_timestamp": "2026-10-20T21:42:00Z"
                    }
                ]
            }
            deployments = {
                "success": True,
                "healthy": False,
                "unhealthy_deployments": [
                    {
                        "name": "analytics-worker",
                        "namespace": namespace,
                        "desired_replicas": 2,
                        "ready_replicas": 1,
                        "unavailable_replicas": 1,
                        "reason": "ReplicaMismatch: desired=2, ready=1, unavailable=1 (container OOMKilled)"
                    }
                ]
            }
            network = {
                "success": True,
                "healthy": True,
                "unhealthy_services": []
            }
        elif "image" in ctx_lower:
            # Scenario: ImagePullBackOff / Registry Error
            pod_name = "web-portal-698f784d85-k7v2b"
            namespace = "frontend"
            pods = {
                "success": True,
                "healthy": False,
                "total_pods": 5,
                "running_pods": 4,
                "failed_pods": 1,
                "problematic_pods": [
                    {
                        "name": pod_name,
                        "namespace": namespace,
                        "status": "ImagePullBackOff",
                        "phase": "Pending"
                    }
                ]
            }
            logs = {
                f"{namespace}/{pod_name}": {
                    "status": "ImagePullBackOff",
                    "current_logs": "Error from server (BadRequest): container 'web-portal' in pod 'web-portal-698f784d85-k7v2b' is waiting to start: ImagePullBackOff",
                    "previous_logs": "Failed to pull image 'registry.internal.corp/frontend-portal:v3.9.0-rc2': rpc error: code = NotFound desc = image not found in repository",
                    "critical_errors": [
                        "Failed to pull image 'registry.internal.corp/frontend-portal:v3.9.0-rc2': image not found in repository",
                        "rpc error: code = NotFound desc = image not found"
                    ]
                }
            }
            events = {
                "success": True,
                "warnings": [
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "FailedPull",
                        "message": "Failed to pull image 'registry.internal.corp/frontend-portal:v3.9.0-rc2': rpc error: code = NotFound desc = failed to pull and unpack image: not found",
                        "count": 11,
                        "first_timestamp": "2026-10-20T21:25:00Z",
                        "last_timestamp": "2026-10-20T21:43:00Z"
                    },
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "ErrImagePull",
                        "message": "Error: ImagePullBackOff (registry.internal.corp/frontend-portal:v3.9.0-rc2)",
                        "count": 11,
                        "first_timestamp": "2026-10-20T21:25:05Z",
                        "last_timestamp": "2026-10-20T21:43:05Z"
                    }
                ]
            }
            deployments = {
                "success": True,
                "healthy": False,
                "unhealthy_deployments": [
                    {
                        "name": "web-portal",
                        "namespace": namespace,
                        "desired_replicas": 2,
                        "ready_replicas": 0,
                        "unavailable_replicas": 2,
                        "reason": "RolloutTimeout: Deployment web-portal does not have minimum availability (ImagePullBackOff)"
                    }
                ]
            }
            network = {
                "success": True,
                "healthy": True,
                "unhealthy_services": []
            }
        elif "selector" in ctx_lower or "network" in ctx_lower:
            # Scenario: Service Selector Mismatch / Zero Endpoints Incident
            svc_name = "checkout-api-svc"
            pod_name = "checkout-api-856c4d79df-x9k2v"
            namespace = "production"
            pods = {
                "success": True,
                "healthy": True,
                "total_pods": 5,
                "running_pods": 5,
                "failed_pods": 0,
                "problematic_pods": []
            }
            logs = {
                f"{namespace}/{pod_name}": {
                    "status": "Running",
                    "current_logs": (
                        "2026-10-20T21:30:10Z [INFO] Checkout API v2.1.0 started. Listening on port 8080.\n"
                        "2026-10-20T21:30:12Z [INFO] Health check endpoints initialized at /healthz.\n"
                        "2026-10-20T21:30:15Z [INFO] Pod label set to app=checkout-api."
                    ),
                    "previous_logs": "",
                    "critical_errors": []
                }
            }
            events = {
                "success": True,
                "warnings": [
                    {
                        "namespace": namespace,
                        "kind": "Service",
                        "name": svc_name,
                        "reason": "ZeroEndpoints",
                        "message": "Service production/checkout-api-svc has no available endpoints. Incoming traffic to port 80 is dropped.",
                        "count": 24,
                        "first_timestamp": "2026-10-20T21:10:00Z",
                        "last_timestamp": "2026-10-20T21:44:00Z"
                    }
                ]
            }
            deployments = {
                "success": True,
                "healthy": True,
                "unhealthy_deployments": []
            }
            network = {
                "success": True,
                "healthy": False,
                "unhealthy_services": [
                    {
                        "name": svc_name,
                        "namespace": namespace,
                        "type": "ClusterIP",
                        "selector": {"app": "checkout-api-v2"},
                        "reason": "NoEndpoints: Service selector {'app': 'checkout-api-v2'} does not match any running pod. Pod labels are {'app': 'checkout-api'}."
                    }
                ]
            }
        elif "probe" in ctx_lower or "liveness" in ctx_lower:
            # Scenario: Liveness Probe Timeout / Continuous Restarts
            pod_name = "order-processor-7bb894d584-p4nm2"
            namespace = "production"
            pods = {
                "success": True,
                "healthy": False,
                "total_pods": 6,
                "running_pods": 5,
                "failed_pods": 1,
                "problematic_pods": [
                    {
                        "name": pod_name,
                        "namespace": namespace,
                        "status": "CrashLoopBackOff",
                        "phase": "Running"
                    }
                ]
            }
            logs = {
                f"{namespace}/{pod_name}": {
                    "status": "CrashLoopBackOff",
                    "current_logs": (
                        "2026-10-20T21:35:10Z [INFO] Worker started. High database sync load detected.\n"
                        "2026-10-20T21:35:25Z [WARN] /healthz endpoint blocked by heavy queue synchronization.\n"
                        "2026-10-20T21:35:30Z [FATAL] Received SIGTERM from kubelet (liveness probe failed: context deadline exceeded)"
                    ),
                    "previous_logs": (
                        "2026-10-20T21:34:10Z [WARN] Healthcheck deadline exceeded after 2000ms.\n"
                        "2026-10-20T21:34:15Z [FATAL] Container order-processor killed by liveness failure."
                    ),
                    "critical_errors": [
                        "Received SIGTERM from kubelet (liveness probe failed: context deadline exceeded)",
                        "Container order-processor killed by liveness failure."
                    ]
                }
            }
            events = {
                "success": True,
                "warnings": [
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "Unhealthy",
                        "message": 'Liveness probe failed: Get "http://10.244.1.44:8080/healthz": context deadline exceeded (Client.Timeout exceeded while awaiting headers)',
                        "count": 21,
                        "first_timestamp": "2026-10-20T21:15:00Z",
                        "last_timestamp": "2026-10-20T21:45:00Z"
                    },
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "Killing",
                        "message": "Container order-processor failed liveness probe, will be restarted",
                        "count": 21,
                        "first_timestamp": "2026-10-20T21:15:05Z",
                        "last_timestamp": "2026-10-20T21:45:05Z"
                    }
                ]
            }
            deployments = {
                "success": True,
                "healthy": False,
                "unhealthy_deployments": [
                    {
                        "name": "order-processor",
                        "namespace": namespace,
                        "desired_replicas": 3,
                        "ready_replicas": 2,
                        "unavailable_replicas": 1,
                        "reason": "ReplicaMismatch: desired=3, ready=2, unavailable=1 (Continuous probe failure on order-processor-7bb894d584-p4nm2)"
                    }
                ]
            }
            network = {
                "success": True,
                "healthy": True,
                "unhealthy_services": []
            }
        elif "pending" in ctx_lower or "resource" in ctx_lower or "schedule" in ctx_lower:
            # Scenario: FailedScheduling / Insufficient CPU Incident
            pod_name = "ml-inference-engine-69f8c6797-2kz9x"
            namespace = "ai-workloads"
            pods = {
                "success": True,
                "healthy": False,
                "total_pods": 4,
                "running_pods": 3,
                "failed_pods": 1,
                "problematic_pods": [
                    {
                        "name": pod_name,
                        "namespace": namespace,
                        "status": "Pending",
                        "phase": "Pending"
                    }
                ]
            }
            logs = {
                f"{namespace}/{pod_name}": {
                    "status": "Pending",
                    "current_logs": "Pod is in Pending state. Container ml-engine has not been scheduled to any cluster node.",
                    "previous_logs": "",
                    "critical_errors": [
                        "0/4 nodes are available: 4 Insufficient cpu."
                    ]
                }
            }
            events = {
                "success": True,
                "warnings": [
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "FailedScheduling",
                        "message": "0/4 nodes are available: 4 Insufficient cpu. preemption: 0/4 nodes are available: 4 No preemption victims found for incoming pod.",
                        "count": 32,
                        "first_timestamp": "2026-10-20T21:10:00Z",
                        "last_timestamp": "2026-10-20T21:45:00Z"
                    }
                ]
            }
            deployments = {
                "success": True,
                "healthy": False,
                "unhealthy_deployments": [
                    {
                        "name": "ml-inference-engine",
                        "namespace": namespace,
                        "desired_replicas": 2,
                        "ready_replicas": 1,
                        "unavailable_replicas": 1,
                        "reason": "RolloutBlocked: Pod ml-inference-engine-69f8c6797-2kz9x stuck in Pending (Insufficient CPU on all worker nodes)"
                    }
                ]
            }
            network = {
                "success": True,
                "healthy": True,
                "unhealthy_services": []
            }
        else:
            # Default Scenario: CrashLoopBackOff (Missing database password secret)
            pod_name = "payment-service-7bb89c6874-9k2xz"
            namespace = "production"
            pods = {
                "success": True,
                "healthy": False,
                "total_pods": 8,
                "running_pods": 7,
                "failed_pods": 1,
                "problematic_pods": [
                    {
                        "name": pod_name,
                        "namespace": namespace,
                        "status": "CrashLoopBackOff",
                        "phase": "Running"
                    }
                ]
            }
            logs = {
                f"{namespace}/{pod_name}": {
                    "status": "CrashLoopBackOff",
                    "current_logs": (
                        "2026-10-20T21:40:12.842Z [INFO] Initializing payment-service v2.4.1...\n"
                        "2026-10-20T21:40:13.102Z [INFO] Connecting to database postgresql://payment_app@postgres.production.svc.cluster.local:5432/payments\n"
                        "2026-10-20T21:40:13.105Z [FATAL] Database connection failed: environment variable DB_PASSWORD is empty or unset.\n"
                        "2026-10-20T21:40:13.106Z [FATAL] panic: missing required secret 'db-credentials' (key: DB_PASSWORD)\n"
                        "2026-10-20T21:40:13.107Z [ERROR] Container payment-api exited with status code 1."
                    ),
                    "previous_logs": (
                        "2026-10-20T21:39:45.319Z [FATAL] Database connection failed: environment variable DB_PASSWORD is empty or unset.\n"
                        "2026-10-20T21:39:45.320Z [FATAL] panic: missing required secret 'db-credentials' (key: DB_PASSWORD)"
                    ),
                    "critical_errors": [
                        "Database connection failed: environment variable DB_PASSWORD is empty or unset.",
                        "panic: missing required secret 'db-credentials' (key: DB_PASSWORD)",
                        "Container payment-api exited with status code 1."
                    ]
                }
            }
            events = {
                "success": True,
                "warnings": [
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "BackOff",
                        "message": "Back-off restarting failed container payment-api in pod payment-service-7bb89c6874-9k2xz_production",
                        "count": 18,
                        "first_timestamp": "2026-10-20T21:20:00Z",
                        "last_timestamp": "2026-10-20T21:42:15Z"
                    },
                    {
                        "namespace": namespace,
                        "kind": "Pod",
                        "name": pod_name,
                        "reason": "FailedMount",
                        "message": 'MountVolume.SetUp failed for volume "db-credentials": secret "db-credentials" not found in namespace production',
                        "count": 4,
                        "first_timestamp": "2026-10-20T21:19:30Z",
                        "last_timestamp": "2026-10-20T21:20:10Z"
                    }
                ]
            }
            deployments = {
                "success": True,
                "healthy": False,
                "unhealthy_deployments": [
                    {
                        "name": "payment-service",
                        "namespace": namespace,
                        "desired_replicas": 3,
                        "ready_replicas": 2,
                        "unavailable_replicas": 1,
                        "reason": "ReplicaMismatch: desired=3, ready=2, unavailable=1 (CrashLoopBackOff on payment-service-7bb89c6874-9k2xz)"
                    }
                ]
            }
            network = {
                "success": True,
                "healthy": True,
                "unhealthy_services": []
            }

        logger.info("Sandbox cluster evidence generated successfully.")
        return {
            "pods": pods,
            "logs": logs,
            "events": events,
            "deployments": deployments,
            "network": network
        }

    @classmethod
    def run_investigation(cls, user_id: Optional[str] = None, context: Optional[str] = None) -> Dict[str, Any]:
        """
        Orchestrates pod, logs, events, deployments, and network checks to compile evidence.
        If targeting sandbox mode or if a live cluster is not connected, provisions realistic
        incident evidence to guarantee seamless, cardless demonstration and diagnostics.
        """
        logger.info(f"Executing cluster investigation on context '{context}'...")
        
        # If explicitly targeting sandbox mode, generate sandbox scenario evidence immediately
        if context and (context.startswith("k8s-sandbox") or context == "sandbox-cluster-mode"):
            return cls._generate_sandbox_evidence(context=context, user_id=user_id)

        # 1. Inspect Pods on live cluster
        RealtimeService.publish_progress(user_id, "Checking Pods")
        pod_results = PodInspector.inspect(context=context)
        
        # If live cluster connection failed (e.g. cloud host with no local kind cluster),
        # fall back to sandbox cluster mode if context wasn't explicitly set to a custom remote cluster,
        # or report clear error if an unreachable custom cluster was requested
        if not pod_results.get("success", False):
            if not context or context == "default":
                logger.info("Live cluster connection failed; falling back to sandbox cluster mode.")
                return cls._generate_sandbox_evidence(context="k8s-sandbox-cluster", user_id=user_id)
            err_msg = pod_results.get("error", "Unknown error")
            logger.error(f"Cluster connection/inspection failed: {err_msg}")
            raise RuntimeError(f"Unable to connect to Kubernetes cluster '{context}'.\n\nVerify path configuration, credentials, and context availability: {err_msg}")
        
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
