import json
import re
from typing import Dict, Any
from loguru import logger

from app.ai.prompt_builder import PromptBuilder
from app.ai.llm_client import LLMClient

async def run_ai_diagnose(evidence: Dict[str, Any]) -> Dict[str, Any]:
    """
    Runs SRE cluster diagnostics by calling OpenRouter LLM, parses findings, and returns root cause + fix.
    """
    logger.info("Initializing AI reasoning agent...")
    
    # 1. Build prompts
    system_prompt = PromptBuilder.build_system_prompt()
    user_prompt = PromptBuilder.build_user_prompt(evidence)
    
    # 2. Call LLM
    raw_response = await LLMClient.call_llm(system_prompt, user_prompt)
    
    # 3. Parse JSON response
    parsed_diagnosis = _parse_llm_json(raw_response)
    
    return parsed_diagnosis

def _parse_llm_json(raw_text: str) -> Dict[str, Any]:
    """
    Parses LLM response string into a structured diagnosis dictionary.
    Handles potential formatting errors or extra markdown markers.
    """
    cleaned_text = raw_text.strip()
    
    # Remove markdown code block markers if present
    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?", "", cleaned_text)
        cleaned_text = re.sub(r"```$", "", cleaned_text)
        cleaned_text = cleaned_text.strip()

    try:
        data = json.loads(cleaned_text)
        
        if "error" in data:
            return {
                "root_cause": "API Connection Failure",
                "explanation": str(data["error"]),
                "fix": "Please configure your active OPENROUTER_API_KEY in backend/.env.",
                "kubectl_command": "kubectl get pods -A",
                "prevention": "Ensure API key configuration is valid.",
                "confidence": 0
            }

        # Ensure all required keys exist
        required_keys = ["root_cause", "explanation", "fix", "kubectl_command", "prevention", "confidence"]
        for key in required_keys:
            if key not in data:
                if key == "confidence":
                    data[key] = 50
                else:
                    data[key] = "Not provided by reasoning engine."
                    
        # Verify confidence is integer
        try:
            data["confidence"] = int(data["confidence"])
        except (ValueError, TypeError):
            data["confidence"] = 75
            
        return data

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from LLM response: {e}. Raw text was: {raw_text}")
        
        if "error" in cleaned_text:
            try:
                err_data = json.loads(cleaned_text)
                return {
                    "root_cause": "API Connection Failure",
                    "explanation": err_data.get("error", "Failed to communicate with OpenRouter API."),
                    "fix": "Please check your OPENROUTER_API_KEY and network connectivity.",
                    "kubectl_command": "kubectl get pods -A",
                    "prevention": "Ensure API key configuration is valid.",
                    "confidence": 0
                }
            except Exception:
                pass
                
        return {
            "root_cause": "Parsing Failure",
            "explanation": f"The AI engine responded, but the output was not in valid JSON format. Raw output: {raw_text[:200]}...",
            "fix": "Retry the investigation or verify the LLM model configurations.",
            "kubectl_command": "kubectl get pods -A",
            "prevention": "Lock the LLM response type to strict JSON structures.",
            "confidence": 0
        }
