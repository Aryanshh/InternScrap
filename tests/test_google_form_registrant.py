import os
import sys
import pytest
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.google_form_registrant import GoogleFormRegistrant

@pytest.fixture(scope="module")
def browser_context():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        yield context
        context.close()
        browser.close()

def test_google_form_question_classification():
    registrant = GoogleFormRegistrant(headless=True)
    profile = {
        "full_name": "Aryanshh Srivastava",
        "email": "aryan@example.com",
        "phone": "+1 (555) 019-2834",
        "location": "San Francisco, CA / Remote Worldwide",
        "linkedin_url": "https://linkedin.com/in/aryansharma",
        "github_url": "https://github.com/aryansharma",
        "portfolio_url": "https://aryansharma.dev",
        "education": [
            {"institution": "Indian Institute of Management", "degree": "Computer Science", "graduation_year": 2026}
        ],
        "work_authorization": "yes",
        "years_of_experience": 3,
        "personal_pitch": "Experienced full-stack engineer passionate about distributed systems.",
    }

    # 1. Name questions
    val, hint = registrant._classify_question("What is your Full Name? *", profile)
    assert val == "Aryanshh Srivastava"
    assert "Full Name" in hint

    val, _ = registrant._classify_question("First Name", profile)
    assert val == "Aryanshh"

    val, _ = registrant._classify_question("Last Name / Surname", profile)
    assert val == "Srivastava"

    # 2. Contact questions
    val, _ = registrant._classify_question("Email address for correspondence", profile)
    assert val == "aryan@example.com"

    val, _ = registrant._classify_question("Contact Phone Number / WhatsApp", profile)
    assert val == "+1 (555) 019-2834"

    # 3. Education questions
    val, _ = registrant._classify_question("College / University Name", profile)
    assert "Indian Institute of Management" in val

    val, _ = registrant._classify_question("Degree / Major / Branch", profile)
    assert "Computer Science" in val

    val, _ = registrant._classify_question("Year of Graduation / Batch", profile)
    assert val == "2026"

    # 4. Links
    val, _ = registrant._classify_question("LinkedIn Profile URL", profile)
    assert "linkedin.com" in val

    val, _ = registrant._classify_question("GitHub Profile link", profile)
    assert "github.com" in val

    val, _ = registrant._classify_question("Portfolio or Work Sample Website", profile)
    assert "aryansharma.dev" in val

    # 5. Work Authorization & Availability
    val, _ = registrant._classify_question("Are you legally authorized to work?", profile)
    assert val == "Yes"

    val, _ = registrant._classify_question("Are you open to remote work?", profile)
    assert val == "Yes"

    # 6. Pitch
    val, _ = registrant._classify_question("Why are you interested in joining this team?", profile)
    assert "full-stack engineer" in val.lower()


def test_google_form_dom_filling(browser_context):
    registrant = GoogleFormRegistrant(headless=True)
    page = browser_context.new_page()

    # Mock Google Form HTML structure with short-text, paragraph, and radio buttons
    gform_html = """
    <html>
        <body>
            <div class="Qr7Oae" role="listitem">
                <div role="heading">Your Full Name *</div>
                <input class="whsOnd" type="text" value="" />
            </div>

            <div class="Qr7Oae" role="listitem">
                <div role="heading">Your Email Address *</div>
                <input class="whsOnd" type="text" value="" />
            </div>

            <div class="Qr7Oae" role="listitem">
                <div role="heading">Why are you interested in this internship?</div>
                <textarea class="KHxj8b"></textarea>
            </div>

            <div class="Qr7Oae" role="listitem">
                <div role="heading">Are you available for remote work?</div>
                <div role="radio" data-value="Yes" aria-checked="false"><span>Yes</span></div>
                <div role="radio" data-value="No" aria-checked="false"><span>No</span></div>
            </div>
        </body>
    </html>
    """
    page.set_content(gform_html)

    profile = {
        "full_name": "Aryanshh Srivastava",
        "email": "aryan@example.com",
        "personal_pitch": "Passionate about building scalable backend platforms.",
    }

    containers = page.locator("div[role='listitem']").all()
    assert len(containers) == 4

    fields_filled = []
    logs = []

    for c in containers:
        registrant._fill_google_form_question(c, profile, fields_filled, logs)

    # Verify input values filled
    assert page.locator("input.whsOnd").first.input_value() == "Aryanshh Srivastava"
    assert page.locator("input.whsOnd").nth(1).input_value() == "aryan@example.com"
    assert "Passionate about" in page.locator("textarea.KHxj8b").input_value()
    assert len(fields_filled) >= 3

    page.close()
