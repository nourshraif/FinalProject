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
  created_at?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_type: string;
  full_name: string;
  user_id: number;
  email: string;
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
