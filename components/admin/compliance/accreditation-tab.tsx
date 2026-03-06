"use client";

import {
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  XCircle,
} from "lucide-react";

interface AccreditationBreakdown {
  total: number;
  selfCertified: number;
  thirdPartyVerified: number;
  kycVerified: number;
  pending: number;
  expired: number;
  expiringSoon: number;
}

interface AccreditationTabProps {
  breakdown: AccreditationBreakdown;
}

const SEGMENTS = [
  {
    key: "selfCertified" as const,
    label: "Self-Certified",
    color: "bg-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
    icon: CheckCircle,
    description: "Investors who self-certified their accredited status under SEC Rule 501(a).",
  },
  {
    key: "thirdPartyVerified" as const,
    label: "Third-Party Verified",
    color: "bg-emerald-500",
    textColor: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle,
    description: "Verified by a licensed CPA, attorney, broker-dealer, or investment advisor.",
  },
  {
    key: "kycVerified" as const,
    label: "KYC Verified",
    color: "bg-purple-500",
    textColor: "text-purple-600 dark:text-purple-400",
    icon: CheckCircle,
    description: "Identity and accreditation confirmed via KYC/AML provider (Persona).",
  },
  {
    key: "pending" as const,
    label: "Pending",
    color: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
    icon: Clock,
    description: "Awaiting accreditation verification or self-certification.",
  },
  {
    key: "expired" as const,
    label: "Expired",
    color: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
    icon: XCircle,
    description: "Accreditation has expired and requires renewal.",
  },
];

export function AccreditationTab({ breakdown }: AccreditationTabProps) {
  const verified =
    breakdown.selfCertified +
    breakdown.thirdPartyVerified +
    breakdown.kycVerified;
  const verificationRate =
    breakdown.total > 0 ? Math.round((verified / breakdown.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Investors</p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {breakdown.total}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Verified</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
            {verified}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Verification Rate</p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {verificationRate}%
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Expiring Soon</p>
          <p className={`text-2xl font-bold font-mono tabular-nums ${breakdown.expiringSoon > 0 ? "text-amber-600" : ""}`}>
            {breakdown.expiringSoon}
          </p>
        </div>
      </div>

      {/* Expiring Warning */}
      {breakdown.expiringSoon > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {breakdown.expiringSoon} accreditation(s) expiring within 90 days
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Contact these investors to renew their accreditation before expiry.
            </p>
          </div>
        </div>
      )}

      {/* Stacked Bar Chart */}
      {breakdown.total > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Verification Distribution</h3>
          <div className="h-6 rounded-full bg-muted overflow-hidden flex">
            {SEGMENTS.map((seg) => {
              const count = breakdown[seg.key];
              if (count === 0) return null;
              const pct = (count / breakdown.total) * 100;
              return (
                <div
                  key={seg.key}
                  className={`${seg.color} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                  title={`${seg.label}: ${count} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-1">
            {SEGMENTS.map((seg) => {
              const count = breakdown[seg.key];
              if (count === 0) return null;
              return (
                <div key={seg.key} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
                  <span className="text-xs text-muted-foreground">
                    {seg.label} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Breakdown */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Verification Methods</h3>
        <div className="space-y-1.5">
          {SEGMENTS.map((seg) => {
            const count = breakdown[seg.key];
            const Icon = seg.icon;
            const pct =
              breakdown.total > 0
                ? Math.round((count / breakdown.total) * 100)
                : 0;
            return (
              <div
                key={seg.key}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${seg.textColor}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium">{seg.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {seg.description}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {count}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    {pct}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {breakdown.total === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No investors yet. Accreditation data will appear when investors
            onboard.
          </p>
        </div>
      )}
    </div>
  );
}
