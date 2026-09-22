import os
import sys
import pytest
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.auto_applier import AutoApplierEngine

@pytest.fixture(scope="module")
def browser_context():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        yield context
        context.close()
        browser.close()

def test_has_application_form_detection(browser_context):
    service = AutoApplierEngine()
    page = browser_context.new_page()

    # 1. Job description page without form inputs
    jd_html = """
    <html>
        <body>
            <h1>Senior Full Stack Engineer</h1>
            <p>We are seeking a talented engineer to join our team.</p>
            <button id="apply-btn">Apply Now</button>
        </body>
    </html>
    """
    page.set_content(jd_html)
    assert service._has_application_form(page) is False

    # 2. Application form page with inputs
    form_html = """
    <html>
        <body>
            <h1>Apply for Senior Full Stack Engineer</h1>
            <form>
                <label>First Name: <input name="first_name" type="text" /></label>
                <label>Email: <input name="email" type="email" /></label>
                <label>Resume: <input type="file" /></label>
            </form>
        </body>
    </html>
    """
    page.set_content(form_html)
    assert service._has_application_form(page) is True
    page.close()

def test_smart_entry_navigates_to_form(browser_context):
    service = AutoApplierEngine()
    page = browser_context.new_page()

    # Job description page that reveals form upon clicking 'Apply Now'
    jd_with_interactive_apply = """
    <html>
        <body>
            <h1>Backend Developer - Python</h1>
            <div id="job-desc">Great job details here.</div>
            <button id="apply-btn" onclick="document.getElementById('form-container').style.display='block'">Apply for this job</button>
            <div id="form-container" style="display:none; margin-top:20px;">
                <input name="first_name" placeholder="First Name" />
                <input name="email" placeholder="Email Address" />
                <input type="file" name="resume" />
            </div>
        </body>
    </html>
    """
    page.set_content(jd_with_interactive_apply)
    logs = []

    # Before resolution, form is not detected
    assert service._has_application_form(page) is False

    # Run resolution
    resolved_page, final_url = service._resolve_application_page(browser_context, page, logs)
    
    # After resolution, 'Apply for this job' was clicked and form inputs are visible
    assert service._has_application_form(resolved_page) is True
    assert any("Located primary application action element" in log for log in logs)
    page.close()

def test_frame_and_page_filling_compatibility(browser_context):
    service = AutoApplierEngine()
    page = browser_context.new_page()

    # Form with inputs to test helper functions
    html = """
    <html>
        <body>
            <input id="first_name" type="text" />
            <input id="last_name" type="text" />
            <select id="gender">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="decline">Decline to self-identify</option>
            </select>
        </body>
    </html>
    """
    page.set_content(html)
    filled = []

    # Fill text input
    success = service._fill_input_if_exists(page, ["#first_name"], "Aryan", "First Name", filled)
    assert success is True
    assert "First Name" in filled
    assert page.locator("#first_name").input_value() == "Aryan"

    # Select dropdown
    dropdown_success = service._select_dropdown_by_text(page, ["#gender"], "Decline", "Gender", filled)
    assert dropdown_success is True
    assert "Gender" in filled
    assert page.locator("#gender").input_value() == "decline"

    page.close()
