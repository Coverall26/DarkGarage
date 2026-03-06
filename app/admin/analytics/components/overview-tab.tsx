"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  DocumentRow,
  VisitorRow,
  VisitorSourceData,
  PIE_COLORS,
  ENGAGEMENT_CONFIG,
  TabKey,
} from "./types";

interface OverviewTabProps {
  graphData: { date: string; views: number }[];
  documents: DocumentRow[];
  visitors: VisitorRow[];
  visitorSources: VisitorSourceData[];
  onSwitchTab: (tab: TabKey) => void;
}

export function OverviewTab({
  graphData,
  documents,
  visitors,
  visitorSources,
  onSwitchTab,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Views Over Time */}
      <Card className="shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Views Over Time</h3>
            <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {graphData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0066FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "#0A1628",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                    labelFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                    formatter={(value) => [`${value} views`, "Views"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#0066FF"
                    strokeWidth={2}
                    fill="url(#viewsGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#0066FF", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              No view data for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Documents + Engagement Breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopDocumentsCard documents={documents} onSwitchTab={onSwitchTab} />
        <EngagementBreakdownCard
          visitors={visitors}
          visitorSources={visitorSources}
          onSwitchTab={onSwitchTab}
        />
      </div>
    </div>
  );
}

function TopDocumentsCard({
  documents,
  onSwitchTab,
}: {
  documents: DocumentRow[];
  onSwitchTab: (tab: TabKey) => void;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Top Documents</h3>
          <button
            onClick={() => onSwitchTab("documents")}
            className="text-xs text-[#0066FF] hover:underline"
          >
            View All
          </button>
        </div>
        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.slice(0, 5).map((doc, idx) => {
              const maxViews = Math.max(...documents.slice(0, 5).map((d) => d.views), 1);
              const barWidth = (doc.views / maxViews) * 100;
              return (
                <div key={doc.id} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium truncate max-w-[200px]">
                      <span className="text-muted-foreground mr-1.5 font-mono">{idx + 1}.</span>
                      {doc.name}
                    </p>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {doc.views} views
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0066FF]/60 rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-6 text-center">No document views yet</p>
        )}
      </CardContent>
    </Card>
  );
}

function EngagementBreakdownCard({
  visitors,
  visitorSources,
  onSwitchTab,
}: {
  visitors: VisitorRow[];
  visitorSources: VisitorSourceData[];
  onSwitchTab: (tab: TabKey) => void;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Engagement Breakdown</h3>
          <button
            onClick={() => onSwitchTab("visitors")}
            className="text-xs text-[#0066FF] hover:underline"
          >
            View All
          </button>
        </div>
        {visitors.length > 0 ? (
          <>
            {visitorSources.length > 0 && (
              <div className="h-44 w-full mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={visitorSources}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {visitorSources.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px" }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "#0A1628",
                        border: "none",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(value, name) => [`${value} visitors`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-2">
              {visitors.slice(0, 4).map((visitor) => {
                const tierColor =
                  visitor.engagementTier === "HOT" ? "bg-red-500" :
                  visitor.engagementTier === "WARM" ? "bg-amber-500" :
                  "bg-blue-400";
                return (
                  <div key={visitor.email} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${tierColor}`} />
                      <span className="text-xs truncate max-w-[180px]">
                        {visitor.viewerName || visitor.email}
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground flex-shrink-0 ml-2">
                      {visitor.totalViews} views
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground py-6 text-center">No visitor data yet</p>
        )}
      </CardContent>
    </Card>
  );
}
