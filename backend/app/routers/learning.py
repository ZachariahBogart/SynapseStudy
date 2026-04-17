from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.db import get_db
from app.models import Attempt, Course, LearningItem, LearningItemKind, Topic
from app.schemas import AttemptCreate, AttemptResult, QuizSessionCreate, QuizSessionResponse
from app.services.evaluation import evaluate_response
from app.services.generation import ensure_course_materials
from app.services.mastery import apply_attempt
from app.services.serializers import serialize_learning_item


router = APIRouter(tags=["learning"])


def _course_for_user(db: Session, course_id: str, user: CurrentUser) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.user_id == user.id))
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return course


@router.post("/courses/{course_id}/quiz/session", response_model=QuizSessionResponse)
def create_quiz_session(
    course_id: str,
    payload: QuizSessionCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> QuizSessionResponse:
    _course_for_user(db, course_id, user)
    ensure_course_materials(db, course_id)
    items = db.scalars(
        select(LearningItem)
        .where(LearningItem.course_id == course_id, LearningItem.kind == LearningItemKind.QUIZ)
        .order_by(LearningItem.updated_at.desc())
        .limit(payload.item_count)
    ).all()
    return QuizSessionResponse(course_id=course_id, items=[serialize_learning_item(item) for item in items])


@router.post("/learning-items/{learning_item_id}/attempt", response_model=AttemptResult)
def submit_attempt(
    learning_item_id: str,
    payload: AttemptCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> AttemptResult:
    item = db.get(LearningItem, learning_item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learning item not found.")

    _course_for_user(db, item.course_id, user)
    topic = db.get(Topic, item.topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found.")

    correctness = None
    feedback = "Confidence saved."

    if item.kind == LearningItemKind.QUIZ:
        _, correctness, feedback = evaluate_response(payload.response, item.answer_key)
    elif item.kind == LearningItemKind.GUIDED_STEP:
        _, correctness, feedback = evaluate_response(payload.response, item.answer_key)
        if correctness:
            if item.quick_check:
                feedback = f"{feedback} Quick check: {item.quick_check}"
        elif item.hint:
            feedback = f"{feedback} Hint: {item.hint}"
    elif item.kind == LearningItemKind.FLASHCARD and payload.confidence_1_5 <= 2:
        feedback = "Low confidence noted. Guided learning will move this topic higher in the queue."
    elif item.kind == LearningItemKind.FLASHCARD:
        feedback = "Confidence saved. Higher confidence will push this topic lower in guided learning."

    attempt = Attempt(
        id=str(uuid4()),
        user_id=user.id,
        learning_item_id=item.id,
        response=payload.response,
        correctness=correctness,
        confidence_1_5=payload.confidence_1_5,
        feedback=feedback,
    )
    db.add(attempt)
    apply_attempt(topic, item.kind, payload.confidence_1_5, correctness)
    db.commit()

    return AttemptResult(
        attempt_id=attempt.id,
        learning_item_id=item.id,
        topic_id=topic.id,
        correctness=correctness,
        confidence_1_5=payload.confidence_1_5,
        feedback=feedback,
        mastery_score=topic.mastery_score,
        priority_score=topic.priority_score,
    )
