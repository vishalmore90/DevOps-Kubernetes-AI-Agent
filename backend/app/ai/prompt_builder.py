import json
from typing import Dict, Any

class PromptBuilder:
    @staticmethod
    def build_system_prompt() -> str:
        return (
            "You are a Senior Kubernetes Site Reliability Engineer (SRE) troubleshooting a cluster incident.\n"
            "You will be given structured cluster evidence containing metrics and configurations from Pods, Logs, Events, Deployments, and Networking.\n\n"
            "Your objective is to identify any root causes of failures, explain the issue, and provide specific, actionable remediation steps.\n\n"
            "You MUST respond ONLY with a valid JSON object matching the following structure:\n"
            "{\n"
            '  "root_cause": "A concise, single-sentence summary of the main failure mechanism (e.g. Missing DATABASE_URL env var)",\n'
            '  "explanation": "A detailed explanation of the issue, correlating pod states, log traces, event warnings, and service configuration mismatch findings.",\n'
            '  "fix": "Actionable, beginner-friendly instructions on how to resolve the problem.",\n'
            '  "kubectl_command": "The exact, copy-pasteable kubectl command(s) needed to fix the issue (e.g. kubectl set env deployment/payment-service DATABASE_URL=...) or inspect further.",\n'
            '  "prevention": "A recommended best practice to prevent this issue from recurring in the future (e.g. using liveness probes or Helm values validation).",\n'
            '  "confidence": 95\n'
            "}\n\n"
            "Rules:\n"
            "1. The confidence score MUST be an integer between 0 and 100. Base it strictly on how clear the evidence is. For example, if logs explicitly show a database connection error, confidence should be high (90%+). If there are no failures and the cluster is healthy, explain that everything is operating normally and set confidence to 100.\n"
            "2. DO NOT return markdown wrappers like ```json ... ```. Just return raw JSON string.\n"
            "3. Make sure all JSON strings are properly escaped.\n"
            "4. Never suggest generic or vague solutions."
        )

    @staticmethod
    def build_user_prompt(evidence: Dict[str, Any]) -> str:
        # Prune large logs to prevent exceeding prompt token limits
        clean_evidence = cls_prune_large_fields(evidence)
        return (
            f"Here is the collected Kubernetes cluster evidence:\n\n"
            f"```json\n"
            f"{json.dumps(clean_evidence, indent=2)}\n"
            f"```\n\n"
            f"Please analyze the evidence and provide the SRE incident report JSON."
        )

def cls_prune_large_fields(evidence: Dict[str, Any]) -> Dict[str, Any]:
    """
    Helper function to prune extremely long log outputs to protect token limits
    while preserving the critical logs and errors.
    """
    pruned = json.loads(json.dumps(evidence)) # deep copy
    
    logs = pruned.get("logs", {})
    for pod_key, log_report in logs.items():
        current_logs = log_report.get("current_logs", "")
        if len(current_logs) > 3000:
            log_report["current_logs"] = current_logs[:1500] + "\n... [TRUNCATED FOR LENGTH] ...\n" + current_logs[-1500:]
            
        prev_logs = log_report.get("previous_logs", "")
        if len(prev_logs) > 3000:
            log_report["previous_logs"] = prev_logs[:1500] + "\n... [TRUNCATED FOR LENGTH] ...\n" + prev_logs[-1500:]
            
    return pruned
