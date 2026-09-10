import re
from typing import Optional, List, Tuple
from datetime import datetime, timezone

try:
    from rapidfuzz import fuzz
except ImportError:
    # Fallback if rapidfuzz is not yet loaded
    fuzz = None

COMPANY_SUFFIXES = {
    "inc", "inc.", "llc", "corp", "corporation", "ltd", "limited", 
    "co", "company", "gmbh", "technologies", "technology", "tech", 
    "group", "software", "solutions", "services", "global"
}

def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    # Remove HTML tags if present
    cleaned = re.sub(r"<[^>]+>", " ", text)
    # Lowercase & normalize spaces and punctuation
    cleaned = re.sub(r"[^\w\s]", " ", cleaned.lower())
    return " ".join(cleaned.split())

def clean_company_name(name: Optional[str]) -> str:
    text = clean_text(name)
    tokens = text.split()
    filtered = [t for t in tokens if t not in COMPANY_SUFFIXES]
    return " ".join(filtered) if filtered else text

def clean_title(title: Optional[str]) -> str:
    text = clean_text(title)
    # Strip common fluff like "(m/f/d)", "(remote)", "[remote]", "100% remote"
    text = re.sub(r"\b(m/f/d|remote|hybrid|full\s*time|part\s*time|w/m/d)\b", "", text)
    return " ".join(text.split())

def generate_fingerprint(title: str, company: str, location: str = "") -> str:
    c = clean_company_name(company)
    t = clean_title(title)
    return f"{c}::{t}".strip(":")

def compute_similarity(title1: str, comp1: str, loc1: str, title2: str, comp2: str, loc2: str) -> float:
    """
    Computes a composite similarity score between 0.0 and 100.0.
    Heavily weights company and title match.
    """
    c1 = clean_company_name(comp1)
    c2 = clean_company_name(comp2)
    t1 = clean_title(title1)
    t2 = clean_title(title2)

    if fuzz is not None:
        comp_sim = fuzz.token_sort_ratio(c1, c2)
        title_sim = fuzz.token_sort_ratio(t1, t2)
    else:
        # Simple Jaccard similarity fallback
        s1_c, s2_c = set(c1.split()), set(c2.split())
        comp_sim = (len(s1_c & s2_c) / len(s1_c | s2_c) * 100.0) if (s1_c | s2_c) else 0.0
        s1_t, s2_t = set(t1.split()), set(t2.split())
        title_sim = (len(s1_t & s2_t) / len(s1_t | s2_t) * 100.0) if (s1_t | s2_t) else 0.0

    # If company match is very poor, jobs are definitely different
    if comp_sim < 75.0:
        return 0.0

    # Composite weighted similarity (60% title, 40% company)
    overall = (title_sim * 0.60) + (comp_sim * 0.40)
    return overall

def merge_job_records(existing_job, incoming_data: dict) -> bool:
    """
    Merges incoming job data into existing_job in place:
    - Appends distinct apply URLs
    - Appends distinct source tags
    - Keeps richer description
    - Retains earliest or latest relevant metadata
    """
    modified = False

    # Merge apply_urls
    existing_urls = list(existing_job.apply_urls or [])
    for url in incoming_data.get("apply_urls", []):
        if url and url not in existing_urls:
            existing_urls.append(url)
            modified = True
    existing_job.apply_urls = existing_urls

    # Merge sources
    existing_sources = list(existing_job.sources or [])
    new_source = incoming_data.get("primary_source") or incoming_data.get("source")
    if new_source and new_source not in existing_sources:
        existing_sources.append(new_source)
        modified = True
    for s in incoming_data.get("sources", []):
        if s and s not in existing_sources:
            existing_sources.append(s)
            modified = True
    existing_job.sources = existing_sources

    # Upgrade description if incoming is significantly longer/cleaner
    incoming_desc = incoming_data.get("description", "")
    if len(incoming_desc) > len(existing_job.description or ""):
        existing_job.description = incoming_desc
        modified = True

    # Fill salary if missing
    if not existing_job.salary_range and incoming_data.get("salary_range"):
        existing_job.salary_range = incoming_data["salary_range"]
        modified = True

    if modified:
        existing_job.updated_at = datetime.now(timezone.utc)

    return modified
