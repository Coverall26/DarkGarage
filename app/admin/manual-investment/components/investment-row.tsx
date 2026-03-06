"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ManualInvestment,
  STATUS_COLORS,
  STATUS_LABELS,
  PROOF_STATUS_COLORS,
  PROOF_STATUS_LABELS,
  formatCurrency,
} from "./shared-types";

export function InvestmentRow({
  investment: inv,
  onViewDetails,
  onVerifyDoc,
  onVerifyProof,
  onRejectProof,
}: {
  investment: ManualInvestment;
  onViewDetails: () => void;
  onVerifyDoc: () => void;
  onVerifyProof: () => void;
  onRejectProof: () => void;
}) {
  const needsDocVerification = !inv.isVerified;
  const hasProofToReview =
    inv.proofStatus === "UPLOADED" ||
    inv.proofStatus === "PENDING" ||
    inv.proofStatus === "RECEIVED";

  return (
    <div className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Investor + Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">
              {inv.investor?.user?.name || inv.investor?.user?.email}
            </span>
            <Badge variant="outline" className="text-xs">
              {inv.fund?.name}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">
              {formatCurrency(inv.commitmentAmount)}
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">{inv.documentTitle}</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">
              {format(new Date(inv.signedDate), "MMM d, yyyy")}
            </span>
          </div>
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_COLORS[inv.status] || STATUS_COLORS.DRAFT
              }`}
            >
              {STATUS_LABELS[inv.status] || inv.status}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                PROOF_STATUS_COLORS[inv.proofStatus] || PROOF_STATUS_COLORS.NOT_UPLOADED
              }`}
            >
              {PROOF_STATUS_LABELS[inv.proofStatus] || inv.proofStatus}
            </span>
            {inv.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Doc Verified
              </span>
            )}
            {inv.proofRejectionReason && inv.proofStatus === "REJECTED" && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {inv.proofRejectionReason}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            className="min-h-[36px]"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:ml-1.5">Details</span>
          </Button>

          {needsDocVerification && (
            <Button
              variant="outline"
              size="sm"
              onClick={onVerifyDoc}
              className="min-h-[36px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
            >
              <ShieldCheck className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Verify Doc</span>
            </Button>
          )}

          {hasProofToReview && (
            <>
              <Button
                size="sm"
                onClick={onVerifyProof}
                className="min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Confirm</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRejectProof}
                className="min-h-[36px] text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                <XCircle className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Reject</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
