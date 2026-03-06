"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

interface PipelineSegment {
  label: string;
  value: number;
  color: string;
}

interface PipelineBarProps {
  segments: PipelineSegment[];
  className?: string;
  height?: string;
  showLabels?: boolean;
}

export function PipelineBar({
  segments,
  className,
  height = "h-3",
  showLabels = true,
}: PipelineBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <TooltipProvider delayDuration={0}>
        <div className={cn("flex w-full overflow-hidden rounded-full bg-muted", height)}>
          {segments.map((segment, i) => {
            const pct = (segment.value / total) * 100;
            if (pct === 0) return null;
            return (
              <Tooltip key={segment.label}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "transition-all duration-300",
                      i === 0 && "rounded-l-full",
                      i === segments.length - 1 && "rounded-r-full",
                    )}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: segment.color,
                      minWidth: pct > 0 ? "4px" : 0,
                    }}
                    role="meter"
                    aria-label={`${segment.label}: ${segment.value}`}
                    aria-valuenow={segment.value}
                    aria-valuemin={0}
                    aria-valuemax={total}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{segment.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {segment.value} ({pct.toFixed(1)}%)
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      {showLabels && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-mono font-medium tabular-nums">
                {segment.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
