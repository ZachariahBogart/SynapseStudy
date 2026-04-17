from __future__ import annotations

import math
import zlib

from app.services.text_utils import tokenize


VECTOR_DIMENSION = 24


def embed_text(text: str) -> list[float]:
    vector = [0.0] * VECTOR_DIMENSION
    tokens = tokenize(text)
    if not tokens:
        return vector

    for token in tokens:
        index = zlib.crc32(token.encode("utf-8")) % VECTOR_DIMENSION
        vector[index] += 1.0

    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector

    return [round(value / magnitude, 6) for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return numerator / (left_norm * right_norm)
