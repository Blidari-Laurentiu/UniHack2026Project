from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    DATABASE_URL: str = ""
    AUTH0_DOMAIN: str = ""
    AUTH0_AUDIENCE: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    DEMO_CACHE: bool = False
    CORS_ORIGINS: str = "http://localhost:5173"
    # Outgoing email (student verification codes). Port 465 uses SSL, anything else STARTTLS.
    # Unset SMTP_HOST: in dev the code is written to the server log, elsewhere sending fails (503).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    # Fail closed: the X-Dev-User bypass, seeding and reset need an explicit APP_ENV=dev.
    APP_ENV: str = "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
