"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Eye,
  Download,
  Clock,
  FileText,
  Shield,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ViewerEvent {
  id: string;
  type: "PAGE_VIEW" | "DOWNLOAD" | "DWELL" | "NDA_SIGNED" | "DOCUMENT_VIEWED";
  viewerEmail: string | null;
  viewerName: string | null;
  documentName: string | null;
  dataroomName: string | null;
  pageNumber: number | null;
  duration: number | null; // seconds
  createdAt: string;
  ipAddress?: string | null;
}

interface ActivityTimelineProps {
  teamId: string | null;
}

// ---------------------------------------------------------------------------
// Event icon + color mapping
// ---------------------------------------------------------------------------

const EVENT_CONFIG: Record<
  string,
  { icon: typeof Eye; color: string; label: string }
> = {
  PAGE_VIEW: {
    icon: Eye,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    label: "Viewed",
  },
  DOWNLOAD: {
    icon: Download,
    color:
      "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
    label: "Downloaded",
  },
  DWELL: {
    icon: Clock,
    color:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
    label: "Spent time",
  },
  NDA_SIGNED: {
    icon: Shield,
    color:
      "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
    label: "Signed NDA",
  },
  DOCUMENT_VIEWED: {
    icon: FileText,
    color:
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400",
    label: "Viewed document",
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityTimeline({ teamId }: ActivityTimelineProps) {
  const [events, setEvents] = useState<ViewerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = useCallback(
    async (pageNum: number = 1) => {
      if (!teamId) return;
      try {
        setLoading(true);
        const res = await fetch(
          `/api/raise-crm/activity?teamId=${teamId}&page=${pageNum}&limit=30`,
        );
        if (res.ok) {
          const data = await res.json();
          if (pageNum === 1) {
            setEvents(data.events ?? []);
          } else {
            setEvents((prev) => [...prev, ...(data.events ?? [])]);
          }
          setHasMore(data.hasMore ?? false);
        }
      } catch {
        // Silently fail — activity is supplementary
      } finally {
        setLoading(false);
      }
    },
    [teamId],
  );

  useEffect(() => {
    fetchEvents(1);
  }, [fetchEvents]);

  // Refresh
  const handleRefresh = () => {
    setPage(1);
    fetchEvents(1);
  };

  // Load more
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEvents(nextPage);
  };

  // Empty state
  if (!loading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">
          No activity yet
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          DataRoom viewer events (page views, downloads, time spent) will
          appear here as visitors engage with your content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Real-time DataRoom viewer activity
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="min-h-[44px]"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading && events.length === 0 && (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />

        <div className="space-y-0">
          {events.map((event) => {
            const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.PAGE_VIEW;
            const Icon = config.icon;
            const viewerLabel =
              event.viewerName || event.viewerEmail || "Anonymous";

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 py-3 relative"
              >
                {/* Icon */}
                <div
                  className={`relative z-10 flex-shrink-0 rounded-full p-1.5 ${config.color}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {viewerLabel}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0"
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {event.documentName && (
                      <span className="font-medium">
                        {event.documentName}
                      </span>
                    )}
                    {event.dataroomName &&
                      !event.documentName && (
                        <span className="font-medium">
                          {event.dataroomName}
                        </span>
                      )}
                    {event.pageNumber && ` — Page ${event.pageNumber}`}
                    {event.duration != null && event.duration > 0 && (
                      <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">
                        ({formatDuration(event.duration)})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono tabular-nums">
                    {formatDistanceToNow(new Date(event.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loading}
            className="min-h-[44px]"
          >
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
