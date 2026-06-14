"""Unit tests for company pricing tiers."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.plan_limits import (
    allowed_pipeline_statuses,
    can_company_analytics,
    can_search_candidates,
    can_send_contact_requests,
    check_plan_access,
    company_plan_label,
    max_active_jobs,
    max_contact_requests_30d,
    max_saved_candidates,
    has_job_boost,
)


def _company(plan: str) -> dict:
    return {"user_type": "company", "plan": plan}


def test_free_company_limits():
    user = _company("free")
    assert max_active_jobs(user) == 1
    assert max_contact_requests_30d(user) == 0
    assert not can_send_contact_requests(user)
    assert max_saved_candidates(user) == 0
    assert not check_plan_access(user, "send_contact_requests")
    assert not can_company_analytics(user)
    assert not has_job_boost(user)
    assert allowed_pipeline_statuses(user) == {"applied", "rejected"}


def test_growth_company_limits():
    user = _company("pro")
    assert max_active_jobs(user) == 5
    assert max_contact_requests_30d(user) == 0
    assert not can_send_contact_requests(user)
    assert max_saved_candidates(user) == 0
    assert not can_search_candidates(user)
    assert can_company_analytics(user)
    assert has_job_boost(user)
    assert "interviewing" in allowed_pipeline_statuses(user)
    assert not check_plan_access(user, "save_candidates")
    assert not check_plan_access(user, "send_contact_requests")
    assert check_plan_access(user, "full_pipeline")


def test_business_company_limits():
    user = _company("business")
    assert max_active_jobs(user) is None
    assert max_contact_requests_30d(user) is None
    assert max_saved_candidates(user) is None
    assert can_search_candidates(user)
    assert can_send_contact_requests(user)
    assert check_plan_access(user, "save_candidates")


def test_company_plan_labels():
    assert company_plan_label("free") == "Free"
    assert company_plan_label("pro") == "Growth"
    assert company_plan_label("business") == "Business"


if __name__ == "__main__":
    test_free_company_limits()
    test_growth_company_limits()
    test_business_company_limits()
    test_company_plan_labels()
    print("All plan_limits tests passed.")
