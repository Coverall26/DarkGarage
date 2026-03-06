"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  accentColor?: string;
  className?: string;
  /** Animate the number counting up */
  animate?: boolean;
}

function useCountUp(target: number, enabled: boolean, duration = 800) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || isNaN(target)) {
      setCurrent(target);
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCurrent(Math.round(target * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, enabled, duration]);
  return current;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  accentColor = "border-blue-500",
  className,
  animate = false,
}: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : NaN;
  const displayValue = useCountUp(numericValue, animate && !isNaN(numericValue));

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-all duration-150",
        "hover:shadow-md",
        `border-l-4 ${accentColor}`,
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className="rounded-md bg-muted p-2" aria-hidden="true">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
          {!isNaN(numericValue) && animate ? displayValue : value}
        </p>
        {trend && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" aria-hidden="true" />
            )}
            <span
              className={cn(
                "font-medium font-mono",
                trend.value >= 0 ? "text-green-500" : "text-red-500",
              )}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </span>
            {trend.label && (
              <span className="text-muted-foreground">{trend.label}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
