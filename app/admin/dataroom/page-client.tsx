"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderArchive,
  Upload,
  RefreshCw,
  Search,
  FileText,
  Users,
  Activity,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDistanceToNow } from "date-fns";
import { StorageMeter } from "./components/storage-meter";
import { FolderTree } from "./components/folder-tree";
import { FileList } from "./components/file-list";
import { ContactVaults } from "./components/contact-vaults";
import { UploadDialog } from "./components/upload-dialog";
import type {
  FiledDocument,
  FilingActivity,
  DataRoomTab,
} from "./components/dataroom-types";
import { SOURCE_TYPE_LABELS } from "./components/dataroom-types";

// ---------------------------------------------------------------------------
// DataRoom — Document vault management dashboard
// ---------------------------------------------------------------------------

export default function DataRoomPageClient() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DataRoomTab>("files");
  const [filings, setFilings] = useState<FiledDocument[]>([]);
  const [activities, setActivities] = useState<FilingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Fetch team context
  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await fetch("/api/admin/team-context");
        if (res.ok) {
          const data = await res.json();
          setTeamId(data.teamId);
        }
      } catch {
        // silent
      }
    }
    fetchTeam();
  }, []);

  // Fetch filings
  const fetchFilings = useCallback(async () => {
    if (!teamId) return;
    try {
      const res = await fetch(
        `/api/esign/filings?pageSize=500`,
      );
      if (res.ok) {
        const data = await res.json();
        setFilings(data.filings ?? []);
      }
    } catch {
      // silent
    }
  }, [teamId]);

  // Fetch activity log
  const fetchActivity = useCallback(async () => {
    if (!teamId) return;
    try {
      const res = await fetch(`/api/dataroom/activity?teamId=${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities ?? []);
      }
    } catch {
      // silent
    }
  }, [teamId]);

  // Initial load
  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    Promise.all([fetchFilings(), fetchActivity()]).finally(() =>
      setLoading(false),
    );
  }, [teamId, fetchFilings, fetchActivity]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFilings(), fetchActivity()]);
    setRefreshing(false);
  };

  // Search filter
  const filteredFilings = search.trim()
    ? filings.filter((f) => {
        const q = search.toLowerCase();
        return (
          (f.filedFileName ?? "").toLowerCase().includes(q) ||
          (f.sourceType && f.sourceType.toLowerCase().includes(q)) ||
          (f.envelope?.title ?? "").toLowerCase().includes(q)
        );
      })
    : filings;

  const TABS: { key: DataRoomTab; label: string; icon: typeof FileText }[] = [
    { key: "files", label: "Filed Documents", icon: FileText },
    { key: "vaults", label: "Contact Vaults", icon: Users },
    { key: "activity", label: "Activity Log", icon: Activity },
  ];

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loading && !teamId) {
    return (
      <div className="space-y-6 p-4 sm:p-6" aria-busy="true" aria-label="Loading DataRoom">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-muted rounded animate-pulse" />
              <div className="h-7 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-muted rounded animate-pulse" />
            <div className="h-10 w-24 bg-muted rounded animate-pulse" />
          </div>
        </div>
        {/* Storage meter skeleton */}
        <div className="h-14 bg-muted rounded-lg animate-pulse" />
        {/* Tabs skeleton */}
        <div className="flex gap-1 border-b border-border pb-px">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
        {/* File list skeleton with sidebar */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="hidden md:block w-56 flex-shrink-0 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-10 max-w-sm bg-muted rounded animate-pulse" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg animate-pulse">
                <div className="h-10 w-10 bg-muted rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
                <div className="h-5 w-16 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderArchive className="h-6 w-6 text-blue-600" />
            DataRoom
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-filed documents, contact vaults & audit trail
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {teamId && (
            <Button
              size="sm"
              className="min-h-[44px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              onClick={() => setShowUpload(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
          )}
        </div>
      </div>

      {/* Storage meter */}
      {teamId && <StorageMeter teamId={teamId} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-2 sm:px-4 py-2.5 min-h-[44px] text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.key === "files" && filings.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-xs px-1.5 py-0"
                >
                  {filings.length}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "files" && (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Folder tree sidebar */}
          {filings.length > 0 && (
            <div className="hidden md:block w-56 flex-shrink-0">
              <FolderTree
                filings={filteredFilings}
                selectedPath={selectedPath}
                onSelectPath={setSelectedPath}
              />
            </div>
          )}

          {/* File list + search */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Search */}
            {filings.length > 0 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-9 pr-3 py-2 text-base sm:text-sm border border-border rounded-md bg-background"
                />
              </div>
            )}

            <FileList
              filings={filteredFilings}
              loading={loading}
              selectedPath={selectedPath}
            />
          </div>
        </div>
      )}

      {activeTab === "vaults" && teamId && (
        <ContactVaults teamId={teamId} />
      )}

      {activeTab === "activity" && (
        <ActivityLog activities={activities} loading={loading} />
      )}

      {/* Upload dialog */}
      {showUpload && teamId && (
        <UploadDialog
          teamId={teamId}
          onClose={() => setShowUpload(false)}
          onUploaded={handleRefresh}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Log sub-component
// ---------------------------------------------------------------------------

function ActivityLog({
  activities,
  loading,
}: {
  activities: FilingActivity[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No filing activity yet"
        description="Activity appears when documents are auto-filed from SignSuite or uploaded manually."
        accentColor="#2563EB"
      />
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
        >
          <div className="flex-shrink-0 rounded-md bg-muted p-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">
              <span className="font-medium">{a.fileName}</span>
              {" filed to "}
              <span className="font-medium">
                {a.destinationType === "ORG_VAULT"
                  ? "Org Vault"
                  : a.destinationType === "CONTACT_VAULT"
                    ? "Contact Vault"
                    : "Email"}
              </span>
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {SOURCE_TYPE_LABELS[a.sourceType] || a.sourceType}
              </Badge>
              {a.filedByEmail && (
                <span className="text-xs text-muted-foreground">
                  by {a.filedByEmail}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
