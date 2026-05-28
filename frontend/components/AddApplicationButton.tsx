"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { buildTrackerUrl, type TrackerPrefill } from "@/lib/tracker";
import { cn } from "@/lib/utils";

type AddApplicationButtonProps = {
  prefill: TrackerPrefill;
  className?: string;
  showIcon?: boolean;
};

export function AddApplicationButton({
  prefill,
  className,
  showIcon = false,
}: AddApplicationButtonProps) {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();
  const { showToast } = useToast();

  if (user?.user_type && user.user_type !== "jobseeker") {
    return null;
  }

  const isPro =
    user?.plan === "pro" ||
    user?.plan === "business" ||
    Boolean(user?.is_admin);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = buildTrackerUrl(prefill);
    if (!isLoggedIn) {
      router.push(`/auth/login?next=${encodeURIComponent(url)}`);
      return;
    }
    if (!isPro) {
      showToast("Application tracker requires Pro plan", "info");
      router.push("/pricing");
      return;
    }
    router.push(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "ghost-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
        className
      )}
    >
      {showIcon && <Plus className="h-3.5 w-3.5" aria-hidden />}
      Add Application
    </button>
  );
}
