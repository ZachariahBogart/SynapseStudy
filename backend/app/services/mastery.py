from __future__ import annotations

from app.models import LearningItemKind, Topic, utcnow


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def apply_attempt(topic: Topic, kind: LearningItemKind, confidence: int, correctness: bool | None) -> None:
    mastery_delta = 0.0
    priority_delta = 0.0

    if kind == LearningItemKind.QUIZ:
        if correctness:
            mastery_delta = 0.12 + max(confidence - 3, 0) * 0.03
            priority_delta = -10 - confidence
        else:
            mastery_delta = -0.16 - (5 - confidence) * 0.02
            priority_delta = 14 + (6 - confidence) * 2
    elif kind == LearningItemKind.FLASHCARD:
        mastery_delta = (confidence - 3) * 0.05
        priority_delta = (6 - confidence) * 3 - 4
    else:
        if correctness is False:
            mastery_delta = -0.08
            priority_delta = 8
        else:
            mastery_delta = (confidence - 3) * 0.04
            priority_delta = (6 - confidence) * 2 - 3

    if confidence <= 2:
        priority_delta += 4
    elif confidence >= 4 and correctness is not False:
        priority_delta -= 2

    topic.mastery_score = round(clamp((topic.mastery_score or 0.35) + mastery_delta, 0.0, 1.0), 3)
    topic.priority_score = round(clamp((topic.priority_score or 60.0) + priority_delta, 0.0, 100.0), 2)
    topic.last_studied_at = utcnow()
    topic.last_mastery_update_at = utcnow()


def apply_tutor_signal(topic: Topic, struggled: bool) -> None:
    if struggled:
        topic.mastery_score = round(clamp((topic.mastery_score or 0.35) - 0.04, 0.0, 1.0), 3)
        topic.priority_score = round(clamp((topic.priority_score or 60.0) + 6.0, 0.0, 100.0), 2)
    else:
        topic.mastery_score = round(clamp((topic.mastery_score or 0.35) + 0.03, 0.0, 1.0), 3)
        topic.priority_score = round(clamp((topic.priority_score or 60.0) - 3.0, 0.0, 100.0), 2)
    topic.last_mastery_update_at = utcnow()
