from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ZE-Ticket"
    APP_ENV: str = "development"
    APP_URL: str = "https://support.z-evolutions.de"

    # Datenbank
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # Elasticsearch
    ELASTICSEARCH_URL: str

    # JWT Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Mail (SMTP)
    SMTP_HOST: str
    SMTP_PORT: int = 465
    SMTP_USER: str
    SMTP_PASSWORD: str
    SMTP_FROM: str
    SMTP_FROM_NAME: str = "ZE-Ticket Support"
    SMTP_SSL: bool = True

    # Mail (IMAP)
    IMAP_HOST: str
    IMAP_PORT: int = 993
    IMAP_USER: str
    IMAP_PASSWORD: str

    class Config:
        env_file = ".env"
        case_sensitive = True


# Singleton — wird überall per Import genutzt
settings = Settings()
