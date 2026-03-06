"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Download,
  Upload,
  Plus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { InviteInvestorsModal } from "@/components/admin/invite-investors-modal";
import {
  InvestorStatsCards,
  InvestorFilterBar,
  InvestorTableView,
  InvestorKanbanView,
  InvestorBatchActionBar,
} from "@/components/admin/investors";
import {
  type InvestorSummary,
  type ViewMode,
  type EngagementFilter,
  type DateRange,
  exportCSV,
  getEngagementScore,
  getEngagementTier,
} from "@/components/admin/investors/types";

export default function InvestorsListClient() {
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<string | null>(null);
  const [filterEngagement, setFilterEngagement] = useState<EngagementFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [fundId, setFundId] = useState<string | null>(null);
  const [funds, setFunds] = useState<Array<{ id: string; name: string }>>([]);
  const [filterFundId, setFilterFundId] = useState<string | null>(null);
  const [fundName, setFundName] = useState<string>("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "commitment" | "createdAt">("commitment");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const fetchInvestors = useCallback(async () => {
    try {
      const teamRes = await fetch("/api/teams");
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        const teams = teamData.teams || teamData;
        if (teams.length > 0) {
          const tid = teams[0].id || teams[0].teamId;
          setTeamId(tid);

          const res = await fetch(`/api/teams/${tid}/investors`);
          if (res.ok) {
            const data = await res.json();
            setInvestors(data.investors || []);
          }

          const fundsRes = await fetch(`/api/teams/${tid}/funds`);
          if (fundsRes.ok) {
            const fundsData = await fundsRes.json();
            const fundsList = fundsData.funds || fundsData || [];
            setFunds(fundsList.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name || "Fund" })));
            if (fundsList.length > 0) {
              setFundId(fundsList[0].id);
              setFundName(fundsList[0].name || "Fund");
            }
          }
        }
      }
    } catch {
      setError("Failed to load investors. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const filteredInvestors = useMemo(() => {
    return investors
      .filter((inv) => {
        const matchSearch =
          !search ||
          inv.name.toLowerCase().includes(search.toLowerCase()) ||
          inv.email.toLowerCase().includes(search.toLowerCase()) ||
          (inv.entityName || "").toLowerCase().includes(search.toLowerCase());
        const matchStage = !filterStage || inv.stage === filterStage;
        const matchFund = !filterFundId;
        const matchEngagement =
          filterEngagement === "all" ||
          getEngagementTier(getEngagementScore(inv)) === filterEngagement;

        let matchDate = true;
        if (dateRange !== "all") {
          const invDate = new Date(inv.createdAt).getTime();
          const now = Date.now();
          if (dateRange === "7d") matchDate = invDate >= now - 7 * 86400000;
          else if (dateRange === "30d") matchDate = invDate >= now - 30 * 86400000;
          else if (dateRange === "90d") matchDate = invDate >= now - 90 * 86400000;
          else if (dateRange === "custom") {
            if (customDateFrom) matchDate = invDate >= new Date(customDateFrom).getTime();
            if (customDateTo && matchDate) matchDate = invDate <= new Date(customDateTo).getTime() + 86400000;
          }
        }

        return matchSearch && matchStage && matchFund && matchEngagement && matchDate;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortBy === "name") return dir * (a.name || "").localeCompare(b.name || "");
        if (sortBy === "commitment") return dir * (a.commitment - b.commitment);
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
  }, [investors, search, filterStage, filterFundId, filterEngagement, sortBy, sortDir, dateRange, customDateFrom, customDateTo]);

  const stageCounts = useMemo(
    () =>
      investors.reduce(
        (acc, inv) => {
          acc[inv.stage] = (acc[inv.stage] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [investors],
  );

  const totalCommitted = useMemo(() => investors.reduce((s, inv) => s + inv.commitment, 0), [investors]);
  const totalFunded = useMemo(() => investors.reduce((s, inv) => s + inv.funded, 0), [investors]);

  const hasActiveFilters = !!filterStage || filterEngagement !== "all" || !!filterFundId || !!search || dateRange !== "all";

  function clearFilters() {
    setSearch("");
    setFilterStage(null);
    setFilterEngagement("all");
    setFilterFundId(null);
    setDateRange("all");
    setCustomDateFrom("");
    setCustomDateTo("");
  }

  function handleSort(col: "name" | "commitment" | "createdAt") {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredInvestors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvestors.map((inv) => inv.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedInvestors = useMemo(
    () => filteredInvestors.filter((inv) => selectedIds.has(inv.id)),
    [filteredInvestors, selectedIds],
  );

  async function handleBatchApprove() {
    if (!teamId || !fundId || selectedInvestors.length === 0) return;
    setBatchLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const inv of selectedInvestors) {
      if (inv.stage === "APPROVED" || inv.stage === "COMMITTED" || inv.stage === "DOCS_APPROVED" || inv.stage === "FUNDED") {
        successCount++;
        continue;
      }
      try {
        const res = await fetch(`/api/admin/investors/${inv.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve", fundId, teamId }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBatchLoading(false);
    if (successCount > 0) toast.success(`Approved ${successCount} investor${successCount !== 1 ? "s" : ""}`);
    if (failCount > 0) toast.error(`Failed to approve ${failCount} investor${failCount !== 1 ? "s" : ""}`);
    clearSelection();
    fetchInvestors();
  }

  function handleBatchEmail() {
    if (selectedInvestors.length === 0) return;
    const emails = selectedInvestors.map((inv) => inv.email).join(",");
    window.open(`mailto:${emails}`);
  }

  function handleBatchExport() {
    if (selectedInvestors.length === 0) return;
    exportCSV(selectedInvestors);
    toast.success(`Exported ${selectedInvestors.length} investor${selectedInvestors.length !== 1 ? "s" : ""}`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="flex justify-between">
            <div className="h-8 bg-muted rounded w-32" />
            <div className="flex gap-2">
              <div className="h-9 bg-muted rounded w-32" />
              <div className="h-9 bg-muted rounded w-24" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-10 bg-muted rounded w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
        <p className="text-destructive font-medium">{error}</p>
        <Button onClick={() => { setError(null); setLoading(true); fetchInvestors(); }}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Investors</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investors</h1>
          <p className="text-muted-foreground">
            {investors.length} investor{investors.length !== 1 ? "s" : ""}{" "}
            {filteredInvestors.length !== investors.length && (
              <span className="text-primary">({filteredInvestors.length} shown)</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(filteredInvestors)}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Export CSV
          </Button>
          <Link href="/admin/investors/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              Import CSV
            </Button>
          </Link>
          <Link href="/admin/investors/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Add Investor
            </Button>
          </Link>
        </div>
      </div>

      <InvestorStatsCards
        totalInvestors={investors.length}
        totalCommitted={totalCommitted}
        totalFunded={totalFunded}
        stageCounts={stageCounts}
      />

      <InvestorFilterBar
        investors={investors}
        filteredCount={filteredInvestors.length}
        search={search}
        setSearch={setSearch}
        filterStage={filterStage}
        setFilterStage={setFilterStage}
        filterEngagement={filterEngagement}
        setFilterEngagement={setFilterEngagement}
        dateRange={dateRange}
        setDateRange={setDateRange}
        customDateFrom={customDateFrom}
        setCustomDateFrom={setCustomDateFrom}
        customDateTo={customDateTo}
        setCustomDateTo={setCustomDateTo}
        filterFundId={filterFundId}
        setFilterFundId={setFilterFundId}
        funds={funds}
        viewMode={viewMode}
        setViewMode={setViewMode}
        stageCounts={stageCounts}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {viewMode === "table" ? (
        <InvestorTableView
          investors={filteredInvestors}
          teamId={teamId}
          fundId={fundId}
          fundName={fundName}
          showInviteModal={showInviteModal}
          setShowInviteModal={setShowInviteModal}
          search={search}
          filterStage={filterStage}
          setSearch={setSearch}
          setFilterStage={setFilterStage}
          onSort={handleSort}
          sortBy={sortBy}
          sortDir={sortDir}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      ) : (
        <InvestorKanbanView investors={filteredInvestors} />
      )}

      <InvestorBatchActionBar
        selectedCount={selectedIds.size}
        batchLoading={batchLoading}
        onApprove={handleBatchApprove}
        onEmail={handleBatchEmail}
        onExport={handleBatchExport}
        onClear={clearSelection}
      />

      {teamId && fundId && (
        <InviteInvestorsModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          teamId={teamId}
          fundId={fundId}
          fundName={fundName}
        />
      )}
    </div>
  );
}
