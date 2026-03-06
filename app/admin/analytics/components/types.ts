import { Flame, Thermometer, Snowflake } from "lucide-react";

export interface AnalyticsOverview {
  totalViews: number;
  uniqueVisitors: number;
  totalDocuments: number;
  avgDwellTimeMs: number;
  viewsTrend: number; // % change vs previous period
}

export interface VisitorRow {
  email: string;
  viewerName: string | null;
  totalViews: number;
  lastActive: string;
  uniqueDocuments: number;
  verified: boolean;
  totalDuration: string;
  engagementTier: "HOT" | "WARM" | "COOL" | "NONE";
}

export interface DocumentRow {
  id: string;
  name: string;
  views: number;
  downloads: number;
  totalDuration: string;
  lastViewed: string | null;
  completionRate: number;
}

export interface VisitorSourceData {
  name: string;
  value: number;
}

export interface ViewEvent {
  id: string;
  viewerEmail: string;
  documentName: string;
  linkName: string;
  viewedAt: string;
  totalDuration: string;
  completionRate: number;
}

export interface DataroomOption {
  id: string;
  name: string;
}

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "custom";
export type TabKey = "overview" | "visitors" | "documents" | "events";

export const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export const PIE_COLORS = ["#0066FF", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

export const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "visitors", label: "Visitors" },
  { key: "documents", label: "Documents" },
  { key: "events", label: "Events" },
];

export const ENGAGEMENT_CONFIG: Record<string, { label: string; icon: typeof Flame; className: string }> = {
  HOT: { label: "Hot", icon: Flame, className: "text-red-600 bg-red-50 dark:bg-red-950/40" },
  WARM: { label: "Warm", icon: Thermometer, className: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  COOL: { label: "Cool", icon: Snowflake, className: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
  NONE: { label: "-", icon: Snowflake, className: "text-muted-foreground bg-muted" },
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return "0s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
