import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Timer,
  Banknote,
} from "lucide-react";
import { SLAIndicator } from "./sla-indicator";
import { type OperationalReport, formatCurrency, formatDocType } from "./types";

const WIRE_STATUS_ITEMS = [
  { label: "Completed", key: "completed" as const, color: "text-emerald-600" },
  { label: "Pending", key: "pending" as const, color: "text-amber-600" },
  { label: "Failed", key: "failed" as const, color: "text-red-600" },
  { label: "Overdue", key: "overdueCount" as const, color: "text-red-600" },
];

const CONVERSION_STAGES = (timing: OperationalReport["conversionTiming"]) => [
  {
    label: "Applied",
    count: timing.totalInvestors,
    avgDays: null as number | null,
  },
  {
    label: "Onboarded",
    count: timing.onboardingCompleted,
    avgDays: timing.avgDaysToOnboarding,
  },
  {
    label: "Committed",
    count: timing.committed,
    avgDays: timing.avgDaysToCommitted,
  },
  {
    label: "Funded",
    count: timing.funded,
    avgDays: timing.avgDaysToFunded,
  },
];

export function OperationsTab({ report }: { report: OperationalReport }) {
  const { wireReconciliation: wire, documentMetrics, signatureMetrics: sig, conversionTiming, sla } = report;

  const stages = CONVERSION_STAGES(conversionTiming);

  return (
    <>
      {/* SLA Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            SLA Dashboard
          </CardTitle>
          <CardDescription>
            Service level tracking for wire confirmations and document reviews
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SLAIndicator
            label="Wire Confirmations"
            onTrack={sla.wireConfirmation.onTrack}
            overdue={sla.wireConfirmation.overdue}
            slaLabel={`${sla.wireConfirmation.slaDays} business days`}
            avgLabel={sla.wireConfirmation.avgDays !== null ? `${sla.wireConfirmation.avgDays}d` : null}
          />
          <SLAIndicator
            label="Document Reviews"
            onTrack={sla.documentReview.onTrack}
            overdue={sla.documentReview.overdue}
            slaLabel={`${sla.documentReview.slaHours}h`}
            avgLabel={sla.documentReview.avgHours !== null ? `${sla.documentReview.avgHours}h` : null}
          />
          {sla.signing.totalPending > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-mono tabular-nums">{sla.signing.totalPending}</span> signature documents awaiting completion
              </div>
              {sla.signing.avgDays !== null && (
                <span className="text-xs text-muted-foreground">
                  Avg: {sla.signing.avgDays}d to complete
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wire Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Banknote className="h-4 w-4" />
            Wire Reconciliation
          </CardTitle>
          <CardDescription>
            Expected vs received amounts and confirmation tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Expected</p>
              <p className="font-mono text-lg font-bold tabular-nums">
                {formatCurrency(wire.totalExpected)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Received</p>
              <p className="font-mono text-lg font-bold tabular-nums text-emerald-600">
                {formatCurrency(wire.totalReceived)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Variance</p>
              <p className={`font-mono text-lg font-bold tabular-nums ${wire.totalVariance > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {wire.totalVariance > 0 ? formatCurrency(wire.totalVariance) : "$0"}
                {wire.variancePercent > 0 && (
                  <span className="ml-1 text-xs">({wire.variancePercent.toFixed(1)}%)</span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Confirm</p>
              <p className="font-mono text-lg font-bold tabular-nums">
                {wire.avgConfirmationDays !== null ? `${wire.avgConfirmationDays}d` : "\u2014"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {WIRE_STATUS_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border p-2"
              >
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`font-mono text-sm font-bold tabular-nums ${item.color}`}>
                  {wire[item.key]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Completion + Signatures side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Document Completion by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileCheck className="h-4 w-4" />
              Document Completion
            </CardTitle>
            <CardDescription>
              Investor document approval rates by type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents submitted yet</p>
            ) : (
              documentMetrics.map((doc) => (
                <div key={doc.type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatDocType(doc.type)}</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="font-mono tabular-nums">{doc.approved}</span>
                      </span>
                      {doc.rejected > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <XCircle className="h-3 w-3" />
                          <span className="font-mono tabular-nums">{doc.rejected}</span>
                        </span>
                      )}
                      {doc.pending > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <Timer className="h-3 w-3" />
                          <span className="font-mono tabular-nums">{doc.pending}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${doc.completionRate}%` }}
                    />
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${doc.rejectionRate}%` }}
                    />
                  </div>
                  {doc.avgReviewHours !== null && (
                    <p className="text-xs text-muted-foreground">
                      Avg review: {doc.avgReviewHours}h
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Signature Completion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileCheck className="h-4 w-4" />
              E-Signature Status
            </CardTitle>
            <CardDescription>
              Required signing documents progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Documents</p>
                <p className="font-mono text-lg font-bold tabular-nums">
                  {sig.completed}/{sig.totalRequired}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sig.completionRate}% complete
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Recipients</p>
                <p className="font-mono text-lg font-bold tabular-nums">
                  {sig.signedRecipients}/{sig.totalRecipients}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sig.totalRecipients > 0
                    ? Math.round((sig.signedRecipients / sig.totalRecipients) * 100)
                    : 0}
                  % signed
                </p>
              </div>
            </div>
            {sig.avgSigningDays !== null && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg signing time</span>
                  <span className="font-mono font-bold tabular-nums">
                    {sig.avgSigningDays} days
                  </span>
                </div>
              </div>
            )}
            {/* Completion bar */}
            <div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${sig.completionRate}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {sig.totalRequired - sig.completed} documents pending
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ArrowRight className="h-4 w-4" />
            Investor Conversion Timing
          </CardTitle>
          <CardDescription>
            Average days between investor lifecycle stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {stages.map((stage, idx, arr) => (
              <div key={stage.label} className="flex items-center gap-2">
                <div className="flex min-w-[100px] flex-col items-center rounded-lg border p-3">
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {stage.count}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stage.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className="flex flex-col items-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    {arr[idx + 1].avgDays !== null && (
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {arr[idx + 1].avgDays}d
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
