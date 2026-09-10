import axios from 'axios';
import { JobListResponse, JobStatsResponse, Job, ResumeData, TailoredResumeResult, ApplicationItem, SchedulerStatus, UserProfile } from '../types/job';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getJobs = async (params: Record<string, any>): Promise<JobListResponse> => {
  const cleanParams: Record<string, any> = {};
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'all') {
      cleanParams[key] = val;
    }
  });
  const res = await api.get<JobListResponse>('/jobs', { params: cleanParams });
  return res.data;
};

export const getStats = async (): Promise<JobStatsResponse> => {
  const res = await api.get<JobStatsResponse>('/jobs/stats');
  return res.data;
};

export const getCategories = async (): Promise<string[]> => {
  const res = await api.get<string[]>('/jobs/categories');
  return res.data;
};

export const triggerIngest = async (limitPerSource: number = 40): Promise<any> => {
  const res = await api.post('/ingest', null, { params: { limit_per_source: limitPerSource } });
  return res.data;
};

export const createManualJob = async (jobData: {
  title: string;
  company: string;
  location?: string;
  remote_type: string;
  category?: string;
  is_internship: boolean;
  description: string;
  apply_url?: string;
  salary_range?: string;
}): Promise<Job> => {
  const res = await api.post<Job>('/jobs/manual', jobData);
  return res.data;
};

export const verifyJobLink = async (jobId: string): Promise<any> => {
  const res = await api.post(`/jobs/${jobId}/verify-link`);
  return res.data;
};

export const getActiveResume = async (): Promise<ResumeData | null> => {
  const res = await api.get<ResumeData | null>('/resumes/active');
  return res.data;
};

export const uploadResume = async (file: File): Promise<ResumeData> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<ResumeData>('/resumes/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const generateTailoredResume = async (jobId: string): Promise<TailoredResumeResult> => {
  const res = await api.post<TailoredResumeResult>(`/jobs/${jobId}/tailor`);
  return res.data;
};

export const checkTailoredResume = async (jobId: string): Promise<{ tailored: boolean; data?: TailoredResumeResult }> => {
  const res = await api.get<any>(`/jobs/${jobId}/tailored`);
  return res.data;
};

export const getResumeDownloadUrl = (tailoredId: string): string => {
  return `${API_BASE}/resumes/download/${tailoredId}`;
};

export const getApplications = async (status?: string): Promise<ApplicationItem[]> => {
  const res = await api.get<ApplicationItem[]>('/applications', {
    params: status && status !== 'all' ? { status } : {}
  });
  return res.data;
};

export const trackApplication = async (jobId: string, status: string = 'saved', notes: string = ''): Promise<ApplicationItem> => {
  const res = await api.post<ApplicationItem>('/applications', {
    job_id: jobId,
    status,
    notes
  });
  return res.data;
};

export const updateApplication = async (appId: string, updates: Partial<{ status: string; notes: string; applied_date: string; tailored_resume_id: string }>): Promise<ApplicationItem> => {
  const res = await api.patch<ApplicationItem>(`/applications/${appId}`, updates);
  return res.data;
};

export const deleteApplication = async (appId: string): Promise<{ success: boolean; deleted_id: string }> => {
  const res = await api.delete<{ success: boolean; deleted_id: string }>(`/applications/${appId}`);
  return res.data;
};

export const getSchedulerStatus = async (): Promise<SchedulerStatus> => {
  const res = await api.get<SchedulerStatus>('/scheduler/status');
  return res.data;
};

export const triggerScheduler = async (): Promise<any> => {
  const res = await api.post('/scheduler/trigger');
  return res.data;
};

export const getDigestLatest = async (): Promise<{ has_digest: boolean; html: string }> => {
  const res = await api.get<{ has_digest: boolean; html: string }>('/digest/latest');
  return res.data;
};

export const getDigestHtmlUrl = (): string => {
  return `${API_BASE}/digest/html`;
};

export const getProfile = async (): Promise<UserProfile> => {
  const res = await api.get<UserProfile>('/profile');
  return res.data;
};

export const updateProfile = async (data: Partial<UserProfile>): Promise<any> => {
  const res = await api.put('/profile', data);
  return res.data;
};

export const syncProfileFromResume = async (): Promise<any> => {
  const res = await api.post('/profile/sync-from-resume');
  return res.data;
};

export const getProfileDocxUrl = (): string => {
  return `${API_BASE}/profile/export-docx`;
};

