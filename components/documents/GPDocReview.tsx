"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  FileText,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  RefreshCw,
  Eye,
  MoreHorizontal,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LPDocument {
  id: string;
  title: string;
  documentType: string;
  status: string;
  uploadSource?: string;
  originalFilename: string;
  fileSize?: string;
  lpNotes?: string;
  gpNotes?: string;
  isOfflineSigned: boolean;
  externalSigningDate?: string;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string;
  storageUrl?: string;
  fund: { id: string; name: string };
  investor: { id: string; name?: string; email?: string };
  uploadedBy?: { name?: string; email?: string };
  reviewedBy?: { name?: string };
}

interface StatusCounts {
  PENDING_REVIEW?: number;
  APPROVED?: number;
  REJECTED?: number;
  REVISION_REQUESTED?: number;
}

interface GPDocReviewProps {
  /** Fund ID to filter documents (optional — shows all funds if omitted) */
  fundId?: string;
  /** Investor ID to filter documents (optional — shows all investors if omitted) */
  investorId?: string;
  /** Callback when a document review action completes */
  onReviewComplete?: () => void;
  /** Compact mode for embedding in other pages (e.g., investor detail) */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  PENDING_REVIEW: {
    label: "Pending Review",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: XCircle,
  },
  REVISION_REQUESTED: {
    label: "Revision Requested",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    icon: RotateCcw,
  },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_AGREEMENT: "Subscription Agreement / SAFE / SPA",
  LPA: "Limited Partnership Agreement",
  SIDE_LETTER: "Side Letter",
  NDA: "NDA",
  K1_TAX_FORM: "K-1 Tax Form",
  PROOF_OF_FUNDS: "Proof of Funds",
  WIRE_CONFIRMATION: "Wire Confirmation",
  ACH_RECEIPT: "ACH Receipt",
  ACCREDITATION_PROOF: "Accreditation Proof",
  IDENTITY_DOCUMENT: "Identity Document",
  PPM: "Private Placement Memorandum",
  INVESTOR_QUESTIONNAIRE: "Investor Questionnaire",
  FORMATION_DOCS: "Formation Documents",
  POWER_OF_ATTORNEY: "Power of Attorney",
  TRUST_AGREEMENT: "Trust Agreement",
  CUSTODIAN_LETTER: "Custodian Letter",
  OTHER: "Other",
};

const UPLOAD_SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  GP_UPLOADED_FOR_LP: {
    label: "GP Upload",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  LP_UPLOADED_EXTERNAL: {
    label: "External",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  LP_UPLOADED: {
    label: "Investor Upload",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GPDocReview({
  fundId,
  investorId,
  onReviewComplete,
  compact = false,
}: GPDocReviewProps) {
  const [documents, setDocuments] = useState<LPDocument[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_REVIEW");
  const [searchQuery, setSearchQuery] = useState("");

  // Review dialog state
  const [reviewingDoc, setReviewingDoc] = useState<LPDocument | null>(null);
  const [reviewAction, setReviewAction] = useState<
    "APPROVE" | "REJECT" | "REQUEST_REVISION" | null
  >(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview dialog state
  const [previewDoc, setPreviewDoc] = useState<LPDocument | null>(null);

  // ------ Data fetching ------

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (fundId) params.set("fundId", fundId);
      if (investorId) params.set("investorId", investorId);

      const response = await fetch(
        `/api/documents/pending-review?${params.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch documents");
      }

      setDocuments(data.documents || []);
      setStatusCounts(data.statusCounts || {});
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load documents"
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fundId, investorId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ------ Review actions ------

  const handleReview = async () => {
    if (!reviewingDoc || !reviewAction) return;

    // Capture into local const so TypeScript narrows the type
    const currentAction: "APPROVE" | "REJECT" | "REQUEST_REVISION" = reviewAction;

    setIsSubmitting(true);

    try {
      const endpoints: Record<"APPROVE" | "REJECT" | "REQUEST_REVISION", string> = {
        APPROVE: `/api/documents/${reviewingDoc.id}/confirm`,
        REJECT: `/api/documents/${reviewingDoc.id}/reject`,
        REQUEST_REVISION: `/api/documents/${reviewingDoc.id}/request-reupload`,
      };
      const endpoint = endpoints[currentAction];

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewNotes: reviewNotes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Review action failed");
      }

      const actionLabels: Record<"APPROVE" | "REJECT" | "REQUEST_REVISION", string> = {
        APPROVE: "approved",
        REJECT: "rejected",
        REQUEST_REVISION: "revision requested for",
      };
      toast.success(`Document ${actionLabels[currentAction]}`);

      setReviewingDoc(null);
      setReviewAction(null);
      setReviewNotes("");
      fetchDocuments();
      onReviewComplete?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Review action failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewDialog = (
    doc: LPDocument,
    action: "APPROVE" | "REJECT" | "REQUEST_REVISION"
  ) => {
    setReviewingDoc(doc);
    setReviewAction(action);
    setReviewNotes("");
  };

  // ------ Filtering ------

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.title?.toLowerCase().includes(q) ||
      doc.investor.name?.toLowerCase().includes(q) ||
      doc.investor.email?.toLowerCase().includes(q) ||
      doc.fund.name?.toLowerCase().includes(q) ||
      doc.originalFilename?.toLowerCase().includes(q)
    );
  });

  // ------ Helpers ------

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatFileSize = (size?: string) => {
    if (!size) return "";
    const bytes = parseInt(size);
    if (isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pendingCount = statusCounts.PENDING_REVIEW || 0;
  const approvedCount = statusCounts.APPROVED || 0;
  const rejectedCount = statusCounts.REJECTED || 0;
  const revisionCount = statusCounts.REVISION_REQUESTED || 0;

  // ------ Render ------

  if (loading && documents.length === 0) {
    return (
      <div className="space-y-4">
        {!compact && (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border bg-muted/50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status cards — hidden in compact mode */}
      {!compact && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatusCard
            label="Pending Review"
            count={pendingCount}
            icon={Clock}
            iconColor="text-amber-500"
            active={statusFilter === "PENDING_REVIEW"}
            onClick={() => setStatusFilter("PENDING_REVIEW")}
          />
          <StatusCard
            label="Approved"
            count={approvedCount}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            active={statusFilter === "APPROVED"}
            onClick={() => setStatusFilter("APPROVED")}
          />
          <StatusCard
            label="Revisions"
            count={revisionCount}
            icon={AlertCircle}
            iconColor="text-orange-500"
            active={statusFilter === "REVISION_REQUESTED"}
            onClick={() => setStatusFilter("REVISION_REQUESTED")}
          />
          <StatusCard
            label="Rejected"
            count={rejectedCount}
            icon={XCircle}
            iconColor="text-red-500"
            active={statusFilter === "REJECTED"}
            onClick={() => setStatusFilter("REJECTED")}
          />
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search by document, investor, or fund..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-base sm:text-sm"
          />
        </div>

        {compact && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by status">
              <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING_REVIEW">Pending</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="REVISION_REQUESTED">Revision</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={fetchDocuments}
          disabled={loading}
          className="min-h-[44px] min-w-[44px]"
          aria-label="Refresh documents"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="flex items-center gap-2 p-4 text-red-600 bg-red-50 dark:bg-red-950/50 rounded-lg"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm">{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!error && filteredDocuments.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText
            className="h-12 w-12 text-muted-foreground mb-4"
            aria-hidden="true"
          />
          <h3 className="text-lg font-medium">No documents found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery
              ? "No documents match your search."
              : statusFilter === "PENDING_REVIEW"
                ? "No documents are pending review."
                : "No documents in this category."}
          </p>
        </div>
      )}

      {/* Document list */}
      {filteredDocuments.length > 0 && (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              compact={compact}
              onApprove={() => openReviewDialog(doc, "APPROVE")}
              onReject={() => openReviewDialog(doc, "REJECT")}
              onRequestRevision={() =>
                openReviewDialog(doc, "REQUEST_REVISION")
              }
              onPreview={() => setPreviewDoc(doc)}
              onDownload={() =>
                window.open(
                  `/api/admin/documents/${doc.id}/download`,
                  "_blank"
                )
              }
              formatDate={formatDate}
              formatFileSize={formatFileSize}
            />
          ))}
        </div>
      )}

      {/* Review dialog */}
      <ReviewDialog
        doc={reviewingDoc}
        action={reviewAction}
        notes={reviewNotes}
        onNotesChange={setReviewNotes}
        isSubmitting={isSubmitting}
        onSubmit={handleReview}
        onClose={() => {
          setReviewingDoc(null);
          setReviewAction(null);
        }}
        formatDateTime={formatDateTime}
      />

      {/* Preview dialog */}
      {previewDoc && (
        <Dialog open onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" aria-hidden="true" />
                {previewDoc.title}
              </DialogTitle>
              <DialogDescription>
                {previewDoc.originalFilename}
                {previewDoc.fileSize &&
                  ` — ${formatFileSize(previewDoc.fileSize)}`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto rounded-lg bg-muted/50 dark:bg-muted/20 p-4 min-h-[400px]">
              <iframe
                src={`/api/admin/documents/${previewDoc.id}/download?inline=true`}
                className="w-full h-[60vh] rounded border"
                title={`Preview: ${previewDoc.title}`}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `/api/admin/documents/${previewDoc.id}/download`,
                    "_blank"
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download
              </Button>
              <Button onClick={() => setPreviewDoc(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusCard({
  label,
  count,
  icon: Icon,
  iconColor,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: typeof CheckCircle2;
  iconColor: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        active ? "ring-2 ring-[#0066FF] ring-offset-2" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono tabular-nums">
          {count}
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentCard({
  doc,
  compact,
  onApprove,
  onReject,
  onRequestRevision,
  onPreview,
  onDownload,
  formatDate,
  formatFileSize,
}: {
  doc: LPDocument;
  compact: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRequestRevision: () => void;
  onPreview: () => void;
  onDownload: () => void;
  formatDate: (d: string) => string;
  formatFileSize: (s?: string) => string;
}) {
  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.PENDING_REVIEW;
  const uploadSource = doc.uploadSource
    ? UPLOAD_SOURCE_LABELS[doc.uploadSource]
    : null;
  const isPending = doc.status === "PENDING_REVIEW";

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: document info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                <Badge className={`text-xs ${statusCfg.color}`}>
                  {statusCfg.label}
                </Badge>
                {uploadSource && (
                  <Badge className={`text-xs ${uploadSource.color}`}>
                    {uploadSource.label}
                  </Badge>
                )}
                {doc.isOfflineSigned && (
                  <Badge variant="secondary" className="text-xs">
                    Offline Signed
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                <span>
                  {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                </span>
                <span>·</span>
                <span>
                  {doc.investor.name || doc.investor.email || "Unknown"}
                </span>
                {!compact && (
                  <>
                    <span>·</span>
                    <span>{doc.fund.name}</span>
                  </>
                )}
                <span>·</span>
                <span>{formatDate(doc.createdAt)}</span>
                {doc.fileSize && (
                  <>
                    <span>·</span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                  </>
                )}
              </div>
              {doc.lpNotes && (
                <div className="mt-2 p-2 rounded bg-muted/50 dark:bg-muted/20 text-xs text-muted-foreground">
                  <span className="font-medium">Investor Notes:</span> {doc.lpNotes}
                </div>
              )}
              {doc.gpNotes && doc.status !== "PENDING_REVIEW" && (
                <div className="mt-1 p-2 rounded bg-muted/50 dark:bg-muted/20 text-xs text-muted-foreground">
                  <span className="font-medium">GP Notes:</span> {doc.gpNotes}
                </div>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isPending && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onApprove}
                  className="min-h-[36px] text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRequestRevision}
                  className="min-h-[36px] text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/30 hidden sm:flex"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Revise
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[36px] min-w-[36px]"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onPreview}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                {isPending && (
                  <>
                    <DropdownMenuItem
                      onClick={onApprove}
                      className="text-emerald-600"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onRequestRevision}
                      className="text-orange-600"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Request Revision
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onReject}
                      className="text-red-600"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewDialog({
  doc,
  action,
  notes,
  onNotesChange,
  isSubmitting,
  onSubmit,
  onClose,
  formatDateTime,
}: {
  doc: LPDocument | null;
  action: "APPROVE" | "REJECT" | "REQUEST_REVISION" | null;
  notes: string;
  onNotesChange: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  formatDateTime: (d: string) => string;
}) {
  if (!doc || !action) return null;

  const actionConfig = {
    APPROVE: {
      title: "Approve Document",
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      buttonLabel: "Approve",
      buttonVariant: "default" as const,
      placeholder: "Optional notes for the investor...",
      notesRequired: false,
    },
    REJECT: {
      title: "Reject Document",
      icon: XCircle,
      iconColor: "text-red-600",
      buttonLabel: "Reject",
      buttonVariant: "destructive" as const,
      placeholder:
        "Explain why this document is being rejected...",
      notesRequired: true,
    },
    REQUEST_REVISION: {
      title: "Request Revision",
      icon: RotateCcw,
      iconColor: "text-orange-600",
      buttonLabel: "Request Revision",
      buttonVariant: "outline" as const,
      placeholder:
        "Describe the changes needed (e.g., missing signature, wrong entity name)...",
      notesRequired: true,
    },
  };

  const cfg = actionConfig[action];
  const ActionIcon = cfg.icon;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActionIcon className={`h-5 w-5 ${cfg.iconColor}`} aria-hidden="true" />
            {cfg.title}
          </DialogTitle>
          <DialogDescription>
            <strong>{doc.title}</strong> from{" "}
            {doc.investor.name || doc.investor.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Document metadata */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
            </div>
            <div>
              <span className="text-muted-foreground">Fund:</span>{" "}
              {doc.fund.name}
            </div>
            <div>
              <span className="text-muted-foreground">Uploaded:</span>{" "}
              {formatDateTime(doc.createdAt)}
            </div>
            {doc.externalSigningDate && (
              <div>
                <span className="text-muted-foreground">Signed:</span>{" "}
                {formatDateTime(doc.externalSigningDate)}
              </div>
            )}
          </div>

          {/* LP notes */}
          {doc.lpNotes && (
            <div className="p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
              <p className="text-sm font-medium mb-1">Investor Notes:</p>
              <p className="text-sm text-muted-foreground">{doc.lpNotes}</p>
            </div>
          )}

          {/* GP review notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Review Notes{" "}
              {!cfg.notesRequired && (
                <span className="text-muted-foreground">(optional)</span>
              )}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={cfg.placeholder}
              rows={4}
              className="text-base sm:text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || (cfg.notesRequired && !notes.trim())}
            variant={cfg.buttonVariant}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Processing...
              </>
            ) : (
              cfg.buttonLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
