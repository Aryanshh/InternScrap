import re
import logging
from typing import Dict, Any, List, Tuple
import numpy as np

from backend.services.resume_parser import TECH_KEYWORDS, extract_skills

logger = logging.getLogger(__name__)

_model = None
_model_attempted = False

def get_sentence_model():
    global _model, _model_attempted
    if not _model_attempted:
        _model_attempted = True
        try:
            from sentence_transformers import SentenceTransformer
            # Only use if already cached locally to prevent blocking HTTP requests
            _model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
            logger.info("SentenceTransformer loaded from local cache.")
        except Exception:
            # Model not cached locally or cannot load; fallback to sklearn TF-IDF
            _model = False
    return _model

def clean_html(text: str) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", " ", text)
    return " ".join(clean.split())

def compute_keyword_match(jd_text: str, resume_skills: List[str], resume_raw_text: str) -> Tuple[float, List[str], List[str]]:
    """
    Identifies technical skills mentioned in the JD.
    Returns:
      - keyword_score (0.0 - 100.0)
      - matched_skills (present in both JD and resume)
      - gap_list (factual list of JD requirements not in resume)
    """
    jd_clean = clean_html(jd_text)
    jd_skills = extract_skills(jd_clean)
    
    if not jd_skills:
        return (50.0, [], [])

    resume_skills_lower = {s.lower() for s in resume_skills}
    resume_text_lower = resume_raw_text.lower()

    matched = []
    gap_list = []

    for s in jd_skills:
        s_lower = s.lower()
        if s_lower in resume_skills_lower or re.search(r"(?<!\w)" + re.escape(s_lower) + r"(?!\w)", resume_text_lower):
            matched.append(s)
        else:
            gap_list.append(s)

    score = (len(matched) / len(jd_skills)) * 100.0
    return (round(score, 1), matched, sorted(gap_list))

def compute_semantic_match(jd_text: str, resume_text: str) -> float:
    """
    Calculates semantic cosine similarity between JD text and Resume text.
    Uses SentenceTransformer if available, otherwise fast TF-IDF N-gram cosine similarity.
    """
    jd_clean = clean_html(jd_text)[:3000]
    res_clean = resume_text[:3000]

    model = get_sentence_model()
    if model:
        try:
            embeddings = model.encode([jd_clean, res_clean], normalize_embeddings=True)
            cosine_sim = float(np.dot(embeddings[0], embeddings[1]))
            calibrated = max(0.0, min(100.0, (cosine_sim - 0.15) / 0.70 * 100.0))
            return round(calibrated, 1)
        except Exception as e:
            logger.error(f"SentenceTransformer encoding error: {e}")

    # High-accuracy TF-IDF N-Gram Vectorizer (1-word to 2-word n-grams)
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", max_features=800)
        matrix = vec.fit_transform([jd_clean, res_clean])
        sim = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])
        # Calibrate TF-IDF cosine score (TF-IDF cosine on documents is usually 0.10 to 0.70)
        calibrated = min(100.0, max(5.0, sim * 140.0))
        return round(calibrated, 1)
    except Exception as e:
        logger.error(f"TF-IDF similarity error: {e}")
        # Word set overlap fallback
        words_jd = set(re.findall(r"\b[a-zA-Z]{3,}\b", jd_clean.lower()))
        words_res = set(re.findall(r"\b[a-zA-Z]{3,}\b", res_clean.lower()))
        if not words_jd:
            return 50.0
        jaccard = len(words_jd & words_res) / len(words_jd)
        return round(min(100.0, jaccard * 100.0), 1)

def evaluate_job_match(jd_text: str, resume_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Produces a composite, honest, non-inflated match report:
    - keyword_score
    - semantic_score
    - blended_score (55% semantic + 45% keyword)
    - gap_list (factual missing requirements)
    - matched_skills
    """
    raw_text = resume_data.get("raw_text", "")
    parsed = resume_data.get("parsed_json", {})
    resume_skills = parsed.get("skills", [])

    keyword_score, matched_skills, gap_list = compute_keyword_match(jd_text, resume_skills, raw_text)
    semantic_score = compute_semantic_match(jd_text, raw_text)

    # 55% semantic, 45% keyword overlap
    blended_score = round((0.55 * semantic_score) + (0.45 * keyword_score), 1)

    return {
        "keyword_score": keyword_score,
        "semantic_score": semantic_score,
        "blended_score": blended_score,
        "gap_list": gap_list,
        "matched_skills": matched_skills,
        "disclaimer": "Scores are algorithmic estimates based on keyword & semantic analysis, not a guarantee of interview or hire."
    }
