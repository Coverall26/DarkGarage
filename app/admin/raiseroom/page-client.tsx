"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  TrendingUp,
  Users,
  FileSignature,
  FileText,
  ExternalLink,
  DollarSign,
  Eye,
  BarChart3,
  RefreshCw,
  Plus,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDistanceToNow } from "date-fns";

// ── Suite color: Cyan #06B6D4 ──
const CYAN = "#06B6D4";

// ── Types ──

interface TeamContext {
  teamId: string;
  orgId: string;
  mode: string;
  funds: Array<{ id: string; name: string; status: string }>;
}

interface FundRaiseData {
  id: string;
  name: string;
  status: string;
  entityMode: string;
  targetRaise: string | null;
  minimumInvestment: string | null;
  regulationDExemption: string | null;
  closingDate: string | null;
  aggregate: {
    totalCommitted: string | null;
    totalInbound: string | null;
  } | null;
  investorCount: number;
  ndaCount: number;
  signingPending: number;
  signingComplete: number;
  offeringSlug: string | null;
  offeringPublic: boolean;
}

interface RaiseStats {
  totalRaised: number;
  totalTarget: number;
  investorCount: number;
  pendingSignatures: number;
  completedSignatures: number;
  ndaSigned: number;
  offeringViews: number;
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

type RaiseTab = "overview" | "pipeline" | "documents" | "activity";

const TABS: { key: RaiseTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "pipeline", label: "Pipeline" },
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Activity" },
];

// ── Component ──

export default function RaiseRoomPageClient() {
  const router = useRouter();
  const [teamCtx, setTeamCtx] = useState<TeamContext | null>(null);
  const [fund, setFund] = useState<FundRaiseData | null>(null);
  const [stats, setStats] = useState<RaiseStats | null>(null);
  const [tab, setTab] = useState<RaiseTab>("overview");
  const [loading, setLoading] = useState(true);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);

  // Fetch team context
  const fetchTeamCtx = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/team-context");
      if (res.ok) {
        const data = await res.json();
        setTeamCtx(data);
        if (!selectedFundId && data.funds?.length > 0) {
          setSelectedFundId(data.funds[0].id);
        }
      }
    } catch {
      // fallback
    }
  }, [selectedFundId]);

  // Fetch fund raise data
  const fetchFundData = useCallback(async () => {
    if (!teamCtx?.teamId || !selectedFundId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/raiseroom/fund-summary?teamId=${teamCtx.teamId}&fundId=${selectedFundId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setFund(data.fund);
        setStats(data.stats);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [teamCtx?.teamId, selectedFundId]);

  useEffect(() => {
    fetchTeamCtx();
  }, [fetchTeamCtx]);

  useEffect(() => {
    fetchFundData();
  }, [fetchFundData]);

  // ── Loading skeleton ──
  if (loading && !fund) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="p-4 border border-border rounded-lg animate-pulse"
            >
              <div className="h-4 w-20 bg-muted rounded mb-3" />
              <div className="h-8 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  const totalRaised = stats?.totalRaised ?? 0;
  const totalTarget = stats?.totalTarget ?? 1;
  const raisePercent = Math.min(
    Math.round((totalRaised / totalTarget) * 100),
    100,
  );

  return (
    <div className="animate-fade-in p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2
              className="h-6 w-6"
              style={{ color: CYAN }}
            />
            Raise Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capital raise management &amp; investor pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Fund selector */}
          {teamCtx && teamCtx.funds.length > 1 && (
            <select
              value={selectedFundId ?? ""}
              onChange={(e) => setSelectedFundId(e.target.value)}
              className="px-3 py-2 text-base sm:text-sm border border-border rounded-md bg-background"
              aria-label="Select fund"
            >
              {teamCtx.funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => fetchFundData()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            style={{ backgroundColor: CYAN }}
            className="min-h-[44px] text-white hover:opacity-90"
            onClick={() => router.push("/admin/investors/new")}
          >
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            Add Investor
          </Button>
        </div>
      </div>

      {/* Raise Progress Bar */}
      {fund && (
        <div className="border border-border rounded-lg p-5 bg-background">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {fund.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <RaiseStatusBadge status={fund.status} />
                {fund.regulationDExemption && (
                  <Badge
                    variant="outline"
                    className="text-xs"
                  >
                    {formatRegD(fund.regulationDExemption)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
                {formatCurrency(totalRaised)}
              </p>
              <p className="text-xs text-muted-foreground">
                of {formatCurrency(totalTarget)} target
              </p>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${raisePercent}%`,
                backgroundColor: CYAN,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{raisePercent}% raised</span>
            {fund.closingDate && (
              <span>
                Closing{" "}
                {formatDistanceToNow(new Date(fund.closingDate), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Investors"
          value={stats?.investorCount ?? 0}
          icon={Users}
          onClick={() => router.push("/admin/investors")}
        />
        <StatCard
          label="NDAs Signed"
          value={stats?.ndaSigned ?? 0}
          icon={Shield}
          onClick={() => router.push("/admin/documents")}
        />
        <StatCard
          label="Pending Signatures"
          value={stats?.pendingSignatures ?? 0}
          icon={FileSignature}
          onClick={() => router.push("/admin/signsuite")}
        />
        <StatCard
          label="Offering Views"
          value={stats?.offeringViews ?? 0}
          icon={Eye}
          onClick={() =>
            fund?.offeringSlug
              ? router.push("/admin/offering")
              : undefined
          }
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-2 sm:px-4 py-2.5 min-h-[44px] text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            style={
              tab === t.key
                ? { borderBottomColor: CYAN, color: CYAN }
                : undefined
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <OverviewTab
          fund={fund}
          stats={stats}
          onNavigate={(path) => router.push(path)}
        />
      )}
      {tab === "pipeline" && (
        <PipelineTab
          stats={stats}
          onNavigate={(path) => router.push(path)}
        />
      )}
      {tab === "documents" && (
        <DocumentsTab
          fund={fund}
          onNavigate={(path) => router.push(path)}
        />
      )}
      {tab === "activity" && <ActivityTab stats={stats} />}
    </div>
  );
}

// ── StatCard ──

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 border border-border rounded-lg bg-background hover:bg-muted/30 transition-colors text-left w-full"
    >
      <div
        className="flex-shrink-0 rounded-lg p-2.5"
        style={{ backgroundColor: `${CYAN}15` }}
      >
        <Icon className="h-5 w-5" style={{ color: CYAN }} />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono tabular-nums text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

// ── Overview Tab ──

function OverviewTab({
  fund,
  stats,
  onNavigate,
}: {
  fund: FundRaiseData | null;
  stats: RaiseStats | null;
  onNavigate: (path: string) => void;
}) {
  if (!fund) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Quick Actions */}
      <div className="border border-border rounded-lg p-5 bg-background">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <ActionButton
            icon={Plus}
            label="Add New Investor"
            description="Manually add an investor to this raise"
            onClick={() => onNavigate("/admin/investors/new")}
          />
          <ActionButton
            icon={FileSignature}
            label="Send Document for Signature"
            description="Send NDA, Sub Ag, or other docs via SignSuite"
            onClick={() => onNavigate("/admin/signsuite/send")}
          />
          <ActionButton
            icon={ExternalLink}
            label={
              fund.offeringSlug
                ? "Edit Offering Page"
                : "Create Offering Page"
            }
            description="Public investor-facing landing page"
            onClick={() => onNavigate("/admin/offering")}
          />
          <ActionButton
            icon={BarChart3}
            label="View Reports"
            description="Raise analytics, pipeline distribution, Form D"
            onClick={() => onNavigate("/admin/reports")}
          />
        </div>
      </div>

      {/* Fund Details Card */}
      <div className="border border-border rounded-lg p-5 bg-background">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Raise Details
        </h3>
        <dl className="space-y-3 text-sm">
          <DetailRow label="Fund Name" value={fund.name} />
          <DetailRow
            label="Target"
            value={formatCurrency(parseFloat(fund.targetRaise ?? "0"))}
            mono
          />
          <DetailRow
            label="Min Investment"
            value={formatCurrency(
              parseFloat(fund.minimumInvestment ?? "0"),
            )}
            mono
          />
          <DetailRow
            label="Regulation"
            value={formatRegD(fund.regulationDExemption ?? "")}
          />
          <DetailRow label="Mode" value={fund.entityMode} />
          {fund.closingDate && (
            <DetailRow
              label="Closing Date"
              value={new Date(fund.closingDate).toLocaleDateString()}
            />
          )}
        </dl>
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              onNavigate(`/admin/fund/${fund.id}`)
            }
          >
            View Fund Details
          </Button>
        </div>
      </div>

      {/* Offering Page Status */}
      <div className="border border-border rounded-lg p-5 bg-background lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Offering Page
          </h3>
          {fund.offeringPublic ? (
            <Badge
              className="text-xs"
              style={{ backgroundColor: `${CYAN}20`, color: CYAN }}
            >
              Live
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Draft
            </Badge>
          )}
        </div>
        {fund.offeringSlug ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground flex-1 truncate">
              /offering/{fund.offeringSlug}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("/admin/offering")}
            >
              Edit
            </Button>
            {fund.offeringPublic && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `/offering/${fund.offeringSlug}`,
                    "_blank",
                  )
                }
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                View
              </Button>
            )}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No offering page created yet"
            description="Create a public-facing offering page to attract investors."
            actionLabel="Create Offering Page"
            onAction={() => onNavigate("/admin/offering")}
            accentColor={CYAN}
          />
        )}
      </div>
    </div>
  );
}

// ── Pipeline Tab ──

function PipelineTab({
  stats,
  onNavigate,
}: {
  stats: RaiseStats | null;
  onNavigate: (path: string) => void;
}) {
  const stages = [
    { label: "Applied", count: 0, color: "#94A3B8" },
    { label: "Under Review", count: 0, color: "#F59E0B" },
    { label: "Approved", count: 0, color: "#3B82F6" },
    { label: "Committed", count: 0, color: "#8B5CF6" },
    { label: "Docs Approved", count: 0, color: CYAN },
    { label: "Funded", count: 0, color: "#10B981" },
  ];
  const total = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Pipeline Bar */}
      <div className="border border-border rounded-lg p-5 bg-background">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Investor Pipeline
        </h3>
        {stats && stats.investorCount > 0 ? (
          <>
            <div className="flex h-8 rounded-full overflow-hidden bg-muted">
              {stages
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div
                    key={s.label}
                    className="h-full transition-all"
                    style={{
                      width: `${(s.count / total) * 100}%`,
                      backgroundColor: s.color,
                    }}
                    title={`${s.label}: ${s.count}`}
                  />
                ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {stages.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {s.label}:{" "}
                    <span className="font-mono tabular-nums font-medium text-foreground">
                      {s.count}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={Users}
            title="No investors in pipeline yet"
            description="Add your first investor to start tracking your raise progress."
            actionLabel="Add Investor"
            onAction={() => onNavigate("/admin/investors/new")}
            accentColor={CYAN}
          />
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLinkCard
          icon={Users}
          label="Full Pipeline"
          description="View & manage all investors"
          onClick={() => onNavigate("/admin/investors")}
        />
        <QuickLinkCard
          icon={ClipboardCheck}
          label="Approvals"
          description="Review pending approvals"
          onClick={() => onNavigate("/admin/approvals")}
        />
        <QuickLinkCard
          icon={DollarSign}
          label="Transactions"
          description="Wire confirmations & payments"
          onClick={() => onNavigate("/admin/transactions")}
        />
      </div>
    </div>
  );
}

// ── Documents Tab ──

function DocumentsTab({
  fund,
  onNavigate,
}: {
  fund: FundRaiseData | null;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* SignSuite Card */}
        <div className="border border-border rounded-lg p-5 bg-background">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 p-2.5">
              <FileSignature className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                E-Signatures
              </p>
              <p className="text-xs text-muted-foreground">
                Send docs via SignSuite
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="text-muted-foreground">
              Pending:{" "}
              <span className="font-mono tabular-nums font-medium text-foreground">
                {fund?.signingPending ?? 0}
              </span>
            </span>
            <span className="text-muted-foreground">
              Complete:{" "}
              <span className="font-mono tabular-nums font-medium text-foreground">
                {fund?.signingComplete ?? 0}
              </span>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onNavigate("/admin/signsuite")}
          >
            Open SignSuite
          </Button>
        </div>

        {/* Investor Documents Card */}
        <div className="border border-border rounded-lg p-5 bg-background">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="rounded-lg p-2.5"
              style={{ backgroundColor: `${CYAN}15` }}
            >
              <FileText className="h-5 w-5" style={{ color: CYAN }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Investor Documents
              </p>
              <p className="text-xs text-muted-foreground">
                Uploaded docs for review
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onNavigate("/admin/documents")}
          >
            Review Documents
          </Button>
        </div>
      </div>

      {/* NDA Gate Status */}
      <div className="border border-border rounded-lg p-5 bg-background">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            NDA Gate via SignSuite
          </h3>
          <Badge
            variant="outline"
            className="text-xs"
            style={{ borderColor: `${CYAN}40`, color: CYAN }}
          >
            {fund?.ndaCount ?? 0} signed
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Require visitors to sign an NDA via SignSuite before viewing protected
          documents in your dataroom. Configure this on individual dataroom link
          settings.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => onNavigate("/datarooms")}
        >
          Manage Dataroom Links
        </Button>
      </div>
    </div>
  );
}

// ── Activity Tab ──

function ActivityTab({ stats }: { stats: RaiseStats | null }) {
  const activities = stats?.recentActivity ?? [];

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No recent activity"
        description="Activity will appear here as investors interact with your raise."
        accentColor={CYAN}
      />
    );
  }

  return (
    <div className="border border-border rounded-lg divide-y divide-border bg-background">
      {activities.map((item) => (
        <div key={item.id} className="flex items-start gap-3 p-4">
          <ActivityIcon type={item.type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{item.description}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(item.timestamp), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ──

function ActionButton({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-3 min-h-[44px] rounded-md hover:bg-muted/50 transition-colors text-left"
    >
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function QuickLinkCard({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 border border-border rounded-lg bg-background hover:bg-muted/30 transition-colors text-left w-full"
    >
      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`text-foreground font-medium ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function RaiseStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Active" },
    OPEN: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Open" },
    CLOSED: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", label: "Closed" },
    DRAFT: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", label: "Draft" },
  };
  const c = config[status] ?? {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    label: status,
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    investor_applied: Users,
    nda_signed: Shield,
    commitment: DollarSign,
    wire_received: CheckCircle2,
    doc_signed: FileSignature,
    offering_view: Eye,
  };
  const Icon = iconMap[type] ?? Clock;
  return (
    <div
      className="flex-shrink-0 rounded-full p-1.5 mt-0.5"
      style={{ backgroundColor: `${CYAN}15` }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: CYAN }} />
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function formatRegD(exemption: string): string {
  const labels: Record<string, string> = {
    "506B": "Rule 506(b)",
    "506C": "Rule 506(c)",
    REG_A_PLUS: "Regulation A+",
    RULE_504: "Rule 504",
  };
  return labels[exemption] ?? exemption;
}
