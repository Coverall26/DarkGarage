// ─── Offering Page Types & Helpers ───────────────────────────────────────────

export interface OfferingData {
  slug: string;
  fundId: string;
  teamId: string;
  heroHeadline: string;
  heroSubheadline: string | null;
  heroImageUrl: string | null;
  heroBadgeText: string | null;
  fundName: string;
  fundStatus: string;
  targetRaise: string | null;
  minimumInvestment: string | null;
  currentRaise: string | null;
  totalCommitted: string;
  totalInbound: string;
  investorCount: number;
  closingDate: string | null;
  entityMode: string;
  fundSubType: string | null;
  regulationDExemption: string | null;
  currency: string;
  managementFeePct: string | null;
  carryPct: string | null;
  hurdleRate: string | null;
  termYears: number | null;
  extensionYears: number | null;
  waterfallType: string | null;
  orgName: string;
  orgLogo: string | null;
  orgDescription: string | null;
  orgSector: string | null;
  orgGeography: string | null;
  orgWebsite: string | null;
  orgFoundedYear: number | null;
  orgCity: string | null;
  orgState: string | null;
  offeringDescription: string | null;
  keyMetrics: Array<{ label: string; value: string; subtext?: string }> | null;
  highlights: Array<{ title: string; description: string; icon?: string }> | null;
  dealTerms: Array<{ label: string; value: string }> | null;
  timeline: Array<{
    date: string;
    title: string;
    description?: string;
    status: "completed" | "current" | "upcoming";
  }> | null;
  leadership: Array<{
    name: string;
    title: string;
    bio?: string;
    imageUrl?: string;
  }> | null;
  gallery: Array<{ url: string; caption?: string; type: "image" | "video" }> | null;
  dataroomDocuments: Array<{
    name: string;
    type: string;
    isGated: boolean;
    url?: string;
  }> | null;
  financialProjections: {
    sections: Array<{
      title: string;
      headers: string[];
      rows: Array<{ label: string; values: string[] }>;
    }>;
  } | null;
  advantages: Array<{ title: string; description: string; icon?: string }> | null;
  ctaText: string;
  ctaSecondary: string | null;
  emailGateEnabled: boolean;
  brandColor: string;
  accentColor: string;
  logoUrl: string | null;
  customCss: string | null;
  disclaimerText: string | null;
  removeBranding: boolean;
  metaTitle: string;
  metaDescription: string | null;
  metaImageUrl: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

import {
  TrendingUp,
  Target,
  Users,
  Shield,
  DollarSign,
  Building2,
  BarChart3,
  Briefcase,
  Award,
  Globe,
  Landmark,
} from "lucide-react";

export function formatCurrency(value: string | number | null, currency = "USD"): string {
  if (!value) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  if (num >= 1_000_000_000)
    return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000)
    return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)
    return `$${(num / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPercent(value: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return `${(num * 100).toFixed(1)}%`;
}

export function getRegDLabel(exemption: string | null): string {
  switch (exemption) {
    case "506B": return "Rule 506(b)";
    case "506C": return "Rule 506(c)";
    case "REG_A_PLUS": return "Regulation A+";
    case "RULE_504": return "Rule 504";
    default: return "Regulation D";
  }
}

export function getIconForHighlight(icon?: string) {
  const map: Record<string, typeof TrendingUp> = {
    trending: TrendingUp,
    target: Target,
    users: Users,
    shield: Shield,
    dollar: DollarSign,
    building: Building2,
    chart: BarChart3,
    briefcase: Briefcase,
    award: Award,
    globe: Globe,
    landmark: Landmark,
  };
  return map[icon || ""] || Target;
}
