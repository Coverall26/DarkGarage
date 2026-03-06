import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  PieChart,
  Target,
} from "lucide-react";
import { StatCard } from "./stat-card";
import { type FundReport, formatCurrency, formatPercent } from "./types";

const PIPELINE_STAGES = [
  { label: "Applied", key: "applied" as const, color: "bg-blue-500" },
  { label: "Under Review", key: "underReview" as const, color: "bg-amber-500" },
  { label: "Approved", key: "approved" as const, color: "bg-emerald-500" },
  { label: "Committed", key: "committed" as const, color: "bg-purple-500" },
  { label: "Funded", key: "funded" as const, color: "bg-green-600" },
  { label: "Rejected", key: "rejected" as const, color: "bg-red-500" },
];

const FUNNEL_STEPS = [
  { label: "Dataroom Views", key: "dataroomViews" as const },
  { label: "Emails Captured", key: "emailsCaptured" as const },
  { label: "Onboarding Started", key: "onboardingStarted" as const },
  { label: "NDA Signed", key: "ndaSigned" as const },
  { label: "Committed", key: "committed" as const },
  { label: "Funded", key: "funded" as const },
];

export function RaiseSummaryTab({ report }: { report: FundReport }) {
  const progressPercent =
    (report.totalCommitted / (report.targetRaise || 1)) * 100;
  const fundedPercent =
    (report.totalFunded / (report.targetRaise || 1)) * 100;

  const funnelCounts = FUNNEL_STEPS.map((step) => ({
    label: step.label,
    count: report.conversionFunnel[step.key],
  }));

  return (
    <>
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Target Raise"
          value={formatCurrency(report.targetRaise)}
          icon={Target}
        />
        <StatCard
          title="Total Committed"
          value={formatCurrency(report.totalCommitted)}
          subtitle={`${formatPercent(report.totalCommitted, report.targetRaise)} of target`}
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          title="Total Funded"
          value={formatCurrency(report.totalFunded)}
          subtitle={`${formatPercent(report.totalFunded, report.targetRaise)} of target`}
          icon={DollarSign}
          accent="purple"
        />
        <StatCard
          title="Total Investors"
          value={report.investorCount}
          subtitle={`${report.stages.funded} funded`}
          icon={Users}
        />
      </div>

      {/* Raise Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Raise Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-6 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-blue-300 transition-all duration-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${Math.min(fundedPercent, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              Committed: {formatCurrency(report.totalCommitted)} (
              <span className="font-mono tabular-nums">
                {progressPercent.toFixed(1)}%
              </span>
              )
            </span>
            <span>
              Funded: {formatCurrency(report.totalFunded)} (
              <span className="font-mono tabular-nums">
                {fundedPercent.toFixed(1)}%
              </span>
              )
            </span>
            <span>Target: {formatCurrency(report.targetRaise)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline & Conversion Funnel */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <PieChart className="h-4 w-4" />
              Pipeline Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.label} className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${stage.color}`} />
                <span className="flex-1 text-sm">{stage.label}</span>
                <Badge variant="secondary" className="font-mono">
                  {report.stages[stage.key]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>
              From dataroom view to funded investor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnelCounts.map((step, idx, arr) => {
              const prevCount = idx > 0 ? arr[idx - 1].count : step.count;
              const convRate =
                prevCount > 0
                  ? ((step.count / prevCount) * 100).toFixed(0)
                  : "\u2014";
              const barWidth =
                arr[0].count > 0 ? (step.count / arr[0].count) * 100 : 0;
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{step.label}</span>
                    <span className="font-medium">
                      <span className="font-mono tabular-nums">{step.count}</span>
                      {idx > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({convRate}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
