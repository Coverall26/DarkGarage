"use client";

import {
  CheckCircle,
  Circle,
  AlertTriangle,
  Shield,
  TrendingUp,
  Users,
  FileText,
  Scale,
} from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
  category: string;
}

interface ComplianceScore {
  complete: number;
  total: number;
  percentage: number;
}

interface OverviewTabProps {
  checklist: ChecklistItem[];
  complianceScore: ComplianceScore;
  stats: {
    totalFunds: number;
    totalInvestors: number;
    auditEventsLast30Days: number;
    signedDocuments: number;
    accreditationMethod: string;
    auditRetentionDays: number;
  };
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  organization: Shield,
  fund: Scale,
  compliance: TrendingUp,
  filing: FileText,
};

const METHOD_LABELS: Record<string, string> = {
  SELF_ACK: "Self-Acknowledgment",
  SELF_ACK_MIN_INVEST: "Self-Ack + Min Investment",
  THIRD_PARTY: "Third Party Verification",
  PERSONA_KYC: "Persona KYC",
  KYC_VERIFIED: "KYC Verified",
};

export function OverviewTab({
  checklist,
  complianceScore,
  stats,
}: OverviewTabProps) {
  const scoreColor =
    complianceScore.percentage >= 80
      ? "text-emerald-500"
      : complianceScore.percentage >= 50
        ? "text-amber-500"
        : "text-red-500";

  const progressColor =
    complianceScore.percentage >= 80
      ? "bg-emerald-500"
      : complianceScore.percentage >= 50
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Compliance Score
            </h3>
            <p className={`text-4xl font-bold font-mono tabular-nums ${scoreColor}`}>
              {complianceScore.percentage}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {complianceScore.complete} of {complianceScore.total} items complete
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">{stats.totalInvestors}</span> investors
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">{stats.totalFunds}</span> fund(s)
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">{stats.signedDocuments}</span> signed docs
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">{stats.auditEventsLast30Days}</span> audit events (30d)
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${complianceScore.percentage}%` }}
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Accreditation Method</p>
          <p className="text-sm font-medium mt-0.5">
            {METHOD_LABELS[stats.accreditationMethod] || stats.accreditationMethod}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Audit Retention</p>
          <p className="text-sm font-medium font-mono tabular-nums mt-0.5">
            {Math.round(stats.auditRetentionDays / 365)} year(s)
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Active Funds</p>
          <p className="text-sm font-medium font-mono tabular-nums mt-0.5">
            {stats.totalFunds}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Investors</p>
          <p className="text-sm font-medium font-mono tabular-nums mt-0.5">
            {stats.totalInvestors}
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Compliance Checklist</h3>
        <div className="space-y-1.5">
          {checklist.map((item) => {
            const Icon = CATEGORY_ICONS[item.category] || Shield;
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-md border px-4 py-3"
              >
                {item.complete ? (
                  <CheckCircle
                    className="h-4.5 w-4.5 text-emerald-500 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-4.5 w-4.5 text-muted-foreground/40 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-medium">{item.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.detail}
                  </p>
                </div>
                {!item.complete && (
                  <AlertTriangle
                    className="h-4 w-4 text-amber-500 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
