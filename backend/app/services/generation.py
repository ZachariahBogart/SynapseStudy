from __future__ import annotations

from collections import defaultdict
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ContentChunk, Course, LearningItem, LearningItemKind, SourceAsset, Topic
from app.services.text_utils import extract_keywords, infer_title, is_generic_heading, slugify, summarize_text


def make_source_ref(asset: SourceAsset, source_ref: str) -> dict:
    return {
        "asset_id": asset.id,
        "asset_name": asset.original_filename,
        "location": source_ref,
        "label": f"{asset.original_filename} - {source_ref}",
    }


def _format_term(term: str) -> str:
    return term.upper() if len(term) <= 4 and term.isalpha() else term


def _focus_label(title: str, key_terms: list[str]) -> str:
    if is_generic_heading(title) and key_terms:
        if len(key_terms) >= 2:
            return f"{_format_term(key_terms[0])} and {_format_term(key_terms[1])}"
        return _format_term(key_terms[0])
    return title


def _flashcard_prompt(title: str, key_terms: list[str]) -> str:
    focus = _focus_label(title, key_terms)
    if is_generic_heading(title):
        return f"What is the core idea in this material about {focus}?"
    return f"What is the core idea behind {focus}?"


def _quiz_prompt(title: str, key_terms: list[str]) -> str:
    if len(key_terms) >= 2:
        return f"Explain how {_format_term(key_terms[0])} connects to {_format_term(key_terms[1])} in this material."
    focus = _focus_label(title, key_terms)
    if is_generic_heading(title):
        return f"What is the main idea this material is teaching about {focus}?"
    return f"Explain {focus} in your own words."


def _guided_prompt(title: str, key_terms: list[str]) -> str:
    if len(key_terms) >= 2:
        return f"How do {_format_term(key_terms[0])} and {_format_term(key_terms[1])} connect in this slide deck?"
    focus = _focus_label(title, key_terms)
    return f"What is the main concept this slide deck is teaching about {focus}?"


def _quick_check(title: str, key_terms: list[str]) -> str:
    if len(key_terms) >= 2:
        return f"How would you use {_format_term(key_terms[0])} to explain {_format_term(key_terms[1])} to a classmate?"
    focus = _focus_label(title, key_terms)
    return f"What is the clearest one-sentence summary of {focus}?"


def ensure_course_materials(db: Session, course_id: str) -> None:
    has_chunks = db.scalar(select(ContentChunk.id).where(ContentChunk.course_id == course_id).limit(1))
    if not has_chunks:
        return
    generate_course_materials(db, course_id)
    db.commit()


def generate_course_materials(db: Session, course_id: str) -> None:
    course = db.get(Course, course_id)
    if course is None:
        return

    assets = {
        asset.id: asset
        for asset in db.scalars(select(SourceAsset).where(SourceAsset.course_id == course_id)).all()
    }
    chunks = db.scalars(
        select(ContentChunk)
        .where(ContentChunk.course_id == course_id)
        .order_by(ContentChunk.sequence_index.asc())
    ).all()

    if not chunks:
        course.summary = "Upload a PDF or PowerPoint to generate a study guide."
        return

    course.summary = summarize_text(" ".join(chunk.text for chunk in chunks), sentence_count=3, max_chars=480)

    grouped_chunks: dict[str, dict] = defaultdict(lambda: {"texts": [], "source_refs": [], "chunk_ids": []})
    for index, chunk in enumerate(chunks, start=1):
        title = infer_title(chunk.text, fallback=f"Topic {index}")
        slug = slugify(title) or f"topic-{index}"
        grouped_chunks[slug]["title"] = title
        grouped_chunks[slug]["texts"].append(chunk.text)
        grouped_chunks[slug]["chunk_ids"].append(chunk.id)
        asset = assets.get(chunk.asset_id)
        if asset is not None:
            grouped_chunks[slug]["source_refs"].append(make_source_ref(asset, chunk.source_ref))

    existing_topics = {
        topic.slug: topic
        for topic in db.scalars(select(Topic).where(Topic.course_id == course_id)).all()
    }

    for slug, payload in grouped_chunks.items():
        topic = existing_topics.get(slug)
        combined_text = "\n".join(payload["texts"])
        summary = summarize_text(combined_text)
        key_terms = extract_keywords(combined_text)
        source_refs = payload["source_refs"][:4]

        if topic is None:
            topic = Topic(
                id=str(uuid4()),
                course_id=course_id,
                slug=slug,
                title=payload["title"],
                summary=summary,
                source_refs=source_refs,
                key_terms=key_terms,
                mastery_score=0.35,
                priority_score=60.0,
            )
            db.add(topic)
        else:
            topic.title = payload["title"]
            topic.summary = summary
            topic.source_refs = source_refs
            topic.key_terms = key_terms

        db.flush()

        for chunk_id in payload["chunk_ids"]:
            chunk = db.get(ContentChunk, chunk_id)
            if chunk is not None:
                chunk.topic_ids = [topic.id]

        existing_items = {
            item.kind: item
            for item in db.scalars(
                select(LearningItem).where(
                    LearningItem.course_id == course_id,
                    LearningItem.topic_id == topic.id,
                )
            ).all()
        }

        flashcard_prompt = _flashcard_prompt(topic.title, topic.key_terms)
        flashcard_hint = (
            f"Focus on {', '.join(_format_term(term) for term in topic.key_terms[:2])}."
            if topic.key_terms
            else "Use the cited source to restate the concept in your own words."
        )
        quiz_prompt = _quiz_prompt(topic.title, topic.key_terms)
        guided_prompt = _guided_prompt(topic.title, topic.key_terms)
        quick_check = _quick_check(topic.title, topic.key_terms)

        item_payloads = {
            LearningItemKind.FLASHCARD: {
                "prompt": flashcard_prompt,
                "answer_key": topic.summary,
                "hint": flashcard_hint,
                "quick_check": quick_check,
            },
            LearningItemKind.QUIZ: {
                "prompt": quiz_prompt,
                "answer_key": topic.summary,
                "hint": f"Revisit {topic.source_refs[0]['label']} and focus on the main relationship or definition."
                if topic.source_refs
                else "Use the overview summary as a starting point.",
                "quick_check": quick_check,
            },
            LearningItemKind.GUIDED_STEP: {
                "prompt": guided_prompt,
                "answer_key": topic.summary,
                "hint": flashcard_hint,
                "quick_check": quick_check,
            },
        }

        for kind, item_data in item_payloads.items():
            item = existing_items.get(kind)
            if item is None:
                item = LearningItem(
                    id=str(uuid4()),
                    course_id=course_id,
                    topic_id=topic.id,
                    kind=kind,
                    prompt=item_data["prompt"],
                    answer_key=item_data["answer_key"],
                    hint=item_data["hint"],
                    quick_check=item_data["quick_check"],
                    source_refs=topic.source_refs,
                )
                db.add(item)
            else:
                item.prompt = item_data["prompt"]
                item.answer_key = item_data["answer_key"]
                item.hint = item_data["hint"]
                item.quick_check = item_data["quick_check"]
                item.source_refs = topic.source_refs
