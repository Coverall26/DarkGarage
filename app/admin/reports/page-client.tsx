"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Download, Loader2, Clock } from "lucide-react";
import { type FundReport, type OperationalReport } from "./components/types";
import { RaiseSummaryTab } from "./components/raise-summary-tab";
import { OperationsTab } from "./components/operations-tab";

export default function ReportsClient() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<FundReport | null>(null);
  const [opsReport, setOpsReport] = useState<OperationalReport | null>(null);
  const [selectedFundId, setSelectedFundId] = useState<string>("");
  const [funds, setFunds] = useState<Array<{ id: string; name: string }>>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"raise" | "operations">("raise");

  const fetchFunds = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fund/list");
      if (res.ok) {
        const data = await res.json();
        setFunds(data.funds || []);
        if (data.funds?.length > 0 && !selectedFundId) {
          setSelectedFundId(data.funds[0].id);
        }
      }
    } catch {
      // Silently handle
    }
  }, [selectedFundId]);

  const fetchReport = useCallback(async () => {
    if (!selectedFundId) return;
    setLoading(true);
    try {
      const [summaryRes, opsRes] = await Promise.all([
        fetch(`/api/admin/reports?fundId=${selectedFundId}`),
        fetch(`/api/admin/reports/operational?fundId=${selectedFundId}`),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setReport(data.report);
      }
      if (opsRes.ok) {
        const data = await opsRes.json();
        setOpsReport(data);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [selectedFundId]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  useEffect(() => {
    if (selectedFundId) {
      fetchReport();
    }
  }, [selectedFundId, fetchReport]);

  const handleExport = async (format: "csv" | "pdf") => {
    setExportLoading(true);
    try {
      const res = await fetch(
        `/api/admin/reports/export?fundId=${selectedFundId}&format=${format}`,
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fund-report-${selectedFundId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silently handle
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Raise summary, operations, and investor activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedFundId} onValueChange={setSelectedFundId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select a fund" />
            </SelectTrigger>
            <SelectContent>
              {funds.map((fund) => (
                <SelectItem key={fund.id} value={fund.id}>
                  {fund.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exportLoading || !report}
          >
            {exportLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        <button
          onClick={() => setActiveTab("raise")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "raise"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="mr-2 inline-block h-4 w-4" />
          Raise Summary
        </button>
        <button
          onClick={() => setActiveTab("operations")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "operations"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="mr-2 inline-block h-4 w-4" />
          Operations
          {opsReport && (opsReport.sla.wireConfirmation.overdue > 0 || opsReport.sla.documentReview.overdue > 0) && (
            <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
              {opsReport.sla.wireConfirmation.overdue + opsReport.sla.documentReview.overdue}
            </Badge>
          )}
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-10 bg-muted rounded w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      ) : !report ? (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Select a fund to view reports
            </p>
            <p className="text-xs text-muted-foreground/60">
              Choose a fund from the dropdown above to see metrics and analytics
            </p>
          </CardContent>
        </Card>
      ) : activeTab === "raise" ? (
        <RaiseSummaryTab report={report} />
      ) : opsReport ? (
        <OperationsTab report={opsReport} />
      ) : (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Operational data not available
            </p>
            <p className="text-xs text-muted-foreground/60">
              Wire reconciliation, document SLAs, and operational metrics will appear once activity begins
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
