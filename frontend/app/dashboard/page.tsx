"use client";

import { useEffect, useState } from "react";
import { getStats, runScraper } from "@/lib/api";
import type { Stats } from "@/types";
import { toast } from "sonner";
import { StatsPanel } from "@/components/StatsPanel";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";

export default function DashboardPage() {
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
        toast.error(msg);
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
      toast.success("Scraper started. Stats refreshed.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scraper request failed";
      setError(msg);
      toast.error(msg);
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
        <div className="flex items-center gap-2 text-vertex-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading stats…
        </div>
      ) : stats ? (
        <StatsPanel stats={stats} />
      ) : !error ? (
        <p className="text-vertex-muted">No stats available.</p>
      ) : null}
    </div>
  );
}
