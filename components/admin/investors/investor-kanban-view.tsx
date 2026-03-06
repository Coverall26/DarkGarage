"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  XCircle,
  User,
} from "lucide-react";
import {
  type InvestorSummary,
  STAGE_CONFIG,
  KANBAN_STAGES,
  ENTITY_ICONS,
  formatCurrency,
  getEngagementScore,
  getEngagementBadge,
  formatRelativeTime,
} from "./types";

interface InvestorKanbanViewProps {
  investors: InvestorSummary[];
}

export function InvestorKanbanView({ investors }: InvestorKanbanViewProps) {
  const stageGroups = useMemo(() => {
    const groups: Record<string, InvestorSummary[]> = {};
    for (const stage of KANBAN_STAGES) {
      groups[stage] = [];
    }
    for (const inv of investors) {
      if (groups[inv.stage]) {
        groups[inv.stage].push(inv);
      } else if (inv.stage !== "REJECTED") {
        groups.APPLIED.push(inv);
      }
    }
    return groups;
  }, [investors]);

  const rejectedCount = investors.filter((inv) => inv.stage === "REJECTED").length;

  return (
    <div className="space-y-3">
      {rejectedCount > 0 && (
        <div className="text-xs text-muted-foreground px-1">
          <span className="inline-flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
            {rejectedCount} rejected investor{rejectedCount !== 1 ? "s" : ""} (not shown in pipeline)
          </span>
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_STAGES.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const stageInvestors = stageGroups[stage];
          const totalCommitment = stageInvestors.reduce((s, i) => s + i.commitment, 0);

          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-[260px] rounded-lg border ${config.borderColor} bg-card`}
            >
              <div className={`px-3 py-2 border-b ${config.bgColor} rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${config.color}`}>
                    {config.label}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {stageInvestors.length}
                  </Badge>
                </div>
                {totalCommitment > 0 && (
                  <p className="text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
                    {formatCurrency(totalCommitment)}
                  </p>
                )}
              </div>

              <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                {stageInvestors.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No investors
                  </div>
                ) : (
                  stageInvestors.map((inv) => (
                    <KanbanCard key={inv.id} investor={inv} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ investor }: { investor: InvestorSummary }) {
  const score = getEngagementScore(investor);
  const engagement = getEngagementBadge(score);
  const EntityIcon = (investor.entityType && ENTITY_ICONS[investor.entityType]) || User;
  const lastActivity = investor.lastActivityAt || investor.createdAt;

  return (
    <Link
      href={`/admin/investors/${investor.id}`}
      className="block p-3 rounded-md border bg-background hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{investor.entityName || investor.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <EntityIcon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-muted-foreground truncate">{investor.email}</span>
          </div>
        </div>
        {engagement.tier !== "none" && engagement.icon && (
          <engagement.icon
            className={`h-4 w-4 flex-shrink-0 ${
              engagement.tier === "hot"
                ? "text-red-500"
                : engagement.tier === "warm"
                  ? "text-amber-500"
                  : "text-blue-400"
            }`}
            aria-label={`Engagement: ${engagement.label}`}
          />
        )}
      </div>
      {investor.commitment > 0 && (
        <p className="text-sm font-mono tabular-nums font-semibold mt-2">
          {formatCurrency(investor.commitment)}
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        {formatRelativeTime(lastActivity)}
      </p>
    </Link>
  );
}
