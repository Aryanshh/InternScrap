import os
import re
import uuid
from typing import Dict, Any, List, Tuple
from pathlib import Path

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from backend.services.resume_parser import TECH_KEYWORDS, extract_skills, is_section_header

# Directory for generated docx files
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_resumes"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()

def extract_jd_keywords(jd_text: str) -> List[str]:
    """Extract known technical keywords from the job description."""
    return extract_skills(jd_text)

def compute_bullet_relevance(bullet: str, jd_keywords: List[str], jd_text: str) -> Tuple[float, List[str]]:
    """
    Computes a relevance score for an experience bullet against the job description.
    Returns (score, list_of_matched_keywords).
    """
    bullet_lower = bullet.lower()
    matched_kws = []
    
    for kw in jd_keywords:
        pattern = r"(?<!\w)" + re.escape(kw.lower()) + r"(?!\w)"
        if re.search(pattern, bullet_lower):
            matched_kws.append(kw)

    # Score combines exact keyword matches + length/density factor
    keyword_score = len(matched_kws) * 1.5
    
    # Simple lexical overlap with JD
    jd_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", jd_text.lower()))
    bullet_words = set(re.findall(r"\b[a-zA-Z]{4,}\b", bullet_lower))
    overlap = len(bullet_words.intersection(jd_words))
    lexical_score = min(overlap * 0.1, 1.0)

    total_score = keyword_score + lexical_score
    return round(total_score, 3), matched_kws

def parse_candidate_header(raw_text: str) -> Dict[str, str]:
    """Extract candidate name, contact info, and role headline from raw text."""
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    name = "Candidate"
    headline = "Software Engineer"
    contact = ""
    summary = ""

    if len(lines) > 0:
        name = lines[0]
    if len(lines) > 1 and not lines[1].isupper() and "@" not in lines[1]:
        headline = lines[1]
    
    # Find contact line (containing email or phone or github)
    for line in lines[1:5]:
        if "@" in line or "github" in line.lower() or "linkedin" in line.lower() or "|" in line:
            contact = line
            break

    # Look for professional summary
    summary_idx = -1
    for i, line in enumerate(lines):
        if "summary" in line.lower() or "profile" in line.lower() or "about me" in line.lower():
            summary_idx = i
            break
    
    if summary_idx != -1 and summary_idx + 1 < len(lines):
        summary_candidates = []
        for line in lines[summary_idx + 1: summary_idx + 5]:
            if line.isupper() or "experience" in line.lower() or "skills" in line.lower():
                break
            summary_candidates.append(line)
        summary = " ".join(summary_candidates)

    return {
        "name": name,
        "headline": headline,
        "contact": contact,
        "summary": summary
    }

def parse_structured_experience(raw_text: str) -> List[Dict[str, Any]]:
    """
    Parses experience entries with company, title, dates, and associated bullet points.
    """
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    in_exp = False
    jobs = []
    current_job = None

    for line in lines:
        lower_line = line.lower()
        if is_section_header(line, ["work experience", "professional experience", "experience", "employment"]):
            in_exp = True
            continue
        elif in_exp and is_section_header(line, ["selected projects", "projects", "personal projects", "education", "technical skills", "skills"]):
            break

        if in_exp:
            # Check if this line is a job heading (e.g., contains | or (20xx - ...) or is non-bullet)
            is_bullet = line.startswith(("-", "•", "*", "–")) or (line[0].isdigit() and line[1:3] in [". ", ") "])
            has_pipe_or_date = "|" in line or re.search(r"\b(20\d\d|19\d\d|present)\b", lower_line)

            if not is_bullet and has_pipe_or_date:
                if current_job and current_job["bullets"]:
                    jobs.append(current_job)
                
                parts = [p.strip() for p in line.split("|")]
                title = parts[0] if len(parts) > 0 else line
                company_date = parts[1] if len(parts) > 1 else ""
                
                current_job = {
                    "title": title,
                    "company_date": company_date,
                    "bullets": []
                }
            elif current_job:
                bullet_clean = line.lstrip("-•*– 0123456789.)").strip()
                if len(bullet_clean) > 15:
                    current_job["bullets"].append(bullet_clean)

    if current_job and current_job["bullets"]:
        jobs.append(current_job)

    return jobs

def parse_structured_projects(raw_text: str) -> List[Dict[str, Any]]:
    """Parses project entries with title and bullet points."""
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    in_proj = False
    projects = []
    current_proj = None

    for line in lines:
        lower_line = line.lower()
        if is_section_header(line, ["selected projects", "projects", "personal projects"]):
            in_proj = True
            continue
        elif in_proj and is_section_header(line, ["education", "experience", "technical skills", "skills"]):
            break

        if in_proj:
            is_bullet = line.startswith(("-", "•", "*", "–"))
            if not is_bullet and len(line) < 80:
                if current_proj and current_proj["bullets"]:
                    projects.append(current_proj)
                current_proj = {
                    "title": line,
                    "bullets": []
                }
            elif current_proj:
                bullet_clean = line.lstrip("-•*– ").strip()
                if len(bullet_clean) > 10:
                    current_proj["bullets"].append(bullet_clean)

    if current_proj and current_proj["bullets"]:
        projects.append(current_proj)

    return projects

def tailor_resume_content(
    resume_dict: Dict[str, Any],
    job_title: str,
    job_company: str,
    job_description: str
) -> Dict[str, Any]:
    """
    Performs deterministic, ATS-aligned tailoring:
    1. Reorders candidate's verified skills so JD-matched skills appear first.
    2. Identifies missing JD requirements and logs them in diff (NEVER fabricates them).
    3. Scores and reorders experience bullets so relevant accomplishments lead each role.
    4. Generates audit diff metrics.
    """
    raw_text = resume_dict.get("raw_text", "")
    parsed = resume_dict.get("parsed_json", {})
    candidate_skills = parsed.get("skills", [])
    candidate_tools = parsed.get("tools", [])

    # 1. Analyze JD keywords
    jd_keywords = extract_jd_keywords(job_description)
    candidate_skills_lower = {s.lower(): s for s in candidate_skills}

    promoted_skills = []
    for kw in jd_keywords:
        if kw.lower() in candidate_skills_lower:
            original_cased = candidate_skills_lower[kw.lower()]
            if original_cased not in promoted_skills:
                promoted_skills.append(original_cased)

    # Remaining candidate skills not explicitly highlighted
    additional_skills = [s for s in candidate_skills if s not in promoted_skills]

    # JD keywords that candidate does NOT have (Factual gap - zero fabrication)
    unmatched_jd_requirements = [
        kw for kw in jd_keywords if kw.lower() not in candidate_skills_lower
    ]

    # 2. Reorder experience bullets
    structured_jobs = parse_structured_experience(raw_text)
    reordered_experience = []
    bullet_audit = []
    bullet_counter = 1

    if structured_jobs:
        for job in structured_jobs:
            scored_bullets = []
            for idx, b in enumerate(job["bullets"]):
                score, matched_kws = compute_bullet_relevance(b, jd_keywords, job_description)
                scored_bullets.append({
                    "original_rank": idx + 1,
                    "text": b,
                    "score": score,
                    "matched_keywords": matched_kws
                })
            
            # Sort bullets within this role by relevance score descending
            sorted_bullets = sorted(scored_bullets, key=lambda x: x["score"], reverse=True)
            
            # Record audit info
            for new_idx, b_info in enumerate(sorted_bullets):
                b_info["new_rank"] = new_idx + 1
                b_info["bullet_id"] = f"bullet_{bullet_counter}"
                bullet_counter += 1
                bullet_audit.append(b_info)

            reordered_experience.append({
                "title": job["title"],
                "company_date": job["company_date"],
                "bullets": [b["text"] for b in sorted_bullets],
                "bullet_details": sorted_bullets
            })
    else:
        # Fallback to flat list of bullets if structured parsing yielded none
        flat_bullets = parsed.get("experience", [])
        scored = []
        for idx, b in enumerate(flat_bullets):
            score, matched_kws = compute_bullet_relevance(b, jd_keywords, job_description)
            scored.append({
                "original_rank": idx + 1,
                "text": b,
                "score": score,
                "matched_keywords": matched_kws
            })
        sorted_bullets = sorted(scored, key=lambda x: x["score"], reverse=True)
        for new_idx, b_info in enumerate(sorted_bullets):
            b_info["new_rank"] = new_idx + 1
            b_info["bullet_id"] = f"bullet_{bullet_counter}"
            bullet_counter += 1
            bullet_audit.append(b_info)
        reordered_experience.append({
            "title": "Software Engineer",
            "company_date": "Professional Experience",
            "bullets": [b["text"] for b in sorted_bullets],
            "bullet_details": sorted_bullets
        })

    # 3. Reorder projects
    structured_projects = parse_structured_projects(raw_text)
    reordered_projects = []
    if structured_projects:
        for p in structured_projects:
            # Score project based on its combined text
            p_text = p["title"] + " " + " ".join(p["bullets"])
            score, matched_kws = compute_bullet_relevance(p_text, jd_keywords, job_description)
            reordered_projects.append({
                "title": p["title"],
                "bullets": p["bullets"],
                "score": score,
                "matched_keywords": matched_kws
            })
        reordered_projects = sorted(reordered_projects, key=lambda x: x["score"], reverse=True)
    else:
        flat_proj = parsed.get("projects", [])
        for p in flat_proj:
            score, matched_kws = compute_bullet_relevance(p, jd_keywords, job_description)
            reordered_projects.append({
                "title": "Project",
                "bullets": [p],
                "score": score,
                "matched_keywords": matched_kws
            })

    header = parse_candidate_header(raw_text)
    education = parsed.get("education", [])

    diff_summary = {
        "job_title": job_title,
        "company": job_company,
        "stats": {
            "skills_promoted": len(promoted_skills),
            "unmatched_jd_requirements": len(unmatched_jd_requirements),
            "bullets_reordered": len(bullet_audit),
            "skills_fabricated": 0  # Strict zero-fabrication invariant
        },
        "promoted_skills": promoted_skills,
        "additional_skills": additional_skills,
        "unmatched_jd_requirements": unmatched_jd_requirements,
        "reordered_bullets": bullet_audit
    }

    tailored_json = {
        "header": header,
        "targeted_role": f"{job_title} | Candidate",
        "skills": {
            "core_matched": promoted_skills,
            "additional": additional_skills,
            "tools": candidate_tools
        },
        "experience": reordered_experience,
        "projects": reordered_projects,
        "education": education
    }

    return {
        "diff_summary": diff_summary,
        "tailored_json": tailored_json
    }

def add_horizontal_border(paragraph):
    """Adds a subtle bottom border under a section heading for ATS visual structure."""
    pPr = paragraph._element.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '2')
    bottom.set(qn('w:color'), '1E3A8A') # Navy blue accent
    pBdr.append(bottom)
    pPr.append(pBdr)

def build_tailored_docx(tailored_data: Dict[str, Any], output_filename: str) -> str:
    """
    Compiles tailored resume JSON into a clean, modern, ATS-optimized Word document (.docx).
    """
    doc = docx.Document()
    
    # 0.75 inch margins
    for section in doc.sections:
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)

    # Styles
    navy = RGBColor(30, 58, 138)       # #1E3A8A
    dark_gray = RGBColor(34, 34, 34)   # #222222
    slate_gray = RGBColor(100, 116, 139) # #64748B

    header = tailored_data.get("header", {})
    
    # Candidate Name
    p_name = doc.add_paragraph()
    p_name.paragraph_format.space_before = Pt(0)
    p_name.paragraph_format.space_after = Pt(2)
    p_name.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_name = p_name.add_run(header.get("name", "Candidate Name"))
    run_name.font.name = "Arial"
    run_name.font.size = Pt(20)
    run_name.font.bold = True
    run_name.font.color.rgb = navy

    # Targeted Role Headline
    p_head = doc.add_paragraph()
    p_head.paragraph_format.space_before = Pt(0)
    p_head.paragraph_format.space_after = Pt(2)
    p_head.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_head = p_head.add_run(header.get("headline", "Software Engineer"))
    run_head.font.name = "Arial"
    run_head.font.size = Pt(11)
    run_head.font.bold = True
    run_head.font.color.rgb = slate_gray

    # Contact line
    if header.get("contact"):
        p_contact = doc.add_paragraph()
        p_contact.paragraph_format.space_before = Pt(0)
        p_contact.paragraph_format.space_after = Pt(8)
        p_contact.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run_contact = p_contact.add_run(header.get("contact"))
        run_contact.font.name = "Arial"
        run_contact.font.size = Pt(9.5)
        run_contact.font.color.rgb = dark_gray

    # Helper for Section Headings
    def add_section_heading(title: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(title.upper())
        run.font.name = "Arial"
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = navy
        add_horizontal_border(p)
        return p

    # Professional Summary (if available)
    if header.get("summary"):
        add_section_heading("Professional Summary")
        p_sum = doc.add_paragraph()
        p_sum.paragraph_format.space_before = Pt(2)
        p_sum.paragraph_format.space_after = Pt(4)
        p_sum.paragraph_format.line_spacing = 1.15
        run_sum = p_sum.add_run(header.get("summary"))
        run_sum.font.name = "Arial"
        run_sum.font.size = Pt(10)
        run_sum.font.color.rgb = dark_gray

    # Technical Skills Section
    skills_data = tailored_data.get("skills", {})
    core_matched = skills_data.get("core_matched", [])
    additional = skills_data.get("additional", [])
    tools = skills_data.get("tools", [])

    add_section_heading("Technical Skills")
    
    if core_matched:
        p_skills = doc.add_paragraph()
        p_skills.paragraph_format.space_before = Pt(2)
        p_skills.paragraph_format.space_after = Pt(2)
        r_label = p_skills.add_run("Core & Matched Technologies: ")
        r_label.font.name = "Arial"
        r_label.font.size = Pt(10)
        r_label.font.bold = True
        r_val = p_skills.add_run(", ".join(core_matched))
        r_val.font.name = "Arial"
        r_val.font.size = Pt(10)
        r_val.font.bold = True # Highlight matched technologies
        r_val.font.color.rgb = navy

    if additional:
        p_add = doc.add_paragraph()
        p_add.paragraph_format.space_before = Pt(0)
        p_add.paragraph_format.space_after = Pt(2)
        r_label = p_add.add_run("Additional Proficiencies: ")
        r_label.font.name = "Arial"
        r_label.font.size = Pt(10)
        r_label.font.bold = True
        r_val = p_add.add_run(", ".join(additional))
        r_val.font.name = "Arial"
        r_val.font.size = Pt(10)
        r_val.font.color.rgb = dark_gray

    if tools:
        p_tools = doc.add_paragraph()
        p_tools.paragraph_format.space_before = Pt(0)
        p_tools.paragraph_format.space_after = Pt(4)
        r_label = p_tools.add_run("Developer Tools & Platforms: ")
        r_label.font.name = "Arial"
        r_label.font.size = Pt(10)
        r_label.font.bold = True
        r_val = p_tools.add_run(", ".join(tools))
        r_val.font.name = "Arial"
        r_val.font.size = Pt(10)
        r_val.font.color.rgb = dark_gray

    # Professional Experience Section
    experience_list = tailored_data.get("experience", [])
    if experience_list:
        add_section_heading("Professional Experience")
        for job in experience_list:
            p_job = doc.add_paragraph()
            p_job.paragraph_format.space_before = Pt(5)
            p_job.paragraph_format.space_after = Pt(1)
            
            r_title = p_job.add_run(job.get("title", ""))
            r_title.font.name = "Arial"
            r_title.font.size = Pt(10.5)
            r_title.font.bold = True
            r_title.font.color.rgb = dark_gray

            if job.get("company_date"):
                r_comp = p_job.add_run(" | " + job.get("company_date", ""))
                r_comp.font.name = "Arial"
                r_comp.font.size = Pt(10)
                r_comp.font.italic = True
                r_comp.font.color.rgb = slate_gray

            for bullet in job.get("bullets", []):
                p_bullet = doc.add_paragraph(style='List Bullet')
                p_bullet.paragraph_format.space_before = Pt(0)
                p_bullet.paragraph_format.space_after = Pt(1.5)
                p_bullet.paragraph_format.line_spacing = 1.12
                r_bullet = p_bullet.add_run(bullet)
                r_bullet.font.name = "Arial"
                r_bullet.font.size = Pt(9.5)
                r_bullet.font.color.rgb = dark_gray

    # Selected Projects Section
    projects_list = tailored_data.get("projects", [])
    if projects_list:
        add_section_heading("Selected Projects")
        for proj in projects_list:
            p_phead = doc.add_paragraph()
            p_phead.paragraph_format.space_before = Pt(4)
            p_phead.paragraph_format.space_after = Pt(1)
            r_phead = p_phead.add_run(proj.get("title", "Project"))
            r_phead.font.name = "Arial"
            r_phead.font.size = Pt(10)
            r_phead.font.bold = True
            r_phead.font.color.rgb = dark_gray

            for b in proj.get("bullets", []):
                p_pbullet = doc.add_paragraph(style='List Bullet')
                p_pbullet.paragraph_format.space_before = Pt(0)
                p_pbullet.paragraph_format.space_after = Pt(1.5)
                p_pbullet.paragraph_format.line_spacing = 1.12
                r_pbullet = p_pbullet.add_run(b)
                r_pbullet.font.name = "Arial"
                r_pbullet.font.size = Pt(9.5)
                r_pbullet.font.color.rgb = dark_gray

    # Education Section
    education_list = tailored_data.get("education", [])
    if education_list:
        add_section_heading("Education")
        for edu in education_list:
            p_edu = doc.add_paragraph()
            p_edu.paragraph_format.space_before = Pt(2)
            p_edu.paragraph_format.space_after = Pt(2)
            r_edu = p_edu.add_run(edu)
            r_edu.font.name = "Arial"
            r_edu.font.size = Pt(9.5)
            r_edu.font.color.rgb = dark_gray

    file_path = str(OUTPUT_DIR / output_filename)
    doc.save(file_path)
    return file_path
