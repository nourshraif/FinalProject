"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { sendContactRequest } from "@/lib/api";
import { toast } from "sonner";

const MAX_MESSAGE = 500;

export interface ContactRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateUserId: number;
  candidateName: string;
  token: string;
}

export function ContactRequestModal({
  isOpen,
  onClose,
  candidateUserId,
  candidateName,
  token,
}: ContactRequestModalProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMessage("");
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE;

  const handleSend = () => {
    if (!canSend || isLoading || !token) return;
    setError(null);
    setIsLoading(true);
    sendContactRequest(token, candidateUserId, trimmed)
      .then(() => {
        setSuccess(true);
        toast.success("Request sent successfully");
        setTimeout(() => {
          onClose();
        }, 1500);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to send request");
      })
      .finally(() => setIsLoading(false));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="glass-card w-full max-w-[480px] rounded-2xl p-8">
        <div className="mb-6 flex items-start justify-between">
          <h2 className="text-xl font-bold text-white">
            Contact {candidateName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-vertex-muted transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "rgba(13,13,26,0.8)", color: "#94a3b8" }}
        >
          📧 The candidate&apos;s email stays private until they accept your
          request.
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-vertex-muted">
            Your message
          </label>
          <textarea
            value={message}
            onChange={(e) =>
              setMessage(e.target.value.slice(0, MAX_MESSAGE))
            }
            placeholder={`Hi ${candidateName}, I came across your profile on Vertex and I think you'd be a great fit for a role at our company...`}
            rows={5}
            className="vertex-input w-full resize-none rounded-lg px-3 py-2 text-sm"
            maxLength={MAX_MESSAGE}
          />
          <p className="mt-1 text-right text-xs text-vertex-muted">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        {success && (
          <p className="mb-4 text-sm text-green-400">
            Request sent! Closing…
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || isLoading}
            className="glow-button w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {isLoading ? "Sending…" : "Send Request"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ghost-button w-full rounded-lg py-2.5 text-sm font-medium text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContactRequestModal;
