"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { adminSendEmail, getAdminUsers } from "@/lib/api";
import type { AdminUserRow } from "@/lib/api";

type Props = {
  token: string;
  showToast: (msg: string, type: "success" | "error") => void;
};

export function AdminEmailsSection({ token, showToast }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchUsers = useCallback(() => {
    if (!token || !query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    getAdminUsers(token, { limit: 8, search: query.trim() })
      .then((r) => setResults(r.users))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [token, query]);

  useEffect(() => {
    const t = setTimeout(searchUsers, 300);
    return () => clearTimeout(t);
  }, [searchUsers]);

  const handleSend = async () => {
    if (!token || !selected) return;
    if (!subject.trim() || !message.trim()) {
      showToast("Subject and message are required", "error");
      return;
    }
    setSending(true);
    try {
      await adminSendEmail(token, {
        user_id: selected.id,
        subject: subject.trim(),
        message: message.trim(),
      });
      showToast(`Email sent to ${selected.full_name}`, "success");
      setSubject("");
      setMessage("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card mt-6 rounded-xl p-6">
      <h2 className="text-lg font-bold text-white">Send email to user</h2>

      <div className="relative mt-6">
        <input
          className="vertex-input w-full px-3 py-2 text-sm"
          placeholder="Search user by name or email..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) setSelected(null);
          }}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-indigo-400" />
        )}
        {results.length > 0 && !selected && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/10 bg-[#152238] py-1 shadow-xl">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => {
                    setSelected(u);
                    setResults([]);
                    setQuery(u.email);
                  }}
                >
                  <span className="text-white">{u.full_name}</span>
                  <span className="ml-2 text-vertex-muted">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1.5 text-sm">
          <span className="text-white">{selected.full_name}</span>
          <span className="text-vertex-muted">{selected.email}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="text-slate-400 hover:text-white"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        className="vertex-input mt-4 w-full px-3 py-2 text-sm"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <div className="mt-4">
        <textarea
          className="vertex-input min-h-[180px] w-full px-3 py-2 text-sm"
          placeholder="Message"
          value={message}
          maxLength={2000}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="mt-1 text-xs text-vertex-muted">{message.length}/2000</p>
      </div>

      <button
        type="button"
        disabled={sending || !selected}
        onClick={handleSend}
        className="glow-button mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm disabled:opacity-50"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          "Send email"
        )}
      </button>
    </div>
  );
}
