"use client";

import { useEffect, useState } from "react";
import { getStats, runScraper } from "@/lib/api";
import type { Stats } from "@/types";
import { useToast } from "@/context/ToastContext";
import { StatsPanel } from "@/components/StatsPanel";
import { SkeletonStatCard } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraperRunning, setScraperRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load stats";
        if (!cancelled) setError(msg);
        showToast(msg, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRunScraper = async () => {
    setScraperRunning(true);
    setError(null);
    try {
      await runScraper();
      const data = await getStats();
      setStats(data);
      showToast("Scraper started. Stats refreshed.", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scraper request failed";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setScraperRunning(false);
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunScraper}
          disabled={scraperRunning}
          className="gap-2"
        >
          {scraperRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Run scraper
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-vertex-danger/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      ) : stats ? (
        <StatsPanel stats={stats} />
      ) : !error ? (
        <p className="text-vertex-muted">No stats available.</p>
      ) : null}
    </div>
  );
}
