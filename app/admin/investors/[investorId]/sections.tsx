"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Building2,
  Shield,
  FileText,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
  Mail,
  Phone,
  Upload,
  Wallet,
  Scale,
  History,
  CalendarDays,
  FileCheck,
  CreditCard,
  UserCheck,
  Activity,
} from "lucide-react";
import { GPDocUpload } from "@/components/documents/GPDocUpload";
import { GPDocReview } from "@/components/documents/GPDocReview";

import type { InvestorProfile, TimelineEvent } from "./types";
import {
  STAGE_CONFIG,
  ENTITY_TYPE_LABELS,
  ACCREDITATION_LABELS,
  KYC_LABELS,
  REPRESENTATION_LABELS,
  ONBOARDING_STEPS,
  countRepresentations,
  getOnboardingStepStatus,
  formatCurrency,
  formatDate,
  formatAddress,
} from "./types";

// --- Loading Skeleton ---

export function LoadingSkeleton() {
  return (
    <div className="min-h-0">
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="mb-4 h-5 w-16" />
        <div className="mb-6 flex justify-between">
          <div>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="mt-2 h-4 w-40" />
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="text-right">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-1 h-4 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-6 h-10 w-full rounded-md" />
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// --- Error State ---

export interface ErrorStateProps {
  error: string | null;
  onGoBack: () => void;
}

export function ErrorState({ error, onGoBack }: ErrorStateProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <p className="text-destructive">{error || "Investor not found"}</p>
      <Button onClick={onGoBack}>Go Back</Button>
    </div>
  );
}

// --- Header Section ---

export interface InvestorHeaderProps {
  investor: InvestorProfile;
  totalCommitment: number;
  totalFunded: number;
}

export function InvestorHeaderSection({ investor, totalCommitment, totalFunded }: InvestorHeaderProps) {
  const stageConfig = STAGE_CONFIG[investor.stage] || STAGE_CONFIG.APPLIED;

  return (
    <div className="mb-6">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/investors">Investors</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{investor.entityName || investor.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold">
            {investor.entityName || investor.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-sm">
              <Mail className="h-3.5 w-3.5" />
              {investor.email}
            </span>
            {investor.phone && (
              <span className="inline-flex items-center gap-1 text-sm">
                <Phone className="h-3.5 w-3.5" />
                {investor.phone}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs">
              <CalendarDays className="h-3 w-3" />
              Joined {formatDate(investor.createdAt)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={stageConfig.badgeVariant}>
              {stageConfig.label}
            </Badge>
            {investor.entityType && (
              <Badge variant="outline">
                {ENTITY_TYPE_LABELS[investor.entityType] || investor.entityType}
              </Badge>
            )}
            {investor.ndaSigned && (
              <Badge variant="outline" className="border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                NDA Signed
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold tabular-nums">
            {formatCurrency(totalCommitment)}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{formatCurrency(totalFunded)}</span> funded
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Summary Metric Cards ---

export interface SummaryMetricCardsProps {
  totalCommitment: number;
  totalFunded: number;
  fundingPercentage: number;
  investmentCount: number;
  documentCount: number;
  pendingDocs: number;
}

export function SummaryMetricCards({
  totalCommitment,
  totalFunded,
  fundingPercentage,
  investmentCount,
  documentCount,
  pendingDocs,
}: SummaryMetricCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-l-4 border-l-blue-500 p-3 dark:border-gray-800 dark:border-l-blue-500">
        <p className="text-xs text-muted-foreground">Committed</p>
        <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
          {formatCurrency(totalCommitment)}
        </p>
      </div>
      <div className="rounded-lg border border-l-4 border-l-emerald-500 p-3 dark:border-gray-800 dark:border-l-emerald-500">
        <p className="text-xs text-muted-foreground">Funded</p>
        <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
          {formatCurrency(totalFunded)}
        </p>
        {totalCommitment > 0 && (
          <div className="mt-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
              />
            </div>
            <p className="mt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {fundingPercentage}%
            </p>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-l-4 border-l-purple-500 p-3 dark:border-gray-800 dark:border-l-purple-500">
        <p className="text-xs text-muted-foreground">Investments</p>
        <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
          {investmentCount}
        </p>
      </div>
      <div className="rounded-lg border border-l-4 border-l-amber-500 p-3 dark:border-gray-800 dark:border-l-amber-500">
        <p className="text-xs text-muted-foreground">Documents</p>
        <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
          {documentCount}
        </p>
        {pendingDocs > 0 && (
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            {pendingDocs} pending review
          </p>
        )}
      </div>
    </div>
  );
}

// --- Stage Controls ---

export interface StageControlsProps {
  availableTransitions: string[];
  showNotesFor: string | null;
  transitionNotes: string;
  transitioning: boolean;
  error: string | null;
  onSetShowNotesFor: (stage: string | null) => void;
  onSetTransitionNotes: (notes: string) => void;
  onHandleStageTransition: (newStage: string) => void;
}

export function StageControls({
  availableTransitions,
  showNotesFor,
  transitionNotes,
  transitioning,
  error,
  onSetShowNotesFor,
  onSetTransitionNotes,
  onHandleStageTransition,
}: StageControlsProps) {
  if (availableTransitions.length === 0) return null;

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Stage Actions</CardTitle>
        <CardDescription>
          Advance or update this investor&apos;s pipeline stage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {availableTransitions.map((nextStage) => {
            const nextConfig = STAGE_CONFIG[nextStage] || STAGE_CONFIG.APPLIED;
            const isReject = nextStage === "REJECTED";

            return (
              <div key={nextStage}>
                {showNotesFor === nextStage ? (
                  <div className="flex items-center gap-2">
                    <Textarea
                      placeholder="Notes (optional)..."
                      value={transitionNotes}
                      onChange={(e) => onSetTransitionNotes(e.target.value)}
                      className="h-10 min-h-0 w-64"
                    />
                    <Button
                      size="sm"
                      variant={isReject ? "destructive" : "default"}
                      onClick={() => onHandleStageTransition(nextStage)}
                      disabled={transitioning}
                    >
                      {transitioning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirm"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onSetShowNotesFor(null);
                        onSetTransitionNotes("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant={isReject ? "destructive" : "outline"}
                    onClick={() => onSetShowNotesFor(nextStage)}
                    disabled={transitioning}
                  >
                    {isReject ? (
                      <XCircle className="h-4 w-4 mr-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-1" />
                    )}
                    {isReject
                      ? "Reject"
                      : `Move to ${nextConfig.label}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Overview Tab ---

export interface OverviewTabProps {
  investor: InvestorProfile;
}

export function OverviewTab({ investor }: OverviewTabProps) {
  const entityData = investor.fundData as Record<string, unknown> | null;

  return (
    <div>
      {/* Onboarding Progress */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle className="text-base">Onboarding Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0">
            {ONBOARDING_STEPS.map((step, idx) => {
              const status = getOnboardingStepStatus(step.key, investor);
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                        status === "completed"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                          : status === "current"
                            ? "border-[#0066FF] bg-blue-50 dark:bg-blue-950"
                            : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                      }`}
                    >
                      {status === "completed" ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                      ) : status === "current" ? (
                        <StepIcon className="h-4 w-4 text-[#0066FF]" />
                      ) : (
                        <StepIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-xs text-center leading-tight max-w-[80px] ${
                        status === "completed"
                          ? "text-emerald-600 font-medium dark:text-emerald-400"
                          : status === "current"
                            ? "text-[#0066FF] font-medium"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < ONBOARDING_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 mt-[-16px] rounded ${
                        getOnboardingStepStatus(ONBOARDING_STEPS[idx + 1].key, investor) === "completed" ||
                        status === "completed"
                          ? "bg-emerald-300 dark:bg-emerald-700"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Entity Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Entity Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Legal Name" value={investor.entityName || investor.name} />
            <InfoRow
              label="Entity Type"
              value={
                investor.entityType
                  ? ENTITY_TYPE_LABELS[investor.entityType] || investor.entityType
                  : "Not specified"
              }
            />
            {entityData?.taxId ? (
              <InfoRow label="Tax ID" value="••••••" />
            ) : null}
            {entityData?.stateOfFormation ? (
              <InfoRow
                label="State of Formation"
                value={String(entityData.stateOfFormation)}
              />
            ) : null}
            {entityData?.authorizedSignatory ? (
              <InfoRow
                label="Authorized Signatory"
                value={String(entityData.authorizedSignatory)}
              />
            ) : null}
            {entityData?.authorizedSignerName ? (
              <InfoRow
                label="Authorized Signer"
                value={`${String(entityData.authorizedSignerName)}${entityData.authorizedSignerTitle ? ` (${entityData.authorizedSignerTitle})` : ""}`}
              />
            ) : null}
            {entityData?.trusteeName ? (
              <InfoRow
                label="Trustee"
                value={String(entityData.trusteeName)}
              />
            ) : null}
            {entityData?.custodianName ? (
              <InfoRow
                label="Custodian"
                value={String(entityData.custodianName)}
              />
            ) : null}
            {entityData?.planType ? (
              <InfoRow
                label="Plan Type"
                value={String(entityData.planType)}
              />
            ) : null}
            {entityData?.address ? (
              <InfoRow
                label="Address"
                value={formatAddress(entityData.address as Record<string, string>)}
              />
            ) : null}
            {entityData?.sourceOfFunds ? (
              <InfoRow
                label="Source of Funds"
                value={String(entityData.sourceOfFunds).replace(/_/g, " ")}
              />
            ) : null}
            {entityData?.occupation ? (
              <InfoRow
                label="Occupation"
                value={String(entityData.occupation)}
              />
            ) : null}
          </CardContent>
        </Card>

        {/* Quick Compliance Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Compliance Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ComplianceRow
              label="NDA"
              status={investor.ndaSigned ? "completed" : "pending"}
              detail={
                investor.ndaSignedAt
                  ? `Signed ${formatDate(investor.ndaSignedAt)}`
                  : "Not yet signed"
              }
            />
            <ComplianceRow
              label="Accreditation"
              status={
                investor.accreditationStatus === "VERIFIED" ||
                investor.accreditationStatus === "SELF_ATTESTED" ||
                investor.accreditationStatus === "SELF_CERTIFIED" ||
                investor.accreditationStatus === "THIRD_PARTY_VERIFIED" ||
                investor.accreditationStatus === "KYC_VERIFIED"
                  ? "completed"
                  : investor.accreditationStatus === "REJECTED"
                    ? "rejected"
                    : "pending"
              }
              detail={
                ACCREDITATION_LABELS[investor.accreditationStatus || ""] ||
                investor.accreditationStatus?.replace(/_/g, " ") ||
                "Not started"
              }
            />
            <ComplianceRow
              label="KYC / AML"
              status={
                investor.kycStatus === "APPROVED" ||
                investor.kycStatus === "COMPLETED"
                  ? "completed"
                  : investor.kycStatus === "DECLINED"
                    ? "rejected"
                    : "pending"
              }
              detail={
                KYC_LABELS[investor.kycStatus || ""] ||
                investor.kycStatus ||
                "Not started"
              }
            />
            {/* SEC Representations summary */}
            {entityData?.representations != null && (
              <div className="mt-2 rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  SEC Representations
                </p>
                <p className="mt-0.5 text-sm">
                  {countRepresentations(entityData.representations as Record<string, boolean>)} of 8 confirmed
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Investments Tab ---

export interface InvestmentsTabProps {
  investments: InvestorProfile["investments"];
}

export function InvestmentsTab({ investments }: InvestmentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Investment History</CardTitle>
      </CardHeader>
      <CardContent>
        {investments.length === 0 ? (
          <div className="py-8 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No investments yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {investments.map((inv) => {
              const invPct = inv.commitmentAmount > 0
                ? Math.round((inv.fundedAmount / inv.commitmentAmount) * 100)
                : 0;
              return (
                <div
                  key={inv.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{inv.fundName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inv.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold tabular-nums">
                        {formatCurrency(inv.commitmentAmount)}
                      </p>
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(inv.fundedAmount)} funded
                      </p>
                    </div>
                  </div>
                  {/* Funding progress bar */}
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className={`h-full rounded-full transition-all ${
                          invPct >= 100 ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(invPct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        inv.transferStatus === "COMPLETED"
                          ? "default"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {inv.transferStatus?.replace(/_/g, " ")}
                    </Badge>
                    {inv.proofStatus && inv.proofStatus !== "NOT_REQUIRED" && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          inv.proofStatus === "VERIFIED"
                            ? "text-emerald-600"
                            : inv.proofStatus === "REJECTED"
                              ? "text-red-600"
                              : "text-amber-600"
                        }`}
                      >
                        Proof: {inv.proofStatus?.replace(/_/g, " ")}
                      </Badge>
                    )}
                    <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                      {invPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Documents Tab ---

export interface DocumentsTabProps {
  investor: InvestorProfile;
  showUploadModal: boolean;
  onSetShowUploadModal: (open: boolean) => void;
  onRefresh: () => void;
}

export function DocumentsTab({ investor, showUploadModal, onSetShowUploadModal, onRefresh }: DocumentsTabProps) {
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Documents</CardTitle>
          {investor.investments.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetShowUploadModal(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload Document
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {investor.documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No documents yet</p>
              {investor.investments.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => onSetShowUploadModal(true)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload first document
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {investor.documents.map((doc) => {
                const statusLabel = doc.status.replace(/_/g, " ");
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type.replace(/_/g, " ")} - {formatDate(doc.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        doc.status === "APPROVED" || doc.status === "SIGNED" || doc.status === "COMPLETED"
                          ? "default"
                          : doc.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {statusLabel}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline document review for this investor */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Document Review</CardTitle>
          <CardDescription>
            Review and approve documents submitted by this investor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GPDocReview
            investorId={investor.id}
            fundId={investor.investments[0]?.fundId}
            compact
            onReviewComplete={onRefresh}
          />
        </CardContent>
      </Card>

      {investor.investments.length > 0 && (
        <GPDocUpload
          isOpen={showUploadModal}
          onClose={() => onSetShowUploadModal(false)}
          investorId={investor.id}
          investorName={investor.entityName || investor.name}
          fundId={investor.investments[0].fundId}
          fundName={investor.investments[0].fundName}
          onSuccess={() => {
            onSetShowUploadModal(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
}

// --- Compliance Tab ---

export interface ComplianceTabProps {
  investor: InvestorProfile;
}

export function ComplianceTab({ investor }: ComplianceTabProps) {
  const entityData = investor.fundData as Record<string, unknown> | null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Compliance Gates */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Compliance Gates</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ComplianceRow
            label="NDA / Confidentiality"
            status={investor.ndaSigned ? "completed" : "pending"}
            detail={
              investor.ndaSignedAt
                ? `Signed ${formatDate(investor.ndaSignedAt)}`
                : "Awaiting signature"
            }
          />
          <ComplianceRow
            label="Accreditation"
            status={
              ["VERIFIED", "SELF_ATTESTED", "SELF_CERTIFIED", "THIRD_PARTY_VERIFIED", "KYC_VERIFIED"].includes(
                investor.accreditationStatus || "",
              )
                ? "completed"
                : investor.accreditationStatus === "REJECTED"
                  ? "rejected"
                  : "pending"
            }
            detail={
              ACCREDITATION_LABELS[investor.accreditationStatus || ""] ||
              investor.accreditationStatus?.replace(/_/g, " ") ||
              "Not started"
            }
          />
          <ComplianceRow
            label="KYC / AML"
            status={
              investor.kycStatus === "APPROVED" || investor.kycStatus === "COMPLETED"
                ? "completed"
                : investor.kycStatus === "DECLINED"
                  ? "rejected"
                  : "pending"
            }
            detail={
              KYC_LABELS[investor.kycStatus || ""] ||
              investor.kycStatus ||
              "Not started"
            }
          />
          {entityData?.sourceOfFunds != null && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Source of Funds</p>
              <p className="text-sm font-medium">
                {String(entityData.sourceOfFunds).replace(/_/g, " ")}
              </p>
            </div>
          )}
          {entityData?.occupation != null && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Occupation</p>
              <p className="text-sm font-medium">{String(entityData.occupation)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEC Representations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">SEC Representations</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {entityData?.representations ? (
            <div className="space-y-2">
              {REPRESENTATION_LABELS.map(({ key, label }) => {
                const reps = entityData.representations as Record<string, boolean>;
                const confirmed = reps[key] === true;
                return (
                  <div key={key} className="flex items-start gap-2 py-1">
                    {confirmed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                    )}
                    <span className={`text-xs ${confirmed ? "" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
              {(entityData.representations as Record<string, unknown>)?.timestamp != null && (
                <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  Confirmed{" "}
                  {formatDate(String((entityData.representations as Record<string, unknown>).timestamp))}
                </p>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Scale className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No representations recorded yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Activity Tab ---

export interface ActivityTabProps {
  investor: InvestorProfile;
}

export function ActivityTab({ investor }: ActivityTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">Activity Timeline</CardTitle>
        </div>
        <CardDescription>Full chronological audit trail</CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityTimeline investor={investor} />
      </CardContent>
    </Card>
  );
}

// --- Activity Timeline (internal) ---

function ActivityTimeline({ investor }: { investor: InvestorProfile }) {
  // Build a unified timeline from all available data
  const events: TimelineEvent[] = [];

  // 1. Account creation
  events.push({
    id: "account-created",
    type: "note",
    title: "Account created",
    description: `${investor.name} was added to the platform`,
    timestamp: investor.createdAt,
    icon: User,
    iconColor: "text-blue-500",
  });

  // 2. NDA signing
  if (investor.ndaSigned && investor.ndaSignedAt) {
    events.push({
      id: "nda-signed",
      type: "nda",
      title: "NDA signed",
      description: "Confidentiality agreement executed",
      timestamp: investor.ndaSignedAt,
      icon: FileCheck,
      iconColor: "text-emerald-500",
    });
  }

  // 3. Accreditation
  if (
    investor.accreditationStatus &&
    investor.accreditationStatus !== "PENDING" &&
    investor.accreditationStatus !== "NOT_STARTED"
  ) {
    const isVerified =
      investor.accreditationStatus === "VERIFIED" ||
      investor.accreditationStatus === "SELF_ATTESTED" ||
      investor.accreditationStatus === "SELF_CERTIFIED" ||
      investor.accreditationStatus === "THIRD_PARTY_VERIFIED" ||
      investor.accreditationStatus === "KYC_VERIFIED";
    events.push({
      id: "accreditation",
      type: "accreditation",
      title: `Accreditation ${isVerified ? "confirmed" : "updated"}`,
      description: `Status: ${ACCREDITATION_LABELS[investor.accreditationStatus] || investor.accreditationStatus?.replace(/_/g, " ")}`,
      timestamp: investor.createdAt, // Best available timestamp
      icon: isVerified ? UserCheck : Shield,
      iconColor: isVerified ? "text-emerald-500" : "text-amber-500",
    });
  }

  // 4. Investments (commitments + fundings)
  for (const inv of investor.investments) {
    events.push({
      id: `investment-${inv.id}`,
      type: "investment",
      title: `Committed to ${inv.fundName}`,
      description: `${formatCurrency(inv.commitmentAmount)} commitment`,
      timestamp: inv.createdAt,
      icon: DollarSign,
      iconColor: "text-purple-500",
    });

    if (inv.fundedAmount > 0) {
      events.push({
        id: `funded-${inv.id}`,
        type: "wire",
        title: `Wire received — ${inv.fundName}`,
        description: `${formatCurrency(inv.fundedAmount)} of ${formatCurrency(inv.commitmentAmount)} funded`,
        timestamp: inv.createdAt, // Best available; would be confirmDate if we had it
        icon: CreditCard,
        iconColor: "text-green-500",
      });
    }

    if (inv.proofStatus === "UPLOADED" || inv.proofStatus === "PROOF_UPLOADED" || inv.proofStatus === "VERIFIED") {
      events.push({
        id: `proof-${inv.id}`,
        type: "wire",
        title: "Wire proof uploaded",
        description: `Proof for ${inv.fundName} — status: ${inv.proofStatus.replace(/_/g, " ").toLowerCase()}`,
        timestamp: inv.createdAt,
        icon: Upload,
        iconColor: "text-blue-500",
      });
    }
  }

  // 5. Documents
  for (const doc of investor.documents) {
    events.push({
      id: `doc-${doc.id}`,
      type: "document",
      title: `Document: ${doc.name}`,
      description: `${doc.type.replace(/_/g, " ")} — ${doc.status.replace(/_/g, " ").toLowerCase()}`,
      timestamp: doc.createdAt,
      icon: FileText,
      iconColor:
        doc.status === "APPROVED" || doc.status === "SIGNED" || doc.status === "COMPLETED"
          ? "text-emerald-500"
          : doc.status === "REJECTED"
            ? "text-red-500"
            : "text-amber-500",
    });
  }

  // 6. Stage transitions from history
  for (let i = 0; i < investor.stageHistory.length; i++) {
    const entry = investor.stageHistory[i];
    const toConfig = STAGE_CONFIG[entry.to] || STAGE_CONFIG.APPLIED;
    events.push({
      id: `stage-${i}`,
      type: "stage_change",
      title: `Stage: ${STAGE_CONFIG[entry.from]?.label || entry.from} → ${toConfig.label}`,
      description: entry.notes || undefined,
      timestamp: entry.timestamp,
      actor: entry.by || undefined,
      icon:
        entry.to === "REJECTED"
          ? XCircle
          : entry.to === "FUNDED"
            ? CheckCircle2
            : ChevronRight,
      iconColor:
        entry.to === "REJECTED"
          ? "text-red-500"
          : entry.to === "FUNDED"
            ? "text-green-500"
            : "text-primary",
    });
  }

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
        <p className="text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
      {events.map((event) => {
        const EventIcon = event.icon;
        return (
          <div key={event.id} className="relative group">
            <div
              className={`absolute -left-[13px] top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-card`}
            >
              <EventIcon className={`h-3.5 w-3.5 ${event.iconColor}`} aria-hidden="true" />
            </div>
            <div className="pl-4">
              <p className="text-sm font-medium">{event.title}</p>
              {event.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(event.timestamp)}
                {event.actor && (
                  <span className="ml-1">
                    by <span className="font-medium">{event.actor}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Shared Small Components ---

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start text-sm gap-0.5 sm:gap-2">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="font-medium sm:text-right sm:max-w-[60%] break-words">{value}</span>
    </div>
  );
}

export function ComplianceRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: "completed" | "pending" | "rejected";
  detail: string;
}) {
  const icons = {
    completed: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    pending: <Clock className="h-5 w-5 text-amber-500" />,
    rejected: <XCircle className="h-5 w-5 text-red-500" />,
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        {icons[status]}
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}
