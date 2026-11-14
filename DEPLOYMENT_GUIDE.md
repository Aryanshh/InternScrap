# InternScrap: 100% Free-Tier Production Deployment Guide

This guide provides step-by-step instructions to deploy the entire **InternScrap** application (FastAPI backend with APScheduler, React Vite frontend, and PostgreSQL database) completely free of charge using **Supabase**, **Render / Railway**, and **Vercel**.

---

## Architecture Overview

```mermaid
graph TD
    Client[Web Browser] -->|HTTPS Requests| Vercel[Vercel Frontend CDN\nReact + Vite + Tailwind]
    Vercel -->|REST API /api| Render[Render / Railway Web Service\nFastAPI + APScheduler Daemon]
    Render -->|PostgreSQL Wire Protocol| Supabase[Supabase Managed PostgreSQL\n500MB Free Tier]
    Render -->|SMTP Port 587| SendGrid[SendGrid / Mailgun\nFree Tier 100/day]
    UptimeRobot[UptimeRobot / cron-job.org\nPings /api/jobs/stats every 10m] -->|Keep-Alive Ping| Render
```

| Component | Platform | Free Tier Quota | Role |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | Unlimited personal hobby projects | Serves compiled React SPA via global edge network |
| **Backend** | **Render** or **Railway** | 750 free instance hours/month | Runs FastAPI, SentenceTransformer embeddings, APScheduler |
| **Database** | **Supabase** | 500MB PostgreSQL, 2 free projects | Stores jobs, resumes, match scores, applications, digests |
| **Email Alerts** | **SendGrid / Mailgun** | 100 free emails/day | Delivers HTML newsletter digests for high-match roles ($\ge 70\%$) |
| **Keep-Alive** | **cron-job.org / UptimeRobot** | Free unlimited monitor | Prevents Render free-tier sleep, keeping background jobs running |

---

## Step 1: Database Setup (Supabase PostgreSQL)

1. Navigate to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**:
   - **Name**: `internscrap-db`
   - **Database Password**: Choose a secure password (save this).
   - **Region**: Choose the region closest to your backend (e.g., `US East - Ohio / N. Virginia`).
3. Once provisioned, navigate to **Project Settings** -> **Database**.
4. Under **Connection string**, select **URI**:
   - **Transaction Pooler (Port 6543 - Recommended)**:
     ```
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - **Direct Connection (Port 5432)**:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
     ```
5. *Note*: You do not need to run manual SQL migration scripts. When the FastAPI application boots up, `Base.metadata.create_all(bind=engine)` automatically creates all tables (`jobs`, `resumes`, `job_matches`, `tailored_resumes`, `applications`, `digest_records`) with proper foreign keys and indexes.

---

## Step 2: Backend Deployment (Render or Railway)

### Option A: Deploy on Render (Recommended)

1. Push your repository to **GitHub**.
2. Log in to [render.com](https://render.com).
3. Click **New +** -> **Web Service**:
   - Connect your GitHub repository (`InternScrap`).
   - **Name**: `internscrap-backend`
   - **Region**: Oregon (or your preferred region)
   - **Environment**: **Python 3** (Recommended for fastest builds) or **Docker**
   - **Build Command** (for Python): `pip install -r requirements.txt`
   - **Start Command** (for Python): `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - *(If using Docker, leave defaults; `Dockerfile` is pre-configured and optimized)*
   - **Plan Type**: `Free`
4. Under **Advanced** / **Environment Variables**, add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:password@db.ref.supabase.co:5432/postgres` | Your Supabase connection URI (or omit to use local SQLite) |
| `PORT` | `10000` | Standard Render web port (auto-injected by Render) |
| `CORS_ORIGINS` | `*` | Allowed frontend domains (allows all Vercel domains) |
| `ENABLE_BACKGROUND_SCHEDULER` | `true` | Enables APScheduler automatic ingestion and 10-minute Threads scanner |
| `SCHEDULER_INTERVAL_HOURS` | `4` | Runs full multi-source API sync every 4 hours |
| `THREADS_SCAN_INTERVAL_MINUTES` | `10` | Runs Threads Opportunity Radar scanner every 10 minutes |
| `ALERT_MIN_MATCH_SCORE` | `60` | Minimum score threshold for email digests |
| `RENDER_EXTERNAL_URL` | `https://your-backend.onrender.com` | Automatically provided by Render for 24/7 keep-alive self-pinging |

5. Click **Create Web Service**. The deployment will install dependencies in under 30 seconds and start Uvicorn.
6. Once deployed, verify your service by visiting `https://your-backend.onrender.com/api/health` (returns `{"status":"healthy"}`).

---

### Option B: Deploy on Railway

1. Log in to [railway.app](https://railway.app).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Railway automatically detects `Dockerfile` and `railway.json`.
4. Add the same Environment Variables listed above under **Variables**.
5. Under **Settings**, click **Generate Domain** (e.g., `https://internscrap-backend.up.railway.app`).

---

## Step 3: Vercel Deployment

InternScrap supports two deployment modes on Vercel:

### Mode 1: All-in-One Vercel Deployment (Frontend + Serverless FastAPI Backend)

You can run the entire application directly on Vercel without creating a separate Render or Railway account:

1. Import your GitHub repository into [vercel.com](https://vercel.com).
2. Leave **Root Directory** as default (`.` / root).
3. Do NOT override the build command; Vercel automatically uses `vercel.json`:
   - Builds Vite frontend into `frontend/dist`.
   - Deploys `api/index.py` as a Python Serverless Function.
   - Automatically rewrites `/api/*` requests to the Python serverless backend.
   - Automatically initializes SQLite database with all tables, default users (`Aryanshh` and `Nishtha`), user profiles, and opportunity leads.
4. Click **Deploy**. Both the frontend and all API endpoints (`/api/jobs`, `/api/threads`, `/api/daily-21`, `/api/auth`, `/api/resumes`) will be live on your Vercel URL!

### Mode 2: Split Architecture (Vercel Frontend + Dedicated Render / Railway Backend)

If you prefer a persistent background worker (e.g., continuous 24/7 background scheduled scraping via APScheduler without serverless cold starts):

1. Deploy the backend to **Render** or **Railway** following Step 2 above.
2. In your Vercel project settings, navigate to **Settings** -> **Environment Variables**.
3. Add the following variable:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://your-backend.onrender.com/api` (use your actual Render/Railway URL with `/api` suffix)
4. Redeploy your Vercel project. The frontend will now automatically direct all API calls to your dedicated Render backend.
5. In your Render/Railway backend environment variables, ensure `CORS_ORIGINS` includes your Vercel domain (e.g., `https://your-app.vercel.app,*`).

---

## Step 4: Keep-Alive & 24/7 Continuous Operation

Render free-tier services spin down after 15 minutes of zero incoming HTTP traffic. To ensure your backend and 10-minute Threads scanner run 24/7 without interruption at **$0 cost**, InternScrap includes two complementary keep-alive layers:

### Layer 1: Built-in 9-Minute Self-Pinger

APScheduler automatically registers a 9-minute self-ping job (`render_keep_alive_ping`) in [backend/services/scheduler.py](file:///c:/Users/aryan/Desktop/InternScrap/internscrap-web/backend/services/scheduler.py).
- Render automatically sets `RENDER_EXTERNAL_URL=https://your-backend.onrender.com`.
- Every 9 minutes (well before the 15-minute sleep threshold), the scheduler sends an HTTP GET request to `https://your-backend.onrender.com/api/health`.
- This incoming request resets Render's idle timer, keeping the instance active 24/7.

### Layer 2: Free External Monitor (Guarantees Zero Cold Starts)

To ensure the instance stays awake even after maintenance restarts:
1. Create a free account at [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).
2. Create a new HTTP monitor:
   - **URL**: `https://your-backend.onrender.com/api/health` (or `/api/ping`)
   - **Interval**: Every 5 or 10 minutes (`*/10 * * * *`)
   - **Method**: `GET`
3. This guarantees:
   - Zero cold-start latency for end users visiting your Vercel frontend.
   - APScheduler continuously executes the 10-minute Meta Threads scanner without pausing.
   - Minimal bandwidth consumption (health check returns 48 bytes in under 1ms).

---

## Step 5: Post-Deployment Verification Checklist

Verify each feature in production:

- [ ] **Job Ingestion**: Click the **Sync APIs** button in the header. Check that listings populate from RemoteOK, Arbeitnow, Jobicy, and GitHub.
- [ ] **Manual Intake**: Click **Paste Job** to paste a listing from a site that prohibits automated scraping (e.g., LinkedIn or Indeed).
- [ ] **Resume Matching**: Upload a PDF or DOCX resume. Verify that the match score pills and factual gap analysis tags appear on every card.
- [ ] **Resume Tailoring**: Click **Tailor Resume** on any job card. Verify that the Zero-Fabrication Diff modal loads and you can download the tailored ATS `.docx` document.
- [ ] **Auto Applier & IIM Resume**: Open the Auto Applier modal. Click "Preview 1-Page IIM PDF" to verify pixel-perfect PDF rendering, or run review mode on Greenhouse/Lever URLs.
- [ ] **Application Pipeline**: Click the **Track** bookmark on 2-3 jobs. Navigate to the **Tracker** tab and move cards between `Saved`, `Applied`, `Interviewing`, `Offer`, and `Rejected`. Add custom interview notes.
- [ ] **Automated Digest**: Click **Email Digest** in the header. Confirm the green "APScheduler: Active & Running" badge and review the live HTML newsletter preview.
