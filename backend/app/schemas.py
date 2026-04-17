from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import AssetStatus, AssetType, LearningItemKind, TutorSessionStatus


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserProfile(APIModel):
    id: str
    display_name: str


class CourseCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    subject: str = Field(min_length=2, max_length=120)


class SourceRef(BaseModel):
    label: str
    asset_id: str | None = None
    asset_name: str | None = None
    location: str | None = None


class AssetRead(APIModel):
    id: str
    course_id: str
    type: AssetType
    status: AssetStatus
    storage_path: str
    original_filename: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class CourseRead(APIModel):
    id: str
    user_id: str
    title: str
    subject: str
    summary: str
    created_at: datetime
    updated_at: datetime


class TopicRead(APIModel):
    id: str
    course_id: str
    title: str
    slug: str
    summary: str
    mastery_score: float
    priority_score: float
    source_refs: list[SourceRef]
    key_terms: list[str]
    created_at: datetime
    updated_at: datetime


class LearningItemRead(APIModel):
    id: str
    course_id: str
    topic_id: str
    kind: LearningItemKind
    prompt: str
    answer_key: str
    hint: str
    quick_check: str
    source_refs: list[SourceRef]
    created_at: datetime
    updated_at: datetime


class OverviewResponse(BaseModel):
    course: CourseRead
    assets: list[AssetRead]
    topics: list[TopicRead]
    learning_counts: dict[str, int]
    weak_topics: list[TopicRead]
    readiness: str


class IngestionStatusResponse(BaseModel):
    course_id: str
    status: str
    ready_assets: int
    processing_assets: int
    failed_assets: int
    assets: list[AssetRead]


class QuizSessionCreate(BaseModel):
    item_count: int = Field(default=5, ge=1, le=20)


class QuizSessionResponse(BaseModel):
    course_id: str
    items: list[LearningItemRead]


class AttemptCreate(BaseModel):
    response: str = ""
    confidence_1_5: int = Field(ge=1, le=5)

    @field_validator("response")
    @classmethod
    def normalize_response(cls, value: str) -> str:
        return value.strip()


class AttemptResult(BaseModel):
    attempt_id: str
    learning_item_id: str
    topic_id: str
    correctness: bool | None
    confidence_1_5: int
    feedback: str
    mastery_score: float
    priority_score: float


class TutorSessionStartResponse(BaseModel):
    session_id: str
    status: TutorSessionStatus
    topic: TopicRead | None
    response: str
    source_refs: list[SourceRef]


class TutorMessageRequest(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=4000)


class TutorMessageResponse(BaseModel):
    session_id: str
    status: TutorSessionStatus
    topic_id: str | None
    stage: str
    response: str
    source_refs: list[SourceRef]
    transcript: list[dict]


class GuidedLearningEntry(BaseModel):
    topic: TopicRead
    learning_item: LearningItemRead
    dynamic_priority: float


class GuidedLearningResponse(BaseModel):
    course_id: str
    items: list[GuidedLearningEntry]


class CourseListResponse(BaseModel):
    user: UserProfile
    courses: list[CourseRead]


class AssetUploadResponse(BaseModel):
    asset: AssetRead
    message: str
