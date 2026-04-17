from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import JSON, Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AssetType(str, Enum):
    PDF = "pdf"
    PPTX = "pptx"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"


class AssetStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class LearningItemKind(str, Enum):
    FLASHCARD = "flashcard"
    QUIZ = "quiz"
    GUIDED_STEP = "guided_step"


class TutorSessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    subject: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class SourceAsset(Base):
    __tablename__ = "source_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    type: Mapped[AssetType] = mapped_column(SqlEnum(AssetType), index=True)
    status: Mapped[AssetStatus] = mapped_column(SqlEnum(AssetStatus), default=AssetStatus.QUEUED, index=True)
    storage_path: Mapped[str] = mapped_column(String(500))
    original_filename: Mapped[str] = mapped_column(String(260))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ContentChunk(Base):
    __tablename__ = "content_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("source_assets.id"), index=True)
    sequence_index: Mapped[int] = mapped_column(Integer)
    source_ref: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(JSON, default=list)
    topic_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("course_id", "slug", name="uq_topic_course_slug"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    slug: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    parent_topic_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id"), nullable=True)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.35)
    priority_score: Mapped[float] = mapped_column(Float, default=60.0)
    last_studied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_mastery_update_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_refs: Mapped[list[dict]] = mapped_column(JSON, default=list)
    key_terms: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class LearningItem(Base):
    __tablename__ = "learning_items"
    __table_args__ = (UniqueConstraint("course_id", "topic_id", "kind", name="uq_learning_item_topic_kind"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    kind: Mapped[LearningItemKind] = mapped_column(SqlEnum(LearningItemKind), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    answer_key: Mapped[str] = mapped_column(Text)
    hint: Mapped[str] = mapped_column(Text, default="")
    quick_check: Mapped[str] = mapped_column(Text, default="")
    source_refs: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    learning_item_id: Mapped[str] = mapped_column(ForeignKey("learning_items.id"), index=True)
    response: Mapped[str] = mapped_column(Text, default="")
    correctness: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    confidence_1_5: Mapped[int] = mapped_column(Integer)
    feedback: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TutorSession(Base):
    __tablename__ = "tutor_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    current_topic_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id"), nullable=True)
    transcript: Mapped[list[dict]] = mapped_column(JSON, default=list)
    status: Mapped[TutorSessionStatus] = mapped_column(SqlEnum(TutorSessionStatus), default=TutorSessionStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
