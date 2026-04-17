from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Course, LearningItem, LearningItemKind, Topic, TutorSession, TutorSessionStatus
from app.schemas import TutorMessageResponse, TutorSessionStartResponse
from app.services.evaluation import evaluate_response
from app.services.guided_learning import get_guided_items
from app.services.mastery import apply_tutor_signal
from app.services.retrieval import retrieve_relevant_chunks
from app.services.serializers import serialize_topic


def _guided_item_for_topic(db: Session, course_id: str, topic_id: str) -> LearningItem | None:
    return db.scalar(
        select(LearningItem).where(
            LearningItem.course_id == course_id,
            LearningItem.topic_id == topic_id,
            LearningItem.kind == LearningItemKind.GUIDED_STEP,
        )
    )


def start_tutor_session(db: Session, course: Course, user_id: str) -> TutorSessionStartResponse:
    ranked = get_guided_items(db, course.id)
    topic = ranked[0][0] if ranked else None
    guided_item = ranked[0][1] if ranked else None

    if topic is None:
        opening = "Upload course material first, then I can guide you through the weakest topics with source-backed questions."
        source_refs: list[dict] = []
    else:
        opening = (
            f"Let's work through {topic.title}. "
            f"{guided_item.prompt if guided_item else f'What do you think is the main idea behind {topic.title}?'}"
        )
        source_refs = topic.source_refs

    session = TutorSession(
        id=str(uuid4()),
        course_id=course.id,
        user_id=user_id,
        current_topic_id=topic.id if topic else None,
        transcript=[{"role": "assistant", "content": opening}],
        status=TutorSessionStatus.ACTIVE,
    )
    db.add(session)
    db.commit()

    return TutorSessionStartResponse(
        session_id=session.id,
        status=session.status,
        topic=serialize_topic(topic) if topic else None,
        response=opening,
        source_refs=source_refs,
    )


def reply_to_tutor(db: Session, session: TutorSession, user_message: str) -> TutorMessageResponse:
    topic = db.get(Topic, session.current_topic_id) if session.current_topic_id else None
    if topic is None:
        response = "I do not have a topic queued yet. Upload material or start a new tutor session to generate one."
        session.transcript = [*session.transcript, {"role": "user", "content": user_message}, {"role": "assistant", "content": response}]
        db.commit()
        return TutorMessageResponse(
            session_id=session.id,
            status=session.status,
            topic_id=None,
            stage="idle",
            response=response,
            source_refs=[],
            transcript=session.transcript,
        )

    guided_item = _guided_item_for_topic(db, session.course_id, topic.id)
    _, correctness, feedback = evaluate_response(user_message, topic.summary)
    relevant_chunks = retrieve_relevant_chunks(db, session.course_id, user_message or topic.title)
    chunk_labels = ", ".join(chunk.source_ref for chunk in relevant_chunks[:2])
    stage = "advance"

    if correctness:
        apply_tutor_signal(topic, struggled=False)
        follow_up = guided_item.quick_check if guided_item else f"What is the next detail that makes {topic.title} easier to remember?"
        response = f"{feedback} One more step: {follow_up}"
    else:
        apply_tutor_signal(topic, struggled=True)
        stage = "hint"
        hint = guided_item.hint if guided_item else topic.summary
        response = f"{feedback} Hint: {hint} Try again and connect it back to {chunk_labels or 'the cited source'}."

    session.transcript = [
        *session.transcript,
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": response},
    ]

    db.commit()

    return TutorMessageResponse(
        session_id=session.id,
        status=session.status,
        topic_id=topic.id,
        stage=stage,
        response=response,
        source_refs=topic.source_refs,
        transcript=session.transcript,
    )
