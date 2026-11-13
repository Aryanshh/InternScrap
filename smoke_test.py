import urllib.request
import json
import time

base = "http://127.0.0.1:8000"

def call(method, path, body=None, token=None, timeout=35):
    url = f"{base}{path}"
    headers = {"Content-Type": "application/json", "User-Agent": "TestRunner"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            try:
                return r.status, json.loads(raw)
            except Exception:
                return r.status, raw
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = err_body
        return e.code, err_json
    except Exception as e:
        return 500, str(e)

print("--- 1. Testing Auth Endpoints ---")
s, r = call("POST", "/api/auth/login", {"username": "Aryanshh", "password": "Aryanshh123"})
print(f"Login Aryanshh: status={s}, success={r.get('success')}, token={r.get('token')[:15]}...")
token = r.get("token")

s, r = call("POST", "/api/auth/login", {"username": "Nishtha", "password": "Nishtha123"})
print(f"Login Nishtha: status={s}, success={r.get('success')}")

s, r = call("GET", "/api/auth/me", token=token)
print(f"Auth me: status={s}, user={r.get('username') if isinstance(r, dict) else r}")

s, r = call("GET", "/api/auth/presets")
presets = [p["id"] for p in r] if isinstance(r, list) else r
print(f"Auth presets: status={s}, ids={presets}")

print("\n--- 2. Testing Profile Endpoints ---")
s, r = call("GET", "/api/profile?user_id=Aryanshh", token=token)
print(f"Get Aryanshh Profile: status={s}, full_name={r.get('full_name') if isinstance(r, dict) else r}")

s, r = call("GET", "/api/profile/list")
profiles = [p["id"] for p in r] if isinstance(r, list) else r
print(f"Profile List: status={s}, ids={profiles}")

print("\n--- 3. Testing Jobs Endpoints ---")
s, r = call("GET", "/api/jobs?page=1&page_size=3")
total = r.get("total") if isinstance(r, dict) else 0
items = len(r.get("items", [])) if isinstance(r, dict) else 0
print(f"Get Jobs: status={s}, total={total}, items={items}")

s, r = call("GET", "/api/jobs/stats")
total_jobs = r.get("total_jobs") if isinstance(r, dict) else r
print(f"Get Job Stats: status={s}, total_jobs={total_jobs}")

s, r = call("GET", "/api/jobs/categories")
cat_count = len(r) if isinstance(r, list) else r
print(f"Get Job Categories: status={s}, count={cat_count}")

print("\n--- 4. Testing Daily 21 & Queued Jobs ---")
s, r = call("GET", "/api/daily-21?user_id=Aryanshh")
d21_total = r.get("total") if isinstance(r, dict) else 0
d21_jobs = len(r.get("jobs", [])) if isinstance(r, dict) else 0
print(f"Get Daily 21: status={s}, total={d21_total}, jobs={d21_jobs}")

s, r = call("GET", "/api/auto-apply/queued-jobs?mode=saved&user_id=Aryanshh")
saved_count = r.get("count") if isinstance(r, dict) else r
print(f"Get Queued Jobs (saved): status={s}, count={saved_count}")

s, r = call("GET", "/api/auto-apply/queued-jobs?mode=top_matches&user_id=Aryanshh")
top_count = r.get("count") if isinstance(r, dict) else r
print(f"Get Queued Jobs (top_matches): status={s}, count={top_count}")

print("\n--- 5. Testing Threads Opportunity Radar ---")
s, r = call("GET", "/api/threads/opportunities")
th_count = r.get("count") if isinstance(r, dict) else r
vertical_counts = r.get("vertical_counts") if isinstance(r, dict) else {}
print(f"Get Threads Opportunities: status={s}, count={th_count}, counts={vertical_counts}")

for v in ["project", "internship", "tech", "collab", "graphic"]:
    sv, rv = call("GET", f"/api/threads/opportunities?vertical={v}")
    v_count = rv.get("count") if isinstance(rv, dict) else rv
    print(f"Threads vertical '{v}': status={sv}, count={v_count}")

s, r = call("GET", "/api/threads/stats")
stat_counts = r.get("vertical_counts") if isinstance(r, dict) else {}
print(f"Get Threads Stats: status={s}, interval={r.get('scan_interval_minutes')}m, stats={stat_counts}")

s, r = call("GET", "/api/threads/config")
th_cfg = r.get("scan_interval_minutes") if isinstance(r, dict) else r
print(f"Get Threads Config: status={s}, scan_interval={th_cfg}m")

print("\n--- 6. Testing Google Forms ---")
s, r = call("GET", "/api/google-forms/jobs")
gf_count = r.get("count") if isinstance(r, dict) else r
print(f"Get Google Forms Jobs: status={s}, count={gf_count}")

print("\n--- 7. Testing Auto-Apply Vault ---")
s, r = call("GET", "/api/auto-apply/vault?user_id=Aryanshh")
vault_name = r.get("full_name") if isinstance(r, dict) else r
print(f"Get Auto-Apply Vault: status={s}, full_name={vault_name}")

print("\n--- 8. Testing Application Tracker ---")
s, r = call("GET", "/api/applications")
apps_count = len(r) if isinstance(r, list) else r
print(f"Get Applications: status={s}, count={apps_count}")

print("\n--- 9. Testing Scheduler & Digest ---")
s, r = call("GET", "/api/scheduler/status")
sched_running = r.get("is_running") if isinstance(r, dict) else r
print(f"Get Scheduler Status: status={s}, running={sched_running}")

s, r = call("GET", "/api/digest/latest")
has_digest = r.get("has_digest") if isinstance(r, dict) else r
print(f"Get Latest Digest: status={s}, has_digest={has_digest}")

print("\n--- 10. Testing Resume Themes Preview ---")
for theme in ["classic", "executive", "tech"]:
    s, r = call("GET", f"/api/resumes/iim-preview?user_id=Aryanshh&theme={theme}")
    html_ok = "html" in str(r).lower()
    print(f"Theme '{theme}' preview: status={s}, is_html={html_ok}")
