from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Attempt, LearningItem, LearningItemKind, Topic


def _hours_since(timestamp: datetime | None) -> float:
    if timestamp is None:
        return 999.0
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - timestamp
    return max(delta.total_seconds() / 3600, 0.0)


def dynamic_priority(db: Session, topic: Topic) -> float:
    attempts = db.scalars(
        select(Attempt)
        .join(LearningItem, LearningItem.id == Attempt.learning_item_id)
        .where(LearningItem.topic_id == topic.id)
        .order_by(Attempt.created_at.desc())
    ).all()

    priority = float(topic.priority_score or 60.0)
    priority += max(min(_hours_since(topic.last_studied_at) / 4, 12), 0)
    priority += (1.0 - float(topic.mastery_score or 0.0)) * 20

    if not attempts:
        priority += 8
    else:
        recent_attempts = attempts[:3]
        low_confidence_hits = sum(1 for attempt in recent_attempts if attempt.confidence_1_5 <= 2)
        incorrect_hits = sum(1 for attempt in recent_attempts if attempt.correctness is False)
        priority += low_confidence_hits * 4 + incorrect_hits * 6

    return round(priority, 2)


def get_guided_items(db: Session, course_id: str) -> list[tuple[Topic, LearningItem, float]]:
    topics = db.scalars(select(Topic).where(Topic.course_id == course_id)).all()
    items_by_topic = {
        item.topic_id: item
        for item in db.scalars(
            select(LearningItem).where(
                LearningItem.course_id == course_id,
                LearningItem.kind == LearningItemKind.GUIDED_STEP,
            )
        ).all()
    }

    ranked: list[tuple[Topic, LearningItem, float]] = []
    for topic in topics:
        item = items_by_topic.get(topic.id)
        if item is None:
            continue
        ranked.append((topic, item, dynamic_priority(db, topic)))

    ranked.sort(key=lambda payload: payload[2], reverse=True)
    return ranked
