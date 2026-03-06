"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  RefreshCcw,
  ChevronDown,
  BarChart3,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import {
  AnalyticsOverview,
  VisitorRow,
  DocumentRow,
  ViewEvent,
  DataroomOption,
  VisitorSourceData,
  TimeRange,
  TabKey,
  TIME_RANGES,
  TABS,
  ENGAGEMENT_CONFIG,
} from "./components/types";
import { AnalyticsKpiCards } from "./components/analytics-kpi-cards";
import { OverviewTab } from "./components/overview-tab";
import { VisitorsTab } from "./components/visitors-tab";
import { DocumentsTab } from "./components/documents-tab";
import { EventsTab } from "./components/events-tab";

export default function DataroomAnalyticsClient() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [datarooms, setDatarooms] = useState<DataroomOption[]>([]);
  const [selectedDataroom, setSelectedDataroom] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [events, setEvents] = useState<ViewEvent[]>([]);
  const [graphData, setGraphData] = useState<{ date: string; views: number }[]>([]);
  const [visitorSources, setVisitorSources] = useState<VisitorSourceData[]>([]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const teamRes = await fetch("/api/admin/team-context");
        if (!teamRes.ok) throw new Error("Failed to load team");
        const teamData = await teamRes.json();
        const tid = teamData.teamId;
        setTeamId(tid);

        const drRes = await fetch(`/api/teams/${tid}/datarooms`);
        if (drRes.ok) {
          const drData = await drRes.json();
          const drs = (drData.datarooms || drData || []).map((dr: { id: string; name: string }) => ({
            id: dr.id,
            name: dr.name,
          }));
          setDatarooms(drs);
          if (drs.length > 0) setSelectedDataroom(drs[0].id);
        }
      } catch {
        setError("Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (!teamId) return;
    if (isRefresh) setRefreshing(true);

    try {
      const params = new URLSearchParams({
        teamId,
        interval: timeRange,
        type: "overview",
      });

      const overviewRes = await fetch(`/api/analytics?${params}`);
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setOverview({
          totalViews: data.totalViews || 0,
          uniqueVisitors: data.uniqueVisitors || 0,
          totalDocuments: data.totalDocuments || 0,
          avgDwellTimeMs: data.avgDwellTimeMs || 0,
          viewsTrend: data.viewsTrend || 0,
        });
        setGraphData(data.graphData || []);
      }

      const visitorsParams = new URLSearchParams({ teamId, interval: timeRange, type: "visitors" });
      const visitorsRes = await fetch(`/api/analytics?${visitorsParams}`);
      if (visitorsRes.ok) {
        const vData = await visitorsRes.json();
        setVisitors(
          (vData.visitors || []).map((v: Record<string, unknown>) => ({
            email: v.email || "",
            viewerName: v.viewerName || null,
            totalViews: v.totalViews || 0,
            lastActive: v.lastActive || "",
            uniqueDocuments: v.uniqueDocuments || 0,
            verified: v.verified || false,
            totalDuration: v.totalDuration || "0s",
            engagementTier: getEngagementTier(v),
          })),
        );
      }

      if (visitors.length > 0) {
        const tierCounts: Record<string, number> = {};
        for (const v of visitors) {
          const tier = v.engagementTier || "NONE";
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        }
        setVisitorSources(
          Object.entries(tierCounts).map(([name, value]) => ({
            name: ENGAGEMENT_CONFIG[name]?.label || name,
            value,
          })),
        );
      }

      const docsParams = new URLSearchParams({ teamId, interval: timeRange, type: "documents" });
      const docsRes = await fetch(`/api/analytics?${docsParams}`);
      if (docsRes.ok) {
        const dData = await docsRes.json();
        setDocuments(
          (dData.documents || []).map((d: Record<string, unknown>) => ({
            id: (d.id as string) || "",
            name: (d.name as string) || "Untitled",
            views: (d.views as number) || 0,
            downloads: (d.downloads as number) || 0,
            totalDuration: (d.totalDuration as string) || "0s",
            lastViewed: (d.lastViewed as string) || null,
            completionRate: (d.completionRate as number) || 0,
          })),
        );
      }

      const viewsParams = new URLSearchParams({ teamId, interval: timeRange, type: "views" });
      const viewsRes = await fetch(`/api/analytics?${viewsParams}`);
      if (viewsRes.ok) {
        const eData = await viewsRes.json();
        setEvents(
          (eData.views || []).map((e: Record<string, unknown>) => ({
            id: (e.id as string) || "",
            viewerEmail: (e.viewerEmail as string) || "",
            documentName: (e.documentName as string) || "",
            linkName: (e.linkName as string) || "",
            viewedAt: (e.viewedAt as string) || "",
            totalDuration: (e.totalDuration as string) || "0s",
            completionRate: (e.completionRate as number) || 0,
          })),
        );
      }
    } catch {
      setError("Failed to load analytics.");
    } finally {
      setRefreshing(false);
    }
  }, [teamId, timeRange]);

  useEffect(() => {
    if (teamId) fetchAnalytics();
  }, [teamId, timeRange, fetchAnalytics]);

  function getEngagementTier(v: Record<string, unknown>): "HOT" | "WARM" | "COOL" | "NONE" {
    const views = (v.totalViews as number) || 0;
    const docs = (v.uniqueDocuments as number) || 0;
    const score = views * 1 + docs * 2;
    if (score >= 10) return "HOT";
    if (score >= 4) return "WARM";
    if (score >= 1) return "COOL";
    return "NONE";
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="flex gap-2">
              <div className="h-9 bg-muted rounded w-24" />
              <div className="h-9 bg-muted rounded w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <Button onClick={() => { setError(null); fetchAnalytics(); }}>
          Try Again
        </Button>
      </div>
    );
  }

  if (datarooms.length === 0 && !overview) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <BarChart3 className="h-7 w-7 text-gray-400" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-medium text-white mb-1">No analytics data yet</h3>
        <p className="text-sm text-gray-400 max-w-md mb-6">
          Create a dataroom and share it with investors to start seeing engagement analytics here.
        </p>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link href="/datarooms">Create Dataroom</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dataroom Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Viewer engagement, document activity, and visitor insights
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {datarooms.length > 1 && (
            <div className="relative">
              <select
                value={selectedDataroom || ""}
                onChange={(e) => setSelectedDataroom(e.target.value)}
                className="appearance-none h-8 pl-3 pr-8 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-[#0066FF]"
              >
                <option value="">All Datarooms</option>
                {datarooms.map((dr) => (
                  <option key={dr.id} value={dr.id}>{dr.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          )}

          <div className="flex border rounded-md overflow-hidden">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === tr.value
                    ? "bg-[#0066FF] text-white"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted"
                }`}
              >
                {tr.label}
              </button>
            ))}
            <button
              onClick={() => setTimeRange("custom")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                timeRange === "custom"
                  ? "bg-[#0066FF] text-white"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Calendar className="h-3 w-3" />
              Custom
            </button>
          </div>

          {timeRange === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 px-2 text-xs border rounded-md bg-background"
                aria-label="Start date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 px-2 text-xs border rounded-md bg-background"
                aria-label="End date"
              />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <AnalyticsKpiCards overview={overview} />

      {/* Tab Bar */}
      <div className="flex border-b mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "text-[#0066FF] border-[#0066FF]"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
            {tab.key === "visitors" && visitors.length > 0 && (
              <span className="ml-1.5 text-xs font-mono text-muted-foreground">
                ({visitors.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          graphData={graphData}
          documents={documents}
          visitors={visitors}
          visitorSources={visitorSources}
          onSwitchTab={setActiveTab}
        />
      )}

      {activeTab === "visitors" && (
        <VisitorsTab visitors={visitors} />
      )}

      {activeTab === "documents" && (
        <DocumentsTab
          documents={documents}
          events={events}
          selectedDocId={selectedDocId}
          onSelectDoc={setSelectedDocId}
        />
      )}

      {activeTab === "events" && (
        <EventsTab events={events} />
      )}
    </div>
  );
}
