import type { Stats } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Clock, Tag } from "lucide-react";

interface StatsPanelProps {
  stats: Stats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  // TODO: replace with real API data; stats are currently passed from parent (mock or API)
  const lastUpdated = stats.last_scraped
    ? new Date(stats.last_scraped).toLocaleString()
    : "—";
  const topCategory = stats.top_categories[0] ?? "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          <Briefcase className="h-4 w-4 text-vertex-muted" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {stats.total_jobs.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          <Clock className="h-4 w-4 text-vertex-muted" />
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{lastUpdated}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Category</CardTitle>
          <Tag className="h-4 w-4 text-vertex-muted" />
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{topCategory}</p>
        </CardContent>
      </Card>
    </div>
  );
}
