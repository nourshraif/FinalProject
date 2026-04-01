import type {
  Job,
  Stats,
  Skill,
  Candidate,
  SavedCandidate,
  SearchHistoryItem,
  SaveProfileResponse,
  TokenResponse,
  RegisterRequest,
  User,
  UserProfile,
  JobApplication,
  SavedJob,
  CompanyProfile,
  ContactRequest,
  Notification,
  Subscription,
  PostedJob,
  ScrapedJob,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_BASE = BASE_URL;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { detail?: string };
      message = typeof json.detail === "string" ? json.detail : text;
    } catch {
      // use text as-is
    }
    throw new Error(message || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Upload PDF CV and get extracted skills */
export async function uploadCV(file: File): Promise<Skill[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload-cv`, {
    method: "POST",
    body: form,
  });
  const data = await handleResponse<{ skills: string[] }>(res);
  return data.skills;
}

/** Get job matches for a list of skills */
export async function matchJobs(skills: Skill[]): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/api/match-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills }),
  });
  return handleResponse<Job[]>(res);
}

/** Get jobs dashboard stats */
export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/api/jobs/stats`);
  return handleResponse<Stats>(res);
}

// ---------------------------------------------------------------------------
// Job search (scraped jobs)
// ---------------------------------------------------------------------------

export interface SearchJobsParams {
  q?: string;
  source?: string;
  location?: string;
  job_type?: string;
  date_posted?: string;
  sort_by?: string;
  limit?: number;
  offset?: number;
}

export interface SearchJobsResponse {
  jobs: ScrapedJob[];
  total: number;
  page: number;
  total_pages: number;
}

export async function searchJobs(
  params: SearchJobsParams = {}
): Promise<SearchJobsResponse> {
  const sp = new URLSearchParams();
  if (params.q != null) sp.set("q", params.q);
  if (params.source != null) sp.set("source", params.source);
  if (params.location != null) sp.set("location", params.location);
  if (params.job_type != null) sp.set("job_type", params.job_type);
  if (params.date_posted != null) sp.set("date_posted", params.date_posted);
  if (params.sort_by != null) sp.set("sort_by", params.sort_by);
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  const res = await fetch(`${API_BASE}/api/jobs/search${qs ? `?${qs}` : ""}`);
  return handleResponse<SearchJobsResponse>(res);
}

export async function getJobSources(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/jobs/sources`);
  return handleResponse<string[]>(res);
}

export async function getJobLocations(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/jobs/locations`);
  return handleResponse<string[]>(res);
}

// ---------------------------------------------------------------------------
// Posted jobs (company job postings)
// ---------------------------------------------------------------------------

export async function getPostedJobs(params?: {
  limit?: number;
  offset?: number;
  job_type?: string;
  experience_level?: string;
  search?: string;
}): Promise<PostedJob[]> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  if (params?.job_type) sp.set("job_type", params.job_type);
  if (params?.experience_level) sp.set("experience_level", params.experience_level);
  if (params?.search) sp.set("search", params.search);
  const q = sp.toString();
  const res = await fetch(`${API_BASE}/api/jobs/posted${q ? `?${q}` : ""}`);
  return handleResponse<PostedJob[]>(res);
}

export async function getPostedJobById(id: number): Promise<PostedJob> {
  const res = await fetch(`${API_BASE}/api/jobs/posted/${id}`);
  return handleResponse<PostedJob>(res);
}

export async function createPostedJob(
  token: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; job_id: number }> {
  const res = await fetch(`${API_BASE}/api/jobs/posted`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean; job_id: number }>(res);
}

export async function updatePostedJob(
  token: string,
  id: number,
  data: Record<string, unknown>
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/jobs/posted/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function deletePostedJob(
  token: string,
  id: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/jobs/posted/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function toggleJobActive(
  token: string,
  id: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/jobs/posted/${id}/toggle`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

/** Get current company's posted jobs (auth required). */
export async function getCompanyPostedJobs(
  token: string
): Promise<PostedJob[]> {
  const res = await fetch(`${API_BASE}/api/company/posted-jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<PostedJob[]>(res);
}

/** Trigger scraper run. No args = public endpoint; with token = admin endpoint. */
export async function runScraper(token?: string): Promise<{ status?: string; message?: string }> {
  if (token) {
    return runAdminScraper(token);
  }
  const res = await fetch(`${API_BASE}/api/scraper/run`, { method: "POST" });
  return handleResponse<{ status: string }>(res);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminStats {
  total_users: number;
  total_jobseekers: number;
  total_companies: number;
  total_jobs: number;
  total_applications: number;
  total_contact_requests: number;
  new_users_today: number;
  new_users_week: number;
  jobs_scraped_today: number;
}

export async function getAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AdminStats>(res);
}

export interface AdminUserRow {
  id: number;
  email: string;
  full_name: string;
  user_type: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export async function getAdminUsers(
  token: string,
  opts?: { limit?: number; offset?: number; search?: string }
): Promise<{ users: AdminUserRow[]; total: number }> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const search = opts?.search ?? "";
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search) params.set("search", search);
  const res = await fetch(`${API_BASE}/api/admin/users?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ users: AdminUserRow[]; total: number }>(res);
}

export async function toggleUserActive(
  token: string,
  userId: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/toggle-active`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function makeUserAdmin(
  token: string,
  userId: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/make-admin`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export interface AdminActivityItem {
  type: string;
  description: string;
  created_at: string;
}

export async function getAdminActivity(
  token: string
): Promise<AdminActivityItem[]> {
  const res = await fetch(`${API_BASE}/api/admin/activity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AdminActivityItem[]>(res);
}

/** Run scraper (admin only). */
export async function runAdminScraper(token: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/admin/scraper/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ message: string }>(res);
}


// ---------------------------------------------------------------------------
// Company Portal
// ---------------------------------------------------------------------------

export interface SearchCandidatesParams {
  company_name?: string;
  required_skills: string[];
  top_k?: number;
  min_keyword_matches?: number;
  use_semantic?: boolean;
  location_filter?: string;
  min_experience?: number;
  max_experience?: number;
  min_match_score?: number;
  sort_by?: "score" | "experience" | "recent";
}

export async function searchCandidates(
  params: SearchCandidatesParams,
  token: string
): Promise<Candidate[]> {
  const res = await fetch(`${API_BASE}/api/company/search-candidates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      company_name: params.company_name ?? null,
      required_skills: params.required_skills,
      top_k: params.top_k ?? 15,
      min_keyword_matches: params.min_keyword_matches ?? 1,
      use_semantic: params.use_semantic ?? true,
      location_filter: params.location_filter ?? null,
      min_experience: params.min_experience ?? null,
      max_experience: params.max_experience ?? null,
      min_match_score: params.min_match_score ?? null,
      sort_by: params.sort_by ?? "score",
    }),
  });
  return handleResponse<Candidate[]>(res);
}

export async function getCandidateCount(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/company/candidate-count`);
  const data = await handleResponse<{ count: number }>(res);
  return data.count;
}

export interface AdminCandidateRow {
  id: number;
  email: string;
  full_name: string;
  skills: string[];
  skills_count: number;
  cv_filename: string;
  created_at: string;
}

export async function getAllCandidates(limit = 50): Promise<AdminCandidateRow[]> {
  const res = await fetch(
    `${API_BASE}/api/company/all-candidates?limit=${limit}`
  );
  const list = await handleResponse<Array<Record<string, unknown>>>(res);
  return list.map((p) => ({
    id: (p.id as number) ?? 0,
    email: (p.email as string) ?? "",
    full_name: (p.full_name as string) ?? "—",
    skills: (p.skills as string[]) ?? [],
    skills_count: ((p.skills as string[]) ?? []).length,
    cv_filename: (p.cv_filename as string) ?? "",
    created_at: (p.created_at as string) ?? "",
  }));
}

export interface SaveProfileParams {
  email: string;
  full_name?: string;
  skills: string[];
  cv_text?: string;
  cv_filename?: string;
}

export async function saveJobSeekerProfile(
  profile: SaveProfileParams
): Promise<SaveProfileResponse> {
  const res = await fetch(`${API_BASE}/api/jobseeker/save-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: profile.email,
      full_name: profile.full_name ?? null,
      skills: profile.skills,
      cv_text: profile.cv_text ?? null,
      cv_filename: profile.cv_filename ?? null,
    }),
  });
  return handleResponse<SaveProfileResponse>(res);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function getGoogleAuthUrl(
  userType: string = "jobseeker"
): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/api/auth/google?user_type=${encodeURIComponent(userType)}`
  );
  const data = await handleResponse<{ url: string }>(res);
  return data.url;
}

export async function loginUser(
  email: string,
  password: string
): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<TokenResponse>(res);
}

export async function registerUser(
  data: RegisterRequest
): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<TokenResponse>(res);
}

export async function getMe(token: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<User>(res);
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse<{ message: string }>(res);
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

// ---------------------------------------------------------------------------
// Job seeker profile
// ---------------------------------------------------------------------------

export async function getProfile(token: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<UserProfile>(res);
}

export async function updateProfile(
  token: string,
  data: {
    full_name?: string;
    headline?: string;
    bio?: string;
    location?: string;
    linkedin_url?: string;
    years_experience?: number;
  }
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<UserProfile>(res);
}

export async function updateSkills(
  token: string,
  skills: string[]
): Promise<{ success: boolean; skills: string[] }> {
  const res = await fetch(`${API_BASE}/api/profile/skills`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ skills }),
  });
  return handleResponse<{ success: boolean; skills: string[] }>(res);
}

export async function uploadProfileCV(
  token: string,
  file: File
): Promise<{
  success: boolean;
  cv_filename: string;
  skills_extracted: string[];
  skills_count: number;
}> {
  const formData = new FormData();
  formData.append("cv", file);
  const res = await fetch(`${API_BASE}/api/profile/upload-cv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Upload failed"
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Application tracker
// ---------------------------------------------------------------------------

export async function getApplications(
  token: string
): Promise<JobApplication[]> {
  const res = await fetch(`${API_BASE}/api/applications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<JobApplication[]>(res);
}

export async function createApplication(
  token: string,
  data: {
    job_title: string;
    company: string;
    job_url?: string;
    location?: string;
    status?: string;
    notes?: string;
  }
): Promise<{ id: number; success: boolean }> {
  const res = await fetch(`${API_BASE}/api/applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ id: number; success: boolean }>(res);
}

export async function updateApplication(
  token: string,
  id: number,
  data: Partial<{
    job_title: string;
    company: string;
    job_url: string;
    location: string;
    status: string;
    notes: string;
  }>
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/applications/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function deleteApplication(
  token: string,
  id: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/applications/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

// ---------------------------------------------------------------------------
// Saved jobs
// ---------------------------------------------------------------------------

export async function getSavedJobs(token: string): Promise<SavedJob[]> {
  const res = await fetch(`${API_BASE}/api/saved-jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<SavedJob[]>(res);
}

export async function saveJob(
  token: string,
  jobId: number
): Promise<{ success: boolean; saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/saved-jobs/${jobId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean; saved: boolean }>(res);
}

export async function unsaveJob(
  token: string,
  jobId: number
): Promise<{ success: boolean; saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/saved-jobs/${jobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean; saved: boolean }>(res);
}

export async function checkSavedJob(
  token: string,
  jobId: number
): Promise<{ saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/saved-jobs/check/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ saved: boolean }>(res);
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------

export async function getCompanyProfile(
  token: string
): Promise<CompanyProfile> {
  const res = await fetch(`${API_BASE}/api/company/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<CompanyProfile>(res);
}

export async function updateCompanyProfile(
  token: string,
  data: {
    company_name: string;
    website?: string;
    industry?: string;
    company_size?: string;
    description?: string;
    contact_name?: string;
  }
): Promise<CompanyProfile> {
  const res = await fetch(`${API_BASE}/api/company/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<CompanyProfile>(res);
}

// ---------------------------------------------------------------------------
// Saved candidates (company)
// ---------------------------------------------------------------------------

export async function getSavedCandidates(
  token: string
): Promise<SavedCandidate[]> {
  const res = await fetch(`${API_BASE}/api/company/saved-candidates`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<SavedCandidate[]>(res);
}

export async function saveCandidate(
  token: string,
  candidateUserId: number
): Promise<{ success: boolean; saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/company/saved-candidates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ candidate_user_id: candidateUserId }),
  });
  return handleResponse<{ success: boolean; saved: boolean }>(res);
}

export async function unsaveCandidate(
  token: string,
  candidateUserId: number
): Promise<{ success: boolean; saved: boolean }> {
  const res = await fetch(
    `${API_BASE}/api/company/saved-candidates/${candidateUserId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return handleResponse<{ success: boolean; saved: boolean }>(res);
}

export async function updateCandidateNotes(
  token: string,
  candidateUserId: number,
  notes: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/company/saved-candidates/notes`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ candidate_user_id: candidateUserId, notes }),
  });
  return handleResponse<{ success: boolean }>(res);
}

// ---------------------------------------------------------------------------
// Search history (company)
// ---------------------------------------------------------------------------

export async function getSearchHistory(
  token: string
): Promise<SearchHistoryItem[]> {
  const res = await fetch(`${API_BASE}/api/company/search-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<SearchHistoryItem[]>(res);
}

export async function deleteSearchHistoryItem(
  token: string,
  searchId: number
): Promise<{ success: boolean }> {
  const res = await fetch(
    `${API_BASE}/api/company/search-history/${searchId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return handleResponse<{ success: boolean }>(res);
}

export async function clearSearchHistory(
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/company/search-history`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

// ---------------------------------------------------------------------------
// Contact requests
// ---------------------------------------------------------------------------
export async function sendContactRequest(
  token: string,
  candidateUserId: number,
  message: string
): Promise<{ success: boolean; request_id: number; message: string }> {
  const res = await fetch(`${API_BASE}/api/contact-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ candidate_user_id: candidateUserId, message }),
  });
  return handleResponse(res);
}

export async function getReceivedRequests(
  token: string
): Promise<ContactRequest[]> {
  const res = await fetch(`${API_BASE}/api/contact-requests/received`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<ContactRequest[]>(res);
}

export async function getSentRequests(
  token: string
): Promise<ContactRequest[]> {
  const res = await fetch(`${API_BASE}/api/contact-requests/sent`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<ContactRequest[]>(res);
}

export async function respondToRequest(
  token: string,
  requestId: number,
  status: "accepted" | "declined"
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/contact-requests/${requestId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function getNotifications(
  token: string,
  unreadOnly?: boolean
): Promise<Notification[]> {
  const sp = new URLSearchParams({ limit: "20" });
  if (unreadOnly) sp.set("unread_only", "true");
  const res = await fetch(`${API_BASE}/api/notifications?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<Notification[]>(res);
}

export async function getUnreadCount(
  token: string
): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await handleResponse<{ count: number }>(res);
  const n = data.count;
  return { count: typeof n === "number" ? n : Number(n) || 0 };
}

export async function markNotificationRead(
  token: string,
  id: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function markAllRead(
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function deleteNotification(
  token: string,
  id: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/notifications/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

// ---------------------------------------------------------------------------
// Payments (Stripe)
// ---------------------------------------------------------------------------

export async function createCheckoutSession(
  token: string,
  plan: string,
  billingCycle: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/payments/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan, billing_cycle: billingCycle }),
  });
  const data = await handleResponse<{ checkout_url: string }>(res);
  return data.checkout_url;
}

export async function getSubscription(token: string): Promise<Subscription> {
  const res = await fetch(`${API_BASE}/api/payments/subscription`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<Subscription>(res);
}

export async function cancelSubscription(
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/payments/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface JobseekerAnalytics {
  applications_by_status: { applied: number; interviewing: number; offer: number; rejected: number };
  applications_over_time: { date: string; count: number }[];
  top_companies_applied: { company: string; count: number }[];
  saved_jobs_count: number;
  profile_completeness: number;
  skills_count: number;
  contact_requests_received: number;
  contact_requests_accepted: number;
}

export interface CompanyAnalytics {
  searches_over_time: { date: string; count: number }[];
  top_searched_skills: { skill: string; count: number }[];
  saved_candidates_count: number;
  contact_requests_sent: number;
  contact_requests_accepted: number;
  avg_results_per_search: number;
  total_searches: number;
}

export async function getJobseekerAnalytics(
  token: string
): Promise<JobseekerAnalytics> {
  const res = await fetch(`${API_BASE}/api/analytics/jobseeker`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<JobseekerAnalytics>(res);
}

export async function getCompanyAnalytics(
  token: string
): Promise<CompanyAnalytics> {
  const res = await fetch(`${API_BASE}/api/analytics/company`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<CompanyAnalytics>(res);
}

// ---------------------------------------------------------------------------
// Job alerts (jobseeker)
// ---------------------------------------------------------------------------

export interface AlertSettings {
  is_enabled: boolean;
  frequency: string;
  min_match_score: number;
  last_sent_at?: string;
}

export async function getAlertSettings(
  token: string
): Promise<AlertSettings> {
  const res = await fetch(`${API_BASE}/api/alerts/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AlertSettings>(res);
}

export async function updateAlertSettings(
  token: string,
  settings: { is_enabled?: boolean; frequency?: string; min_match_score?: number }
): Promise<AlertSettings> {
  const res = await fetch(`${API_BASE}/api/alerts/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });
  return handleResponse<AlertSettings>(res);
}

export async function sendTestAlert(token: string): Promise<{ sent: boolean; jobs_count: number }> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${BASE_URL}/api/alerts/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Failed to send test alert"
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Public profile (no auth)
// ---------------------------------------------------------------------------

export interface PublicProfile {
  full_name: string;
  headline?: string;
  bio?: string;
  location?: string;
  linkedin_url?: string;
  years_experience?: number;
  skills: string[];
  profile_slug: string;
  is_public: boolean;
  member_since?: number;
  user_id?: number;
}

export async function getPublicProfile(slug: string): Promise<PublicProfile> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${BASE_URL}/api/public/profile/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Profile not found or is private");
    throw new Error("Failed to load profile");
  }
  return res.json();
}

export async function getMySlug(
  token: string
): Promise<{ slug: string; profile_url: string }> {
  const res = await fetch(`${API_BASE}/api/profile/slug`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ slug: string; profile_url: string }>(res);
}

export async function updateProfileVisibility(
  token: string,
  isPublic: boolean
): Promise<{ success: boolean; is_public: boolean }> {
  const res = await fetch(`${API_BASE}/api/profile/visibility`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ is_public: isPublic }),
  });
  return handleResponse<{ success: boolean; is_public: boolean }>(res);
}
