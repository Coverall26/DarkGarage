import {
  User,
  Users,
  Building2,
  Briefcase,
  CreditCard,
  Shield,
  Flame,
  Thermometer,
  Snowflake,
} from "lucide-react";
import { statusBadgeClasses } from "@/lib/design-tokens";

// --- Types ---

export interface InvestorSummary {
  id: string;
  name: string;
  email: string;
  entityName: string | null;
  entityType: string | null;
  commitment: number;
  funded: number;
  status: string;
  stage: string;
  accreditationStatus: string | null;
  ndaSigned: boolean;
  leadSource: string | null;
  createdAt: string;
  lastActivityAt?: string | null;
  fundingStatus?: string;
}

export type ViewMode = "table" | "kanban";
export type EngagementFilter = "all" | "hot" | "warm" | "cool" | "none";
export type DateRange = "all" | "7d" | "30d" | "90d" | "custom";

// --- Constants ---

export const STAGE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string; badgeClassName: string }
> = {
  APPLIED: { label: "Lead", color: "text-gray-600", bgColor: "bg-gray-100", borderColor: "border-gray-300", badgeClassName: statusBadgeClasses.applied },
  UNDER_REVIEW: { label: "Under Review", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-300", badgeClassName: statusBadgeClasses.underReview },
  APPROVED: { label: "Approved", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-300", badgeClassName: statusBadgeClasses.approved },
  COMMITTED: { label: "Committed", color: "text-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-300", badgeClassName: statusBadgeClasses.committed },
  DOCS_APPROVED: { label: "Docs Approved", color: "text-indigo-600", bgColor: "bg-indigo-50", borderColor: "border-indigo-300", badgeClassName: statusBadgeClasses.docsApproved },
  FUNDED: { label: "Funded", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-300", badgeClassName: statusBadgeClasses.funded },
  REJECTED: { label: "Rejected", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-300", badgeClassName: statusBadgeClasses.rejected },
};

export const KANBAN_STAGES = ["APPLIED", "UNDER_REVIEW", "APPROVED", "COMMITTED", "DOCS_APPROVED", "FUNDED"];

export const ENTITY_ICONS: Record<string, typeof User> = {
  INDIVIDUAL: User,
  JOINT: Users,
  LLC: Building2,
  CORPORATION: Building2,
  TRUST: Briefcase,
  PARTNERSHIP: Users,
  RETIREMENT: CreditCard,
  IRA: CreditCard,
  CHARITY: Shield,
  OTHER: User,
};

export const ENTITY_LABELS: Record<string, string> = {
  INDIVIDUAL: "Individual",
  JOINT: "Joint",
  LLC: "LLC",
  CORPORATION: "Corp",
  TRUST: "Trust",
  PARTNERSHIP: "Partnership",
  RETIREMENT: "IRA",
  IRA: "IRA",
  CHARITY: "Charity",
  OTHER: "Other",
};

export const FUNDING_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_FUNDED: { label: "Not Funded", className: statusBadgeClasses.notFunded },
  PENDING_WIRE: { label: "Pending Wire", className: statusBadgeClasses.pendingWire },
  WIRE_UPLOADED: { label: "Wire Uploaded", className: statusBadgeClasses.wireUploaded },
  CONFIRMED: { label: "Confirmed", className: statusBadgeClasses.confirmed },
};

// --- Utility Functions ---

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

export function getEngagementScore(investor: InvestorSummary): number {
  let score = 0;
  if (investor.ndaSigned) score += 5;
  if (investor.commitment > 0) score += 10;
  if (investor.funded > 0) score += 5;
  if (
    investor.accreditationStatus === "VERIFIED" ||
    investor.accreditationStatus === "SELF_ATTESTED" ||
    investor.accreditationStatus === "SELF_CERTIFIED" ||
    investor.accreditationStatus === "THIRD_PARTY_VERIFIED" ||
    investor.accreditationStatus === "KYC_VERIFIED"
  )
    score += 3;
  return score;
}

export function getEngagementTier(score: number): "hot" | "warm" | "cool" | "none" {
  if (score >= 15) return "hot";
  if (score >= 5) return "warm";
  if (score >= 1) return "cool";
  return "none";
}

export function getEngagementBadge(score: number): {
  label: string;
  tier: "hot" | "warm" | "cool" | "none";
  className: string;
  icon: typeof Flame | null;
} {
  if (score >= 15) return { label: "Hot", tier: "hot", className: statusBadgeClasses.hot, icon: Flame };
  if (score >= 5) return { label: "Warm", tier: "warm", className: statusBadgeClasses.warm, icon: Thermometer };
  if (score >= 1) return { label: "Cool", tier: "cool", className: statusBadgeClasses.cool, icon: Snowflake };
  return { label: "None", tier: "none", className: statusBadgeClasses.none, icon: null };
}

export function getFundingStatus(investor: InvestorSummary): string {
  if (investor.funded > 0 && investor.funded >= investor.commitment) return "CONFIRMED";
  if (investor.status === "PROOF_UPLOADED" || investor.fundingStatus === "PROOF_UPLOADED") return "WIRE_UPLOADED";
  if (investor.commitment > 0 && investor.funded === 0) return "PENDING_WIRE";
  return "NOT_FUNDED";
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function exportCSV(investors: InvestorSummary[]) {
  const headers = [
    "Name", "Email", "Entity", "Entity Type", "Stage", "Commitment",
    "Funded", "Funding Status", "NDA Signed", "Accreditation", "Engagement",
    "Lead Source", "Last Activity", "Date Added",
  ];
  const rows = investors.map((inv) => {
    const score = getEngagementScore(inv);
    const eng = getEngagementBadge(score);
    const funding = getFundingStatus(inv);
    return [
      inv.entityName || inv.name,
      inv.email,
      inv.entityName || "",
      inv.entityType || "",
      STAGE_CONFIG[inv.stage]?.label || inv.stage,
      inv.commitment.toString(),
      inv.funded.toString(),
      FUNDING_STATUS_CONFIG[funding]?.label || funding,
      inv.ndaSigned ? "Yes" : "No",
      inv.accreditationStatus || "N/A",
      eng.label,
      inv.leadSource || "Unknown",
      inv.lastActivityAt ? new Date(inv.lastActivityAt).toISOString() : "",
      new Date(inv.createdAt).toLocaleDateString(),
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `investors-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
