from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.db import get_db
from app.models import AssetStatus, AssetType, Course, LearningItem, LearningItemKind, SourceAsset, Topic
from app.schemas import (
    AssetUploadResponse,
    CourseCreate,
    CourseListResponse,
    CourseRead,
    GuidedLearningEntry,
    GuidedLearningResponse,
    IngestionStatusResponse,
    LearningItemRead,
    OverviewResponse,
    TopicRead,
)
from app.services.generation import ensure_course_materials
from app.services.guided_learning import get_guided_items
from app.services.ingestion import process_asset
from app.services.serializers import serialize_asset, serialize_course, serialize_learning_item, serialize_topic
from app.services.storage import store_upload


router = APIRouter(prefix="/courses", tags=["courses"])


def _course_for_user(db: Session, course_id: str, user: CurrentUser) -> Course:
    course = db.scalar(select(Course).where(Course.id == course_id, Course.user_id == user.id))
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return course


@router.get("", response_model=CourseListResponse)
def list_courses(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> CourseListResponse:
    courses = db.scalars(
        select(Course).where(Course.user_id == user.id).order_by(Course.updated_at.desc())
    ).all()
    return CourseListResponse(user=user, courses=[serialize_course(course) for course in courses])


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> CourseRead:
    course = Course(id=str(uuid4()), user_id=user.id, title=payload.title, subject=payload.subject)
    db.add(course)
    db.commit()
    db.refresh(course)
    return serialize_course(course)


@router.post("/{course_id}/assets", response_model=AssetUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_asset(
    course_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> AssetUploadResponse:
    course = _course_for_user(db, course_id, user)
    asset_id = str(uuid4())
    storage_path, original_filename = store_upload(file, course_id=course.id, asset_id=asset_id)
    asset_type = AssetType.PDF if original_filename.lower().endswith(".pdf") else AssetType.PPTX

    asset = SourceAsset(
        id=asset_id,
        course_id=course.id,
        type=asset_type,
        status=AssetStatus.QUEUED,
        storage_path=storage_path,
        original_filename=original_filename,
        details={},
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    background_tasks.add_task(process_asset, asset.id)

    return AssetUploadResponse(
        asset=serialize_asset(asset),
        message=f"{original_filename} uploaded and queued for analysis.",
    )


@router.get("/{course_id}/ingestion-status", response_model=IngestionStatusResponse)
def course_ingestion_status(
    course_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> IngestionStatusResponse:
    _course_for_user(db, course_id, user)
    assets = db.scalars(select(SourceAsset).where(SourceAsset.course_id == course_id)).all()
    ready_assets = sum(1 for asset in assets if asset.status == AssetStatus.READY)
    processing_assets = sum(1 for asset in assets if asset.status in {AssetStatus.QUEUED, AssetStatus.PROCESSING})
    failed_assets = sum(1 for asset in assets if asset.status == AssetStatus.FAILED)

    if failed_assets:
        overall = "failed"
    elif processing_assets:
        overall = "processing"
    elif ready_assets:
        overall = "ready"
    else:
        overall = "empty"

    return IngestionStatusResponse(
        course_id=course_id,
        status=overall,
        ready_assets=ready_assets,
        processing_assets=processing_assets,
        failed_assets=failed_assets,
        assets=[serialize_asset(asset) for asset in assets],
    )


@router.get("/{course_id}/overview", response_model=OverviewResponse)
def course_overview(
    course_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> OverviewResponse:
    course = _course_for_user(db, course_id, user)
    ensure_course_materials(db, course_id)
    assets = db.scalars(select(SourceAsset).where(SourceAsset.course_id == course_id)).all()
    topics = db.scalars(select(Topic).where(Topic.course_id == course_id).order_by(Topic.priority_score.desc())).all()
    learning_items = db.scalars(select(LearningItem).where(LearningItem.course_id == course_id)).all()
    weak_topics = sorted(topics, key=lambda topic: topic.priority_score, reverse=True)[:3]
    readiness = "ready" if assets and all(asset.status == AssetStatus.READY for asset in assets) else "processing"

    counts = {
        LearningItemKind.FLASHCARD.value: sum(1 for item in learning_items if item.kind == LearningItemKind.FLASHCARD),
        LearningItemKind.QUIZ.value: sum(1 for item in learning_items if item.kind == LearningItemKind.QUIZ),
        LearningItemKind.GUIDED_STEP.value: sum(1 for item in learning_items if item.kind == LearningItemKind.GUIDED_STEP),
    }

    return OverviewResponse(
        course=serialize_course(course),
        assets=[serialize_asset(asset) for asset in assets],
        topics=[serialize_topic(topic) for topic in topics],
        learning_counts=counts,
        weak_topics=[serialize_topic(topic) for topic in weak_topics],
        readiness=readiness,
    )


@router.get("/{course_id}/topics", response_model=list[TopicRead])
def course_topics(
    course_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[TopicRead]:
    _course_for_user(db, course_id, user)
    ensure_course_materials(db, course_id)
    topics = db.scalars(select(Topic).where(Topic.course_id == course_id).order_by(Topic.priority_score.desc())).all()
    return [serialize_topic(topic) for topic in topics]


@router.get("/{course_id}/flashcards", response_model=list[LearningItemRead])
def flashcards(
    course_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[LearningItemRead]:
    _course_for_user(db, course_id, user)
    ensure_course_materials(db, course_id)
    items = db.scalars(
        select(LearningItem)
        .where(LearningItem.course_id == course_id, LearningItem.kind == LearningItemKind.FLASHCARD)
        .order_by(LearningItem.created_at.asc())
    ).all()
    return [serialize_learning_item(item) for item in items]


@router.get("/{course_id}/guided-learning", response_model=GuidedLearningResponse)
def guided_learning(
    course_id: str,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> GuidedLearningResponse:
    _course_for_user(db, course_id, user)
    ensure_course_materials(db, course_id)
    ranked = get_guided_items(db, course_id)
    return GuidedLearningResponse(
        course_id=course_id,
        items=[
            GuidedLearningEntry(
                topic=serialize_topic(topic),
                learning_item=serialize_learning_item(item),
                dynamic_priority=score,
            )
            for topic, item, score in ranked
        ],
    )
