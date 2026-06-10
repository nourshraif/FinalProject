"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  adminCreateScraperSource,
  adminDeleteScraperSource,
  adminGetScraperSources,
  adminUpdateScraperSource,
  type ScraperSource,
  type ScraperSourceInput,
} from "@/lib/api";

type Props = {
  token: string;
  showToast: (msg: string, type: "success" | "error") => void;
};

const EMPTY_FORM: ScraperSourceInput = {
  source_name: "",
  source_key: "",
  base_url: "",
  scraper_type: "",
  api_endpoint: "",
  scrape_interval_hours: 24,
  is_active: true,
};

export function AdminSourcesSection({ token, showToast }: Props) {
  const [sources, setSources] = useState<ScraperSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ScraperSourceInput>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ScraperSource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSources = useCallback(() => {
    if (!token) return;
    setLoading(true);
    adminGetScraperSources(token)
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(source: ScraperSource) {
    setEditId(source.id);
    setForm({
      source_name: source.source_name,
      source_key: source.source_key,
      base_url: source.base_url,
      scraper_type: source.scraper_type,
      api_endpoint: source.api_endpoint ?? "",
      scrape_interval_hours: source.scrape_interval_hours,
      is_active: source.is_active,
    });
    setModalOpen(true);
  }

  async function saveSource() {
    if (!token) return;
    setSaving(true);
    try {
      if (editId) {
        await adminUpdateScraperSource(token, editId, form);
        showToast("Source updated", "success");
      } else {
        await adminCreateScraperSource(token, form);
        showToast("Source added", "success");
      }
      setModalOpen(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      loadSources();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save source", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteScraperSource(token, deleteTarget.id);
      showToast(`Removed ${deleteTarget.source_name}`, "success");
      setDeleteTarget(null);
      loadSources();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete source", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="glass-card rounded-xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Job board sources</h2>
            <p className="mt-1 text-sm text-vertex-muted">
              {loading
                ? "Loading configured sources…"
                : `${sources.length} job board${sources.length === 1 ? "" : "s"} configured for nightly ingest.`}
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="glow-button inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white"
          >
            <Plus className="h-4 w-4" />
            Add source
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm text-white">
            <thead>
              <tr className="border-b border-white/10 text-left text-vertex-muted">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Key</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Interval</th>
                <th className="pb-3 pr-4 font-medium">Active</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-vertex-muted">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
                  </td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-vertex-muted">
                    No sources configured yet.
                  </td>
                </tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-3 pr-4 font-medium">{s.source_name}</td>
                    <td className="py-3 pr-4 text-vertex-muted">{s.source_key}</td>
                    <td className="py-3 pr-4 text-vertex-muted">{s.scraper_type}</td>
                    <td className="py-3 pr-4 text-vertex-muted">{s.scrape_interval_hours}h</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          s.is_active
                            ? "text-green-400"
                            : "text-slate-500"
                        }
                      >
                        {s.is_active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 px-4 py-10">
          <div className="flex min-h-full items-start justify-center">
            <div className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b1120] p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {editId ? "Edit source" : "Add source"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-3 py-1 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Source name</label>
                  <input
                    type="text"
                    value={form.source_name}
                    onChange={(e) => setForm({ ...form, source_name: e.target.value })}
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="LinkedIn Jobs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Source key</label>
                  <input
                    type="text"
                    value={form.source_key}
                    onChange={(e) => setForm({ ...form, source_key: e.target.value })}
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="linkedin_jobs"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-300">Base URL</label>
                  <input
                    type="text"
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="https://linkedin.com/jobs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Scraper type</label>
                  <input
                    type="text"
                    value={form.scraper_type}
                    onChange={(e) => setForm({ ...form, scraper_type: e.target.value })}
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="html"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">API endpoint</label>
                  <input
                    type="text"
                    value={form.api_endpoint ?? ""}
                    onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })}
                    className="vertex-input w-full rounded-lg px-4 py-3"
                    placeholder="/api/jobs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Scrape interval (hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.scrape_interval_hours ?? 24}
                    onChange={(e) =>
                      setForm({ ...form, scrape_interval_hours: Number(e.target.value) })
                    }
                    className="vertex-input w-full rounded-lg px-4 py-3"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={form.is_active ?? true}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="rounded border-white/20"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSource}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-70"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save source"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete source"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.source_name}"? This cannot be undone.`
            : ""
        }
        confirmText={deleting ? "Deleting…" : "Delete"}
        confirmStyle="destructive"
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );
}
