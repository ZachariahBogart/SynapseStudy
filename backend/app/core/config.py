from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data"


def _normalize_origin(value: str) -> str:
    return value.strip().strip("'\"").rstrip("/")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AI_STUDY_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Synapse Study API"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{(DATA_DIR / 'study.db').as_posix()}"
    storage_dir: Path = DATA_DIR / "uploads"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    use_background_worker: bool = False
    redis_url: str | None = None
    default_user_id: str = "demo-student"
    default_user_name: str = "Demo Student"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if value is None:
            return value

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                return [_normalize_origin(part) for part in raw.split(",") if _normalize_origin(part)]

            if isinstance(parsed, str):
                return [_normalize_origin(parsed)] if _normalize_origin(parsed) else []
            if isinstance(parsed, list):
                return [_normalize_origin(item) for item in parsed if isinstance(item, str) and _normalize_origin(item)]
            raise ValueError("AI_STUDY_CORS_ORIGINS must be a string or list of strings.")

        if isinstance(value, (list, tuple, set)):
            return [_normalize_origin(item) for item in value if isinstance(item, str) and _normalize_origin(item)]

        return value


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
