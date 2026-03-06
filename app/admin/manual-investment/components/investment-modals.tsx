"use client";

import React from "react";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ManualInvestment, formatCurrency } from "./shared-types";
import { InvestmentDetail } from "./investment-detail";

export function VerifyDocModal({
  investment,
  actionLoading,
  onClose,
  onConfirm,
}: {
  investment: ManualInvestment | null;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (inv: ManualInvestment) => void;
}) {
  return (
    <Dialog open={!!investment} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Verify Document
          </DialogTitle>
          <DialogDescription>
            Confirm that you have reviewed and verified the document for{" "}
            <strong>
              {investment?.investor?.user?.name ||
                investment?.investor?.user?.email}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Document</span>
            <span className="font-medium">{investment?.documentTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fund</span>
            <span className="font-medium">{investment?.fund?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium font-mono tabular-nums">
              {formatCurrency(investment?.commitmentAmount)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => investment && onConfirm(investment)}
            disabled={actionLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Verify Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VerifyProofModal({
  investment,
  actionLoading,
  onClose,
  onConfirm,
}: {
  investment: ManualInvestment | null;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (inv: ManualInvestment) => void;
}) {
  return (
    <Dialog open={!!investment} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Verify Wire Proof
          </DialogTitle>
          <DialogDescription>
            Confirm that the wire proof from{" "}
            <strong>
              {investment?.investor?.user?.name ||
                investment?.investor?.user?.email}
            </strong>{" "}
            has been verified. This will mark the transfer as completed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Proof File</span>
            <span className="font-medium">{investment?.proofFileName || "\u2014"}</span>
          </div>
          {investment?.proofNotes && (
            <div>
              <span className="text-muted-foreground">Investor Notes</span>
              <p className="mt-1 text-sm bg-muted/50 rounded p-2">
                {investment.proofNotes}
              </p>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Commitment</span>
            <span className="font-medium font-mono tabular-nums">
              {formatCurrency(investment?.commitmentAmount)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => investment && onConfirm(investment)}
            disabled={actionLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Verify Proof
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectProofModal({
  investment,
  rejectReason,
  onRejectReasonChange,
  actionLoading,
  onClose,
  onConfirm,
}: {
  investment: ManualInvestment | null;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (inv: ManualInvestment) => void;
}) {
  return (
    <Dialog open={!!investment} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            Reject Wire Proof
          </DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting the wire proof from{" "}
            <strong>
              {investment?.investor?.user?.name ||
                investment?.investor?.user?.email}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Proof File</span>
            <span className="font-medium">{investment?.proofFileName || "\u2014"}</span>
          </div>
          <div>
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Rejection Reason *
            </label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onRejectReasonChange(e.target.value)}
              placeholder="e.g., Amount does not match commitment, proof is unreadable..."
              rows={3}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => investment && onConfirm(investment)}
            disabled={actionLoading || !rejectReason.trim()}
          >
            {actionLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Reject Proof
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DetailModal({
  investment,
  onClose,
}: {
  investment: ManualInvestment | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!investment} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Investment Details</DialogTitle>
          <DialogDescription>
            {investment?.documentTitle}
          </DialogDescription>
        </DialogHeader>
        {investment && <InvestmentDetail investment={investment} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
