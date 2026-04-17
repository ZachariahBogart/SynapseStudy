from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.db import get_db
from app.models import Course, TutorSession
from app.schemas import TutorMessageRequest, TutorMessageResponse, TutorSessionStartResponse
from app.services.generation import ensure_course_materials
from app.services.tutor import reply_to_tutor, start_tutor_session


router = APIRouter(prefix="/courses", tags=["tutor"])


def _course_for_user(db: Session, course_id: str, user: CurrentUser) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.user_id == user.id))
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return course


@router.post("/{course_id}/tutor/session", response_model=TutorSessionStartResponse)
def create_tutor_session(
    course_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> TutorSessionStartResponse:
    course = _course_for_user(db, course_id, user)
    ensure_course_materials(db, course_id)
    return start_tutor_session(db, course, user.id)


@router.post("/{course_id}/tutor/message", response_model=TutorMessageResponse)
def tutor_message(
    course_id: str,
    payload: TutorMessageRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> TutorMessageResponse:
    _course_for_user(db, course_id, user)
    session = db.scalar(
        select(TutorSession).where(
            TutorSession.id == payload.session_id,
            TutorSession.course_id == course_id,
            TutorSession.user_id == user.id,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tutor session not found.")
    return reply_to_tutor(db, session, payload.message)
