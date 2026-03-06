"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  X,
  LayoutList,
  Columns3,
  CalendarDays,
} from "lucide-react";
import {
  type InvestorSummary,
  type ViewMode,
  type EngagementFilter,
  type DateRange,
  STAGE_CONFIG,
} from "./types";

interface InvestorFilterBarProps {
  investors: InvestorSummary[];
  filteredCount: number;
  search: string;
  setSearch: (v: string) => void;
  filterStage: string | null;
  setFilterStage: (v: string | null) => void;
  filterEngagement: EngagementFilter;
  setFilterEngagement: (v: EngagementFilter) => void;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
  customDateFrom: string;
  setCustomDateFrom: (v: string) => void;
  customDateTo: string;
  setCustomDateTo: (v: string) => void;
  filterFundId: string | null;
  setFilterFundId: (v: string | null) => void;
  funds: Array<{ id: string; name: string }>;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  stageCounts: Record<string, number>;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function InvestorFilterBar({
  investors,
  search,
  setSearch,
  filterStage,
  setFilterStage,
  filterEngagement,
  setFilterEngagement,
  dateRange,
  setDateRange,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  filterFundId,
  setFilterFundId,
  funds,
  viewMode,
  setViewMode,
  stageCounts,
  hasActiveFilters,
  onClearFilters,
}: InvestorFilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Top row: Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search by name, email, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search investors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={filterEngagement}
            onChange={(e) => setFilterEngagement(e.target.value as EngagementFilter)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by engagement"
          >
            <option value="all">All Engagement</option>
            <option value="hot">Hot (15+)</option>
            <option value="warm">Warm (5-14)</option>
            <option value="cool">Cool (1-4)</option>
            <option value="none">None</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by date range"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom Range</option>
          </select>
          {funds.length > 1 && (
            <select
              value={filterFundId || ""}
              onChange={(e) => setFilterFundId(e.target.value || null)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by fund"
            >
              <option value="">All Funds</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm min-h-[36px] ${viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => setViewMode("table")}
              aria-label="Table view"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              className={`px-3 py-1.5 text-sm min-h-[36px] border-l ${viewMode === "kanban" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              onClick={() => setViewMode("kanban")}
              aria-label="Kanban view"
            >
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stage Filter Pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={filterStage === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterStage(null)}
        >
          All ({investors.length})
        </Button>
        {Object.entries(STAGE_CONFIG).map(([stage, config]) => {
          const count = stageCounts[stage] || 0;
          if (count === 0) return null;
          return (
            <Button
              key={stage}
              variant={filterStage === stage ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStage(filterStage === stage ? null : stage)}
            >
              <span className={filterStage !== stage ? config.color : ""}>
                {config.label}
              </span>{" "}
              ({count})
            </Button>
          );
        })}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Custom Date Range Inputs */}
      {dateRange === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            type="date"
            value={customDateFrom}
            onChange={(e) => setCustomDateFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Date from"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            value={customDateTo}
            onChange={(e) => setCustomDateTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Date to"
          />
        </div>
      )}
    </div>
  );
}
