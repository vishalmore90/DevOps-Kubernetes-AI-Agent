from typing import Union, List
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o"
    KUBECONFIG_PATH: str = "~/.kube/config"
    INSFORGE_API_KEY: str = ""
    INSFORGE_API_BASE_URL: str = "https://xq2heej9.ap-southeast.insforge.app"
    
    # API Configurations
    API_PREFIX: str = "/api/v1"
    
    # CORS Origins
    ALLOWED_ORIGINS: Union[str, List[str]] = ["http://localhost:3000", "http://127.0.0.1:3000", "*"]

    @field_validator("ALLOWED_ORIGINS", mode="after")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
