from __future__ import annotations

from app.core.config import Settings


def test_cors_origins_accepts_plain_string() -> None:
    settings = Settings(cors_origins="https://synapse-study.vercel.app")
    assert settings.cors_origins == ["https://synapse-study.vercel.app"]


def test_cors_origins_accepts_json_list() -> None:
    settings = Settings(cors_origins='["https://synapse-study.vercel.app", "https://preview.vercel.app/"]')
    assert settings.cors_origins == [
        "https://synapse-study.vercel.app",
        "https://preview.vercel.app",
    ]


def test_cors_origins_accepts_csv() -> None:
    settings = Settings(cors_origins="https://synapse-study.vercel.app, https://preview.vercel.app/")
    assert settings.cors_origins == [
        "https://synapse-study.vercel.app",
        "https://preview.vercel.app",
    ]
