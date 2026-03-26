export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  description: string | null;
  url: string;
  match_score: number;
  tags: string[];
}

/** Scraped job from GET /api/jobs/search */
export interface ScrapedJob {
  id: number;
  source: string;
  job_title: string;
  company: string;
  location: string | null;
  description: string | null;
  job_url: string;
  scraped_at: string;
}

export type Skill = string;

export interface Stats {
  total_jobs: number;
  last_scraped: string | null;
  top_categories: string[];
}

export interface UploadCVResponse {
  skills: string[];
}

export interface Candidate {
  rank: number;
  full_name: string;
  email: string;
  skills: string[];
  matched_skills: string[];
  keyword_score: number;
  vector_score: number;
  combined_score: number;
  cv_filename?: string;
  created_at?: string;
  user_id?: number;
  profile_slug?: string;
  location?: string;
  years_experience?: number;
}

export interface SavedCandidate {
  id: number;
  candidate_user_id: number;
  full_name: string;
  email: string;
  headline?: string;
  location?: string;
  skills: string[];
  cv_filename?: string;
  notes?: string;
  saved_at: string;
  updated_at: string;
}

export interface SaveProfileResponse {
  success: boolean;
  profile_id: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  user_type: "jobseeker" | "company";
  is_admin?: boolean;
  created_at?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_type: string;
  full_name: string;
  user_id: number;
  email: string;
  is_admin?: boolean;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
  user_type: string;
  company_name?: string | null;
}

export interface UserProfile {
  id?: number;
  email: string;
  full_name: string;
  headline?: string;
  bio?: string;
  location?: string;
  linkedin_url?: string;
  years_experience?: number;
  skills?: string[];
  cv_filename?: string;
  created_at?: string;
  updated_at?: string;
}

export type ApplicationStatus =
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "saved";

export interface JobApplication {
  id: number;
  job_title: string;
  company: string;
  job_url?: string;
  location?: string;
  status: ApplicationStatus;
  notes?: string;
  applied_at: string;
  updated_at: string;
}

export interface SavedJob {
  id: number;
  job_title: string;
  company: string;
  location?: string;
  description?: string;
  job_url: string;
  source: string;
  saved_at: string;
  scraped_at: string;
}

export interface SearchHistoryItem {
  id: number;
  company_name: string;
  required_skills: string[];
  results_count: number;
  searched_at: string;
}

export interface CompanyProfile {
  user_id: number;
  email: string;
  full_name: string;
  company_name: string;
  website?: string;
  industry?: string;
  company_size?: string;
  description?: string;
  logo_url?: string;
  created_at?: string;
}

export interface ContactRequest {
  id: number;
  company_user_id: number;
  candidate_user_id: number;
  company_name: string;
  contact_name: string;
  candidate_name?: string;
  headline?: string;
  candidate_email?: string;
  message: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type:
    | "contact_request"
    | "request_accepted"
    | "request_declined"
    | "job_alert"
    | "new_job_match"
    | "profile_view"
    | "system";
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface Subscription {
  plan: "free" | "pro" | "business";
  status: "active" | "canceled" | "past_due" | "trialing";
  stripe_subscription_id?: string;
  current_period_end?: string;
}

export interface PostedJob {
  id: number;
  company_user_id: number;
  title: string;
  company_name: string;
  location?: string;
  job_type: string;
  experience_level: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  description: string;
  requirements?: string;
  benefits?: string;
  skills_required: string[];
  application_url?: string;
  application_email?: string;
  is_active: boolean;
  is_featured: boolean;
  views_count: number;
  applications_count: number;
  expires_at?: string;
  created_at: string;
  company_desc?: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
}
