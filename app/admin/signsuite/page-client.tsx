"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, RefreshCw, Calendar, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignSuiteUsageMeter } from "./components/usage-meter";
import { EnvelopeList } from "./components/envelope-list";
import { TemplateList } from "./components/template-list";
import { EnvelopeDetail } from "./components/envelope-detail";
import { FieldPlacement } from "./components/field-placement";
import { BatchDashboard } from "./components/batch-dashboard";
import { TABS } from "./components/signsuite-types";
import type { Envelope, TabKey } from "./components/signsuite-types";

// ---------------------------------------------------------------------------
// View state
// ---------------------------------------------------------------------------

type View =
  | { kind: "list" }
  | { kind: "detail"; envelopeId: string }
  | { kind: "fieldPlacement"; envelopeId: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignSuitePageClient() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Envelope data
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // -------------------------------------------------------------------------
  // Fetch envelopes
  // -------------------------------------------------------------------------

  const statusFilter = useCallback(() => {
    switch (tab) {
      case "all":
        return "";
      case "active":
        return "SENT,VIEWED,PARTIALLY_SIGNED";
      case "completed":
        return "COMPLETED";
      case "drafts":
        return "DRAFT";
      default:
        return "";
    }
  }, [tab]);

  const fetchEnvelopes = useCallback(async () => {
    if (tab === "templates" || tab === "batches") return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const sf = statusFilter();
      if (sf) params.set("status", sf);
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      params.set("limit", "50");

      const res = await fetch(`/api/esign/envelopes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEnvelopes(data.envelopes ?? data ?? []);
      }
    } catch {
      // handled silently — list shows empty
    } finally {
      setLoading(false);
    }
  }, [tab, search, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    if (tab !== "templates" && tab !== "batches") fetchEnvelopes();
  }, [tab, fetchEnvelopes, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  // -------------------------------------------------------------------------
  // Envelope actions
  // -------------------------------------------------------------------------

  const handleEnvelopeAction = async (
    envelopeId: string,
    action: "send" | "remind" | "void" | "delete",
  ) => {
    let url = `/api/esign/envelopes/${envelopeId}`;
    let method = "POST";

    switch (action) {
      case "send":
        url += "/send";
        break;
      case "remind":
        url += "/remind";
        break;
      case "void":
        url += "/void";
        break;
      case "delete":
        method = "DELETE";
        break;
    }

    const res = await fetch(url, { method });
    if (res.ok) refresh();
  };

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------

  const goToDetail = (id: string) => setView({ kind: "detail", envelopeId: id });
  const goToFieldPlacement = (id: string) =>
    setView({ kind: "fieldPlacement", envelopeId: id });
  const goToList = () => setView({ kind: "list" });

  // -------------------------------------------------------------------------
  // Render – non-list views
  // -------------------------------------------------------------------------

  if (view.kind === "detail") {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <EnvelopeDetail
          envelopeId={view.envelopeId}
          onBack={goToList}
          onRefresh={refresh}
        />
      </div>
    );
  }

  if (view.kind === "fieldPlacement") {
    return (
      <div className="p-4 sm:p-6">
        <FieldPlacement
          envelopeId={view.envelopeId}
          onBack={() => goToDetail(view.envelopeId)}
          onSaved={() => goToDetail(view.envelopeId)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render – loading skeleton
  // -------------------------------------------------------------------------

  if (loading && envelopes.length === 0 && view.kind === "list") {
    return (
      <div className="p-4 sm:p-6 space-y-6" aria-busy="true" aria-label="Loading SignSuite">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-7 w-36 bg-muted rounded animate-pulse" />
            <div className="h-4 w-56 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-muted rounded animate-pulse" />
        </div>
        {/* Usage meter skeleton */}
        <div className="h-16 bg-muted rounded-lg animate-pulse" />
        {/* Tabs skeleton */}
        <div className="flex gap-1 border-b border-border pb-px">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
        {/* Search bar skeleton */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="h-10 flex-1 max-w-sm bg-muted rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-muted rounded animate-pulse" />
            <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 w-10 bg-muted rounded animate-pulse" />
        </div>
        {/* Envelope list skeleton */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4 border border-border rounded-lg animate-pulse">
              <div className="h-5 w-5 bg-muted rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
              <div className="h-6 w-20 bg-muted rounded-full" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render – list / dashboard view
  // -------------------------------------------------------------------------

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">SignSuite</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send documents for signature to anyone
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="min-h-[44px] border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            onClick={() => router.push("/admin/signsuite/bulk-send")}
          >
            <Send className="h-4 w-4 mr-1.5" />
            Bulk Send
          </Button>
          <Button className="min-h-[44px]" onClick={() => router.push("/admin/signsuite/send")}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Envelope
          </Button>
        </div>
      </div>

      {/* Usage Meter */}
      <SignSuiteUsageMeter />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSearch("");
              setDateFrom("");
              setDateTo("");
            }}
            className={`px-2 sm:px-4 py-2.5 min-h-[44px] text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + Date Range + Refresh (envelope tabs only) */}
      {tab !== "templates" && tab !== "batches" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search envelopes..."
              className="w-full pl-9 pr-3 py-2 text-base sm:text-sm border border-border rounded-md bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-base sm:text-sm border border-border rounded-md bg-background"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-base sm:text-sm border border-border rounded-md bg-background"
              aria-label="To date"
            />
          </div>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Content */}
      {tab === "templates" ? (
        <TemplateList />
      ) : tab === "batches" ? (
        <BatchDashboard />
      ) : (
        <EnvelopeList
          envelopes={envelopes}
          loading={loading}
          onSelect={(envelope) => goToDetail(envelope.id)}
          onSend={(id) => handleEnvelopeAction(id, "send")}
          onRemind={(id) => handleEnvelopeAction(id, "remind")}
          onVoid={(id) => handleEnvelopeAction(id, "void")}
          onDelete={(id) => handleEnvelopeAction(id, "delete")}
        />
      )}
    </div>
  );
}
