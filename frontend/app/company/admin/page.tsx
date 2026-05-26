"use client";

import { useEffect, useState } from "react";
import { getAllCandidates, type AdminCandidateRow } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// TODO: add authentication before production

export default function CompanyAdminPage() {
  const [candidates, setCandidates] = useState<AdminCandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllCandidates(50)
      .then(setCandidates)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load candidates";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">All Candidates</h1>
      {/* TODO: add authentication before production */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-vertex-danger/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-vertex-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Talent pool ({candidates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-vertex-border text-left text-vertex-muted">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Skills</th>
                    <th className="pb-2 font-medium">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.email} className="border-b border-vertex-border/50">
                      <td className="py-3 pr-4 font-medium">{c.full_name}</td>
                      <td className="py-3 pr-4">
                        <a
                          href={`mailto:${c.email}`}
                          className="text-vertex-purple hover:underline"
                        >
                          {c.email}
                        </a>
                      </td>
                      <td className="py-3 pr-4">{c.skills_count}</td>
                      <td className="py-3">
                        {c.created_at
                          ? new Date(c.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {candidates.length === 0 && (
              <p className="py-8 text-center text-vertex-muted">
                No candidates in the pool yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
