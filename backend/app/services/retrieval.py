from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ContentChunk
from app.services.embeddings import cosine_similarity, embed_text


def retrieve_relevant_chunks(db: Session, course_id: str, query: str, limit: int = 3) -> list[ContentChunk]:
    query_vector = embed_text(query)
    chunks = db.scalars(select(ContentChunk).where(ContentChunk.course_id == course_id)).all()
    ranked = sorted(
        chunks,
        key=lambda chunk: cosine_similarity(query_vector, chunk.embedding or []),
        reverse=True,
    )
    return ranked[:limit]
