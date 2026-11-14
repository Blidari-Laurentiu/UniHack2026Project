from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    DATABASE_URL: str = ""
    AUTH0_DOMAIN: str = ""
    AUTH0_AUDIENCE: str = ""
    # Account settings (routers/account.py). A Machine to Machine application authorised
    # for the Auth0 Management API with the scopes read:authentication_methods,
    # delete:authentication_methods and delete:users. Unset: turning 2FA off and deleting an
    # account answer 503 (deleting still works for dev users, who have no Auth0 account).
    AUTH0_MGMT_CLIENT_ID: str = ""
    AUTH0_MGMT_CLIENT_SECRET: str = ""
    # The database (email + password) connection, for the "change password" email.
    AUTH0_DB_CONNECTION: str = "Username-Password-Authentication"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    DEMO_CACHE: bool = False
    CORS_ORIGINS: str = "http://localhost:5173"
    # Outgoing email (student verification codes). MAIL_FROM is "Name <address>".
    # BREVO_API_KEY set: sent through Brevo's HTTPS API (works on Render's free plan, which
    # blocks SMTP ports). Otherwise SMTP_HOST (port 465 = SSL, other ports = STARTTLS).
    # Neither: in dev the code is written to the server log, elsewhere sending fails (503).
    MAIL_FROM: str = ""
    BREVO_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    # Fail closed: the X-Dev-User bypass, seeding and reset need an explicit APP_ENV=dev.
    APP_ENV: str = "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
