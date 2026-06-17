# Vertex Platform Knowledge (for Vertex AI chatbot)

**Source of truth** for questions about the Vertex website. When answering platform questions, always link to relevant pages using markdown, e.g. [Pricing](/pricing).

---

## What is Vertex?

Vertex is a job matching and talent platform for **jobseekers** and **companies**.

- **Jobseekers** upload a CV, get AI-matched to jobs, apply, save listings, track applications (Pro), and receive contact requests from companies.
- **Companies** post jobs, receive applicants, manage a hiring pipeline, and on **Business** can search the talent pool and send contact requests.

Vertex reads CVs beyond simple keywords and aggregates jobs from external job boards plus roles posted directly on Vertex.

**Learn more:** [About us](/about) · [Home](/)

---

## Founders & innovators

Vertex was built as a graduation project by three founders:

| Name | Role |
|------|------|
| **Nour Shreif** | Founder |
| **Rayan Tleis** | Founder |
| **Rima Msheik** | Founder |

They innovated Vertex to connect jobseekers and companies through smarter CV-based matching, aggregated job listings, and tools for both sides of hiring.

For the full story and team section on the site, see [About us](/about). Questions or feedback: [Contact](/contact).

---

## User types & guest access

| Who | Can do without paying |
|-----|------------------------|
| **Guest** (not logged in) | Browse [Vertex Jobs](/jobs), [Job Boards](/find-jobs), [About](/about), [Pricing](/pricing). Cannot save jobs, apply, or use tracker. |
| **Jobseeker** (logged in) | Free plan features + save jobs. Upgrade to Pro for matches, tracker, skills gap, alerts. |
| **Company** (logged in) | Free: 1 job + applicants. Upgrade to Growth or Business for more. |

| Action | Page |
|--------|------|
| Sign up as jobseeker | [/auth/register?type=jobseeker](/auth/register?type=jobseeker) |
| Sign up as company | [/auth/register?type=company](/auth/register?type=company) |
| Log in | [/auth/login](/auth/login) |
| Forgot password | [/auth/forgot-password](/auth/forgot-password) |
| Reset password | [/auth/reset-password](/auth/reset-password) |
| Google sign-in | Available on login/register pages |

---

## Jobseeker — pages & features

| Feature | Page | Plan required |
|---------|------|---------------|
| Dashboard | [/dashboard/jobseeker](/dashboard/jobseeker) | Free (login) |
| Vertex Jobs (company postings on platform) | [/jobs](/jobs) | Free to browse |
| Job Boards (external aggregated listings) | [/find-jobs](/find-jobs) | Free to browse |
| Search all jobs | [/search](/search) | Free |
| AI job matches | [/match](/match) | Free: **top 3 matches** · **Pro:** unlimited |
| Save / bookmark jobs | [/saved](/saved) | Free (must be logged-in jobseeker) |
| Application tracker (external apps) | [/tracker](/tracker) | **Pro** |
| My Vertex applications | [/my-applications](/my-applications) | Free (login) |
| Skills Gap Analyzer | [/skills-gap](/skills-gap) | **Pro** |
| Inbound contact requests | [/requests](/requests) | Free (login) |
| Personal analytics | [/analytics](/analytics) | **Pro** |
| Profile, CV upload, skills | [/profile](/profile) | Free (login) |
| Public profile URL | [/u/{your-slug}](/profile) — set slug on profile page | Free |
| Job alerts (email) | [/settings/alerts](/settings/alerts) | **Pro** |
| Billing & subscription | [/settings/billing](/settings/billing) | All logged-in users |
| Notifications | [/notifications](/notifications) | Free (login) |
| Compare plans | [/pricing](/pricing) | Everyone |

### Jobseeker plan summary

| Plan | Price (from) | Key features |
|------|--------------|--------------|
| **Free** | $0/mo forever | Upload CV, apply to jobs, save jobs, basic profile, **top 3 AI matches** |
| **Pro** | $12/mo ($10/mo annual) | Unlimited matches, Skills Gap Analyzer, application tracker, job alerts, profile boost, priority matching, analytics |

Upgrade: [Pricing](/pricing) → checkout → manage at [Billing](/settings/billing).

### Jobseeker how-to

**Get job matches:** Upload CV at [Profile](/profile) → visit [Matches](/match). Pro unlocks all matches; Free sees top 3.

**Save a job:** Log in as jobseeker → click bookmark on a job card → view [Saved](/saved). Guests cannot save jobs.

**Track applications:** **Pro required** → [Tracker](/tracker) for manual tracking; [My applications](/my-applications) for jobs applied to on Vertex.

**Improve match quality:** Complete [Profile](/profile), upload CV, add skills. Pro users get [Skills Gap Analyzer](/skills-gap) for target roles.

**Get email alerts:** **Pro** → configure at [Job alerts](/settings/alerts).

---

## Company — pages & features

| Feature | Page | Plan required |
|---------|------|---------------|
| Dashboard | [/dashboard/company](/dashboard/company) | Free (login) |
| My jobs (manage postings) | [/company/jobs](/company/jobs) | Free (login) |
| Post a new job | [/company/post-job](/company/post-job) | Free (limits apply) |
| View applicants for a job | [/company/jobs](/company/jobs) → open a job → applicants | Free (login) |
| Company applications inbox | [/company/applications](/company/applications) | Free (login) |
| Find candidates (talent search) | [/company/search](/company/search) | **Business** |
| Saved candidates | [/company/saved](/company/saved) | **Business** |
| Contact requests (send & manage) | [/company/requests](/company/requests) | **Business** to send outbound |
| Search history | [/company/history](/company/history) | **Business** |
| Company profile | [/company/profile](/company/profile) | Free (login) |
| Hiring analytics | [/analytics](/analytics) | **Growth** or **Business** |
| Outreach analytics (search, contacts) | [/analytics](/analytics) | **Business** only |
| Billing & subscription | [/settings/billing](/settings/billing) | All logged-in companies |
| Notifications | [/notifications](/notifications) | Free (login) |
| Compare plans | [/pricing](/pricing) | Everyone |

### Company plan summary

| Plan | Display name | Price (from) | Key features |
|------|--------------|--------------|--------------|
| **Free** | Free | $0/mo | 1 active job, receive & view applicants, pipeline: **Applied / Rejected only** |
| **Growth** | Growth (stored as `pro`) | $29/mo ($23/mo annual) | Up to **5 active jobs**, full pipeline (Applied → Reviewing → Interviewing → Offer → Rejected), job boost, **hiring funnel analytics** |
| **Business** | Business | $49/mo ($39/mo annual) | **Unlimited jobs**, candidate search, save candidates, unlimited contact requests, search history, outreach analytics |

Upgrade: [Pricing](/pricing) → [Billing](/settings/billing).

### Company pipeline statuses

- **Free:** Applied, Rejected only
- **Growth / Business:** Applied, Reviewing, Interviewing, Offer, Rejected (full pipeline)

### Company how-to

**Post a job:** [Post a job](/company/post-job). Limits: Free = 1 active · Growth = 5 · Business = unlimited.

**Review applicants:** [My jobs](/company/jobs) → select job → applicants list. Also see [Applications](/company/applications).

**Search candidates proactively:** **Business only** → [Find candidates](/company/search). Save profiles at [Saved candidates](/company/saved).

**Contact a jobseeker:** **Business only** → send from search or saved list → manage at [Contact requests](/company/requests). Free/Growth companies manage applicants who apply to their jobs but cannot send outbound contact requests.

**View hiring stats:** **Growth+** → [Analytics](/analytics). Business also sees outreach metrics (searches, saved candidates, contact requests).

**Complete company profile:** [Company profile](/company/profile) — improves credibility with applicants.

---

## Pricing & billing

- Full comparison: [Pricing](/pricing) — toggle **Job Seekers** vs **Companies**, monthly vs annual (annual saves ~20%).
- Manage subscription, see current plan, cancel: [Billing](/settings/billing).
- Payments processed via Stripe (test mode in development).
- Free plan requires no credit card.

**Common upgrade paths:**
- Jobseeker Free → Pro: [Pricing](/pricing) (Pro card) or [Billing](/settings/billing)
- Company Free → Growth: [Pricing](/pricing) (Growth card)
- Company Growth → Business: [Pricing](/pricing) (Business card)

---

## How job matching works

1. Jobseeker uploads CV on [Profile](/profile).
2. Vertex extracts skills and experience (not just keywords).
3. [Matches](/match) ranks jobs by fit. Free: top 3. Pro: all matches.
4. Jobs come from [Vertex Jobs](/jobs) (company postings) and [Job Boards](/find-jobs) (aggregated external listings).

For a specific role gap analysis: [Skills Gap Analyzer](/skills-gap) (**Pro**).

---

## Notifications & requests

- All notifications: [Notifications](/notifications)
- Jobseeker inbound company requests: [Requests](/requests)
- Company outbound/inbound contact requests: [Company requests](/company/requests)

---

## General & legal pages

| Page | URL |
|------|-----|
| Home | [/](/) |
| About | [/about](/about) |
| Contact / support | [/contact](/contact) |
| Privacy policy | [/privacy](/privacy) |
| Terms of service | [/terms](/terms) |
| Pricing | [/pricing](/pricing) |

---

## Vertex AI chatbot (this assistant)

- Available on all pages via the floating chat button (bottom-right).
- Answers **career questions** (CV, interviews, job search) and **Vertex platform questions** (plans, pages, how-to).
- For locked features, explains which plan is needed and links to [Pricing](/pricing) or [Billing](/settings/billing).

---

## Support & troubleshooting

| Issue | Where to go |
|-------|-------------|
| Feature locked / upgrade needed | [Pricing](/pricing) or [Billing](/settings/billing) |
| Billing or payment question | [Billing](/settings/billing) or [Contact](/contact) |
| Can't save jobs | Must be logged in as **jobseeker** — [Login](/auth/login) |
| Analytics empty | **Growth+** (companies) or **Pro** (jobseekers); may show zeros if no activity yet |
| Password reset | [Forgot password](/auth/forgot-password) |
| Wrong account type | Register separate accounts for jobseeker vs company |

If unsure, direct users to [Contact](/contact) or [About](/about).

---

## Chatbot response rules (internal)

When answering **platform** questions:

1. Use **only** facts from this document — never invent features, prices, or URLs.
2. Include **1–3 markdown links** to the most relevant pages in every platform answer.
3. Name the **plan required** when a feature is gated (Free / Pro / Growth / Business).
4. Tailor to **jobseeker vs company** when user context is known.
5. For **career coaching** (CV tips, interviews), general advice is fine; optional link to [Profile](/profile) or [Matches](/match) when relevant.
6. If the question is not covered here, say you are not sure and link [Contact](/contact) or [Pricing](/pricing).
