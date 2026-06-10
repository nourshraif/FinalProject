"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — job board management lives on the admin Job Boards tab. */
export default function AdminSourcesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin?tab=sources");
  }, [router]);

  return null;
}
