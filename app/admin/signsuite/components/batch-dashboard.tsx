"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchSummary {
  batchId: string;
  batchName: string | null;
  documentTitle: string | null;
  totalEnvelopes: number;
  createdAt: string | null;
  statuses: Record<string, number>;
  sent: number;
  signed: number;
  pending: number;
}

interface BatchEnvelope {
  id: string;
  status: string;
  recipientName: string;
  recipientEmail: string;
  recipientStatus: string | null;
  signedAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface BatchDetail {
  batchId: string;
  batchName: string | null;
  documentTitle: string | null;
  totalEnvelopes: number;
  statuses: Record<string, number>;
  sent: number;
  signed: number;
  pending: number;
  envelopes: BatchEnvelope[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchDashboard() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch batches
  // -------------------------------------------------------------------------

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/esign/bulk-send");
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // -------------------------------------------------------------------------
  // Expand / collapse batch detail
  // -------------------------------------------------------------------------

  const toggleBatchDetail = async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      setBatchDetail(null);
      return;
    }

    setExpandedBatch(batchId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/esign/bulk-send?batchId=${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setBatchDetail(data);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const completionPct = (b: BatchSummary) => {
    if (b.totalEnvelopes === 0) return 0;
    return Math.round((b.signed / b.totalEnvelopes) * 100);
  };

  // -------------------------------------------------------------------------
  // Render — loading
  // -------------------------------------------------------------------------

  if (loading && batches.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bg-muted rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
              <div className="h-6 w-20 bg-muted rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — empty state
  // -------------------------------------------------------------------------

  if (batches.length === 0) {
    return (
      <div className="text-center py-12">
        <Send className="h-10 w-10 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">No bulk sends yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Use Bulk Send to send a document to multiple recipients at once
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — batch list
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          {batches.length} batch{batches.length !== 1 ? "es" : ""}
        </p>
        <Button variant="ghost" size="sm" onClick={fetchBatches}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {batches.map((b) => {
        const pct = completionPct(b);
        const isExpanded = expandedBatch === b.batchId;

        return (
          <div key={b.batchId} className="border border-border rounded-lg overflow-hidden">
            {/* Summary row */}
            <button
              onClick={() => toggleBatchDetail(b.batchId)}
              className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {b.batchName || b.documentTitle || "Untitled Batch"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(b.createdAt)} · {b.totalEnvelopes} recipient{b.totalEnvelopes !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-blue-600">
                    <Send className="h-3 w-3" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{b.sent}</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{b.signed}</span>
                  </span>
                  {b.pending > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span className="font-mono tabular-nums">{b.pending}</span>
                    </span>
                  )}
                </div>

                <Badge
                  variant="outline"
                  className={`font-mono tabular-nums text-xs ${
                    pct === 100
                      ? "border-emerald-500/40 text-emerald-600"
                      : pct > 0
                        ? "border-blue-500/40 text-blue-600"
                        : ""
                  }`}
                >
                  {pct}%
                </Badge>

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Progress bar */}
            <div className="h-1 bg-muted">
              <div
                className="h-1 bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-border">
                {detailLoading ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                  </div>
                ) : batchDetail ? (
                  <div className="divide-y divide-border max-h-64 overflow-y-auto">
                    {batchDetail.envelopes.map((env) => (
                      <div
                        key={env.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{env.recipientName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {env.recipientEmail}
                          </p>
                        </div>
                        <EnvelopeStatusBadge status={env.status} />
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {env.signedAt
                            ? formatDate(env.signedAt)
                            : env.sentAt
                              ? formatDate(env.sentAt)
                              : formatDate(env.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function EnvelopeStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "border-gray-400/40 text-gray-500" },
    PREPARING: { label: "Preparing", className: "border-blue-400/40 text-blue-500" },
    SENT: { label: "Sent", className: "border-blue-500/40 text-blue-600" },
    VIEWED: { label: "Viewed", className: "border-indigo-500/40 text-indigo-500" },
    PARTIALLY_SIGNED: { label: "Partial", className: "border-amber-500/40 text-amber-500" },
    COMPLETED: { label: "Signed", className: "border-emerald-500/40 text-emerald-600" },
    DECLINED: { label: "Declined", className: "border-red-500/40 text-red-500" },
    VOIDED: { label: "Voided", className: "border-gray-400/40 text-gray-400" },
    EXPIRED: { label: "Expired", className: "border-amber-600/40 text-amber-600" },
  };

  const c = config[status] ?? { label: status, className: "" };

  return (
    <Badge variant="outline" className={`text-xs ${c.className}`}>
      {c.label}
    </Badge>
  );
}
