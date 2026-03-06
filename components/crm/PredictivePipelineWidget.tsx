"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageData {
  stage: string;
  count: number;
  label: string;
}

interface PredictivePipelineWidgetProps {
  stages: StageData[];
  hasAiFeatures: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_COLORS: Record<string, string> = {
  LEAD: "bg-blue-500",
  CONTACTED: "bg-indigo-500",
  INTERESTED: "bg-violet-500",
  CONVERTED: "bg-amber-500",
  NDA_SIGNED: "bg-emerald-500",
  ACCREDITED: "bg-teal-500",
  COMMITTED: "bg-orange-500",
  FUNDED: "bg-green-500",
};

/**
 * Calculate simple conversion rates between adjacent stages.
 * Returns an array of percentages: [stage0→stage1 %, stage1→stage2 %, ...]
 */
function calculateConversionRates(stages: StageData[]): number[] {
  const rates: number[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    if (stages[i].count === 0) {
      rates.push(0);
    } else {
      rates.push(Math.round((stages[i + 1].count / stages[i].count) * 100));
    }
  }
  return rates;
}

/**
 * Estimate pipeline velocity based on distribution.
 * Healthy pipeline: most contacts in early stages with progressive drop-off.
 */
function estimatePipelineHealth(stages: StageData[]): {
  score: "healthy" | "bottleneck" | "stalled";
  message: string;
} {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return { score: "stalled", message: "No contacts in pipeline" };

  const earlyStages = stages.slice(0, Math.ceil(stages.length / 2));
  const lateStages = stages.slice(Math.ceil(stages.length / 2));

  const earlyCount = earlyStages.reduce((sum, s) => sum + s.count, 0);
  const lateCount = lateStages.reduce((sum, s) => sum + s.count, 0);

  // Check for bottleneck — too many stuck in middle
  const midIdx = Math.floor(stages.length / 2);
  const midCount = stages[midIdx]?.count ?? 0;
  if (midCount > total * 0.4) {
    return {
      score: "bottleneck",
      message: `Bottleneck at ${stages[midIdx].label} — ${Math.round((midCount / total) * 100)}% of contacts`,
    };
  }

  // Healthy if early > late (natural funnel shape)
  if (earlyCount > lateCount * 1.5 && lateCount > 0) {
    return { score: "healthy", message: "Pipeline shows healthy funnel progression" };
  }

  if (lateCount === 0 && earlyCount > 0) {
    return { score: "stalled", message: "No conversions to later stages yet" };
  }

  return { score: "healthy", message: "Pipeline is progressing normally" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PredictivePipelineWidget({
  stages,
  hasAiFeatures,
}: PredictivePipelineWidgetProps) {
  const conversionRates = useMemo(() => calculateConversionRates(stages), [stages]);
  const pipelineHealth = useMemo(() => estimatePipelineHealth(stages), [stages]);
  const totalContacts = useMemo(() => stages.reduce((sum, s) => sum + s.count, 0), [stages]);
  const maxCount = useMemo(() => Math.max(...stages.map((s) => s.count), 1), [stages]);

  if (totalContacts === 0) {
    return null;
  }

  const healthConfig = {
    healthy: {
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    bottleneck: {
      icon: TrendingDown,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800",
    },
    stalled: {
      icon: TrendingDown,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/20",
      border: "border-red-200 dark:border-red-800",
    },
  };

  const hc = healthConfig[pipelineHealth.score];
  const HealthIcon = hc.icon;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {hasAiFeatures && (
            <Sparkles className="h-4 w-4 text-purple-500" aria-hidden="true" />
          )}
          <h4 className="text-sm font-semibold">Pipeline Conversion</h4>
        </div>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {totalContacts} contacts
        </span>
      </div>

      {/* Pipeline Health Banner */}
      <div className={`rounded-md border ${hc.border} ${hc.bg} p-2.5 mb-3`}>
        <div className="flex items-center gap-2">
          <HealthIcon className={`h-4 w-4 ${hc.color}`} aria-hidden="true" />
          <span className={`text-xs font-medium ${hc.color}`}>
            {pipelineHealth.message}
          </span>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="space-y-1.5">
        {stages.map((stage, i) => {
          const barWidth = Math.max((stage.count / maxCount) * 100, 4); // min 4% width for visibility
          const rate = conversionRates[i];
          const color = STAGE_COLORS[stage.stage] ?? "bg-gray-500";

          return (
            <div key={stage.stage}>
              {/* Stage bar */}
              <div className="flex items-center gap-2">
                <div className="w-20 text-xs text-muted-foreground truncate" title={stage.label}>
                  {stage.label}
                </div>
                <div className="flex-1 h-6 bg-muted/50 rounded overflow-hidden">
                  <div
                    className={`h-full ${color} rounded transition-all duration-300 flex items-center px-2`}
                    style={{ width: `${barWidth}%` }}
                  >
                    {stage.count > 0 && (
                      <span className="text-xs font-mono font-medium text-white tabular-nums">
                        {stage.count}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Conversion arrow between stages */}
              {rate !== undefined && i < stages.length - 1 && (
                <div className="flex items-center gap-2 ml-20 pl-2 py-0.5">
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      rate >= 50
                        ? "text-emerald-600 dark:text-emerald-400"
                        : rate >= 25
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {rate}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
