"use client";

import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Target, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Insight {
  title: string;
  description: string;
  type: "opportunity" | "risk" | "action" | "trend";
  priority: "high" | "medium" | "low";
  contactIds?: string[];
}

interface PipelineInsightsCardProps {
  /** When true, fetch pipeline-level insights (no contactId) */
  mode: "pipeline" | "contact";
  /** Required when mode === "contact" */
  contactId?: string;
  /** Callback when the user wants to act on a contact */
  onSelectContact?: (email: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string; badge: string }> = {
  opportunity: {
    icon: TrendingUp,
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  risk: {
    icon: AlertTriangle,
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  action: {
    icon: Target,
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  trend: {
    icon: BarChart3,
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineInsightsCard({
  mode,
  contactId,
  onSelectContact,
}: PipelineInsightsCardProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    setError(false);
    try {
      const url =
        mode === "contact" && contactId
          ? `/api/ai/insights?contactId=${contactId}`
          : "/api/ai/insights";
      const res = await fetch(url);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setInsights(data.insights ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, contactId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-800 dark:bg-purple-950/10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 animate-pulse text-purple-500" aria-hidden="true" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            {mode === "pipeline" ? "Analyzing pipeline..." : "Analyzing contact..."}
          </span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-purple-100/50 dark:bg-purple-900/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-800 dark:bg-purple-950/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">AI insights unavailable</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchInsights} className="h-7 text-xs text-purple-500">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-800 dark:bg-purple-950/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">No insights available yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-800 dark:bg-purple-950/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
            {mode === "pipeline" ? "Pipeline Insights" : "Contact Insights"}
          </h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchInsights}
          className="h-7 px-2 text-xs text-purple-500"
        >
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {insights.map((insight, idx) => {
          const config = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.action;
          const TypeIcon = config.icon;

          return (
            <div
              key={idx}
              className={`rounded-md border border-border ${config.bg} p-3`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <TypeIcon className={`h-4 w-4 mt-0.5 shrink-0 ${config.text}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${config.text}`}>{insight.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
                    {insight.contactIds && insight.contactIds.length > 0 && onSelectContact && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {insight.contactIds.slice(0, 3).map((email) => (
                          <button
                            key={email}
                            onClick={() => onSelectContact(email)}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline truncate max-w-[140px]"
                          >
                            {email}
                          </button>
                        ))}
                        {insight.contactIds.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{insight.contactIds.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${config.badge}`}>
                    {insight.type}
                  </span>
                  {insight.priority === "high" && (
                    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      urgent
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
