from __future__ import annotations

import re
from collections import Counter


STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "why",
    "with",
    "you",
    "your",
}

GENERIC_TITLE_WORDS = {
    "agenda",
    "block",
    "chapter",
    "course",
    "goals",
    "introduction",
    "intro",
    "lecture",
    "lesson",
    "module",
    "objectives",
    "overview",
    "part",
    "review",
    "section",
    "summary",
    "unit",
    "week",
}


def slugify(value: str) -> str:
    lowered = value.lower().strip()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    return lowered.strip("-")


def clean_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in re.findall(r"[A-Za-z][A-Za-z0-9'-]+", text)]


def split_sentences(text: str) -> list[str]:
    normalized = clean_text(text).replace("\n", ". ")
    sentences = re.split(r"(?<=[.!?])\s+", normalized)
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def summarize_text(text: str, sentence_count: int = 2, max_chars: int = 360) -> str:
    sentences = split_sentences(text)
    if not sentences:
        return "This source is still being analyzed."
    summary = " ".join(sentences[:sentence_count]).strip()
    if len(summary) > max_chars:
        summary = summary[: max_chars - 3].rstrip() + "..."
    return summary


def extract_keywords(text: str, limit: int = 6) -> list[str]:
    tokens = [
        token
        for token in tokenize(text)
        if token not in STOPWORDS and token not in GENERIC_TITLE_WORDS and len(token) > 1
    ]
    counts = Counter(tokens)
    return [word for word, _count in counts.most_common(limit)]


def first_nonempty_lines(text: str) -> list[str]:
    return [line.strip() for line in clean_text(text).splitlines() if line.strip()]


def is_generic_heading(line: str) -> bool:
    normalized = re.sub(r"[^a-z0-9\s]", "", line.lower()).strip()
    if not normalized:
        return True

    words = normalized.split()
    if not words:
        return True

    generic_hits = [word for word in words if word in GENERIC_TITLE_WORDS]
    non_generic_words = [word for word in words if word not in GENERIC_TITLE_WORDS and not word.isdigit()]

    if "overview" in words and ("block" in words or "unit" in words or "chapter" in words):
        return True

    return bool(generic_hits) and not non_generic_words


def infer_title(text: str, fallback: str) -> str:
    lines = first_nonempty_lines(text)
    for line in lines:
        if 2 <= len(line.split()) <= 12 and len(line) <= 80 and not is_generic_heading(line):
            return line.rstrip(":")
    sentences = split_sentences(text)
    for sentence in sentences:
        trimmed = sentence[:80].rstrip(" .")
        if 3 <= len(trimmed.split()) <= 12 and not is_generic_heading(trimmed):
            return trimmed
    keywords = extract_keywords(text, limit=3)
    if keywords:
        return " / ".join(word.title() for word in keywords)
    return fallback


def split_for_chunks(text: str, max_words: int = 180) -> list[str]:
    cleaned = clean_text(text)
    if not cleaned:
        return []

    paragraphs = [paragraph.strip() for paragraph in cleaned.split("\n") if paragraph.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for paragraph in paragraphs:
        words = paragraph.split()
        if current and current_words + len(words) > max_words:
            chunks.append("\n".join(current))
            current = []
            current_words = 0
        current.append(paragraph)
        current_words += len(words)

    if current:
        chunks.append("\n".join(current))

    return chunks
