"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Send,
  Bell,
  Ban,
  Trash2,
  User,
  Clock,
  FileText,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, RecipientStatusBadge } from "./status-badges";
import type { Envelope } from "./signsuite-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnvelopeDetailProps {
  envelopeId: string;
  onBack: () => void;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EnvelopeDetail({
  envelopeId,
  onBack,
  onRefresh,
}: EnvelopeDetailProps) {
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/esign/envelopes/${envelopeId}`);
      if (res.ok) {
        const data = await res.json();
        setEnvelope(data);
      } else {
        setError("Failed to load envelope.");
      }
    } catch {
      setError("Failed to load envelope.");
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleAction = async (
    action: "send" | "remind" | "void" | "delete",
  ) => {
    if (!envelope) return;
    setActionLoading(action);
    setError(null);

    try {
      let url = `/api/esign/envelopes/${envelope.id}`;
      let method = "POST";

      switch (action) {
        case "send":
          url += "/send";
          break;
        case "remind":
          url += "/remind";
          break;
        case "void":
          url += "/void";
          break;
        case "delete":
          method = "DELETE";
          break;
      }

      const res = await fetch(url, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to ${action}.`);
      } else {
        if (action === "delete") {
          onRefresh();
          onBack();
        } else {
          fetchDetail();
          onRefresh();
        }
      }
    } catch {
      setError(`Failed to ${action}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadAuditTrail = async () => {
    if (!envelope) return;
    setActionLoading("audit-trail");
    setError(null);

    try {
      const res = await fetch(
        `/api/esign/envelopes/${envelope.id}/audit-trail`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to download audit trail.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
        `audit-trail-${envelope.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download audit trail.");
    } finally {
      setActionLoading(null);
    }
  };

  // -----------------------------------------------------------------------
  // Loading / Error
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded" />
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!envelope) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">
          {error || "Envelope not found."}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  const isDraft = envelope.status === "DRAFT" || envelope.status === "PREPARING";
  const isActive = ["SENT", "VIEWED", "PARTIALLY_SIGNED"].includes(
    envelope.status,
  );
  const isDeclined = envelope.status === "DECLINED";
  const isVoided = envelope.status === "VOIDED";
  const signers = envelope.recipients.filter((r) => r.role === "SIGNER");
  const ccRecipients = envelope.recipients.filter((r) => r.role !== "SIGNER");
  const signedCount = signers.filter((r) => r.signedAt).length;

  // Determine current signing group for SEQUENTIAL/MIXED mode
  const currentSigningOrder = (() => {
    if (envelope.signingMode === "PARALLEL") return null;
    if (!isActive) return null;
    const pendingSigners = signers.filter(
      (s) => !s.signedAt && !s.declinedAt,
    );
    if (pendingSigners.length === 0) return null;
    return Math.min(...pendingSigners.map((s) => s.order));
  })();

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {envelope.title}
            </h2>
            <StatusBadge status={envelope.status} />
          </div>
          {envelope.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {envelope.description}
            </p>
          )}
        </div>
      </div>

      {/* Declined Banner */}
      {isDeclined && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              This envelope was declined
              {envelope.declinedAt &&
                ` on ${format(new Date(envelope.declinedAt), "MMM d, yyyy h:mm a")}`}
            </p>
          </div>
          {envelope.voidedReason && (
            <p className="mt-1 ml-6 text-xs text-red-500 dark:text-red-400">
              Reason: {envelope.voidedReason}
            </p>
          )}
        </div>
      )}

      {/* Voided Banner */}
      {isVoided && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              This envelope was voided
              {envelope.voidedAt &&
                ` on ${format(new Date(envelope.voidedAt), "MMM d, yyyy h:mm a")}`}
            </p>
          </div>
          {envelope.voidedReason && (
            <p className="mt-1 ml-6 text-xs text-amber-500 dark:text-amber-400">
              Reason: {envelope.voidedReason}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center gap-2">
        {isDraft && (
          <>
            <Button
              size="sm"
              onClick={() => handleAction("send")}
              disabled={actionLoading !== null}
            >
              <Send className="h-4 w-4 mr-1" />
              {actionLoading === "send" ? "Sending..." : "Send Now"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600"
              onClick={() => handleAction("delete")}
              disabled={actionLoading !== null}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </>
        )}
        {isActive && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction("remind")}
              disabled={actionLoading !== null}
            >
              <Bell className="h-4 w-4 mr-1" />
              {actionLoading === "remind" ? "Sending..." : "Send Reminder"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600"
              onClick={() => handleAction("void")}
              disabled={actionLoading !== null}
            >
              <Ban className="h-4 w-4 mr-1" />
              Void
            </Button>
          </>
        )}
        {!isDraft && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAuditTrail}
            disabled={actionLoading !== null}
          >
            <Download className="h-4 w-4 mr-1" />
            {actionLoading === "audit-trail"
              ? "Generating..."
              : "Download Audit Trail"}
          </Button>
        )}
      </div>

      {/* Signing Progress */}
      {signers.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">
              Signing Progress
            </p>
            <span className="text-sm font-mono tabular-nums text-muted-foreground">
              {signedCount}/{signers.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${
                  signers.length > 0
                    ? (signedCount / signers.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Signers */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            Signers ({signers.length})
          </p>
        </div>
        <div className="divide-y divide-border">
          {signers.map((signer, idx) => {
            const isCurrentSigner =
              currentSigningOrder !== null && signer.order === currentSigningOrder && !signer.signedAt && !signer.declinedAt;
            return (
              <div
                key={idx}
                className={`flex items-center gap-3 px-4 py-3 ${
                  isCurrentSigner
                    ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-blue-500"
                    : ""
                }`}
              >
                <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                  {signer.order}
                </span>
                <div className={`flex-shrink-0 rounded-full p-1.5 ${
                  isCurrentSigner ? "bg-blue-100 dark:bg-blue-900" : "bg-muted"
                }`}>
                  <User className={`h-3.5 w-3.5 ${
                    isCurrentSigner ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {signer.name || signer.email}
                    </p>
                    {isCurrentSigner && (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">
                        UP NEXT
                      </span>
                    )}
                  </div>
                  {signer.name && (
                    <p className="text-xs text-muted-foreground">{signer.email}</p>
                  )}
                  {signer.declinedAt && signer.declinedReason && (
                    <p className="text-xs text-red-500 mt-0.5">
                      Declined: {signer.declinedReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
                  {signer.viewedAt && !signer.declinedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Viewed{" "}
                      {formatDistanceToNow(new Date(signer.viewedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                  {signer.signedAt && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {format(new Date(signer.signedAt), "MMM d, h:mm a")}
                    </span>
                  )}
                  {signer.declinedAt && (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle className="h-3 w-3" />
                      {format(new Date(signer.declinedAt), "MMM d, h:mm a")}
                    </span>
                  )}
                  <RecipientStatusBadge status={signer.status ?? "PENDING"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CC Recipients */}
      {ccRecipients.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
            <p className="text-sm font-medium text-foreground">
              CC / Certified Delivery ({ccRecipients.length})
            </p>
          </div>
          <div className="divide-y divide-border">
            {ccRecipients.map((r, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-foreground">{r.name || r.email}</p>
                {r.name && (
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
        <p className="font-medium text-foreground">Details</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>Created</span>
          <span>
            {format(new Date(envelope.createdAt), "MMM d, yyyy h:mm a")}
          </span>
          {envelope.createdBy && (
            <>
              <span>Created by</span>
              <span>{envelope.createdBy.name || envelope.createdBy.email}</span>
            </>
          )}
          {envelope.sourceFileName && (
            <>
              <span>Document</span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {envelope.sourceFileName}
              </span>
            </>
          )}
          <span>Signing mode</span>
          <span>
            {envelope.signingMode === "SEQUENTIAL"
              ? "In Order"
              : envelope.signingMode === "PARALLEL"
                ? "Any Order"
                : "Mixed"}
          </span>
          {envelope.emailSubject && (
            <>
              <span>Email subject</span>
              <span>{envelope.emailSubject}</span>
            </>
          )}
          {envelope.expiresAt && (
            <>
              <span>Expires</span>
              <span>
                {format(new Date(envelope.expiresAt), "MMM d, yyyy")}
              </span>
            </>
          )}
          <span>Reminders</span>
          <span>
            {envelope.reminderEnabled
              ? `Every ${envelope.reminderDays} day(s), max ${envelope.maxReminders}`
              : "Disabled"}
          </span>
          {envelope.declinedAt && (
            <>
              <span>Declined</span>
              <span className="text-red-500">
                {format(new Date(envelope.declinedAt), "MMM d, yyyy h:mm a")}
              </span>
            </>
          )}
          {envelope.voidedAt && (
            <>
              <span>Voided</span>
              <span className="text-amber-500">
                {format(new Date(envelope.voidedAt), "MMM d, yyyy h:mm a")}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
