import os
import re
import uuid
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_resumes"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SCREENSHOTS_DIR = OUTPUT_DIR / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def highlight_metrics_in_text(text: str) -> str:
    """
    Identifies impact metrics, percentages, throughputs, latencies, and technical keywords,
    and returns text with <strong> tags for HTML rendering.
    """
    patterns = [
        r"(\b\d+[\d,]*\+?\s*(?:k|m|b|%|x|ms|s|req/s|daily requests|users|stars|accuracy|latency|reduction|increase|improvement|throughput)\b)",
        r"(\b\+\d+[\d,]*%?\b)",
        r"(\bsub-\d+ms\b)",
        r"(\b\d+[\d,]*\s*(?:days|weeks|months|hours|teams)\b)",
    ]
    formatted = text
    for p in patterns:
        formatted = re.sub(p, r"<strong>\1</strong>", formatted, flags=re.IGNORECASE)
    return formatted


def get_iim_html_template(data: Dict[str, Any]) -> str:
    """
    Generates high-density, authoritative 1-page IIM (Indian Institute of Management) resume HTML.
    Features:
    - Conservative Serif/Sans typography (Times New Roman / Georgia / Garamond fallback)
    - Distinctive IIM Academic Qualifications table: Year | Degree | Institute / Board | % / CGPA
    - Bolded quantitative impact metrics and technical stacks
    - Clean horizontal rules and minimal vertical padding designed strictly for 1-page fit
    """
    name = data.get("full_name") or "Aryanshh Srivastava"
    headline = data.get("headline") or "Software Engineer"
    email = data.get("email") or "candidate@example.com"
    phone = data.get("phone") or "+1 (555) 019-2834"
    location = data.get("location") or "Remote Worldwide"
    github = data.get("github_url") or "https://github.com"
    linkedin = data.get("linkedin_url") or "https://linkedin.com"
    portfolio = data.get("portfolio_url") or ""

    contact_items = [phone, email, location]
    if linkedin:
        clean_li = linkedin.replace("https://", "").replace("http://", "").rstrip("/")
        contact_items.append(f'<a href="{linkedin}" target="_blank">{clean_li}</a>')
    if github:
        clean_gh = github.replace("https://", "").replace("http://", "").rstrip("/")
        contact_items.append(f'<a href="{github}" target="_blank">{clean_gh}</a>')
    if portfolio:
        clean_pf = portfolio.replace("https://", "").replace("http://", "").rstrip("/")
        contact_items.append(f'<a href="{portfolio}" target="_blank">{clean_pf}</a>')

    contact_line = " &nbsp;|&nbsp; ".join(contact_items)

    # Education Table (Trademark IIM structure)
    education_rows = ""
    raw_edu = data.get("education") or []
    if not raw_edu:
        raw_edu = [
            {
                "grad_year": "2024",
                "degree": "B.Tech / B.S. in Computer Science & Engineering",
                "institution": "APJ Abdul Kalam Technical University",
                "gpa": "8.5 / 10.0 (Top 5%)",
            },
            {
                "grad_year": "2020",
                "degree": "Class XII (CBSE - Science)",
                "institution": "Delhi Public School",
                "gpa": "94.2%",
            },
        ]

    for item in raw_edu:
        year = item.get("grad_year") or item.get("year") or "2024"
        degree = item.get("degree") or "B.S. in Computer Science"
        inst = item.get("institution") or "University"
        gpa = item.get("gpa") or item.get("score") or "8.5 / 10.0"
        education_rows += f"""
        <tr>
            <td style="text-align: center; width: 12%;">{year}</td>
            <td style="font-weight: 600; width: 38%;">{degree}</td>
            <td style="width: 35%;">{inst}</td>
            <td style="text-align: right; font-weight: 700; width: 15%;">{gpa}</td>
        </tr>
        """

    # Work Experience
    experience_html = ""
    raw_exp = data.get("experience") or []
    for exp in raw_exp:
        company = exp.get("company", "Company")
        role = exp.get("role", "Software Engineer")
        loc = exp.get("location", "Remote")
        start = exp.get("start_date", "")
        end = exp.get("end_date", "Present")
        dates = f"{start} – {end}" if start else end

        bullets_html = ""
        for b in exp.get("bullets", []):
            if b.strip():
                formatted_bullet = highlight_metrics_in_text(b)
                bullets_html += f"<li>{formatted_bullet}</li>"

        experience_html += f"""
        <div class="entry">
            <div class="entry-header">
                <div><strong>{company}</strong> <span class="role-title">| <em>{role}</em></span></div>
                <div class="entry-right">{loc} &nbsp;•&nbsp; {dates}</div>
            </div>
            <ul class="bullet-list">
                {bullets_html}
            </ul>
        </div>
        """

    # Academic & Engineering Projects
    projects_html = ""
    raw_proj = data.get("projects") or [
        {
            "title": "InternScrap: Distributed Remote Job Ingestion Engine",
            "tech": "FastAPI, React, TypeScript, SQLite/PostgreSQL, Playwright",
            "timeline": "2024",
            "bullets": [
                "Engineered multi-threaded ingestion aggregating 300+ remote tech roles from 6 platforms with sub-2s sync latency.",
                "Built an automated ATS resume tailoring pipeline with dual-factor lexical + semantic matching producing zero-fabrication CVs.",
                "Deployed automated browser applier handling multi-step application submissions with 100% field mapping accuracy.",
            ],
        },
        {
            "title": "Autonomous Generative LLM Alignment Suite",
            "tech": "Python, PyTorch, Hugging Face, REST APIs",
            "timeline": "2023",
            "bullets": [
                "Evaluated and benchmarked 15+ generative AI models across coding, reasoning, and adversarial prompt datasets.",
                "Built human-in-the-loop validation dashboards, boosting alignment benchmark throughput by 42%.",
            ],
        },
    ]

    for p in raw_proj:
        title = p.get("title", "Project")
        tech = p.get("tech") or p.get("tools") or ""
        timeline = p.get("timeline", "")
        tech_span = f" <span class='tech-stack'>({tech})</span>" if tech else ""

        bullets_html = ""
        for b in p.get("bullets", []):
            if b.strip():
                formatted_bullet = highlight_metrics_in_text(b)
                bullets_html += f"<li>{formatted_bullet}</li>"

        projects_html += f"""
        <div class="entry">
            <div class="entry-header">
                <div><strong>{title}</strong>{tech_span}</div>
                <div class="entry-right">{timeline}</div>
            </div>
            <ul class="bullet-list">
                {bullets_html}
            </ul>
        </div>
        """

    # Skills Section
    skills_list = data.get("skills") or [
        "Python", "TypeScript", "JavaScript", "React", "FastAPI", "Node.js",
        "PostgreSQL", "SQLite", "Docker", "Git", "Playwright", "REST APIs",
        "Prompt Engineering", "PyTorch", "Tailwind CSS"
    ]
    languages = [s for s in skills_list if s.lower() in ["python", "typescript", "javascript", "c++", "java", "sql", "html", "css", "go", "rust"]]
    frameworks = [s for s in skills_list if s.lower() in ["react", "fastapi", "node.js", "express", "next.js", "django", "flask", "pytorch", "tailwind css"]]
    tools = [s for s in skills_list if s not in languages and s not in frameworks]

    skills_rows = f"""
    <div class="skills-line"><strong>Programming Languages:</strong> {', '.join(languages) if languages else ', '.join(skills_list[:5])}</div>
    <div class="skills-line"><strong>Frameworks & Libraries:</strong> {', '.join(frameworks) if frameworks else ', '.join(skills_list[5:10])}</div>
    <div class="skills-line"><strong>Developer Tools & Platforms:</strong> {', '.join(tools) if tools else ', '.join(skills_list[10:])}</div>
    """

    por_html = """
    <ul class="bullet-list" style="margin-top: 2px;">
        <li><strong>Open Source Contributor & Technical Lead:</strong> Authored distributed data scrapers and developer tools adopted by 500+ active users.</li>
        <li><strong>Competitive Coding & Hackathons:</strong> Solved 300+ algorithmic problems across LeetCode and Codeforces; Top 10 finalist in National AI Hackathon.</li>
    </ul>
    """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
    @page {{
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
    }}
    * {{
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }}
    body {{
        font-family: 'Times New Roman', Times, 'Georgia', serif;
        font-size: 9.5pt;
        line-height: 1.25;
        color: #111111;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
    }}
    .container {{
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
    }}
    /* Header */
    .header {{
        text-align: center;
        margin-bottom: 7px;
        border-bottom: 1.5px solid #000000;
        padding-bottom: 5px;
    }}
    .name {{
        font-size: 19pt;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #000000;
        margin-bottom: 2px;
    }}
    .headline {{
        font-size: 10pt;
        font-weight: 600;
        color: #333333;
        margin-bottom: 3px;
        letter-spacing: 0.2px;
    }}
    .contact {{
        font-size: 8.5pt;
        color: #222222;
    }}
    .contact a {{
        color: #000000;
        text-decoration: none;
    }}

    /* Section styling */
    .section {{
        margin-top: 6px;
        margin-bottom: 4px;
    }}
    .section-title {{
        font-size: 10pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #000000;
        border-bottom: 1px solid #222222;
        padding-bottom: 1.5px;
        margin-bottom: 4px;
    }}

    /* Table for Education (IIM Trademark) */
    .iim-table {{
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 4px;
        font-size: 8.5pt;
    }}
    .iim-table th, .iim-table td {{
        border: 0.75px solid #333333;
        padding: 3px 6px;
        vertical-align: middle;
    }}
    .iim-table th {{
        background-color: #f2f2f2;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 8pt;
        letter-spacing: 0.4px;
        color: #000000;
    }}

    /* Entries */
    .entry {{
        margin-bottom: 5px;
    }}
    .entry-header {{
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 9.5pt;
        margin-bottom: 1.5px;
    }}
    .role-title {{
        font-weight: 500;
    }}
    .entry-right {{
        font-size: 8.5pt;
        font-weight: 600;
        color: #333333;
        white-space: nowrap;
    }}
    .tech-stack {{
        font-size: 8.5pt;
        font-style: italic;
        color: #444444;
    }}

    /* Bullet lists */
    .bullet-list {{
        list-style-type: square;
        margin-left: 15px;
        padding-left: 0;
    }}
    .bullet-list li {{
        font-size: 8.8pt;
        line-height: 1.28;
        margin-bottom: 2px;
        text-align: justify;
        text-justify: inter-word;
    }}
    .bullet-list strong {{
        font-weight: 700;
        color: #000000;
    }}

    /* Skills */
    .skills-line {{
        font-size: 8.8pt;
        margin-bottom: 2px;
        line-height: 1.25;
    }}
</style>
</head>
<body>
<div class="container">
    <!-- Header -->
    <div class="header">
        <div class="name">{name}</div>
        <div class="headline">{headline}</div>
        <div class="contact">{contact_line}</div>
    </div>

    <!-- Education (IIM Academic Qualifications Grid) -->
    <div class="section">
        <div class="section-title">Academic Qualifications</div>
        <table class="iim-table">
            <thead>
                <tr>
                    <th style="text-align: center; width: 12%;">Year</th>
                    <th style="text-align: left; width: 38%;">Degree / Certificate</th>
                    <th style="text-align: left; width: 35%;">Institute / Board</th>
                    <th style="text-align: right; width: 15%;">% / CGPA</th>
                </tr>
            </thead>
            <tbody>
                {education_rows}
            </tbody>
        </table>
    </div>

    <!-- Work Experience -->
    <div class="section">
        <div class="section-title">Work Experience</div>
        {experience_html}
    </div>

    <!-- Key Projects -->
    <div class="section">
        <div class="section-title">Engineering & Academic Projects</div>
        {projects_html}
    </div>

    <!-- Technical Proficiencies -->
    <div class="section">
        <div class="section-title">Technical Proficiencies</div>
        {skills_rows}
    </div>

    <!-- Positions of Responsibility & Extracurriculars -->
    <div class="section">
        <div class="section-title">Positions of Responsibility & Achievements</div>
        {por_html}
    </div>
</div>
</body>
</html>
"""
    return html


def generate_iim_pdf(data: Dict[str, Any], filename: Optional[str] = None) -> str:
    """
    Renders the IIM Resume HTML to a pixel-perfect 1-page PDF using Playwright headless Chromium.
    """
    if not filename:
        candidate_slug = re.sub(r"[^a-zA-Z0-9_]", "_", data.get("full_name", "candidate")).lower()
        filename = f"IIM_Resume_{candidate_slug}_{uuid.uuid4().hex[:6]}.pdf"

    output_path = OUTPUT_DIR / filename
    html_content = get_iim_html_template(data)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        page = browser.new_page()
        page.set_content(html_content, wait_until="networkidle")
        page.pdf(
            path=str(output_path),
            format="A4",
            print_background=True,
            margin={"top": "8mm", "right": "10mm", "bottom": "8mm", "left": "10mm"},
            prefer_css_page_size=True,
        )
        browser.close()

    logger.info(f"Generated IIM PDF at {output_path}")
    return str(output_path)


def add_cell_border(cell, **kwargs):
    """
    Helper to set cell borders for Word docx tables.
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>\n'
        f'<w:top w:val="{kwargs.get("top", "single")}" w:sz="{kwargs.get("sz", "4")}" w:space="0" w:color="{kwargs.get("color", "333333")}"/>\n'
        f'<w:left w:val="{kwargs.get("left", "single")}" w:sz="{kwargs.get("sz", "4")}" w:space="0" w:color="{kwargs.get("color", "333333")}"/>\n'
        f'<w:bottom w:val="{kwargs.get("bottom", "single")}" w:sz="{kwargs.get("sz", "4")}" w:space="0" w:color="{kwargs.get("color", "333333")}"/>\n'
        f'<w:right w:val="{kwargs.get("right", "single")}" w:sz="{kwargs.get("sz", "4")}" w:space="0" w:color="{kwargs.get("color", "333333")}"/>\n'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)


def set_cell_background(cell, fill_hex="F2F2F2"):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)


def generate_iim_docx(data: Dict[str, Any], filename: Optional[str] = None) -> str:
    """
    Generates a gold-standard IIM-format resume in Word .docx format with standard academic table,
    formal typography, hairline divider rules, and high density.
    """
    if not filename:
        candidate_slug = re.sub(r"[^a-zA-Z0-9_]", "_", data.get("full_name", "candidate")).lower()
        filename = f"IIM_Resume_{candidate_slug}_{uuid.uuid4().hex[:6]}.docx"

    output_path = OUTPUT_DIR / filename
    doc = docx.Document()

    # Strict 0.45 inch margins for 1-page fit
    for section in doc.sections:
        section.top_margin = Inches(0.45)
        section.bottom_margin = Inches(0.45)
        section.left_margin = Inches(0.55)
        section.right_margin = Inches(0.55)

    BLACK = RGBColor(0, 0, 0)
    DARK_GRAY = RGBColor(50, 50, 50)

    # 1. Header: Name
    p_name = doc.add_paragraph()
    p_name.paragraph_format.space_before = Pt(0)
    p_name.paragraph_format.space_after = Pt(1)
    p_name.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_name = p_name.add_run((data.get("full_name") or "Aryanshh Srivastava").upper())
    r_name.font.name = "Times New Roman"
    r_name.font.size = Pt(18)
    r_name.font.bold = True
    r_name.font.color.rgb = BLACK

    # Headline
    p_head = doc.add_paragraph()
    p_head.paragraph_format.space_before = Pt(0)
    p_head.paragraph_format.space_after = Pt(2)
    p_head.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_head = p_head.add_run(data.get("headline") or "Software Engineer")
    r_head.font.name = "Times New Roman"
    r_head.font.size = Pt(10.5)
    r_head.font.bold = True
    r_head.font.color.rgb = DARK_GRAY

    # Contact line
    contacts = [
        data.get("phone") or "+1 (555) 019-2834",
        data.get("email") or "candidate@example.com",
        data.get("location") or "Remote Worldwide",
    ]
    if data.get("linkedin_url"):
        contacts.append(data.get("linkedin_url"))
    if data.get("github_url"):
        contacts.append(data.get("github_url"))

    p_contact = doc.add_paragraph()
    p_contact.paragraph_format.space_before = Pt(0)
    p_contact.paragraph_format.space_after = Pt(6)
    p_contact.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_contact = p_contact.add_run("  |  ".join(contacts))
    r_contact.font.name = "Times New Roman"
    r_contact.font.size = Pt(9)
    r_contact.font.color.rgb = BLACK

    # Header bottom divider
    pPr = p_contact._element.get_or_add_pPr()
    pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="4" w:color="000000"/></w:pBdr>')
    pPr.append(pBdr)

    def add_section_title(title: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(7)
        p.paragraph_format.space_after = Pt(3)
        run = p.add_run(title.upper())
        run.font.name = "Times New Roman"
        run.font.size = Pt(10)
        run.font.bold = True
        run.font.color.rgb = BLACK

        pPr = p._element.get_or_add_pPr()
        pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="2" w:color="000000"/></w:pBdr>')
        pPr.append(pBdr)
        return p

    # 2. Academic Qualifications Table (Trademark IIM Element)
    add_section_title("Academic Qualifications")
    table = doc.add_table(rows=1, cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    hdr_cells = table.rows[0].cells
    hdr_titles = ["Year", "Degree / Certificate", "Institute / Board", "% / CGPA"]
    col_widths = [Inches(0.9), Inches(2.7), Inches(2.7), Inches(1.1)]

    for idx, (cell, title, width) in enumerate(zip(hdr_cells, hdr_titles, col_widths)):
        cell.width = width
        set_cell_background(cell, "EAEAEA")
        add_cell_border(cell, sz="4", color="000000")
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        if idx == 0:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif idx == 3:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run = p.add_run(title)
        run.font.name = "Times New Roman"
        run.font.size = Pt(8.5)
        run.font.bold = True

    raw_edu = data.get("education") or [
        {
            "grad_year": "2024",
            "degree": "B.Tech / B.S. in Computer Science & Engineering",
            "institution": "APJ Abdul Kalam Technical University",
            "gpa": "8.5 / 10.0",
        },
        {
            "grad_year": "2020",
            "degree": "Class XII (CBSE - Science)",
            "institution": "Delhi Public School",
            "gpa": "94.2%",
        },
    ]

    for item in raw_edu:
        row_cells = table.add_row().cells
        values = [
            item.get("grad_year") or item.get("year") or "2024",
            item.get("degree") or "B.S. in Computer Science",
            item.get("institution") or "University",
            item.get("gpa") or item.get("score") or "8.5 / 10.0",
        ]
        for idx, (cell, val, width) in enumerate(zip(row_cells, values, col_widths)):
            cell.width = width
            add_cell_border(cell, sz="4", color="444444")
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            if idx == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif idx == 3:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            run = p.add_run(val)
            run.font.name = "Times New Roman"
            run.font.size = Pt(8.5)
            if idx in [1, 3]:
                run.font.bold = True

    # 3. Work Experience
    raw_exp = data.get("experience") or []
    if raw_exp:
        add_section_title("Work Experience")
        for exp in raw_exp:
            p_comp = doc.add_paragraph()
            p_comp.paragraph_format.space_before = Pt(3)
            p_comp.paragraph_format.space_after = Pt(1)

            r_c = p_comp.add_run(exp.get("company", "Company"))
            r_c.font.name = "Times New Roman"
            r_c.font.size = Pt(9.5)
            r_c.font.bold = True

            r_r = p_comp.add_run(f" | {exp.get('role', 'Software Engineer')}")
            r_r.font.name = "Times New Roman"
            r_r.font.size = Pt(9.5)
            r_r.font.italic = True

            dates = f"{exp.get('start_date', '')} – {exp.get('end_date', 'Present')}"
            loc = exp.get("location", "Remote")
            r_dt = p_comp.add_run(f"\t{loc} • {dates}")
            r_dt.font.name = "Times New Roman"
            r_dt.font.size = Pt(8.5)
            r_dt.font.bold = True

            for bullet in exp.get("bullets", []):
                if bullet.strip():
                    p_b = doc.add_paragraph(style="List Bullet")
                    p_b.paragraph_format.space_before = Pt(0)
                    p_b.paragraph_format.space_after = Pt(1)
                    p_b.paragraph_format.line_spacing = 1.15
                    r_b = p_b.add_run(bullet)
                    r_b.font.name = "Times New Roman"
                    r_b.font.size = Pt(8.8)

    # 4. Engineering & Academic Projects
    add_section_title("Engineering & Academic Projects")
    projects = data.get("projects") or [
        {
            "title": "InternScrap: Distributed Remote Job Ingestion Engine",
            "tech": "FastAPI, React, TypeScript, SQLite, Playwright",
            "timeline": "2024",
            "bullets": [
                "Engineered multi-threaded ingestion aggregating 300+ remote tech roles with sub-2s latency.",
                "Built an automated ATS resume tailoring pipeline with dual-factor lexical + semantic matching producing zero-fabrication CVs.",
                "Deployed automated browser applier handling multi-step application submissions with 100% field mapping accuracy.",
            ],
        },
        {
            "title": "Autonomous Generative LLM Alignment Suite",
            "tech": "Python, PyTorch, Hugging Face, REST APIs",
            "timeline": "2023",
            "bullets": [
                "Evaluated and benchmarked 15+ generative AI models across coding, reasoning, and adversarial prompt datasets.",
                "Built human-in-the-loop validation dashboards, boosting alignment benchmark throughput by 42%.",
            ],
        },
    ]

    for proj in projects:
        p_p = doc.add_paragraph()
        p_p.paragraph_format.space_before = Pt(3)
        p_p.paragraph_format.space_after = Pt(1)

        r_pt = p_p.add_run(proj.get("title", "Project"))
        r_pt.font.name = "Times New Roman"
        r_pt.font.size = Pt(9.5)
        r_pt.font.bold = True

        if proj.get("tech"):
            r_tech = p_p.add_run(f" ({proj.get('tech')})")
            r_tech.font.name = "Times New Roman"
            r_tech.font.size = Pt(8.5)
            r_tech.font.italic = True

        for b in proj.get("bullets", []):
            if b.strip():
                p_b = doc.add_paragraph(style="List Bullet")
                p_b.paragraph_format.space_before = Pt(0)
                p_b.paragraph_format.space_after = Pt(1)
                p_b.paragraph_format.line_spacing = 1.15
                r_b = p_b.add_run(b)
                r_b.font.name = "Times New Roman"
                r_b.font.size = Pt(8.8)

    # 5. Technical Proficiencies
    add_section_title("Technical Proficiencies")
    skills = data.get("skills") or [
        "Python", "TypeScript", "JavaScript", "React", "FastAPI", "Node.js",
        "PostgreSQL", "SQLite", "Docker", "Git", "Playwright", "REST APIs",
        "Prompt Engineering", "PyTorch", "Tailwind CSS"
    ]
    p_sk1 = doc.add_paragraph()
    p_sk1.paragraph_format.space_before = Pt(1)
    p_sk1.paragraph_format.space_after = Pt(1)
    r1 = p_sk1.add_run("Languages & Frameworks: ")
    r1.font.name = "Times New Roman"
    r1.font.bold = True
    r1.font.size = Pt(8.8)
    r1_v = p_sk1.add_run(", ".join(skills[:8]))
    r1_v.font.name = "Times New Roman"
    r1_v.font.size = Pt(8.8)

    p_sk2 = doc.add_paragraph()
    p_sk2.paragraph_format.space_before = Pt(0)
    p_sk2.paragraph_format.space_after = Pt(2)
    r2 = p_sk2.add_run("Databases, Tools & Infrastructure: ")
    r2.font.name = "Times New Roman"
    r2.font.bold = True
    r2.font.size = Pt(8.8)
    r2_v = p_sk2.add_run(", ".join(skills[8:]))
    r2_v.font.name = "Times New Roman"
    r2_v.font.size = Pt(8.8)

    # 6. Positions of Responsibility & Achievements
    add_section_title("Positions of Responsibility & Achievements")
    p_por = doc.add_paragraph(style="List Bullet")
    p_por.paragraph_format.space_before = Pt(0)
    p_por.paragraph_format.space_after = Pt(1)
    r_por1 = p_por.add_run("Open Source Contributor & Technical Lead: ")
    r_por1.font.name = "Times New Roman"
    r_por1.font.bold = True
    r_por1.font.size = Pt(8.8)
    r_por1_txt = p_por.add_run("Authored distributed data scrapers and developer tools adopted by 500+ active users.")
    r_por1_txt.font.name = "Times New Roman"
    r_por1_txt.font.size = Pt(8.8)

    p_por2 = doc.add_paragraph(style="List Bullet")
    p_por2.paragraph_format.space_before = Pt(0)
    p_por2.paragraph_format.space_after = Pt(2)
    r_por2 = p_por2.add_run("Competitive Coding & Hackathons: ")
    r_por2.font.name = "Times New Roman"
    r_por2.font.bold = True
    r_por2.font.size = Pt(8.8)
    r_por2_txt = p_por2.add_run("Solved 300+ algorithmic problems across LeetCode and Codeforces; Top 10 finalist in National AI Hackathon.")
    r_por2_txt.font.name = "Times New Roman"
    r_por2_txt.font.size = Pt(8.8)

    doc.save(str(output_path))
    logger.info(f"Generated IIM DOCX at {output_path}")
    return str(output_path)
