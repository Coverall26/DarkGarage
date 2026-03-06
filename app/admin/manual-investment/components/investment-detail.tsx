"use client";

import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";

import {
  ManualInvestment,
  STATUS_COLORS,
  STATUS_LABELS,
  PROOF_STATUS_COLORS,
  PROOF_STATUS_LABELS,
  formatCurrency,
} from "./shared-types";

export function InvestmentDetail({ investment: inv }: { investment: ManualInvestment }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Investor",
      value: inv.investor?.user?.name || inv.investor?.user?.email,
    },
    { label: "Fund", value: inv.fund?.name },
    { label: "Document", value: inv.documentTitle },
    { label: "Document Type", value: inv.documentType },
    {
      label: "Commitment",
      value: (
        <span className="font-mono tabular-nums">
          {formatCurrency(inv.commitmentAmount)}
        </span>
      ),
    },
    {
      label: "Funded",
      value: (
        <span className="font-mono tabular-nums">
          {formatCurrency(inv.fundedAmount)}
        </span>
      ),
    },
    {
      label: "Signed",
      value: format(new Date(inv.signedDate), "MMM d, yyyy"),
    },
    {
      label: "Status",
      value: (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_COLORS[inv.status] || STATUS_COLORS.DRAFT
          }`}
        >
          {STATUS_LABELS[inv.status] || inv.status}
        </span>
      ),
    },
    {
      label: "Doc Verified",
      value: inv.isVerified ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Yes
          {inv.verifiedAt && (
            <span className="text-muted-foreground ml-1">
              ({format(new Date(inv.verifiedAt), "MMM d, yyyy")})
            </span>
          )}
        </span>
      ) : (
        <span className="text-amber-600 dark:text-amber-400">Not verified</span>
      ),
    },
    {
      label: "Proof Status",
      value: (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            PROOF_STATUS_COLORS[inv.proofStatus] || PROOF_STATUS_COLORS.NOT_UPLOADED
          }`}
        >
          {PROOF_STATUS_LABELS[inv.proofStatus] || inv.proofStatus}
        </span>
      ),
    },
  ];

  if (inv.proofFileName) {
    rows.push({ label: "Proof File", value: inv.proofFileName });
  }
  if (inv.proofNotes) {
    rows.push({ label: "Proof Notes", value: inv.proofNotes });
  }
  if (inv.proofRejectionReason) {
    rows.push({
      label: "Rejection Reason",
      value: (
        <span className="text-red-600 dark:text-red-400">
          {inv.proofRejectionReason}
        </span>
      ),
    });
  }
  if (inv.transferMethod) {
    rows.push({ label: "Transfer Method", value: inv.transferMethod });
  }
  if (inv.transferRef) {
    rows.push({ label: "Transfer Ref", value: inv.transferRef });
  }
  if (inv.bankName) {
    rows.push({ label: "Bank", value: inv.bankName });
  }
  if (inv.notes) {
    rows.push({ label: "Notes", value: inv.notes });
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-between gap-4 text-sm py-1 border-b border-border/50 last:border-0">
          <span className="text-muted-foreground flex-shrink-0">{row.label}</span>
          <span className="font-medium text-right">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
