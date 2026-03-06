"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Scale,
  Users,
  ClipboardCheck,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { OverviewTab } from "@/components/admin/compliance/overview-tab";
import { FormDTab } from "@/components/admin/compliance/form-d-tab";
import { AccreditationTab } from "@/components/admin/compliance/accreditation-tab";
import { RepresentationsTab } from "@/components/admin/compliance/representations-tab";
import { AuditTrailTab } from "@/components/admin/compliance/audit-trail-tab";

type TabKey =
  | "overview"
  | "formD"
  | "accreditation"
  | "representations"
  | "auditTrail";

const TABS: { key: TabKey; label: string; icon: typeof Shield }[] = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "formD", label: "Form D", icon: Scale },
  { key: "accreditation", label: "Accreditation", icon: Users },
  { key: "representations", label: "Representations", icon: ClipboardCheck },
  { key: "auditTrail", label: "Audit Trail", icon: Activity },
];

interface ComplianceData {
  organization: {
    name: string;
    entityType: string | null;
    badActorCertified: boolean;
    badActorCertifiedAt: string | null;
    relatedPersonsCount: number;
    address: string | null;
  };
  accreditationBreakdown: {
    total: number;
    selfCertified: number;
    thirdPartyVerified: number;
    kycVerified: number;
    pending: number;
    expired: number;
    expiringSoon: number;
  };
  representationsTracking: {
    total: number;
    allConfirmed: number;
    partial: number;
    none: number;
  };
  formDTimeline: Array<{
    fundId: string;
    fundName: string;
    fundStatus: string;
    entityMode: string;
    regulationDExemption: string | null;
    investmentCompanyExemption: string | null;
    formDFilingDate: string | null;
    formDAmendmentDue: string | null;
    formDReminderSent: boolean;
    filingDeadline: string;
    filingStatus: "not_filed" | "filed" | "amendment_due" | "overdue";
    targetRaise: number | null;
    minimumInvestment: number | null;
  }>;
  checklist: Array<{
    id: string;
    label: string;
    complete: boolean;
    detail: string;
    category: string;
  }>;
  complianceScore: {
    complete: number;
    total: number;
    percentage: number;
  };
  stats: {
    totalFunds: number;
    totalInvestors: number;
    auditEventsLast30Days: number;
    signedDocuments: number;
    accreditationMethod: string;
    auditRetentionDays: number;
  };
}

interface CompliancePackageAudit {
  chainIntegrity: {
    isValid: boolean;
    totalEntries: number;
    verifiedEntries: number;
    errors: string[];
  };
  export: {
    dateRange: { from: string; to: string };
    totalRecords: number;
    checksum: string;
  };
}

export function ComplianceDashboardClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [data, setData] = useState<ComplianceData | null>(null);
  const [auditData, setAuditData] = useState<CompliancePackageAudit | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Fetch compliance overview
      const overviewRes = await fetch("/api/admin/compliance-overview");
      if (!overviewRes.ok) {
        throw new Error("Failed to load compliance data");
      }
      const overviewData: ComplianceData = await overviewRes.json();
      setData(overviewData);

      // Fetch team context for teamId
      const teamRes = await fetch("/api/admin/team-context");
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeamId(teamData.teamId || null);
      }

      // Fetch audit chain data (non-blocking)
      try {
        const packageRes = await fetch("/api/admin/compliance-package");
        if (packageRes.ok) {
          const packageData = await packageRes.json();
          setAuditData(packageData.auditLog || null);
        }
      } catch {
        // Audit data is supplementary — don't block on failure
      }
    } catch {
      setError("Failed to load compliance data. Please try again.");
      if (isRefresh) toast.error("Failed to refresh compliance data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-80 animate-pulse rounded bg-muted mt-1" />
          </div>
        </div>
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-lg border bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            SEC Compliance Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.organization.name
              ? `${data.organization.name} — `
              : ""}
            Regulation D compliance monitoring and reporting
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          aria-label="Refresh compliance data"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-0 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                className="mr-1.5 inline-block h-3.5 w-3.5"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.key === "formD"
                  ? "Form D"
                  : tab.key === "auditTrail"
                    ? "Audit"
                    : tab.key === "representations"
                      ? "Reps"
                      : tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          checklist={data.checklist}
          complianceScore={data.complianceScore}
          stats={data.stats}
        />
      )}

      {activeTab === "formD" && (
        <FormDTab
          formDTimeline={data.formDTimeline}
          teamId={teamId || ""}
        />
      )}

      {activeTab === "accreditation" && (
        <AccreditationTab breakdown={data.accreditationBreakdown} />
      )}

      {activeTab === "representations" && (
        <RepresentationsTab tracking={data.representationsTracking} />
      )}

      {activeTab === "auditTrail" && (
        <AuditTrailTab
          chainIntegrity={auditData?.chainIntegrity ?? null}
          auditExport={auditData?.export ?? null}
          auditEventsLast30Days={data.stats.auditEventsLast30Days}
          auditRetentionDays={data.stats.auditRetentionDays}
        />
      )}
    </div>
  );
}
