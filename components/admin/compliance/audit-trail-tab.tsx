"use client";

import { useState } from "react";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Download,
  Loader2,
  Link2,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface AuditChainIntegrity {
  isValid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  errors: string[];
}

interface AuditExportMeta {
  dateRange: {
    from: string;
    to: string;
  };
  totalRecords: number;
  checksum: string;
}

interface AuditTrailTabProps {
  chainIntegrity: AuditChainIntegrity | null;
  auditExport: AuditExportMeta | null;
  auditEventsLast30Days: number;
  auditRetentionDays: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AuditTrailTab({
  chainIntegrity,
  auditExport,
  auditEventsLast30Days,
  auditRetentionDays,
}: AuditTrailTabProps) {
  const [exporting, setExporting] = useState(false);

  const retentionYears = Math.round(auditRetentionDays / 365);
  const chainValid = chainIntegrity?.isValid ?? false;
  const chainEntries = chainIntegrity?.totalEntries ?? 0;
  const chainVerified = chainIntegrity?.verifiedEntries ?? 0;
  const chainErrors = chainIntegrity?.errors ?? [];

  const handleExportCompliancePackage = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/compliance-package");
      if (!res.ok) {
        toast.error("Failed to export compliance package");
        return;
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-package-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Compliance package exported");
    } catch {
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Chain Integrity Status */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                chainValid
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              {chainValid ? (
                <Shield className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                SHA-256 Hash Chain Integrity
              </h3>
              <p className="text-xs text-muted-foreground">
                {chainValid
                  ? "Immutable audit chain verified — no tampering detected"
                  : chainEntries === 0
                    ? "No audit entries to verify"
                    : "Chain integrity check failed — review errors below"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chainValid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                <CheckCircle className="h-3 w-3" />
                Verified
              </span>
            ) : chainEntries > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <XCircle className="h-3 w-3" />
                Failed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                No Data
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chain Errors */}
      {chainErrors.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {chainErrors.length} integrity error(s) detected
            </p>
            <ul className="mt-1 space-y-0.5">
              {chainErrors.slice(0, 5).map((err, i) => (
                <li
                  key={i}
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {err}
                </li>
              ))}
              {chainErrors.length > 5 && (
                <li className="text-xs text-red-600 dark:text-red-400">
                  ...and {chainErrors.length - 5} more
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Link2 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Chain Entries</p>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {chainEntries.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
            {chainVerified.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Events (30d)</p>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {auditEventsLast30Days.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Retention</p>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {retentionYears} yr{retentionYears !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Export Checksum */}
      {auditExport && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Last Export Verification
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
            <div>
              <p className="text-muted-foreground">Date Range</p>
              <p className="font-medium font-mono tabular-nums">
                {formatDate(auditExport.dateRange.from)} –{" "}
                {formatDate(auditExport.dateRange.to)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Records</p>
              <p className="font-medium font-mono tabular-nums">
                {auditExport.totalRecords.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">SHA-256 Checksum</p>
              <p
                className="font-mono text-xs text-muted-foreground truncate"
                title={auditExport.checksum}
              >
                {auditExport.checksum}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Package Export */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">
              SEC Compliance Package Export
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Download a comprehensive JSON package including organization
              certification, Form D data, investor accreditation report,
              representations, signature audit, and immutable audit log with
              hash chain verification.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0 ml-4"
            onClick={handleExportCompliancePackage}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export Package
          </Button>
        </div>
      </div>

      {/* SEC Compliance Note */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              SEC 506(c) Compliance
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              All audit entries are cryptographically hash-chained using SHA-256
              for tamper-evident logging. This immutable audit trail satisfies
              SEC recordkeeping requirements under Rule 204-2 of the Investment
              Advisers Act and supports Regulation D 506(c) verification
              obligations.
            </p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {chainEntries === 0 && auditEventsLast30Days === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No audit trail data available. Events will be recorded as platform
            activity occurs.
          </p>
        </div>
      )}
    </div>
  );
}
