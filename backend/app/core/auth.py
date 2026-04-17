from __future__ import annotations

import re

from fastapi import Depends, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models import User


settings = get_settings()


class CurrentUser(BaseModel):
    id: str
    display_name: str


def _normalize_user_id(candidate: str | None) -> str:
    base = candidate or settings.default_user_id
    normalized = re.sub(r"[^a-zA-Z0-9_-]+", "-", base.strip().lower()).strip("-")
    return normalized or settings.default_user_id


def get_current_user(
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
) -> CurrentUser:
    user_id = _normalize_user_id(x_user_id)
    display_name = (x_user_name or settings.default_user_name).strip() or settings.default_user_name

    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, display_name=display_name)
        db.add(user)
        db.commit()
    elif user.display_name != display_name:
        user.display_name = display_name
        db.commit()

    return CurrentUser(id=user.id, display_name=user.display_name)
