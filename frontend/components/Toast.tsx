"use client";

import { useEffect } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

const borderColors = {
  success: "#22c55e",
  error: "#ef4444",
  info: "#6366f1",
};

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const borderColor = borderColors[type];
  const Icon =
    type === "success" ? Check : type === "error" ? AlertCircle : Info;
  const iconColor =
    type === "success" ? "text-green-500" : type === "error" ? "text-red-500" : "text-indigo-400";

  return (
    <div
      className="glass-card flex min-w-[300px] max-w-[400px] items-center gap-3 rounded-xl px-5 py-4 shadow-lg animate-toast-slide-in"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />
      <p className="min-w-0 flex-1 text-sm font-medium text-white">
        {message}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded p-1 text-vertex-muted transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
