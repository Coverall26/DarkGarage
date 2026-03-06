"use client";

import Link from "next/link";
import { Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PipelineIQUpgradeCardProps {
  contactCount: number;
  contactLimit: number;
}

/**
 * Inline upgrade card shown when free-tier user reaches contact cap.
 * Two upgrade paths: PipelineIQ add-on ($15/mo) or CRM Pro ($29/mo).
 */
export function PipelineIQUpgradeCard({
  contactCount,
  contactLimit,
}: PipelineIQUpgradeCardProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/50 p-2">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              You&apos;ve reached your contact limit
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-mono tabular-nums">{contactCount}</span> of{" "}
              <span className="font-mono tabular-nums">{contactLimit}</span>{" "}
              contacts used. Upgrade to add unlimited contacts, Kanban
              pipeline, email outreach, and more.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/admin/settings?tab=billing">
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px] border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 w-full sm:w-auto"
            >
              <Zap className="h-4 w-4 mr-1" />
              Unlock PipelineIQ — $15/mo
            </Button>
          </Link>
          <Link href="/admin/settings?tab=billing">
            <Button
              size="sm"
              className="min-h-[44px] bg-[#F59E0B] hover:bg-[#D97706] text-white w-full sm:w-auto"
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Upgrade to Pro — $29/mo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
