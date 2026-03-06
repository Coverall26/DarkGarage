"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  Search,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgActivation {
  id: string;
  status: string;
  mode: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  setupCompletedAt: string | null;
}

interface OrgRow {
  teamId: string;
  teamName: string;
  orgName: string;
  orgId: string | null;
  productMode: string | null;
  subscriptionTier: string;
  ownerName: string | null;
  ownerEmail: string | null;
  fundCount: number;
  memberCount: number;
  createdAt: string;
  activation: OrgActivation | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string | undefined) {
  switch (status) {
    case "ACTIVE":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </span>
      );
    case "SUSPENDED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <PauseCircle className="h-3 w-3" />
          Suspended
        </span>
      );
    case "DEACTIVATED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          Deactivated
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Not Activated
        </span>
      );
  }
}

function tierBadge(tier: string) {
  switch (tier) {
    case "FUNDROOM":
      return (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          FundRoom
        </span>
      );
    case "CRM_PRO":
      return (
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          CRM Pro
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Free
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrgActivationManagerSection() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");

  const fetchOrgs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/platform/organizations");
      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Platform owner access required");
          return;
        }
        throw new Error("Failed to load organizations");
      }
      const result = await res.json();
      setOrgs(result.organizations ?? []);
    } catch (error) {
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleAction = async (
    teamId: string,
    action: "activate" | "suspend" | "deactivate" | "reactivate",
  ) => {
    setActionLoading(`${teamId}-${action}`);
    try {
      const res = await fetch("/api/admin/platform/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          action,
          reason: reasonText || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || `Failed to ${action}`);
        return;
      }
      toast.success(
        `Organization ${action === "activate" ? "activated" : action === "suspend" ? "suspended" : action === "deactivate" ? "deactivated" : "reactivated"} successfully`,
      );
      setReasonText("");
      setExpandedOrg(null);
      fetchOrgs();
    } catch (error) {
      toast.error(`Failed to ${action} organization`);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = orgs.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.teamName.toLowerCase().includes(q) ||
      o.orgName.toLowerCase().includes(q) ||
      (o.ownerEmail && o.ownerEmail.toLowerCase().includes(q)) ||
      (o.ownerName && o.ownerName.toLowerCase().includes(q))
    );
  });

  // Summary counts
  const activeCount = orgs.filter(
    (o) => o.activation?.status === "ACTIVE",
  ).length;
  const suspendedCount = orgs.filter(
    (o) => o.activation?.status === "SUSPENDED",
  ).length;
  const notActivatedCount = orgs.filter((o) => !o.activation).length;

  if (loading) {
    return (
      <div className="space-y-3 p-2">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Platform owner access required, or no organizations found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">{orgs.length}</span>
          <span className="text-muted-foreground">total</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">{activeCount}</span>
          <span>active</span>
        </div>
        {suspendedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <PauseCircle className="h-4 w-4" aria-hidden="true" />
            <span className="font-medium">{suspendedCount}</span>
            <span>suspended</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <span className="font-medium">{notActivatedCount}</span>
          <span>not activated</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search by name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Organization list */}
      <div className="space-y-2">
        {filtered.map((org) => {
          const isExpanded = expandedOrg === org.teamId;
          const status = org.activation?.status;

          return (
            <div
              key={org.teamId}
              className="rounded-lg border border-border bg-card"
            >
              {/* Row header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {org.orgName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {org.ownerEmail && (
                        <span className="truncate">{org.ownerEmail}</span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        {org.memberCount}
                      </span>
                      <span>
                        {org.fundCount} fund{org.fundCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {tierBadge(org.subscriptionTier)}
                  {statusBadge(status)}
                  <button
                    onClick={() =>
                      setExpandedOrg(isExpanded ? null : org.teamId)
                    }
                    className="p-1 rounded hover:bg-muted"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">Team:</span>{" "}
                      {org.teamName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Owner:</span>{" "}
                      {org.ownerName || "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mode:</span>{" "}
                      {org.productMode || "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                    {org.activation?.activatedAt && (
                      <div>
                        <span className="text-muted-foreground">
                          Activated:
                        </span>{" "}
                        {new Date(
                          org.activation.activatedAt,
                        ).toLocaleDateString()}
                      </div>
                    )}
                    {org.activation?.deactivationReason && (
                      <div className="col-span-2 sm:col-span-3">
                        <span className="text-muted-foreground">Reason:</span>{" "}
                        <span className="text-amber-600 dark:text-amber-400">
                          {org.activation.deactivationReason}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reason input for suspend/deactivate */}
                  {(status === "ACTIVE" || !status) && (
                    <Input
                      placeholder="Reason for suspend/deactivate (optional)"
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      className="text-sm"
                    />
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Not activated → Activate */}
                    {!status && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(org.teamId, "activate")}
                        disabled={actionLoading === `${org.teamId}-activate`}
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {actionLoading === `${org.teamId}-activate` ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <PlayCircle className="mr-1 h-3 w-3" />
                        )}
                        Activate
                      </Button>
                    )}

                    {/* Active → Suspend / Deactivate */}
                    {status === "ACTIVE" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(org.teamId, "suspend")
                          }
                          disabled={
                            actionLoading === `${org.teamId}-suspend`
                          }
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                        >
                          {actionLoading === `${org.teamId}-suspend` ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <PauseCircle className="mr-1 h-3 w-3" />
                          )}
                          Suspend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(org.teamId, "deactivate")
                          }
                          disabled={
                            actionLoading === `${org.teamId}-deactivate`
                          }
                          className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          {actionLoading ===
                          `${org.teamId}-deactivate` ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}
                          Deactivate
                        </Button>
                      </>
                    )}

                    {/* Suspended or Deactivated → Reactivate */}
                    {(status === "SUSPENDED" ||
                      status === "DEACTIVATED") && (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleAction(org.teamId, "reactivate")
                        }
                        disabled={
                          actionLoading === `${org.teamId}-reactivate`
                        }
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {actionLoading ===
                        `${org.teamId}-reactivate` ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <PlayCircle className="mr-1 h-3 w-3" />
                        )}
                        Reactivate
                      </Button>
                    )}
                  </div>

                  {/* Warning for suspend/deactivate */}
                  {status === "ACTIVE" && (
                    <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Suspending or deactivating will block investor onboarding,
                        e-signatures, wire proof uploads, and staged
                        commitments for this organization.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No organizations match your search.
          </p>
        )}
      </div>
    </div>
  );
}
