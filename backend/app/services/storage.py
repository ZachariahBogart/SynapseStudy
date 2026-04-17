from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.services.text_utils import slugify


settings = get_settings()


def store_upload(upload: UploadFile, course_id: str, asset_id: str) -> tuple[str, str]:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in {".pdf", ".pptx"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and PPTX uploads are supported in this MVP.",
        )

    safe_stem = slugify(Path(upload.filename or "upload").stem) or "source"
    course_dir = settings.storage_dir / course_id
    course_dir.mkdir(parents=True, exist_ok=True)
    destination = course_dir / f"{asset_id}-{safe_stem}{suffix}"

    with destination.open("wb") as file_handle:
        shutil.copyfileobj(upload.file, file_handle)

    return str(destination), Path(upload.filename or destination.name).name
