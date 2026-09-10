export interface JobMatch {
  keyword_score: number;
  semantic_score: number;
  blended_score: number;
  gap_list: string[];
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  remote_type: 'remote' | 'hybrid' | 'on-site' | string;
  category: string;
  is_internship: boolean;
  description: string;
  apply_urls: string[];
  sources: string[];
  primary_source: string;
  posted_date: string | null;
  salary_range: string | null;
  is_active: boolean;
  is_stale_link: boolean;
  fingerprint: string;
  created_at: string | null;
  updated_at: string | null;
  match?: JobMatch | null;
}

export interface JobListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Job[];
}

export interface JobStatsResponse {
  total_jobs: number;
  active_jobs: number;
  remote_jobs: number;
  internship_jobs: number;
  sources: Record<string, number>;
  categories: Record<string, number>;
}

export interface ParsedResumeJSON {
  skills: string[];
  tools: string[];
  experience: string[];
  projects: string[];
  education: string[];
}

export interface ResumeData {
  id: string;
  filename: string;
  raw_text: string;
  parsed_json: ParsedResumeJSON;
  is_active: boolean;
  created_at: string | null;
}

export interface FilterState {
  search: string;
  remote_type: string;
  category: string;
  is_internship: boolean | null;
  source: string;
  min_match_score?: number;
  sort_by: string;
  page: number;
}

export interface BulletAuditItem {
  original_rank: number;
  new_rank: number;
  bullet_id: string;
  text: string;
  score: number;
  matched_keywords: string[];
}

export interface TailoredDiffSummary {
  job_title: string;
  company: string;
  stats: {
    skills_promoted: number;
    unmatched_jd_requirements: number;
    bullets_reordered: number;
    skills_fabricated: number;
  };
  promoted_skills: string[];
  additional_skills: string[];
  unmatched_jd_requirements: string[];
  reordered_bullets: BulletAuditItem[];
}

export interface TailoredJSON {
  header: {
    name: string;
    headline: string;
    contact: string;
    summary: string;
  };
  targeted_role: string;
  skills: {
    core_matched: string[];
    additional: string[];
    tools: string[];
  };
  experience: Array<{
    title: string;
    company_date: string;
    bullets: string[];
    bullet_details?: BulletAuditItem[];
  }>;
  projects: Array<{
    title: string;
    bullets: string[];
    score: number;
    matched_keywords: string[];
  }>;
  education: string[];
}

export interface TailoredResumeResult {
  id: string;
  job_id: string;
  resume_id: string;
  job_title: string;
  company: string;
  diff_summary: TailoredDiffSummary;
  tailored_json: TailoredJSON;
  download_url: string;
}

export interface ApplicationItem {
  id: string;
  job_id: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';
  applied_date: string | null;
  notes: string;
  tailored_resume_id?: string | null;
  created_at: string | null;
  updated_at: string | null;
  job?: Job | null;
  match?: JobMatch | null;
  tailored_resume?: {
    id: string;
    download_url: string;
  } | null;
}

export interface SchedulerStatus {
  is_running: boolean;
  interval_hours: number;
  next_run_time: string | null;
  last_run: string | null;
  last_run_stats?: {
    new_jobs_ingested: number;
    high_matches_found: number;
    digest_sent: boolean;
  };
  alert_min_score: number;
}

export interface WorkExperienceItem {
  company: string;
  role: string;
  location?: string;
  start_date: string;
  end_date: string;
  bullets: string[];
}

export interface EducationItem {
  institution: string;
  degree: string;
  grad_year: string;
  gpa?: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  headline?: string;
  bio?: string;
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  desired_work_mode: string;
  min_salary?: number;
  min_hourly_rate?: number;
  target_platforms: string[];
  skills: string[];
  experience: WorkExperienceItem[];
  education: EducationItem[];
  digest_enabled: boolean;
  digest_frequency: string;
  digest_min_score: number;
  updated_at: string | null;
  active_resume?: {
    id: string;
    filename: string;
    uploaded_at: string | null;
  } | null;
}

export interface LoginProfileSummary {
  id: string;
  full_name: string;
  headline: string;
  email: string;
  avatar: string;
  role_tag: string;
  skills_count: number;
  desired_work_mode: string;
  min_hourly_rate?: number;
  target_platforms?: string[];
}


