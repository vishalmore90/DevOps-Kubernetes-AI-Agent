from typing import Dict, List, Any, Optional
from loguru import logger
from app.kubernetes.kubectl_executor import KubectlExecutor

class LogsCollector:
    KEYWORDS = ["exception", "error", "fail", "missing", "conn", "refused", "timeout", "fatal", "crash"]

    @classmethod
    def collect(cls, problematic_pods: List[Dict[str, Any]], context: Optional[str] = None) -> Dict[str, Any]:
        """
        Collects logs for problematic pods. For each, gathers logs (and previous run logs if crashed).
        Filters for critical keyword events to keep it concise.
        """
        logger.info(f"Starting Logs Collection for {len(problematic_pods)} pods...")
        results = {}

        for pod in problematic_pods:
            name = pod["name"]
            namespace = pod["namespace"]
            status = pod["status"]
            
            pod_key = f"{namespace}/{name}"
            results[pod_key] = {
                "status": status,
                "current_logs": "",
                "previous_logs": "",
                "critical_errors": []
            }
            
            # Fetch current tail logs
            success, stdout, stderr = KubectlExecutor.run_command([
                "logs", name,
                "-n", namespace,
                "--tail=100"
            ], context=context)
            
            if success:
                results[pod_key]["current_logs"] = stdout
                results[pod_key]["critical_errors"].extend(cls._extract_errors(stdout))
            else:
                results[pod_key]["current_logs"] = f"Failed to get current logs: {stderr}"
                
            # Fetch previous terminated logs if pod has restarted/crashed
            if status in ["CrashLoopBackOff", "OOMKilled", "Error", "ContainerCannotRun"] or "Exit" in status:
                success_p, stdout_p, stderr_p = KubectlExecutor.run_command([
                    "logs", name,
                    "-n", namespace,
                    "--tail=100",
                    "-p"
                ], context=context)
                if success_p:
                    results[pod_key]["previous_logs"] = stdout_p
                    results[pod_key]["critical_errors"].extend(cls._extract_errors(stdout_p))

            # Deduplicate critical errors
            results[pod_key]["critical_errors"] = list(set(results[pod_key]["critical_errors"]))
            
        return results

    @classmethod
    def _extract_errors(cls, log_text: str) -> List[str]:
        """
        Scan log lines for errors/exceptions to compile a list of highlights.
        """
        critical_lines = []
        if not log_text or "Failed to get current logs" in log_text:
            return critical_lines

        for line in log_text.splitlines():
            line_lower = line.lower()
            if any(kw in line_lower for kw in cls.KEYWORDS):
                trimmed = line.strip()
                if len(trimmed) > 150:
                    trimmed = trimmed[:147] + "..."
                critical_lines.append(trimmed)

        # Return up to top 10 unique matches
        return list(dict.fromkeys(critical_lines))[:10]
