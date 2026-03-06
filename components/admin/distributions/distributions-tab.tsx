"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownToLine,
  ChevronRight,
  Calendar,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { DistributionStatusBadge, DistributionTypeBadge } from "./distribution-status-badge";
import { DistributionCreateWizard } from "./distribution-create-wizard";

interface Distribution {
  id: string;
  distributionNumber: number;
  totalAmount: string;
  distributionType: string;
  distributionDate: string;
  status: string;
  createdAt: string;
}

interface DistributionsTabProps {
  fundId: string;
  teamId: string;
}

export function DistributionsTab({ fundId, teamId }: DistributionsTabProps) {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const fetchDistributions = useCallback(async () => {
    try {
      const url = new URL(
        `/api/teams/${teamId}/funds/${fundId}/distributions`,
        window.location.origin,
      );
      if (statusFilter !== "all") {
        url.searchParams.set("status", statusFilter);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDistributions(data.distributions || []);
    } catch {
      setError("Failed to load distributions");
    } finally {
      setLoading(false);
    }
  }, [fundId, teamId, statusFilter]);

  useEffect(() => {
    fetchDistributions();
  }, [fetchDistributions]);

  const formatCurrency = (v: string | number) => {
    const num = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(num)) return "$0.00";
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  // Summary stats
  const totalDistributed = distributions
    .filter((d) => d.status === "DISTRIBUTED" || d.status === "COMPLETED")
    .reduce((sum, d) => sum + parseFloat(d.totalAmount), 0);
  const totalPending = distributions
    .filter((d) => d.status === "PENDING" || d.status === "APPROVED" || d.status === "PROCESSING")
    .reduce((sum, d) => sum + parseFloat(d.totalAmount), 0);
  const draftCount = distributions.filter((d) => d.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Distributions</h3>
          <p className="text-sm text-muted-foreground">
            Manage fund distributions to investors
          </p>
        </div>
        <Button onClick={() => setShowCreateWizard(true)}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          New Distribution
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Distributions</p>
            <p className="text-2xl font-bold font-mono tabular-nums">
              {distributions.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Distributed</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalDistributed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
              {formatCurrency(totalPending)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-gray-600 dark:text-gray-400">
              {draftCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Refresh */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" aria-label="Filter by status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="DISTRIBUTED">Distributed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchDistributions();
          }}
          aria-label="Refresh distributions"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Distributions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-muted animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground" role="alert">{error}</p>
            <Button variant="outline" onClick={fetchDistributions} className="mt-3">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : distributions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowDownToLine
              className="h-12 w-12 mx-auto mb-3 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-muted-foreground mb-1">
              No distributions yet
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first distribution to send returns to investors
            </p>
            <Button onClick={() => setShowCreateWizard(true)}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Create Distribution
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {distributions.map((dist) => (
            <Card
              key={dist.id}
              className="cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="shrink-0">
                      <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                        <ArrowDownToLine
                          className="h-5 w-5 text-emerald-500"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          Distribution #{dist.distributionNumber}
                        </span>
                        <DistributionStatusBadge status={dist.status} />
                        <DistributionTypeBadge type={dist.distributionType} />
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {new Date(dist.distributionDate).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="font-mono tabular-nums font-semibold">
                        {formatCurrency(dist.totalAmount)}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Wizard Modal */}
      <DistributionCreateWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onCreated={() => {
          setShowCreateWizard(false);
          fetchDistributions();
        }}
        teamId={teamId}
        fundId={fundId}
      />
    </div>
  );
}
