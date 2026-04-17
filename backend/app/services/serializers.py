from __future__ import annotations

from app.models import Course, LearningItem, SourceAsset, Topic
from app.schemas import AssetRead, CourseRead, LearningItemRead, TopicRead


def serialize_asset(asset: SourceAsset) -> AssetRead:
    return AssetRead(
        id=asset.id,
        course_id=asset.course_id,
        type=asset.type,
        status=asset.status,
        storage_path=asset.storage_path,
        original_filename=asset.original_filename,
        metadata=asset.details or {},
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def serialize_course(course: Course) -> CourseRead:
    return CourseRead(
        id=course.id,
        user_id=course.user_id,
        title=course.title,
        subject=course.subject,
        summary=course.summary,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


def serialize_topic(topic: Topic) -> TopicRead:
    return TopicRead(
        id=topic.id,
        course_id=topic.course_id,
        title=topic.title,
        slug=topic.slug,
        summary=topic.summary,
        mastery_score=topic.mastery_score,
        priority_score=topic.priority_score,
        source_refs=topic.source_refs or [],
        key_terms=topic.key_terms or [],
        created_at=topic.created_at,
        updated_at=topic.updated_at,
    )


def serialize_learning_item(item: LearningItem) -> LearningItemRead:
    return LearningItemRead(
        id=item.id,
        course_id=item.course_id,
        topic_id=item.topic_id,
        kind=item.kind,
        prompt=item.prompt,
        answer_key=item.answer_key,
        hint=item.hint,
        quick_check=item.quick_check,
        source_refs=item.source_refs or [],
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
