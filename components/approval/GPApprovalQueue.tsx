"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircleIcon,
  Loader2Icon,
  SearchIcon,
  FileTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MessageSquareIcon,
  EyeIcon,
  Edit3Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { ApprovalItem, GPApprovalQueueProps, TabValue } from "./approval-types";
import { TABS, SUBMISSION_TYPE_LABELS, SUBMISSION_TYPE_ICONS } from "./approval-types";
import { ApproveWithChangesModal } from "./approve-with-changes-modal";
import { RequestChangesModal } from "./request-changes-modal";
import { ChangeRequestComparison } from "./change-request-comparison";

export default function GPApprovalQueue({
  teamId,
  fundId,
  onApprovalCountChange,
}: GPApprovalQueueProps) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("pending");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal state
  const [approveWithChangesItem, setApproveWithChangesItem] = useState<ApprovalItem | null>(null);
  const [requestChangesItem, setRequestChangesItem] = useState<ApprovalItem | null>(null);
  const [confirmApproveItem, setConfirmApproveItem] = useState<ApprovalItem | null>(null);
  const [rejectItem, setRejectItem] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchApprovals = useCallback(async () => {
    try {
      const params = new URLSearchParams({ teamId });
      if (fundId) params.set("fundId", fundId);
      const res = await fetch(`/api/approvals/pending?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.items || []);
      onApprovalCountChange?.(
        (data.items || []).filter((i: ApprovalItem) => i.status === "PENDING").length,
      );
    } catch {
      logger.error("Failed to fetch approvals", { module: "GPApprovalQueue" });
    } finally {
      setLoading(false);
    }
  }, [teamId, fundId, onApprovalCountChange]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (tab !== "all") {
      result = result.filter(
        (i) => i.status.toLowerCase() === tab,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.investorName.toLowerCase().includes(q) ||
          i.investorEmail.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, tab, search]);

  const pendingCount = items.filter((i) => i.status === "PENDING").length;

  // ----- Action handlers -----

  const handleApprove = async (item: ApprovalItem) => {
    setActionLoading(item.id);
    try {
      const res = await fetch(
        `/api/admin/investors/${item.investorId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve",
            fundId: item.fundId,
            teamId: item.teamId,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to approve");
      }
      toast.success(`${item.investorName} approved`);
      setConfirmApproveItem(null);
      await fetchApprovals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveWithChanges = async (
    changes: Array<{ field: string; originalValue: string; newValue: string }>,
    notes: string,
  ) => {
    if (!approveWithChangesItem) return;
    setActionLoading(approveWithChangesItem.id);
    try {
      const res = await fetch(
        `/api/admin/investors/${approveWithChangesItem.investorId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "approve-with-changes",
            fundId: approveWithChangesItem.fundId,
            teamId: approveWithChangesItem.teamId,
            changes,
            notes,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to approve");
      }
      toast.success(`${approveWithChangesItem.investorName} approved with changes`);
      setApproveWithChangesItem(null);
      await fetchApprovals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async (
    requestedChanges: Array<{
      changeType: string;
      fieldName: string;
      reason: string;
      currentValue?: string;
    }>,
    notes: string,
  ) => {
    if (!requestChangesItem) return;
    setActionLoading(requestChangesItem.id);
    try {
      const res = await fetch(
        `/api/admin/investors/${requestChangesItem.investorId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request-changes",
            fundId: requestChangesItem.fundId,
            teamId: requestChangesItem.teamId,
            requestedChanges,
            notes,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to request changes");
      }
      toast.success(`Changes requested from ${requestChangesItem.investorName}`);
      setRequestChangesItem(null);
      await fetchApprovals();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to request changes",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectItem) return;
    setActionLoading(rejectItem.id);
    try {
      const res = await fetch(
        `/api/admin/investors/${rejectItem.investorId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            fundId: rejectItem.fundId,
            teamId: rejectItem.teamId,
            rejectionReason: rejectReason || "Did not meet fund requirements",
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to reject");
      }
      toast.success(`${rejectItem.investorName} rejected`);
      setRejectItem(null);
      setRejectReason("");
      await fetchApprovals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      case "CHANGES_REQUESTED":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Changes Requested</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2Icon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Approvals</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-red-500 text-white text-xs font-bold">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="relative w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search investors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => {
          const count = items.filter(
            (i) => t.value === "all" || i.status.toLowerCase() === t.value,
          ).length;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px]",
                tab === t.value
                  ? "border-[#0066FF] text-[#0066FF]"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-600 mb-1">
            {tab === "pending" ? "No Pending Approvals" : "No Items Found"}
          </h3>
          <p className="text-sm text-gray-400">
            {tab === "pending"
              ? "All investor submissions have been reviewed."
              : "No items match your current filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const Icon = SUBMISSION_TYPE_ICONS[item.submissionType] || FileTextIcon;
            const isExpanded = expandedId === item.id;
            const isPending = item.status === "PENDING";
            const isChangeRequest = item.submissionType === "CHANGE_REQUEST";

            return (
              <Card
                key={item.id}
                className={cn(
                  "transition-shadow",
                  isPending && "border-amber-200 shadow-sm",
                )}
              >
                <CardContent className="p-4">
                  {/* Row */}
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-gray-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{item.investorName}</span>
                        {getStatusBadge(item.status)}
                        {item.accreditationMethod === "DOCUMENT_UPLOAD" && item.accreditationDocumentIds && item.accreditationDocumentIds.length > 0 && (
                          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50">
                            <FileTextIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                            {item.accreditationDocumentIds.length} Doc{item.accreditationDocumentIds.length > 1 ? "s" : ""} to Review
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span>{SUBMISSION_TYPE_LABELS[item.submissionType]}</span>
                        <span>|</span>
                        <span>{item.fundName}</span>
                        <span>|</span>
                        <span>
                          {new Date(item.submittedAt).toLocaleDateString()}
                        </span>
                        {item.commitmentAmount && (
                          <>
                            <span>|</span>
                            <span className="font-medium text-gray-700">
                              ${item.commitmentAmount.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPending && !isChangeRequest && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setConfirmApproveItem(item)}
                            disabled={actionLoading === item.id}
                            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
                          >
                            {actionLoading === item.id ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 sm:mr-1" />
                            )}
                            <span className="hidden sm:inline">Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : item.id)
                            }
                            className="min-h-[44px]"
                          >
                            {isExpanded ? (
                              <ChevronUpIcon className="h-4 w-4" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                      {isPending && isChangeRequest && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : item.id)
                          }
                          className="min-h-[44px]"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      )}
                      {!isPending && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : item.id)
                          }
                          className="min-h-[44px] text-gray-500"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                      {/* Investor details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="font-medium">{item.investorEmail}</p>
                        </div>
                        {item.entityType && (
                          <div>
                            <p className="text-xs text-gray-500">Entity</p>
                            <p className="font-medium">{item.entityType}</p>
                          </div>
                        )}
                        {item.accreditationStatus && (
                          <div>
                            <p className="text-xs text-gray-500">Accreditation</p>
                            <p className="font-medium">{item.accreditationStatus}</p>
                            {item.accreditationMethod && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Method: {item.accreditationMethod === "DOCUMENT_UPLOAD"
                                  ? "Document Upload"
                                  : item.accreditationMethod === "SELF_CERTIFICATION"
                                    ? "Self-Certification"
                                    : item.accreditationMethod}
                              </p>
                            )}
                          </div>
                        )}
                        {item.documentType && (
                          <div>
                            <p className="text-xs text-gray-500">Doc Type</p>
                            <p className="font-medium">{item.documentType}</p>
                          </div>
                        )}
                      </div>

                      {/* 506(c) Accreditation documents */}
                      {item.accreditationDocumentIds && item.accreditationDocumentIds.length > 0 && (
                        <div className="rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FileTextIcon className="h-4 w-4 text-amber-600" aria-hidden="true" />
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              506(c) Verification Documents ({item.accreditationDocumentIds.length})
                            </p>
                          </div>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                            Investor uploaded accreditation verification documents. Review these before approving.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.accreditationDocumentIds.map((docId: string, idx: number) => (
                              <a
                                key={docId}
                                href={`/admin/documents?docId=${docId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                                aria-label={`Review document ${idx + 1} in new tab`}
                              >
                                <EyeIcon className="h-3 w-3" aria-hidden="true" />
                                Document {idx + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Change request comparison */}
                      {isChangeRequest && item.changeRequest && (
                        <ChangeRequestComparison
                          item={item}
                          onApproveChange={() => handleApprove(item)}
                          onRejectChange={() => setRejectItem(item)}
                          loading={actionLoading === item.id}
                        />
                      )}

                      {/* Action buttons for expanded pending items */}
                      {isPending && !isChangeRequest && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => setConfirmApproveItem(item)}
                            disabled={actionLoading === item.id}
                            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                            Approve All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setApproveWithChangesItem(item)}
                            className="min-h-[44px]"
                          >
                            <Edit3Icon className="h-4 w-4 mr-1.5" />
                            Approve with Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRequestChangesItem(item)}
                            className="min-h-[44px] text-amber-600 border-amber-300 hover:bg-amber-50"
                          >
                            <MessageSquareIcon className="h-4 w-4 mr-1.5" />
                            Request Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRejectItem(item)}
                            className="min-h-[44px] text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <XCircleIcon className="h-4 w-4 mr-1.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm Approve Modal */}
      <Dialog
        open={!!confirmApproveItem}
        onOpenChange={(v) => !v && setConfirmApproveItem(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Approval</DialogTitle>
            <DialogDescription>
              Approve {confirmApproveItem?.investorName}&apos;s{" "}
              {SUBMISSION_TYPE_LABELS[confirmApproveItem?.submissionType || ""]?.toLowerCase() || "submission"}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmApproveItem(null)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmApproveItem && handleApprove(confirmApproveItem)}
              disabled={actionLoading === confirmApproveItem?.id}
              className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading === confirmApproveItem?.id ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog
        open={!!rejectItem}
        onOpenChange={(v) => {
          if (!v) {
            setRejectItem(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Reject {rejectItem?.investorName}&apos;s submission? They will be
              notified via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">Rejection Reason</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectItem(null);
                setRejectReason("");
              }}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading === rejectItem?.id}
              className="min-h-[44px] bg-red-600 hover:bg-red-700"
            >
              {actionLoading === rejectItem?.id ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircleIcon className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve with Changes Modal */}
      {approveWithChangesItem && (
        <ApproveWithChangesModal
          item={approveWithChangesItem}
          open={!!approveWithChangesItem}
          onClose={() => setApproveWithChangesItem(null)}
          onSubmit={handleApproveWithChanges}
          submitting={actionLoading === approveWithChangesItem.id}
        />
      )}

      {/* Request Changes Modal */}
      {requestChangesItem && (
        <RequestChangesModal
          item={requestChangesItem}
          open={!!requestChangesItem}
          onClose={() => setRequestChangesItem(null)}
          onSubmit={handleRequestChanges}
          submitting={actionLoading === requestChangesItem.id}
        />
      )}
    </div>
  );
}
