import axios from 'axios';
import {
  JobListResponse,
  JobStatsResponse,
  Job,
  ResumeData,
  TailoredResumeResult,
  ApplicationItem,
  SchedulerStatus,
  UserProfile,
  LoginProfileSummary,
  AuthResponse,
  AuthUser,
  UserPreset,
} from '../types/job';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('internscrap_auth_token');
  const userId = localStorage.getItem('internscrap_user_id') || 'Aryanshh';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-User-Id'] = userId;
  return config;
});

export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/login', { username, password });
  if (res.data.token) {
    localStorage.setItem('internscrap_auth_token', res.data.token);
    setActiveUserId(res.data.user.id);
  }
  return res.data;
};

export const register = async (username: string, password: string, fullName?: string): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/register', { username, password, full_name: fullName });
  if (res.data.token) {
    localStorage.setItem('internscrap_auth_token', res.data.token);
    setActiveUserId(res.data.user.id);
  }
  return res.data;
};

export const getAuthPresets = async (): Promise<UserPreset[]> => {
  const res = await api.get<UserPreset[]>('/auth/presets');
  return res.data;
};

export const getCurrentAuthUser = async (): Promise<AuthUser> => {
  const res = await api.get<AuthUser>('/auth/me');
  return res.data;
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('internscrap_auth_token');
};

export const clearAuth = (): void => {
  localStorage.removeItem('internscrap_auth_token');
  localStorage.removeItem('internscrap_user_id');
};

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

export const getActiveUserId = (): string => {
  return localStorage.getItem('internscrap_user_id') || 'Aryanshh';
};

export const setActiveUserId = (userId: string): void => {
  localStorage.setItem('internscrap_user_id', userId);
};

export const getProfilesList = async (): Promise<LoginProfileSummary[]> => {
  const res = await api.get<LoginProfileSummary[]>('/profile/list');
  return res.data;
};

export const switchProfile = async (userId: string): Promise<any> => {
  setActiveUserId(userId);
  const res = await api.post('/profile/switch', { user_id: userId });
  return res.data;
};

export const getProfile = async (userId?: string): Promise<UserProfile> => {
  const uid = userId || getActiveUserId();
  const res = await api.get<UserProfile>('/profile', { params: { user_id: uid } });
  return res.data;
};

export const updateProfile = async (data: Partial<UserProfile>, userId?: string): Promise<any> => {
  const uid = userId || getActiveUserId();
  const res = await api.put('/profile', data, { params: { user_id: uid } });
  return res.data;
};

export const syncProfileFromResume = async (userId?: string): Promise<any> => {
  const uid = userId || getActiveUserId();
  const res = await api.post('/profile/sync-from-resume', {}, { params: { user_id: uid } });
  return res.data;
};

export const getProfileDocxUrl = (userId?: string): string => {
  const uid = userId || getActiveUserId();
  return `${API_BASE}/profile/export-docx?user_id=${encodeURIComponent(uid)}`;
};

export interface AutoApplyResult {
  run_id: string;
  url: string;
  platform: string;
  status: string;
  mode: string;
  fields_filled: string[];
  fields_count: number;
  screenshot_url?: string;
  resume_attached?: string;
  timestamp: string;
  logs: string[];
}

export interface AutoApplyBatchResponse {
  success: boolean;
  mode: string;
  total_requested: number;
  total_processed: number;
  results: AutoApplyResult[];
  resume_attached?: string;
}

export const runAutoApply = async (
  urls: string[],
  mode: 'review' | 'submit' = 'review',
  customAnswers?: Record<string, string>
): Promise<AutoApplyBatchResponse> => {
  const res = await api.post<AutoApplyBatchResponse>('/auto-apply/run', {
    urls,
    mode,
    user_id: getActiveUserId(),
    custom_answers: customAnswers,
  });
  return res.data;
};

export const getAutoApplyVault = async (): Promise<any> => {
  const res = await api.get('/auto-apply/vault', {
    params: { user_id: getActiveUserId() },
  });
  return res.data;
};

export const getIimPreviewUrl = (userId?: string): string => {
  const uid = userId || getActiveUserId();
  return `${API_BASE}/resumes/iim-preview?user_id=${encodeURIComponent(uid)}`;
};

export const getIimPdfUrl = (userId?: string): string => {
  const uid = userId || getActiveUserId();
  return `${API_BASE}/resumes/iim-download-pdf?user_id=${encodeURIComponent(uid)}`;
};

export const getIimDocxUrl = (userId?: string): string => {
  const uid = userId || getActiveUserId();
  return `${API_BASE}/resumes/iim-download-docx?user_id=${encodeURIComponent(uid)}`;
};



