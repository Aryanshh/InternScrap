import os
import re
import time
import uuid
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError

from backend.database import SessionLocal
from backend.models.application import Application
from backend.models.job import Job
from backend.models.profile import UserProfile
from backend.services.iim_resume_service import generate_iim_pdf

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_resumes"
SCREENSHOTS_DIR = OUTPUT_DIR / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


class AutoApplierEngine:
    """
    Automated job application engine using Playwright.
    Supports Greenhouse, Lever, Ashby, and general ATS career portals.
    """

    def __init__(self, headless: bool = True):
        self.headless = headless

    def _split_name(self, full_name: str) -> tuple[str, str]:
        parts = (full_name or "").strip().split()
        if not parts:
            return "Aryanshh", "Srivastava"
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], " ".join(parts[1:])

    def _fill_input_if_exists(self, page: Page, selectors: List[str], value: str, label_hint: str, filled_list: List[str]) -> bool:
        if not value:
            return False
        for sel in selectors:
            try:
                locator = page.locator(sel).first
                if locator.is_visible(timeout=800):
                    locator.fill(str(value))
                    filled_list.append(label_hint)
                    return True
            except Exception:
                continue
        return False

    def _select_radio_or_dropdown(self, page: Page, question_pattern: str, target_option: str, filled_list: List[str], label_hint: str) -> bool:
        """Heuristic handler for common Yes/No radio buttons or selects."""
        try:
            # Look for labels containing question_pattern
            labels = page.locator("label").all()
            for lbl in labels:
                txt = lbl.inner_text().lower()
                if re.search(question_pattern, txt):
                    # Check for radio within or nearby
                    radios = lbl.locator('input[type="radio"]').all()
                    for r in radios:
                        r_val = (r.get_attribute("value") or "").lower()
                        if target_option.lower() in r_val:
                            r.check(force=True)
                            filled_list.append(label_hint)
                            return True
        except Exception:
            pass
        return False

    def _upload_resume(self, page: Page, resume_path: str, filled_list: List[str]) -> bool:
        if not resume_path or not os.path.exists(resume_path):
            return False
        selectors = [
            'input[type="file"][name*="resume" i]',
            'input[type="file"][id*="resume" i]',
            'input[type="file"][name*="attach" i]',
            'input[type="file"][accept*="pdf" i]',
            'input[type="file"]',
        ]
        for sel in selectors:
            try:
                file_input = page.locator(sel).first
                if file_input.count() > 0:
                    file_input.set_input_files(resume_path)
                    filled_list.append("Resume Upload (IIM PDF)")
                    return True
            except Exception:
                continue
        return False

    def apply_single(
        self,
        url: str,
        profile_data: Dict[str, Any],
        resume_pdf_path: str,
        mode: str = "review",  # "review" (autofill + screenshot) or "submit"
    ) -> Dict[str, Any]:
        """
        Executes an automated application fill-out for a single job posting link.
        """
        run_id = uuid.uuid4().hex[:8]
        timestamp = datetime.now(timezone.utc).isoformat()
        logs: List[str] = []
        fields_filled: List[str] = []
        screenshot_filename = f"apply_{run_id}.png"
        screenshot_path = SCREENSHOTS_DIR / screenshot_filename
        status = "failed"
        platform = "Generic Career Portal"

        first_name, last_name = self._split_name(profile_data.get("full_name", ""))
        full_name = profile_data.get("full_name", f"{first_name} {last_name}".strip())
        email = profile_data.get("email", "")
        phone = profile_data.get("phone", "")
        location = profile_data.get("location", "")
        linkedin = profile_data.get("linkedin_url", "")
        github = profile_data.get("github_url", "")
        portfolio = profile_data.get("portfolio_url", "")

        logs.append(f"[{timestamp}] Initiating Auto-Apply in '{mode.upper()}' mode.")
        logs.append(f"Target URL: {url}")
        logs.append(f"Candidate: {full_name} ({email})")

        # Detect platform from URL
        if "greenhouse.io" in url:
            platform = "Greenhouse"
        elif "lever.co" in url:
            platform = "Lever"
        elif "ashbyhq.com" in url:
            platform = "Ashby"
        elif "workday" in url:
            platform = "Workday"

        logs.append(f"Detected Platform: {platform}")

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={"width": 1366, "height": 900},
            )
            page = context.new_page()

            try:
                logs.append("Navigating to application link...")
                page.goto(url, wait_until="domcontentloaded", timeout=25000)
                time.sleep(1.5)

                # 1. Fill Name
                # First try first + last name
                filled_first = self._fill_input_if_exists(
                    page,
                    ['#first_name', 'input[name*="first_name" i]', 'input[name="firstName"]', 'input[autocomplete="given-name"]'],
                    first_name,
                    "First Name",
                    fields_filled,
                )
                filled_last = self._fill_input_if_exists(
                    page,
                    ['#last_name', 'input[name*="last_name" i]', 'input[name="lastName"]', 'input[autocomplete="family-name"]'],
                    last_name,
                    "Last Name",
                    fields_filled,
                )
                if not (filled_first and filled_last):
                    self._fill_input_if_exists(
                        page,
                        ['#name', 'input[name="name"]', 'input[name*="full_name" i]', 'input[placeholder*="full name" i]'],
                        full_name,
                        "Full Name",
                        fields_filled,
                    )

                # 2. Fill Email
                self._fill_input_if_exists(
                    page,
                    ['#email', 'input[type="email"]', 'input[name*="email" i]'],
                    email,
                    "Email Address",
                    fields_filled,
                )

                # 3. Fill Phone
                self._fill_input_if_exists(
                    page,
                    ['#phone', 'input[type="tel"]', 'input[name*="phone" i]'],
                    phone,
                    "Phone Number",
                    fields_filled,
                )

                # 4. Fill Location
                self._fill_input_if_exists(
                    page,
                    ['#location', 'input[name*="location" i]', 'input[name*="city" i]'],
                    location,
                    "Location",
                    fields_filled,
                )

                # 5. Fill Socials & Links
                self._fill_input_if_exists(
                    page,
                    ['input[name*="linkedin" i]', 'input[placeholder*="linkedin" i]', 'input[name*="urls[LinkedIn]"]'],
                    linkedin,
                    "LinkedIn Profile",
                    fields_filled,
                )
                self._fill_input_if_exists(
                    page,
                    ['input[name*="github" i]', 'input[placeholder*="github" i]', 'input[name*="urls[GitHub]"]'],
                    github,
                    "GitHub Profile",
                    fields_filled,
                )
                self._fill_input_if_exists(
                    page,
                    ['input[name*="website" i]', 'input[name*="portfolio" i]', 'input[name*="urls[Portfolio]"]'],
                    portfolio,
                    "Portfolio Website",
                    fields_filled,
                )

                # 6. Work Authorization heuristics
                self._select_radio_or_dropdown(page, r"authorized to work", "yes", fields_filled, "Work Authorization: Yes")
                self._select_radio_or_dropdown(page, r"require.*sponsorship", "no", fields_filled, "Visa Sponsorship: No")

                # 7. Upload IIM Resume (PDF)
                uploaded = self._upload_resume(page, resume_pdf_path, fields_filled)
                if uploaded:
                    logs.append(f"Successfully attached compiled IIM Resume: {os.path.basename(resume_pdf_path)}")
                else:
                    logs.append("No file upload input detected or resume already pre-populated.")

                # Wait for any dynamic DOM updates
                time.sleep(1)

                # 8. Capture Verification Screenshot
                page.screenshot(path=str(screenshot_path), full_page=False)
                logs.append(f"Captured verification screenshot: {screenshot_filename}")

                # 9. Handle Submit if in submit mode
                if mode == "submit":
                    logs.append("Submitting application...")
                    submit_btn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit Application"), button:has-text("Submit")').first
                    if submit_btn.is_visible(timeout=2000):
                        submit_btn.click()
                        time.sleep(3)
                        # Re-take confirmation screenshot
                        page.screenshot(path=str(screenshot_path), full_page=False)
                        status = "submitted"
                        logs.append("Submission button triggered successfully!")
                    else:
                        status = "ready_for_review"
                        logs.append("Submit button was not clickable or requires manual CAPTCHA review.")
                else:
                    status = "ready_for_review"
                    logs.append("All available fields filled. Ready for final user review.")

            except PlaywrightTimeoutError:
                logs.append("Warning: Timed out waiting for some form elements to load.")
                status = "partial_fill"
                try:
                    page.screenshot(path=str(screenshot_path), full_page=False)
                except Exception:
                    pass
            except Exception as ex:
                logger.error(f"Auto-applier error for {url}: {ex}")
                logs.append(f"Error during auto-application: {str(ex)}")
                status = "error"
                try:
                    page.screenshot(path=str(screenshot_path), full_page=False)
                except Exception:
                    pass
            finally:
                browser.close()

        # Build relative screenshot URL
        screenshot_url = f"/api/auto-apply/screenshot/{screenshot_filename}" if os.path.exists(screenshot_path) else None

        return {
            "run_id": run_id,
            "url": url,
            "platform": platform,
            "status": status,
            "mode": mode,
            "fields_filled": fields_filled,
            "fields_count": len(fields_filled),
            "screenshot_url": screenshot_url,
            "resume_attached": os.path.basename(resume_pdf_path) if resume_pdf_path else None,
            "timestamp": timestamp,
            "logs": logs,
        }

    def process_batch(
        self,
        urls: List[str],
        profile_data: Dict[str, Any],
        resume_pdf_path: str,
        mode: str = "review",
        user_id: str = "default_user",
    ) -> List[Dict[str, Any]]:
        """
        Processes a batch of URLs sequentially and records results into the Application Tracker.
        """
        results = []
        db = SessionLocal()
        try:
            for url in urls:
                clean_url = (url or "").strip()
                if not clean_url or not (clean_url.startswith("http://") or clean_url.startswith("https://")):
                    continue

                res = self.apply_single(clean_url, profile_data, resume_pdf_path, mode=mode)
                results.append(res)

                # Automatically link/sync into Application Tracker
                try:
                    # Find if job exists with this URL
                    job = db.query(Job).filter(Job.apply_url == clean_url).first()
                    job_id = job.id if job else f"auto_{uuid.uuid4().hex[:12]}"
                    
                    if not job:
                        # Create an auto-intake job entry so tracker can show it
                        job = Job(
                            id=job_id,
                            title=f"Role at {res.get('platform', 'External Job')}",
                            company=res.get("platform", "Direct Company"),
                            location="Remote",
                            apply_url=clean_url,
                            source="Auto-Applier",
                            description="Auto-applied via InternScrap IIM Auto Applier.",
                        )
                        db.add(job)
                        db.commit()

                    app_status = "applied" if res.get("status") == "submitted" else "saved"
                    app_record = db.query(Application).filter(Application.job_id == job_id).first()
                    if not app_record:
                        app_record = Application(
                            id=str(uuid.uuid4()),
                            job_id=job_id,
                            status=app_status,
                            applied_date=datetime.now(timezone.utc) if app_status == "applied" else None,
                            notes=f"Processed by IIM Auto Applier ({res.get('platform')}). Fields filled ({res.get('fields_count', 0)}): {', '.join(res.get('fields_filled', []))}. Screenshot: {res.get('screenshot_url')}",
                        )
                        db.add(app_record)
                    else:
                        app_record.status = app_status
                        if app_status == "applied":
                            app_record.applied_date = datetime.now(timezone.utc)
                        app_record.notes = (app_record.notes or "") + f"\n[Auto-Apply] {res.get('status')}: {', '.join(res.get('fields_filled', []))}"
                    db.commit()
                except Exception as sync_err:
                    logger.warning(f"Failed to record application to tracker: {sync_err}")
                    db.rollback()

        finally:
            db.close()

        return results
