import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Basic app settings
    APP_NAME: str = "Apple Music API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # API settings
    API_PREFIX: str = "/api"
    BACKEND_DOMAIN: str = "applemusic-api.example.com"
    FRONTEND_DOMAIN: str = "applemusic.example.com"
    
    # Cloudflare Turnstile settings
    TURNSTILE_SECRET_KEY: str = "example-turnstile-secret-key"
    TURNSTILE_VERIFY_URL: str = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    TURNSTILE_SESSION_EXPIRE: int = 100  # Seconds
    
    # Apple Music settings
    COOKIES_PATH: Path = Path(__file__).parent / "apple-music.txt"
    TEMP_DIR: Path = Path(__file__).parent / "temp"
    OUTPUT_DIR: Path = Path(__file__).parent / "downloads"
    
    # Download token settings
    DOWNLOAD_TOKEN_EXPIRE: int = 300  # 5 minutes, in seconds
    PLAY_TOKEN_EXPIRE: int = 300  # 5 minutes, in seconds
    
    # File cleanup settings
    CLEANUP_HOUR: int = 3  # 03:00 in Asia/Shanghai
    CLEANUP_TIMEZONE: str = "Asia/Shanghai"
    
    # CORS settings
    ALLOWED_ORIGINS: list = [
        f"https://{FRONTEND_DOMAIN}",
        f"http://{FRONTEND_DOMAIN}",
        "http://localhost:8787",  # Local Cloudflare Workers development
    ]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Create the global settings instance
settings = Settings()

# Ensure required directories exist
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

