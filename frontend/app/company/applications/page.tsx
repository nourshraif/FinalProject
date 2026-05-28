"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getCompanyApplications } from "@/lib/api";
import type { VertexJobApplication } from "@/types";

function AllApplicationsContent() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [apps, setApps] = useState<VertexJobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getCompanyApplications(token)
      .then((list) => setApps(list.filter((a) => a.status !== "withdrawn")))
      .catch((e) => {
        setApps([]);
        showToast(e instanceof Error ? e.message : "Failed to load", "error");
      })
      .finally(() => setLoading(false));
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6">
        <h1 className="text-3xl font-bold text-white">All applicants</h1>
        <p className="mt-1 text-sm text-vertex-muted">
          Applications across all your Vertex job postings
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "#6366f1" }}
            />
          </div>
        ) : apps.length === 0 ? (
          <div className="glass-card mt-8 rounded-2xl py-16 text-center">
            <p className="text-white font-medium">No applications yet</p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {apps.map((app) => (
              <Link
                key={app.id}
                href={`/company/jobs/${app.posted_job_id}/applicants`}
                className="glass-card block rounded-xl p-5 transition-colors hover:border-indigo-500/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-white">{app.applicant_name}</p>
                    <p className="text-sm text-vertex-muted">
                      {app.job_title} · {app.company_name}
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs text-indigo-200">
                    {app.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompanyApplicationsPage() {
  return (
    <ProtectedRoute requiredRole="company">
      <AllApplicationsContent />
    </ProtectedRoute>
  );
}
