"use client";

import {
  CheckCircle,
  AlertCircle,
  XCircle,
  ClipboardCheck,
} from "lucide-react";

interface RepresentationsTracking {
  total: number;
  allConfirmed: number;
  partial: number;
  none: number;
}

interface RepresentationsTabProps {
  tracking: RepresentationsTracking;
}

const REPRESENTATION_ITEMS = [
  {
    key: "accreditedCert",
    label: "Accredited Investor Certification",
    description: "Confirms accredited investor status under SEC Rule 501(a).",
    secRef: "Rule 501(a)",
  },
  {
    key: "investingAsPrincipal",
    label: "Investing as Principal",
    description: "Investing on own behalf, not as agent or nominee.",
    secRef: "General",
  },
  {
    key: "readOfferingDocs",
    label: "Offering Documents Reviewed",
    description: "Read and understood the PPM, subscription agreement, and related materials.",
    secRef: "Reg D",
  },
  {
    key: "riskAwareness",
    label: "Risk Awareness",
    description: "Acknowledges the investment carries risk of total loss of capital.",
    secRef: "Risk Disclosure",
  },
  {
    key: "restrictedSecurities",
    label: "Restricted Securities",
    description: "Understands securities are restricted and not freely transferable.",
    secRef: "Rule 144",
  },
  {
    key: "amlOfac",
    label: "AML / OFAC Compliance",
    description: "Confirms compliance with anti-money laundering and OFAC sanctions regulations.",
    secRef: "BSA/AML",
  },
  {
    key: "taxConsent",
    label: "Tax ID Consent",
    description: "Consents to providing Tax ID for K-1 preparation and IRS reporting.",
    secRef: "IRS",
  },
  {
    key: "independentAdvice",
    label: "Independent Advice",
    description: "Acknowledges independent legal and tax advice was available.",
    secRef: "General",
  },
];

export function RepresentationsTab({ tracking }: RepresentationsTabProps) {
  const completionRate =
    tracking.total > 0
      ? Math.round((tracking.allConfirmed / tracking.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Investors</p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {tracking.total}
          </p>
        </div>
        <div className="rounded-lg border p-3 border-l-4 border-l-emerald-500">
          <p className="text-xs text-muted-foreground">All Confirmed</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
            {tracking.allConfirmed}
          </p>
        </div>
        <div className="rounded-lg border p-3 border-l-4 border-l-amber-500">
          <p className="text-xs text-muted-foreground">Partial</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-600">
            {tracking.partial}
          </p>
        </div>
        <div className="rounded-lg border p-3 border-l-4 border-l-red-500">
          <p className="text-xs text-muted-foreground">None</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-600">
            {tracking.none}
          </p>
        </div>
      </div>

      {/* Completion Rate Bar */}
      {tracking.total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Representation Completion Rate
            </h3>
            <span className="text-sm font-mono tabular-nums font-bold">
              {completionRate}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            {tracking.allConfirmed > 0 && (
              <div
                className="bg-emerald-500 transition-all"
                style={{
                  width: `${(tracking.allConfirmed / tracking.total) * 100}%`,
                }}
                title={`All confirmed: ${tracking.allConfirmed}`}
              />
            )}
            {tracking.partial > 0 && (
              <div
                className="bg-amber-500 transition-all"
                style={{
                  width: `${(tracking.partial / tracking.total) * 100}%`,
                }}
                title={`Partial: ${tracking.partial}`}
              />
            )}
            {tracking.none > 0 && (
              <div
                className="bg-red-400 transition-all"
                style={{
                  width: `${(tracking.none / tracking.total) * 100}%`,
                }}
                title={`None: ${tracking.none}`}
              />
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              All confirmed ({tracking.allConfirmed})
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              Partial ({tracking.partial})
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              None ({tracking.none})
            </div>
          </div>
        </div>
      )}

      {/* Partial / None Warning */}
      {(tracking.partial > 0 || tracking.none > 0) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {tracking.partial + tracking.none} investor(s) have incomplete
              representations
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              All 8 SEC representations should be confirmed before closing.
              Incomplete representations may affect your compliance posture.
            </p>
          </div>
        </div>
      )}

      {/* Required Representations List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          Required SEC Representations ({REPRESENTATION_ITEMS.length})
        </h3>
        <div className="space-y-1.5">
          {REPRESENTATION_ITEMS.map((rep, i) => (
            <div
              key={rep.key}
              className="flex items-start gap-3 rounded-md border px-4 py-3"
            >
              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-mono font-bold text-muted-foreground shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{rep.label}</p>
                  <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground font-mono">
                    {rep.secRef}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rep.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {tracking.total === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No investor representation data available. Representations are
            collected during investor onboarding.
          </p>
        </div>
      )}
    </div>
  );
}
