/** Prefill data for the application tracker add form. */
export type TrackerPrefill = {
  job_title: string;
  company: string;
  location?: string;
  job_url?: string;
};

export function buildTrackerUrl(prefill: TrackerPrefill): string {
  const params = new URLSearchParams();
  params.set("add", "1");
  params.set("title", prefill.job_title);
  params.set("company", prefill.company);
  if (prefill.location?.trim()) params.set("location", prefill.location.trim());
  if (prefill.job_url?.trim()) params.set("url", prefill.job_url.trim());
  return `/tracker?${params.toString()}`;
}

export function parseTrackerPrefill(
  searchParams: URLSearchParams
): TrackerPrefill | null {
  if (searchParams.get("add") !== "1") return null;
  const job_title = searchParams.get("title")?.trim() || "";
  const company = searchParams.get("company")?.trim() || "";
  if (!job_title && !company) return null;
  return {
    job_title,
    company,
    location: searchParams.get("location")?.trim() || undefined,
    job_url: searchParams.get("url")?.trim() || undefined,
  };
}
