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
3. Once provisioned, navigate to **Project Settings** ➔ **Database**.
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
3. Click **New +** ➔ **Blueprint** (or **Web Service**):
   - If using **Blueprint**, select your repo. Render will automatically read `render.yaml`.
   - If creating manually as a **Web Service**:
     - **Name**: `internscrap-backend`
     - **Environment**: `Docker` (or `Python 3`)
     - **DockerfilePath**: `./Dockerfile`
     - **Region**: Oregon (or your preferred region)
     - **Instance Type**: `Free`
4. In the **Environment Variables** tab, add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:password@db.ref.supabase.co:5432/postgres` | Your Supabase connection URI |
| `PORT` | `8000` | Standard web port |
| `CORS_ORIGINS` | `https://your-internscrap.vercel.app,http://localhost:5173` | Allowed frontend domains |
| `ENABLE_BACKGROUND_SCHEDULER` | `true` | Enables APScheduler automatic ingestion & alerts |
| `SCHEDULER_INTERVAL_HOURS` | `6` | Runs sync & alert pipeline every 6 hours |
| `ALERT_MIN_MATCH_SCORE` | `70.0` | Minimum score threshold for email digests |
| `DIGEST_RECIPIENT_EMAIL` | `youremail@example.com` | Candidate email for alerts |
| `SMTP_HOST` | `smtp.sendgrid.net` | (Optional) SMTP host for email delivery |
| `SMTP_PORT` | `587` | Standard TLS port |
| `SMTP_USER` | `apikey` | SendGrid user |
| `SMTP_PASSWORD` | `SG.your-sendgrid-secret-key` | SendGrid secret key |
| `SMTP_FROM_EMAIL` | `alerts@internscrap.dev` | Verified sender email address |

5. Click **Create Web Service**. The build will:
   - Install all dependencies from `backend/requirements.txt`.
   - Pre-download the `SentenceTransformer('all-MiniLM-L6-v2')` model into the Docker layer to eliminate runtime cold starts.
   - Start Uvicorn on `0.0.0.0:8000`.
6. Once deployed, note your service URL (e.g., `https://internscrap-backend.onrender.com`). Verify by visiting `https://internscrap-backend.onrender.com/api/jobs/stats`.

---

### Option B: Deploy on Railway

1. Log in to [railway.app](https://railway.app).
2. Click **New Project** ➔ **Deploy from GitHub repo**.
3. Railway automatically detects `Dockerfile` and `railway.json`.
4. Add the same Environment Variables listed above under **Variables**.
5. Under **Settings**, click **Generate Domain** (e.g., `https://internscrap-backend.up.railway.app`).

---

## Step 3: Frontend Deployment (Vercel)

1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** ➔ **Project** and import your GitHub repository.
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `yarn build` (or `npm run build`)
   - **Output Directory**: `dist`
4. In **Environment Variables**, add:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://internscrap-backend.onrender.com/api` (use your actual Render/Railway backend URL with the `/api` suffix)
5. Click **Deploy**. Vercel will build the frontend and serve it globally on edge nodes.
6. Copy your Vercel production URL (e.g., `https://internscrap.vercel.app`) and ensure it is included in the backend's `CORS_ORIGINS` variable.

---

## Step 4: Keep-Alive & Cold-Start Optimization

> [!TIP]
> **Free Tier Keep-Alive Strategy**: Render free-tier services spin down after 15 minutes without incoming HTTP traffic. When asleep, internal background timers pause until awakened.

To keep your `APScheduler` background daemon active 24/7 at **\$0 cost**:
1. Register a free account at [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).
2. Create a new HTTP monitor:
   - **URL**: `https://internscrap-backend.onrender.com/api/jobs/stats`
   - **Schedule**: Every 10 minutes (`*/10 * * * *`)
   - **Method**: `GET`
3. This lightweight health check query:
   - Keeps the FastAPI container warm with instant zero-second response times for end users.
   - Guarantees `APScheduler` fires uninterrupted to discover new jobs and deliver email digests.
   - Consumes negligible bandwidth.

---

## Step 5: Post-Deployment Verification Checklist

Verify each feature in production:

- [ ] **Job Ingestion**: Click the **Sync APIs** button in the header. Check that listings populate from RemoteOK, Arbeitnow, Jobicy, and GitHub.
- [ ] **Manual Intake**: Click **Paste Job** to paste a listing from a site that prohibits automated scraping (e.g., LinkedIn or Indeed).
- [ ] **Resume Matching**: Upload a PDF or DOCX resume. Verify that the match score pills and factual gap analysis tags appear on every card.
- [ ] **Resume Tailoring**: Click **Tailor Resume** on any job card. Verify that the Zero-Fabrication Diff modal loads and you can download the tailored ATS `.docx` document.
- [ ] **Application Pipeline**: Click the **Track** bookmark on 2-3 jobs. Navigate to the **Tracker** tab and move cards between `Saved`, `Applied`, `Interviewing`, `Offer`, and `Rejected`. Add custom interview notes.
- [ ] **Automated Digest**: Click **Email Digest** in the header. Confirm the green "APScheduler: Active & Running" badge and review the live HTML newsletter preview.
