from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3-8b-instruct:free"
    KUBECONFIG_PATH: str = "~/.kube/config"
    INSFORGE_API_KEY: str = "ik_d00007395929e6bfe04e718b413df5bf"
    INSFORGE_API_BASE_URL: str = "https://69gizjai.ap-southeast.insforge.app"
    
    # API Configurations
    API_PREFIX: str = "/api/v1"
    
    # CORS Origins
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
