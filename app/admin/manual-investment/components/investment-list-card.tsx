"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Fund,
  ManualInvestment,
  TabKey,
  TabCounts,
  TABS,
} from "./shared-types";
import { InvestmentRow } from "./investment-row";

export function InvestmentListCard({
  loading,
  filtered,
  totalCount,
  funds,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  fundFilter,
  onFundFilterChange,
  counts,
  onViewDetails,
  onVerifyDoc,
  onVerifyProof,
  onRejectProof,
}: {
  loading: boolean;
  filtered: ManualInvestment[];
  totalCount: number;
  funds: Fund[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  fundFilter: string;
  onFundFilterChange: (value: string) => void;
  counts: TabCounts;
  onViewDetails: (inv: ManualInvestment) => void;
  onVerifyDoc: (inv: ManualInvestment) => void;
  onVerifyProof: (inv: ManualInvestment) => void;
  onRejectProof: (inv: ManualInvestment) => void;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 text-xs">
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search + Fund Filter */}
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search investor or title..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
                className="pl-9 w-[220px]"
              />
            </div>
            {funds.length > 1 && (
              <Select value={fundFilter} onValueChange={onFundFilterChange}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by fund">
                  <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
                  <SelectValue placeholder="All Funds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Funds</SelectItem>
                  {funds.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" aria-hidden="true" />
            <p className="text-lg font-medium text-muted-foreground">
              {totalCount === 0
                ? "No manual investments yet"
                : "No investments match your filters"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount === 0
                ? "Add an off-platform investment record to get started."
                : "Try adjusting your search or tab filter."}
            </p>
            {totalCount === 0 && (
              <Button
                className="mt-4"
                onClick={() => router.push("/admin/manual-investment/new")}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add Investment
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inv) => (
              <InvestmentRow
                key={inv.id}
                investment={inv}
                onViewDetails={() => onViewDetails(inv)}
                onVerifyDoc={() => onVerifyDoc(inv)}
                onVerifyProof={() => onVerifyProof(inv)}
                onRejectProof={() => onRejectProof(inv)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
