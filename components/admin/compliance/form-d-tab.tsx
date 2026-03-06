"use client";

import { useState } from "react";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface FormDEntry {
  fundId: string;
  fundName: string;
  fundStatus: string;
  entityMode: string;
  regulationDExemption: string | null;
  investmentCompanyExemption: string | null;
  formDFilingDate: string | null;
  formDAmendmentDue: string | null;
  formDReminderSent: boolean;
  filingDeadline: string;
  filingStatus: "not_filed" | "filed" | "amendment_due" | "overdue";
  targetRaise: number | null;
  minimumInvestment: number | null;
}

interface FormDTabProps {
  formDTimeline: FormDEntry[];
  teamId: string;
}

const REG_D_LABELS: Record<string, string> = {
  "506B": "Rule 506(b)",
  "506C": "Rule 506(c)",
  REG_A_PLUS: "Regulation A+",
  RULE_504: "Rule 504",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  filed: {
    label: "Filed",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
    icon: CheckCircle,
  },
  not_filed: {
    label: "Not Filed",
    color: "text-muted-foreground bg-muted",
    icon: Clock,
  },
  amendment_due: {
    label: "Amendment Due",
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    icon: AlertTriangle,
  },
  overdue: {
    label: "Overdue",
    color: "text-red-600 bg-red-50 dark:bg-red-900/20",
    icon: AlertTriangle,
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FormDTab({ formDTimeline, teamId }: FormDTabProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const overdueFunds = formDTimeline.filter(
    (f) => f.filingStatus === "overdue",
  );
  const amendmentDueFunds = formDTimeline.filter(
    (f) => f.filingStatus === "amendment_due",
  );

  const handleExportFormD = async (fundId: string, format: "json" | "csv") => {
    setExporting(fundId);
    try {
      const res = await fetch(
        `/api/admin/reports/form-d?fundId=${fundId}&format=${format}`,
      );
      if (!res.ok) {
        toast.error("Failed to export Form D data");
        return;
      }
      if (format === "csv") {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `form-d-${fundId}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Form D data exported");
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `form-d-${fundId}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Form D data exported");
      }
    } catch {
      toast.error("Failed to export");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(overdueFunds.length > 0 || amendmentDueFunds.length > 0) && (
        <div className="space-y-2">
          {overdueFunds.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {overdueFunds.length} fund(s) overdue for Form D filing
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  SEC requires Form D filing within 15 days of the first sale of
                  securities.
                </p>
              </div>
            </div>
          )}
          {amendmentDueFunds.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {amendmentDueFunds.length} fund(s) need Form D amendment
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Annual amendments are required to keep the filing current.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fund Form D Cards */}
      <div className="space-y-4">
        {formDTimeline.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No funds to display. Create a fund to begin Form D tracking.
            </p>
          </div>
        ) : (
          formDTimeline.map((fund) => {
            const statusCfg = STATUS_CONFIG[fund.filingStatus];
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={fund.fundId}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h4 className="text-sm font-semibold">{fund.fundName}</h4>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleExportFormD(fund.fundId, "csv")}
                      disabled={exporting === fund.fundId}
                    >
                      {exporting === fund.fundId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleExportFormD(fund.fundId, "json")}
                      disabled={exporting === fund.fundId}
                    >
                      {exporting === fund.fundId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3 w-3" />
                      )}
                      JSON
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Exemption</p>
                    <p className="font-medium">
                      {fund.regulationDExemption
                        ? REG_D_LABELS[fund.regulationDExemption] ||
                          fund.regulationDExemption
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Filing Deadline</p>
                    <p className="font-medium font-mono tabular-nums">
                      {formatDate(fund.filingDeadline)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Filed On</p>
                    <p className="font-medium font-mono tabular-nums">
                      {fund.formDFilingDate
                        ? formatDate(fund.formDFilingDate)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Amendment Due</p>
                    <p className="font-medium font-mono tabular-nums">
                      {fund.formDAmendmentDue
                        ? formatDate(fund.formDAmendmentDue)
                        : "—"}
                    </p>
                  </div>
                </div>

                {(fund.targetRaise || fund.minimumInvestment || fund.investmentCompanyExemption) && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs border-t pt-3">
                    {fund.targetRaise && (
                      <div>
                        <p className="text-muted-foreground">Target Raise</p>
                        <p className="font-medium font-mono tabular-nums">
                          {formatCurrency(fund.targetRaise)}
                        </p>
                      </div>
                    )}
                    {fund.minimumInvestment && (
                      <div>
                        <p className="text-muted-foreground">Min Investment</p>
                        <p className="font-medium font-mono tabular-nums">
                          {formatCurrency(fund.minimumInvestment)}
                        </p>
                      </div>
                    )}
                    {fund.investmentCompanyExemption && (
                      <div>
                        <p className="text-muted-foreground">
                          Investment Co. Exemption
                        </p>
                        <p className="font-medium">
                          {fund.investmentCompanyExemption === "3C1"
                            ? "Section 3(c)(1)"
                            : fund.investmentCompanyExemption === "3C7"
                              ? "Section 3(c)(7)"
                              : fund.investmentCompanyExemption}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
