import httpx
import asyncio
from loguru import logger
from app.core.config import settings

class LLMClient:
    API_URL = "https://openrouter.ai/api/v1/chat/completions"

    @classmethod
    async def call_llm(cls, system_prompt: str, user_prompt: str) -> str:
        """
        Calls OpenRouter chat completion API asynchronously with retry logic and timeout.
        """
        api_key = settings.OPENROUTER_API_KEY
        model = settings.OPENROUTER_MODEL or "meta-llama/llama-3-70b-instruct"

        if not api_key:
            logger.error("OPENROUTER_API_KEY is not configured in settings.")
            return '{"error": "OPENROUTER_API_KEY is missing. Please configure it in your backend .env file."}'

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "AI Kubernetes Agent"
        }

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": { "type": "json_object" },
            "max_tokens": 1200
        }

        max_retries = 3
        backoff_factor = 2.0
        timeout = 60.0

        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"Sending request to OpenRouter ({model}) - Attempt {attempt}/{max_retries}...")
                
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        cls.API_URL,
                        headers=headers,
                        json=payload
                    )
                    response.raise_for_status()
                    
                    data = response.json()
                    choices = data.get("choices", [])
                    if not choices:
                        logger.error(f"Empty choices returned from OpenRouter: {data}")
                        raise ValueError("No completions returned in API response.")
                        
                    content = choices[0].get("message", {}).get("content", "")
                    logger.info("Successfully received response from OpenRouter.")
                    return content

            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                logger.error(f"HTTP error {status_code} on attempt {attempt}: {e.response.text}")
                if status_code in [400, 401, 403, 404] and status_code != 429:
                    import json
                    error_msg = f"OpenRouter API request failed with status {status_code}: {e.response.text}"
                    return json.dumps({"error": error_msg})
            except (httpx.RequestError, ValueError) as e:
                logger.error(f"Request/Parsing error on attempt {attempt}: {str(e)}")
            
            if attempt < max_retries:
                sleep_time = backoff_factor ** attempt
                logger.warning(f"Retrying in {sleep_time} seconds...")
                await asyncio.sleep(sleep_time)

        logger.error("Max retries exceeded for OpenRouter request.")
        return '{"error": "Failed to connect to OpenRouter after maximum retry attempts. Please check network status."}'
