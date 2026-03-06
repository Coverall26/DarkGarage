"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  DollarSign,
  Loader2,
  RefreshCcw,
  TrendingUp,
  Users,
} from "lucide-react";

interface FundMetrics {
  fund: {
    id: string;
    name: string;
    targetSize: string;
    waterfallType: string | null;
    termYears: number | null;
  };
  current: {
    grossAum: string;
    netAum: string;
    nav: string;
    totalCommitted: string;
    totalFunded: string;
    totalDistributed: string;
    investorCount: number;
    fundAgeYears: number;
  };
  performance: {
    irr: number;
    tvpi: number;
    dpi: number;
    rvpi: number;
    moic: number;
  };
  deductions: {
    managementFees: number;
    performanceFees: number;
    orgFees: number;
    expenses: number;
    total: number;
  };
  rates: {
    managementFeePct: number;
    carryPct: number;
    orgFeePct: number;
    expenseRatioPct: number;
  };
  ratios: {
    fundedRatio: number;
    distributedRatio: number;
    expenseRatio: number;
  };
}

interface FundMetricsCardProps {
  fundId: string;
  teamId: string;
}

export function FundMetricsCard({ fundId, teamId }: FundMetricsCardProps) {
  const [metrics, setMetrics] = useState<FundMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchMetrics() {
    try {
      setError(null);
      const res = await fetch(
        `/api/teams/${teamId}/funds/${fundId}/metrics`,
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setMetrics(data);
    } catch {
      setError("Failed to load fund metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundId, teamId]);

  const formatCurrency = (v: string | number) => {
    const num = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(num)) return "$0";
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  };

  const formatPercent = (v: number) => {
    return `${(v * 100).toFixed(1)}%`;
  };

  const formatMultiple = (v: number) => {
    return `${v.toFixed(2)}x`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm" role="alert">
            {error || "No metrics available"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            className="mt-3"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { current, performance, rates } = metrics;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Fund Performance</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchMetrics();
          }}
          aria-label="Refresh metrics"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="IRR"
          value={formatPercent(performance.irr)}
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          color="blue"
        />
        <MetricCard
          label="TVPI"
          value={formatMultiple(performance.tvpi)}
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
          color="emerald"
        />
        <MetricCard
          label="DPI"
          value={formatMultiple(performance.dpi)}
          icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
          color="purple"
        />
        <MetricCard
          label="RVPI"
          value={formatMultiple(performance.rvpi)}
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
          color="amber"
        />
        <MetricCard
          label="MOIC"
          value={formatMultiple(performance.moic)}
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          color="blue"
        />
      </div>

      {/* Fund Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Net AUM</p>
            <p className="text-lg font-bold font-mono tabular-nums">
              {formatCurrency(current.netAum)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">NAV</p>
            <p className="text-lg font-bold font-mono tabular-nums">
              {formatCurrency(current.nav)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Total Distributed</p>
            <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(current.totalDistributed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">Investors</p>
            </div>
            <p className="text-lg font-bold font-mono tabular-nums">
              {current.investorCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Capital Flow Summary */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Capital Flow Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <FlowRow
            label="Total Committed"
            value={formatCurrency(current.totalCommitted)}
          />
          <FlowRow
            label="Total Funded"
            value={formatCurrency(current.totalFunded)}
            color="blue"
          />
          <FlowRow
            label="Total Distributed"
            value={formatCurrency(current.totalDistributed)}
            color="emerald"
          />
          <div className="border-t pt-2">
            <FlowRow
              label="Gross AUM"
              value={formatCurrency(current.grossAum)}
            />
          </div>
          {rates.managementFeePct > 0 && (
            <FlowRow
              label={`Mgmt Fee (${(rates.managementFeePct * 100).toFixed(1)}%)`}
              value={formatCurrency(metrics.deductions.managementFees)}
              color="gray"
            />
          )}
          {rates.carryPct > 0 && (
            <FlowRow
              label={`Carry (${(rates.carryPct * 100).toFixed(0)}%)`}
              value={formatCurrency(metrics.deductions.performanceFees)}
              color="gray"
            />
          )}
          <div className="border-t pt-2">
            <FlowRow
              label="Net AUM"
              value={formatCurrency(current.netAum)}
              bold
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "purple" | "amber";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  };

  return (
    <Card>
      <CardContent className="pt-3 pb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <div className={`h-5 w-5 rounded flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
        <p className="text-lg font-bold font-mono tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function FlowRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color?: "blue" | "emerald" | "gray";
  bold?: boolean;
}) {
  const colorClass = color === "blue"
    ? "text-blue-600 dark:text-blue-400"
    : color === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : color === "gray"
        ? "text-muted-foreground"
        : "";

  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className={`font-mono tabular-nums text-sm ${bold ? "font-semibold" : ""} ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}
