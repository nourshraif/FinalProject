import resend
import os
from typing import Optional

resend.api_key = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "onboarding@resend.dev"
)
APP_URL = os.getenv("APP_URL", "http://localhost:3000")


def send_welcome_email(
    to_email: str,
    full_name: str,
    user_type: str
) -> bool:
    try:
        if user_type == "jobseeker":
            subject = "Welcome to Vertex — Let's find your match"
            body = f"""
      <div style="font-family: Arial, sans-serif;
                  max-width: 600px; margin: 0 auto;
                  background: #0a0a0f; color: white;
                  padding: 40px; border-radius: 12px;">

        <div style="text-align: center;
                    margin-bottom: 32px;">
          <h1 style="font-size: 32px; margin: 0;">
            <span style="color: white;">Vert</span>
            <span style="color: #6366f1;">ex</span>
          </h1>
        </div>

        <h2 style="color: white; font-size: 24px;">
          Welcome, {full_name}! 👋
        </h2>

        <p style="color: #94a3b8; line-height: 1.6;">
          Your Vertex account is ready.
          You're one step away from finding
          the job you were made for.
        </p>

        <div style="background: #13131f;
                    border: 1px solid #2a2a3d;
                    border-radius: 12px;
                    padding: 24px;
                    margin: 24px 0;">
          <h3 style="color: white; margin-top: 0;">
            Get started in 3 steps:
          </h3>
          <p style="color: #94a3b8; margin: 8px 0;">
            1️⃣ Complete your profile
          </p>
          <p style="color: #94a3b8; margin: 8px 0;">
            2️⃣ Upload your CV
          </p>
          <p style="color: #94a3b8; margin: 8px 0;">
            3️⃣ Get matched to the best jobs
          </p>
        </div>

        <div style="text-align: center;
                    margin: 32px 0;">
          <a href="{APP_URL}/dashboard/jobseeker"
             style="background: #6366f1;
                    color: white;
                    padding: 14px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;
                    font-size: 16px;">
            Go to Dashboard →
          </a>
        </div>

        <p style="color: #64748b;
                  font-size: 12px;
                  text-align: center;
                  margin-top: 32px;">
          © 2026 Vertex. All rights reserved.
        </p>
      </div>
      """
        else:
            subject = "Welcome to Vertex — Start finding talent"
            body = f"""
      <div style="font-family: Arial, sans-serif;
                  max-width: 600px; margin: 0 auto;
                  background: #0a0a0f; color: white;
                  padding: 40px; border-radius: 12px;">

        <div style="text-align: center;
                    margin-bottom: 32px;">
          <h1 style="font-size: 32px; margin: 0;">
            <span style="color: white;">Vert</span>
            <span style="color: #6366f1;">ex</span>
          </h1>
        </div>

        <h2 style="color: white; font-size: 24px;">
          Welcome, {full_name}! 🏢
        </h2>

        <p style="color: #94a3b8; line-height: 1.6;">
          Your company account is ready.
          Start finding the right talent
          for your team today.
        </p>

        <div style="background: #13131f;
                    border: 1px solid #2a2a3d;
                    border-radius: 12px;
                    padding: 24px;
                    margin: 24px 0;">
          <h3 style="color: white; margin-top: 0;">
            Get started:
          </h3>
          <p style="color: #94a3b8; margin: 8px 0;">
            1️⃣ Complete your company profile
          </p>
          <p style="color: #94a3b8; margin: 8px 0;">
            2️⃣ Enter the skills you need
          </p>
          <p style="color: #94a3b8; margin: 8px 0;">
            3️⃣ See ranked matching candidates
          </p>
        </div>

        <div style="text-align: center;
                    margin: 32px 0;">
          <a href="{APP_URL}/dashboard/company"
             style="background: #6366f1;
                    color: white;
                    padding: 14px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;
                    font-size: 16px;">
            Go to Dashboard →
          </a>
        </div>

        <p style="color: #64748b;
                  font-size: 12px;
                  text-align: center;
                  margin-top: 32px;">
          © 2026 Vertex. All rights reserved.
        </p>
      </div>
      """

        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": body
        })
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


def send_job_alert_email(
    to_email: str,
    full_name: str,
    jobs: list
) -> bool:
    if not jobs:
        return False
    try:
        jobs_html = ""
        for job in jobs[:10]:
            jobs_html += f"""
      <div style="background: #13131f;
                  border: 1px solid #2a2a3d;
                  border-radius: 10px;
                  padding: 16px;
                  margin-bottom: 12px;">
        <div style="display: flex;
                    justify-content: space-between;
                    align-items: center;">
          <div>
            <h3 style="color: white;
                        margin: 0 0 4px 0;
                        font-size: 16px;">
              {job.get('job_title', 'Job Title')}
            </h3>
            <p style="color: #94a3b8;
                       margin: 0;
                       font-size: 14px;">
              {job.get('company', 'Company')}
            </p>
            <p style="color: #64748b;
                       margin: 4px 0 0 0;
                       font-size: 12px;">
              📍 {job.get('location', 'Remote')}
            </p>
          </div>
          <span style="background: rgba(34,197,94,0.15);
                        color: #22c55e;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 13px;
                        font-weight: bold;">
            {job.get('match_score', 0):.0f}% Match
          </span>
        </div>
        <a href="{job.get('job_url', '#')}"
           style="display: inline-block;
                  margin-top: 12px;
                  color: #6366f1;
                  font-size: 13px;
                  text-decoration: none;">
          View Job →
        </a>
      </div>
      """
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": f"🎯 {len(jobs)} new jobs match your profile",
            "html": f"""
      <div style="font-family: Arial, sans-serif;
                  max-width: 600px; margin: 0 auto;
                  background: #0a0a0f; color: white;
                  padding: 40px; border-radius: 12px;">

        <div style="text-align: center;
                    margin-bottom: 24px;">
          <h1 style="font-size: 28px; margin: 0;">
            <span style="color: white;">Vert</span>
            <span style="color: #6366f1;">ex</span>
          </h1>
        </div>

        <h2 style="color: white; font-size: 22px;">
          Hi {full_name}, new matches found! 🎯
        </h2>

        <p style="color: #94a3b8; line-height: 1.6;">
          We found {len(jobs)} new jobs that match
          your profile. Here are your top matches:
        </p>

        {jobs_html}

        <div style="text-align: center;
                    margin: 32px 0;">
          <a href="{APP_URL}/match"
             style="background: #6366f1;
                    color: white;
                    padding: 14px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;">
            See All Matches →
          </a>
        </div>

        <p style="color: #64748b;
                  font-size: 12px;
                  text-align: center;">
          © 2026 Vertex ·
          <a href="{APP_URL}/settings/alerts"
             style="color: #64748b;">
            Manage alerts
          </a>
        </p>
      </div>
      """
        })
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


def send_contact_request_email(
    to_email: str,
    candidate_name: str,
    company_name: str,
    message: str
) -> bool:
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": f"🏢 {company_name} wants to connect",
            "html": f"""
      <div style="font-family: Arial, sans-serif;
                  max-width: 600px; margin: 0 auto;
                  background: #0a0a0f; color: white;
                  padding: 40px; border-radius: 12px;">

        <div style="text-align: center;
                    margin-bottom: 24px;">
          <h1 style="font-size: 28px; margin: 0;">
            <span style="color: white;">Vert</span>
            <span style="color: #6366f1;">ex</span>
          </h1>
        </div>

        <h2 style="color: white; font-size: 22px;">
          Hi {candidate_name}! 👋
        </h2>

        <p style="color: #94a3b8; line-height: 1.6;">
          <strong style="color: white;">
            {company_name}
          </strong>
          found your profile on Vertex and
          wants to connect with you.
        </p>

        <div style="background: #13131f;
                    border: 1px solid #2a2a3d;
                    border-left: 3px solid #6366f1;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 24px 0;">
          <p style="color: #94a3b8;
                     margin: 0;
                     font-style: italic;
                     line-height: 1.6;">
            "{message}"
          </p>
          <p style="color: #64748b;
                     font-size: 12px;
                     margin: 12px 0 0 0;">
            — {company_name}
          </p>
        </div>

        <div style="text-align: center;
                    margin: 32px 0;">
          <a href="{APP_URL}/dashboard/jobseeker"
             style="background: #6366f1;
                    color: white;
                    padding: 14px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;
                    margin-right: 12px;">
            View Request →
          </a>
        </div>

        <p style="color: #64748b;
                  font-size: 12px;
                  text-align: center;">
          © 2026 Vertex. All rights reserved.
        </p>
      </div>
      """
        })
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


def send_acceptance_email(
    company_email: str,
    company_name: str,
    candidate_name: str,
    candidate_email: str,
) -> bool:
    """Notify company that candidate accepted; include candidate email."""
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [company_email],
            "subject": f"✓ {candidate_name} accepted your contact request",
            "html": f"""
      <div style="font-family: Arial, sans-serif;
                  max-width: 600px; margin: 0 auto;
                  background: #0a0a0f; color: white;
                  padding: 40px; border-radius: 12px;">

        <div style="text-align: center;
                    margin-bottom: 24px;">
          <h1 style="font-size: 28px; margin: 0;">
            <span style="color: white;">Vert</span>
            <span style="color: #6366f1;">ex</span>
          </h1>
        </div>

        <h2 style="color: white; font-size: 22px;">
          Great news! 🎉
        </h2>

        <p style="color: #94a3b8; line-height: 1.6;">
          <strong style="color: white;">{candidate_name}</strong>
          accepted your contact request on Vertex.
          You can now reach them directly:
        </p>

        <div style="background: rgba(34,197,94,0.1);
                    border: 1px solid rgba(34,197,94,0.3);
                    border-radius: 10px;
                    padding: 20px;
                    margin: 24px 0;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">
            Candidate email
          </p>
          <a href="mailto:{candidate_email}"
             style="color: #6366f1; font-size: 18px; text-decoration: none;">
            {candidate_email}
          </a>
        </div>

        <p style="color: #64748b;
                  font-size: 12px;
                  text-align: center;">
          © 2026 Vertex. All rights reserved.
        </p>
      </div>
      """
        })
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False


def send_password_reset_email(
    to_email: str,
    full_name: str,
    reset_token: str
) -> bool:
    try:
        reset_url = f"{APP_URL}/auth/reset-password?token={reset_token}"
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Reset your Vertex password",
            "html": f"""
      <div style="font-family: Arial, sans-serif;
                  max-width: 600px; margin: 0 auto;
                  background: #0a0a0f; color: white;
                  padding: 40px; border-radius: 12px;">

        <div style="text-align: center;
                    margin-bottom: 24px;">
          <h1 style="font-size: 28px; margin: 0;">
            <span style="color: white;">Vert</span>
            <span style="color: #6366f1;">ex</span>
          </h1>
        </div>

        <h2 style="color: white; font-size: 22px;">
          Password Reset Request
        </h2>

        <p style="color: #94a3b8; line-height: 1.6;">
          Hi {full_name}, we received a request to
          reset your Vertex password. Click the button
          below to set a new password.
        </p>

        <div style="text-align: center;
                    margin: 32px 0;">
          <a href="{reset_url}"
             style="background: #6366f1;
                    color: white;
                    padding: 14px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;">
            Reset Password →
          </a>
        </div>

        <p style="color: #64748b;
                  font-size: 13px;
                  text-align: center;">
          This link expires in 1 hour.
          If you did not request this,
          ignore this email.
        </p>

        <p style="color: #64748b;
                  font-size: 12px;
                  text-align: center;
                  margin-top: 24px;">
          © 2026 Vertex. All rights reserved.
        </p>
      </div>
      """
        })
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False
