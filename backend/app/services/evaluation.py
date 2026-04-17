from __future__ import annotations

from app.services.text_utils import extract_keywords, tokenize


def evaluate_response(response: str, answer_key: str) -> tuple[float, bool, str]:
    cleaned_response = response.strip()
    if not cleaned_response:
        return 0.0, False, "Give yourself a short explanation before rating confidence so the app can coach what to revisit."

    expected_terms = extract_keywords(answer_key, limit=8)
    if not expected_terms:
        return 0.5, True, "You responded, but the concept summary was sparse. Keep going and use the source references if needed."

    response_terms = set(tokenize(cleaned_response))
    overlap = len([term for term in expected_terms if term in response_terms])
    score = overlap / len(expected_terms)
    correctness = score >= 0.35

    if correctness and score >= 0.65:
        feedback = "Strong explanation. You covered the key ideas and linked the concept well."
    elif correctness:
        feedback = "Solid start. You hit the main idea, but another concrete detail would make the explanation stronger."
    else:
        missing_terms = [term for term in expected_terms if term not in response_terms][:3]
        if missing_terms:
            feedback = "You are close, but revisit these ideas next: " + ", ".join(missing_terms) + "."
        else:
            feedback = "Try again in your own words and connect the concept back to the original material."

    return score, correctness, feedback
