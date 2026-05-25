"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  User,
  Building2,
  Briefcase,
  ClipboardList,
  Mail,
  TrendingUp,
  Loader2,
  Clock3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getAdminStats,
  getAdminHealth,
  getAdminScraperLastRun,
  getAdminUsers,
  getAdminActivity,
  runScraper,
  cleanupInactiveJobs,
  toggleUserActive,
  makeUserAdmin,
  type AdminStats as AdminStatsType,
  type AdminUserRow,
  type AdminActivityItem,
} from "@/lib/api";
import { AdminForbidden } from "../AdminForbidden";
import { useToast } from "@/context/ToastContext";

const PAGE_SIZE = 50;

export default function AdminPage() {
  const { user, token, isLoggedIn } = useAuth();
  const { showToast } = useToast();

  // ===================== EXISTING STATE =====================
  const [stats, setStats] = useState<AdminStatsType | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [activity, setActivity] = useState<AdminActivityItem[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const [scraperLoading, setScraperLoading] = useState(false);
  const [cleanupInactiveLoading, setCleanupInactiveLoading] = useState(false);

  const [lastScraperRun, setLastScraperRun] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(false);

  // ===================== SCRAPER SOURCES STATE (NEW) =====================
  const [sources, setSources] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [form, setForm] = useState({
    source_name: "",
    source_key: "",
    base_url: "",
    scraper_type: "",
    api_endpoint: "",
    scrape_interval_hours: 24,
  });

  // ===================== LOAD SOURCES =====================
  const loadSources = useCallback(() => {
  if (!token) return;

  fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/scrapers/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("SCRAPERS RESPONSE:", data);

      const list =
        Array.isArray(data)
          ? data
          : data?.sources || data?.data || data?.results || [];

      setSources(list);
    })
    .catch(() => setSources([]));
}, [token]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // ===================== SAVE (CREATE / UPDATE) =====================
  const saveSource = async () => {
    if (!token) return;

    const url = editId
      ? `/api/admin/scrapers/${editId}`
      : `/api/admin/scrapers/`;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      method: editId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    setModalOpen(false);
    setEditId(null);

    setForm({
      source_name: "",
      source_key: "",
      base_url: "",
      scraper_type: "",
      api_endpoint: "",
      scrape_interval_hours: 24,
    });

    loadSources();
    showToast("Source saved successfully", "success");
  };

  // ===================== EDIT =====================
  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm(s);
    setModalOpen(true);
  };

  // ===================== LOAD EXISTING FUNCTIONS =====================
  const loadStats = useCallback(() => {
    if (!token) return;
    setLoadingStats(true);
    getAdminStats(token)
      .then(setStats)
      .finally(() => setLoadingStats(false));
  }, [token]);

  const loadUsers = useCallback(() => {
    if (!token) return;
    setLoadingUsers(true);
    getAdminUsers(token, { limit: PAGE_SIZE, offset, search: search || undefined })
      .then(({ users, total }) => {
        setUsers(users);
        setTotalUsers(total);
      })
      .finally(() => setLoadingUsers(false));
  }, [token, offset, search]);

  const loadActivity = useCallback(() => {
    if (!token) return;
    setLoadingActivity(true);
    getAdminActivity(token)
      .then(setActivity)
      .finally(() => setLoadingActivity(false));
  }, [token]);

  useEffect(() => {
    loadStats();
    loadUsers();
    loadActivity();
  }, [loadStats, loadUsers, loadActivity]);

  // ===================== UI =====================
  if (!isLoggedIn || !user) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 pt-24 text-white">
        Please sign in.
        <Link href="/auth/login" className="ml-2 underline">Login</Link>
      </div>
    );
  }

  if (!user.is_admin) return <AdminForbidden />;

return (
  <div className="min-h-screen overflow-y-auto px-6 pt-24 pb-32">
    <div className="mx-auto max-w-[1200px]">

      {/* ===================== SCRAPER SOURCES ===================== */}
      <div className="glass-card mt-6 p-6">
        <div className="mb-3 flex justify-between">
          <h2 className="font-bold text-white">Scraper Sources</h2>

          <button
            onClick={() => {
              setEditId(null);

              setForm({
                source_name: "",
                source_key: "",
                base_url: "",
                scraper_type: "",
                api_endpoint: "",
                scrape_interval_hours: 24,
              });

              setModalOpen(true);
            }}
            className="glow-button rounded px-3 py-2"
          >
            + Add Source
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-white">
            <thead>
              <tr className="text-left text-gray-400">
                <th>Name</th>
                <th>Key</th>
                <th>Type</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-gray-800">
                  <td className="py-3">{s.source_name}</td>
                  <td>{s.source_key}</td>
                  <td>{s.scraper_type}</td>
                  <td>{s.is_active ? "Yes" : "No"}</td>

                  <td>
                    <button
                      onClick={() => openEdit(s)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== MODAL ===================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 px-4 py-10">
          <div className="flex min-h-full items-start justify-center">
            <div className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b1120] p-6 shadow-2xl">

              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {editId ? "Edit Source" : "Add Source"}
                </h2>

                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-3 py-1 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Source Name
                  </label>

                  <input
                    type="text"
                    value={form.source_name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        source_name: e.target.value,
                      })
                    }
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="LinkedIn Jobs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Source Key
                  </label>

                  <input
                    type="text"
                    value={form.source_key}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        source_key: e.target.value,
                      })
                    }
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="linkedin_jobs"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-300">
                    Base URL
                  </label>

                  <input
                    type="text"
                    value={form.base_url}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        base_url: e.target.value,
                      })
                    }
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="https://linkedin.com/jobs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Scraper Type
                  </label>

                  <input
                    type="text"
                    value={form.scraper_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        scraper_type: e.target.value,
                      })
                    }
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="html"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    API Endpoint
                  </label>

                  <input
                    type="text"
                    value={form.api_endpoint}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        api_endpoint: e.target.value,
                      })
                    }
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="/api/jobs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-300">
                    Scrape Interval (hours)
                  </label>

                  <input
                    type="number"
                    value={form.scrape_interval_hours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        scrape_interval_hours: Number(e.target.value),
                      })
                    }
                    className="vertex-input w-full rounded-lg px-4 py-3"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  onClick={saveSource}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Save Source
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  </div>
);
}