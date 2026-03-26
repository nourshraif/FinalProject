"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: "destructive" | "normal";
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmStyle = "normal",
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    if (isOpen) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="glass-card w-full max-w-[400px] rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-vertex-muted">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="ghost-button flex-1 rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white",
              confirmStyle === "destructive"
                ? "bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-500"
                : "glow-button"
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
