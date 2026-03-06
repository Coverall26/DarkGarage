"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Eye,
  Users,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { AnalyticsOverview, formatDuration } from "./types";

interface AnalyticsKpiCardsProps {
  overview: AnalyticsOverview | null;
}

export function AnalyticsKpiCards({ overview }: AnalyticsKpiCardsProps) {
  const trendPositive = (overview?.viewsTrend || 0) >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="border-l-4 border-l-[#0066FF]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="h-4 w-4 text-[#0066FF]" />
            <span className="text-xs text-muted-foreground">Total Views</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold font-mono tabular-nums">{overview?.totalViews || 0}</p>
            {overview && overview.viewsTrend !== 0 && (
              <span className={`flex items-center text-xs font-medium mb-0.5 ${trendPositive ? "text-emerald-600" : "text-red-600"}`}>
                {trendPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(overview.viewsTrend)}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Unique Visitors</span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">{overview?.uniqueVisitors || 0}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-[#10B981]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-[#10B981]" />
            <span className="text-xs text-muted-foreground">Docs Viewed</span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">{overview?.totalDocuments || 0}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-[#F59E0B]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-[#F59E0B]" />
            <span className="text-xs text-muted-foreground">Avg. Dwell Time</span>
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {formatDuration(overview?.avgDwellTimeMs || 0)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
