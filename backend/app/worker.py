from __future__ import annotations

import dramatiq
from dramatiq.brokers.redis import RedisBroker

from app.core.config import get_settings
from app.services.ingestion import process_asset


settings = get_settings()

if settings.redis_url:
    dramatiq.set_broker(RedisBroker(url=settings.redis_url))


@dramatiq.actor
def process_asset_actor(asset_id: str) -> None:
    process_asset(asset_id)
