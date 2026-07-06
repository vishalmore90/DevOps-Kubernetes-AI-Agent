import httpx
from loguru import logger
from app.core.config import settings

class RealtimeService:
    @classmethod
    def publish_progress(cls, user_id: str, step: str, status: str = "active") -> bool:
        """
        Publishes an SRE investigation progress step to the user's realtime channel.
        Uses InsForge database-triggered realtime socket events.
        """
        if not user_id:
            logger.warning("No user_id provided. Skipping progress event publish.")
            return False

        url = f"{settings.INSFORGE_API_BASE_URL}/api/database/records/progress_events"
        headers = {
            "Authorization": f"Bearer {settings.INSFORGE_API_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        channel = f"investigation:{user_id}"
        payload = {
            "channel": channel,
            "event": "progress",
            "payload": {
                "step": step,
                "status": status
            }
        }
        
        try:
            logger.info(f"Publishing progress event to realtime channel {channel}: '{step}'...")
            response = httpx.post(url, headers=headers, json=payload, timeout=5)
            if response.status_code in [200, 201]:
                logger.debug(f"Progress event successfully published: {response.text}")
                return True
            else:
                logger.error(f"Failed to publish progress event. Status: {response.status_code}. Body: {response.text}")
                return False
        except Exception as e:
            logger.exception(f"Error publishing progress event to InsForge: {e}")
            return False
