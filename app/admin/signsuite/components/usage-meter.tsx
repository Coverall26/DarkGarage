"use client";

import Link from "next/link";
import { FileSignature } from "lucide-react";
import { useTier } from "@/lib/hooks/use-tier";

/**
 * SignSuite usage meter — shows e-signature allocation per tier.
 * FREE: 10/mo, CRM_PRO: 25/mo, FUNDROOM: unlimited.
 * At 80%+: amber warning. At 100%: red + upgrade CTA.
 */
export function SignSuiteUsageMeter() {
  const { tier, usage, isLoading } = useTier();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30 animate-pulse">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-32 bg-muted rounded" />
          <div className="h-1.5 w-full bg-muted rounded-full" />
        </div>
      </div>
    );
  }

  const used = usage?.esigUsedThisMonth ?? 0;
  const limit = usage?.esigLimit ?? null;
  const isUnlimited = limit === null || tier === "FUNDROOM";

  if (isUnlimited) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30">
        <div className="flex-shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-2">
          <FileSignature className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            <span className="font-mono tabular-nums">{used}</span> e-signatures this month
          </p>
          <p className="text-xs text-muted-foreground">Unlimited plan</p>
        </div>
      </div>
    );
  }

  const pct = Math.min((used / limit) * 100, 100);
  const isWarning = pct >= 80 && pct < 100;
  const isAtLimit = pct >= 100;

  const barColor = isAtLimit
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-emerald-600";

  const iconBg = isAtLimit
    ? "bg-red-100 dark:bg-red-900/40"
    : isWarning
      ? "bg-amber-100 dark:bg-amber-900/40"
      : "bg-emerald-100 dark:bg-emerald-900/40";

  const iconColor = isAtLimit
    ? "text-red-600 dark:text-red-400"
    : isWarning
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30">
      <div className={`flex-shrink-0 rounded-full ${iconBg} p-2`}>
        <FileSignature className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-foreground">
            <span className="font-mono tabular-nums">{used}</span>
            {" of "}
            <span className="font-mono tabular-nums">{limit}</span>
            {" e-signatures"}
          </p>
          {isAtLimit && (
            <Link
              href="/admin/settings?tab=billing"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex-shrink-0 ml-2"
            >
              Upgrade
            </Link>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isAtLimit && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            Monthly limit reached. Upgrade for more sends.
          </p>
        )}
      </div>
    </div>
  );
}
