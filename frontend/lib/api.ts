import type {
  Job,
  MatchJobsResult,
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
  VertexJobApplication,
  VertexApplicationStatus,
  ScrapedJob,
  SkillsGapResult,
  AdminUserDetail,
  AdminJobRow,
  Announcement,
  PlatformSettings,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_BASE = BASE_URL;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) {
      try {
        localStorage.removeItem("vertex_token");
        localStorage.removeItem("vertex_user");
      } catch {
        // ignore
      }
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
      throw new Error("Session expired. Please log in again.");
    }
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { detail?: unknown };
      const d = json.detail;
      if (typeof d === "string") {
        message = d;
      } else if (d && typeof d === "object" && d !== null && "message" in d) {
        message = String((d as { message: string }).message);
      }
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

/** Get job matches for a list of skills (no auth required). */
export async function matchJobs(skills: Skill[]): Promise<MatchJobsResult> {
  const res = await fetch(`${API_BASE}/api/match-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills }),
  });
  const data = await handleResponse<MatchJobsResult>(res);
  return {
    ...data,
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
  };
}

/** Match jobs using saved profile skills; sends bearer token (same JSON body as matchJobs). */
export async function matchJobsWithSkills(
  token: string,
  skills: string[]
): Promise<MatchJobsResult> {
  const res = await fetch(`${API_BASE}/api/match-jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ skills }),
  });
  const data = await handleResponse<MatchJobsResult>(res);
  return {
    ...data,
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
  };
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

export async function getJobById(jobId: number): Promise<ScrapedJob> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
  return handleResponse<ScrapedJob>(res);
}

// ---------------------------------------------------------------------------
// Posted jobs (company job postings)
// ---------------------------------------------------------------------------

export interface PostedJobsListResponse {
  jobs: PostedJob[];
  total: number;
  page: number;
  total_pages: number;
}

export async function getPostedJobs(params?: {
  limit?: number;
  offset?: number;
  job_type?: string;
  experience_level?: string;
  search?: string;
}): Promise<PostedJobsListResponse> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  if (params?.job_type) sp.set("job_type", params.job_type);
  if (params?.experience_level) sp.set("experience_level", params.experience_level);
  if (params?.search) sp.set("search", params.search);
  const q = sp.toString();
  const res = await fetch(`${API_BASE}/api/jobs/posted${q ? `?${q}` : ""}`);
  return handleResponse<PostedJobsListResponse>(res);
}

export async function getPostedJobById(id: number): Promise<PostedJob> {
  const res = await fetch(`${API_BASE}/api/jobs/posted/${id}`);
  return handleResponse<PostedJob>(res);
}

export async function analyzeJobGap(
  token: string,
  jobId: number
): Promise<SkillsGapResult> {
  const res = await fetch(`${API_BASE}/api/skills-gap/analyze-job/${jobId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<SkillsGapResult>(res);
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

// ---------------------------------------------------------------------------
// Vertex job applications (posted jobs only)
// ---------------------------------------------------------------------------

export async function getVertexApplyStatus(
  token: string,
  postedJobId: number
): Promise<{ applied: boolean; application: VertexJobApplication | null }> {
  const res = await fetch(`${API_BASE}/api/jobs/posted/${postedJobId}/apply-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

export async function applyToVertexJob(
  token: string,
  postedJobId: number,
  coverMessage?: string
): Promise<{ id: number; success: boolean; status: string }> {
  const res = await fetch(`${API_BASE}/api/jobs/posted/${postedJobId}/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cover_message: coverMessage || undefined }),
  });
  return handleResponse(res);
}

export async function getMyVertexApplications(
  token: string
): Promise<VertexJobApplication[]> {
  const res = await fetch(`${API_BASE}/api/my-vertex-applications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<VertexJobApplication[]>(res);
}

export async function withdrawVertexApplication(
  token: string,
  applicationId: number
): Promise<{ success: boolean }> {
  const res = await fetch(
    `${API_BASE}/api/my-vertex-applications/${applicationId}/withdraw`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return handleResponse(res);
}

export async function getCompanyApplications(
  token: string,
  params?: { posted_job_id?: number; status?: VertexApplicationStatus }
): Promise<VertexJobApplication[]> {
  const q = new URLSearchParams();
  if (params?.posted_job_id != null) {
    q.set("posted_job_id", String(params.posted_job_id));
  }
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  const res = await fetch(
    `${API_BASE}/api/company/applications${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return handleResponse<VertexJobApplication[]>(res);
}

export async function updateCompanyApplicationStatus(
  token: string,
  applicationId: number,
  data: { status: VertexApplicationStatus; company_notes?: string }
): Promise<{ success: boolean; status: string }> {
  const res = await fetch(`${API_BASE}/api/company/applications/${applicationId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
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

export interface AdminScraperLastRunResponse {
  last_run: string | null;
}

export interface AdminHealthResponse {
  database: boolean;
  email_configured: boolean;
  last_scraper_run: string | null;
  total_jobs: number;
}

export async function getAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AdminStats>(res);
}

export interface AdminAnalytics {
  period_days: number;
  revenue: {
    estimated_mrr: number;
    estimated_arr: number;
    pro_monthly_price: number;
    business_monthly_price: number;
    paid_users: number;
    active_subscriptions: number;
    disclaimer: string;
  };
  plans: { free: number; pro: number; business: number };
  plan_distribution: { plan: string; count: number; color: string }[];
  subscription_status: { status: string; count: number }[];
  users_over_time: { date: string; count: number }[];
  signups_by_type_over_time: {
    date: string;
    count: number;
    jobseekers: number;
    companies: number;
  }[];
  jobs_over_time: { date: string; count: number }[];
  applications_over_time: { date: string; count: number }[];
  contact_requests_over_time: { date: string; count: number }[];
  user_types: { type: string; count: number }[];
}

export async function getAdminAnalytics(
  token: string,
  days = 30
): Promise<AdminAnalytics> {
  const res = await fetch(`${API_BASE}/api/admin/analytics?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AdminAnalytics>(res);
}

export async function getAdminScraperLastRun(
  token: string
): Promise<AdminScraperLastRunResponse> {
  const res = await fetch(`${API_BASE}/api/admin/scraper/last-run`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AdminScraperLastRunResponse>(res);
}

export async function getAdminHealth(
  token: string
): Promise<AdminHealthResponse> {
  const res = await fetch(`${API_BASE}/api/admin/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AdminHealthResponse>(res);
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

export type AdminUserTypeFilter = "" | "jobseeker" | "company" | "admin";
export type AdminUserStatusFilter = "" | "active" | "inactive";

export interface AdminUserCounts {
  all: number;
  jobseekers: number;
  companies: number;
  admins: number;
}

export async function getAdminUsers(
  token: string,
  opts?: {
    limit?: number;
    offset?: number;
    search?: string;
    user_type?: AdminUserTypeFilter;
    status?: AdminUserStatusFilter;
    joined_from?: string;
    joined_to?: string;
  }
): Promise<{ users: AdminUserRow[]; total: number; counts: AdminUserCounts }> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (opts?.search) params.set("search", opts.search);
  if (opts?.user_type) params.set("user_type", opts.user_type);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.joined_from) params.set("joined_from", opts.joined_from);
  if (opts?.joined_to) params.set("joined_to", opts.joined_to);
  const res = await fetch(`${API_BASE}/api/admin/users?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ users: AdminUserRow[]; total: number; counts: AdminUserCounts }>(res);
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
  token: string,
  limit = 10
): Promise<AdminActivityItem[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/admin/activity?${q}`, {
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

export async function adminGetUserDetails(
  token: string,
  userId: number
): Promise<AdminUserDetail> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<AdminUserDetail>(res);
}

export async function adminDeleteUser(
  token: string,
  userId: number
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function adminUpdateUserPlan(
  token: string,
  userId: number,
  plan: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/plan`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan }),
  });
  return handleResponse<{ success: boolean }>(res);
}

export type AdminJobListingType = "all" | "job_boards" | "vertex";

export async function adminGetJobs(
  token: string,
  params?: {
    limit?: number;
    offset?: number;
    search?: string;
    source?: string;
    listing_type?: AdminJobListingType;
  }
): Promise<{ jobs: AdminJobRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.search) q.set("search", params.search);
  if (params?.source) q.set("source", params.source);
  if (params?.listing_type) q.set("listing_type", params.listing_type);
  const res = await fetch(`${API_BASE}/api/admin/jobs?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ jobs: AdminJobRow[]; total: number }>(res);
}

export async function adminDeleteJob(
  token: string,
  jobId: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/jobs/${jobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function adminDeletePostedJob(
  token: string,
  jobId: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/jobs/posted/${jobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function adminSendAnnouncement(
  token: string,
  data: {
    title: string;
    message: string;
    target: string;
    send_email?: boolean;
    send_notification?: boolean;
  }
): Promise<{ success: boolean; recipients_count: number; message: string }> {
  const res = await fetch(`${API_BASE}/api/admin/announcements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean; recipients_count: number; message: string }>(
    res
  );
}

export async function adminSendEmail(
  token: string,
  data: { user_id: number; subject: string; message: string }
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function adminGetSettings(token: string): Promise<PlatformSettings> {
  const res = await fetch(`${API_BASE}/api/admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<PlatformSettings>(res);
}

export async function adminUpdateSettings(
  token: string,
  settings: Partial<PlatformSettings>
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/settings`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function adminGetAnnouncementRecipientCounts(
  token: string
): Promise<{ all: number; jobseekers: number; companies: number }> {
  const res = await fetch(`${API_BASE}/api/admin/announcements/recipient-counts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ all: number; jobseekers: number; companies: number }>(res);
}

export async function adminGetAnnouncements(
  token: string
): Promise<Announcement[]> {
  const res = await fetch(`${API_BASE}/api/admin/announcements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<Announcement[]>(res);
}

export async function adminDeleteAnnouncement(
  token: string,
  announcementId: number
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/announcements/${announcementId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function cleanupInactiveJobs(
  token: string
): Promise<{
  success: boolean;
  deleted_scraped: number;
  deleted_posted: number;
  total_deleted: number;
}> {
  const res = await fetch(`${API_BASE}/api/admin/cleanup-inactive-jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<{
    success: boolean;
    deleted_scraped: number;
    deleted_posted: number;
    total_deleted: number;
  }>(res);
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

export async function verifyCheckoutSession(
  token: string,
  sessionId: string
): Promise<{ success: boolean; plan: string; status: string }> {
  const res = await fetch(
    `${API_BASE}/api/payments/verify-session?session_id=${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return handleResponse<{ success: boolean; plan: string; status: string }>(res);
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
