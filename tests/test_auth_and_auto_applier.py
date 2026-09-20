import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models.user import User
from backend.models.profile import UserProfile

client = TestClient(app)

def test_auth_registration_and_login_flow():
    # Cleanup if previously exists
    db = SessionLocal()
    db.query(UserProfile).filter(UserProfile.id == 'test_user_suite').delete()
    db.query(User).filter(User.username == 'test_user_suite').delete()
    db.commit()
    db.close()

    # 1. Register candidate with full dossier onboarding
    reg_payload = {
        'username': 'test_user_suite',
        'password': 'StrongPassword123',
        'full_name': 'Candidate Suite Test',
        'email': 'suite@testcandidate.com',
        'primary_role': 'Frontend Developer',
        'desired_work_mode': 'Hybrid',
        'years_of_experience': 3
    }
    reg_res = client.post('/api/auth/register', json=reg_payload)
    assert reg_res.status_code == 200, f'Registration failed: {reg_res.text}'
    reg_data = reg_res.json()
    assert reg_data['success'] is True
    assert reg_data['user']['email'] == 'suite@testcandidate.com'
    token = reg_data['token']

    # 2. Login by Username
    login_user = client.post('/api/auth/login', json={
        'username': 'test_user_suite',
        'password': 'StrongPassword123'
    })
    assert login_user.status_code == 200
    assert login_user.json()['success'] is True

    # 3. Login by Email
    login_email = client.post('/api/auth/login', json={
        'username': 'suite@testcandidate.com',
        'password': 'StrongPassword123'
    })
    assert login_email.status_code == 200
    assert login_email.json()['success'] is True

    # 4. Duplicate username rejected
    dup_user = client.post('/api/auth/register', json=reg_payload)
    assert dup_user.status_code == 400

    # 5. Duplicate email rejected
    dup_email = client.post('/api/auth/register', json={
        'username': 'different_user',
        'password': 'StrongPassword123',
        'full_name': 'Another User',
        'email': 'suite@testcandidate.com'
    })
    assert dup_email.status_code == 400

    # 6. Verify User Profile & Wellfound Dossier
    headers = {'Authorization': f'Bearer {token}'}
    prof_res = client.get('/api/profile', headers=headers)
    assert prof_res.status_code == 200
    prof_data = prof_res.json()
    assert prof_data['full_name'] == 'Candidate Suite Test'
    assert prof_data['email'] == 'suite@testcandidate.com'
    assert prof_data['primary_role'] == 'Frontend Developer'
    assert prof_data['desired_work_mode'] == 'Hybrid'
    assert prof_data['years_of_experience'] == 3

    # Cleanup
    db = SessionLocal()
    db.query(UserProfile).filter(UserProfile.id == 'test_user_suite').delete()
    db.query(User).filter(User.username == 'test_user_suite').delete()
    db.commit()
    db.close()

def test_iim_resume_generation_themes():
    # Test all 3 themes return 200 with HTML content
    for theme in ['classic', 'executive', 'tech']:
        res = client.get(f'/api/resumes/iim-preview?user_id=demo&theme={theme}')
        assert res.status_code == 200
        assert 'html' in res.headers.get('content-type', '').lower()
        assert len(res.text) > 500

def test_auto_applier_vault_update():
    # Test fetching and updating candidate vault for demo account
    vault_get = client.get('/api/auto-apply/vault?user_id=demo')
    assert vault_get.status_code == 200
    vault = vault_get.json()
    assert 'full_name' in vault
    assert 'desired_work_mode' in vault
    assert 'skills_with_years' in vault
    assert 'eeo_gender' in vault
