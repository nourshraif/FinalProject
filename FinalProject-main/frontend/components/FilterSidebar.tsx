"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlidersHorizontal, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterSidebarProps {
  open?: boolean;
  onClose?: () => void;
  /** Only show close button on smaller screens when sidebar is overlay */
  showCloseButton?: boolean;
}

export function FilterSidebar({
  open = true,
  onClose,
  showCloseButton = false,
}: FilterSidebarProps) {
  return (
    <aside
      className={cn(
        "w-full shrink-0 lg:w-64",
        !open && "max-lg:hidden"
      )}
      aria-hidden={!open}
    >
      <Card className="h-full lg:h-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </CardTitle>
          {showCloseButton && onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Job Type</Label>
            <div className="flex flex-wrap gap-2">
              {["Remote", "Hybrid", "On-site"].map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-1.5 text-sm text-vertex-muted"
                >
                  <input type="checkbox" className="rounded border-vertex-border" />
                  {opt}
                </label>
              ))}
            </div>
            {/* TODO: wire up filtering logic */}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Location</Label>
            <input
              type="text"
              placeholder="City or country"
              className="w-full vertex-input px-3 py-2 text-sm placeholder:text-vertex-muted"
              aria-label="Location filter"
            />
            {/* TODO: wire up filtering logic */}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Posted</Label>
            <select
              className="w-full vertex-input px-3 py-2 text-sm text-vertex-muted"
              defaultValue=""
              aria-label="Date posted filter"
            >
              <option value="">Any time</option>
              <option value="24">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
            {/* TODO: wire up filtering logic */}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Match Score (min)</Label>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 60"
              className="w-full vertex-input px-3 py-2 text-sm placeholder:text-vertex-muted"
              aria-label="Minimum match score"
            />
            {/* TODO: wire up filtering logic */}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
