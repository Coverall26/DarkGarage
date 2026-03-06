"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Wallet,
  FileText,
  Settings,
  Shield,
  ShieldCheck,
  Store,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ClipboardCheck,
  Rocket,
  Landmark,
  Menu,
  X,
  CreditCard,
  UserSearch,
  LayoutTemplate,
  FolderIcon,
  FolderArchive,
  FileSignature,
  Contact,
  Brush,
  ServerIcon,
  Send,
  Crown,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ── Suite colors (from FundRoom Brand Guidelines) ──

const SUITE_COLORS = {
  fundroom: "#8B5CF6",  // Purple — Full platform
  raiseroom: "#06B6D4", // Cyan — Capital raise management
  signsuite: "#10B981", // Emerald — E-signature
  pipelineiq: "#F59E0B", // Amber — Investor pipeline
  dataroom: "#2563EB",  // Blue — Document filing
  admin: "#0066FF",     // Electric Blue — Admin tools
} as const;

// ── Mode type (matches Organization.featureFlags.mode) ──

type OrgMode = "GP_FUND" | "STARTUP" | "DATAROOM_ONLY";

// ── Nav item definition ──

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPaths: string[];
  comingSoon?: boolean;
  badgeKey?: string;
  sectionLabel?: string;
  activeColor?: string;
}

interface PendingCounts {
  pendingWires: number;
  pendingDocs: number;
  needsReview: number;
  awaitingWire: number;
  total: number;
}

// ── Suite-grouped navigation ──

// FundRoom (Purple) — Platform-level items always visible
const FUNDROOM_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    matchPaths: ["/admin/dashboard"],
    sectionLabel: "FundRoom",
    activeColor: SUITE_COLORS.fundroom,
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    matchPaths: ["/admin/analytics", "/dashboard"],
    activeColor: SUITE_COLORS.fundroom,
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: TrendingUp,
    matchPaths: ["/admin/reports"],
    activeColor: SUITE_COLORS.fundroom,
  },
];

// RaiseRoom (Cyan) — Capital raise operations
const RAISEROOM_GP_ITEMS: NavItem[] = [
  {
    label: "Raise Dashboard",
    href: "/admin/raiseroom",
    icon: Building2,
    matchPaths: ["/admin/raiseroom"],
    sectionLabel: "Raise Management",
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Funds",
    href: "/admin/fund",
    icon: Landmark,
    matchPaths: ["/admin/fund"],
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Investors",
    href: "/admin/investors",
    icon: Users,
    matchPaths: ["/admin/investors"],
    badgeKey: "needsReview",
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Manual Entry",
    href: "/admin/investors/new",
    icon: Wallet,
    matchPaths: ["/admin/investors/new", "/admin/manual-investment"],
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Approvals",
    href: "/admin/approvals",
    icon: ClipboardCheck,
    matchPaths: ["/admin/approvals"],
    badgeKey: "needsReview",
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Transactions",
    href: "/admin/transactions",
    icon: CreditCard,
    matchPaths: ["/admin/transactions"],
    badgeKey: "pendingWires",
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Offering Page",
    href: "/admin/offering",
    icon: LayoutTemplate,
    matchPaths: ["/admin/offering"],
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Marketplace",
    href: "/admin/marketplace",
    icon: Store,
    matchPaths: ["/admin/marketplace"],
    comingSoon: true,
    activeColor: SUITE_COLORS.raiseroom,
  },
];

const RAISEROOM_STARTUP_ITEMS: NavItem[] = [
  {
    label: "Raise Dashboard",
    href: "/admin/raiseroom",
    icon: Building2,
    matchPaths: ["/admin/raiseroom"],
    sectionLabel: "Raise Management",
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Raises",
    href: "/admin/fund",
    icon: Rocket,
    matchPaths: ["/admin/fund"],
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Investors",
    href: "/admin/investors",
    icon: Users,
    matchPaths: ["/admin/investors"],
    badgeKey: "needsReview",
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Manual Entry",
    href: "/admin/investors/new",
    icon: Wallet,
    matchPaths: ["/admin/investors/new", "/admin/manual-investment"],
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Approvals",
    href: "/admin/approvals",
    icon: ClipboardCheck,
    matchPaths: ["/admin/approvals"],
    badgeKey: "needsReview",
    activeColor: SUITE_COLORS.raiseroom,
  },
  {
    label: "Transactions",
    href: "/admin/transactions",
    icon: CreditCard,
    matchPaths: ["/admin/transactions"],
    badgeKey: "pendingWires",
    activeColor: SUITE_COLORS.raiseroom,
  },
];

// SignSuite (Emerald) — E-signature
const SIGNSUITE_ITEMS: NavItem[] = [
  {
    label: "SignSuite",
    href: "/admin/signsuite",
    icon: FileSignature,
    matchPaths: ["/admin/signsuite"],
    sectionLabel: "SignSuite",
    activeColor: SUITE_COLORS.signsuite,
  },
];

// PipelineIQ (Amber) — Investor pipeline
const PIPELINEIQ_ITEMS: NavItem[] = [
  {
    label: "PipelineIQ",
    href: "/admin/raise-crm",
    icon: UserSearch,
    matchPaths: ["/admin/raise-crm"],
    sectionLabel: "PipelineIQ",
    activeColor: SUITE_COLORS.pipelineiq,
  },
  {
    label: "Outreach",
    href: "/admin/outreach",
    icon: Send,
    matchPaths: ["/admin/outreach"],
    activeColor: SUITE_COLORS.pipelineiq,
  },
];

// DataRoom (Blue) — Document filing & storage
const DATAROOM_ITEMS: NavItem[] = [
  {
    label: "DataRoom",
    href: "/admin/dataroom",
    icon: FolderArchive,
    matchPaths: ["/admin/dataroom"],
    sectionLabel: "DocRooms",
    activeColor: SUITE_COLORS.dataroom,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FolderIcon,
    matchPaths: ["/documents"],
    activeColor: SUITE_COLORS.dataroom,
  },
  {
    label: "Datarooms",
    href: "/datarooms",
    icon: ServerIcon,
    matchPaths: ["/datarooms"],
    activeColor: SUITE_COLORS.dataroom,
  },
  {
    label: "Investor Documents",
    href: "/admin/documents",
    icon: FileText,
    matchPaths: ["/admin/documents"],
    badgeKey: "pendingDocs",
    activeColor: SUITE_COLORS.dataroom,
  },
  {
    label: "Visitors",
    href: "/visitors",
    icon: Contact,
    matchPaths: ["/visitors"],
    activeColor: SUITE_COLORS.dataroom,
  },
  {
    label: "Branding",
    href: "/branding",
    icon: Brush,
    matchPaths: ["/branding"],
    activeColor: SUITE_COLORS.dataroom,
  },
];

// Admin Tools — always at bottom
const ADMIN_ITEMS: NavItem[] = [
  {
    label: "Entities",
    href: "/admin/entities",
    icon: Building2,
    matchPaths: ["/admin/entities"],
    sectionLabel: "Admin",
    activeColor: SUITE_COLORS.admin,
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    icon: Shield,
    matchPaths: ["/admin/audit"],
    activeColor: SUITE_COLORS.admin,
  },
  {
    label: "SEC Compliance",
    href: "/admin/compliance",
    icon: ShieldCheck,
    matchPaths: ["/admin/compliance"],
    activeColor: SUITE_COLORS.admin,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    matchPaths: ["/admin/settings"],
    activeColor: SUITE_COLORS.admin,
  },
];

function getNavItems(mode: OrgMode): NavItem[] {
  const raiseroomItems =
    mode === "GP_FUND"
      ? RAISEROOM_GP_ITEMS
      : mode === "STARTUP"
        ? RAISEROOM_STARTUP_ITEMS
        : []; // DATAROOM_ONLY has no raise section

  return [
    ...FUNDROOM_ITEMS,
    ...raiseroomItems,
    ...SIGNSUITE_ITEMS,
    ...PIPELINEIQ_ITEMS,
    ...DATAROOM_ITEMS,
    ...ADMIN_ITEMS,
  ];
}

// ── Sidebar component ──

interface AdminSidebarProps {
  mode?: OrgMode;
}

export function AdminSidebar({ mode: propMode }: AdminSidebarProps) {
  const pathname = usePathname() ?? "";
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgMode, setOrgMode] = useState<OrgMode>(propMode ?? "GP_FUND");
  const [pendingCounts, setPendingCounts] = useState<PendingCounts | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);

  // Detect tablet viewport (768-1023px) — force collapsed sidebar
  useEffect(() => {
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsTablet(e.matches);
    };
    handleChange(tabletQuery);
    tabletQuery.addEventListener("change", handleChange);
    return () => tabletQuery.removeEventListener("change", handleChange);
  }, []);

  // Sidebar is collapsed on tablet regardless of user preference
  const collapsed = isTablet || userCollapsed;

  // Fetch org mode from API if not provided via props
  const fetchOrgMode = useCallback(async () => {
    if (propMode) return;
    try {
      const res = await fetch("/api/admin/team-context");
      if (res.ok) {
        const data = await res.json();
        if (data.mode === "STARTUP" || data.mode === "DATAROOM_ONLY") {
          setOrgMode(data.mode);
        }
      }
    } catch {
      // Fall back to GP_FUND
    }
  }, [propMode]);

  useEffect(() => {
    fetchOrgMode();
  }, [fetchOrgMode]);

  // Detect platform owner status
  useEffect(() => {
    fetch("/api/admin/platform/settings")
      .then((r) => {
        if (r.ok) setIsPlatformOwner(true);
      })
      .catch(() => {
        /* not platform owner */
      });
  }, []);

  // Fetch pending action counts for badges
  const fetchPendingCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard-stats");
      if (res.ok) {
        const data = await res.json();
        setPendingCounts(data.pendingActions || null);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchPendingCounts();
    const interval = setInterval(fetchPendingCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchPendingCounts]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = [
    ...getNavItems(orgMode),
    ...(isPlatformOwner
      ? [
          {
            label: "Platform Admin",
            href: "/admin/settings?tab=platform",
            icon: Crown,
            matchPaths: [] as string[],
            sectionLabel: "Platform",
            activeColor: SUITE_COLORS.fundroom,
          },
        ]
      : []),
  ];

  const modeLabel =
    orgMode === "GP_FUND"
      ? "GP Admin"
      : orgMode === "STARTUP"
        ? "Startup Admin"
        : "Dataroom Admin";

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        {!collapsed ? (
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/_static/fundroom-icon.png"
              alt="FundRoom AI"
              className="h-7 w-7 rounded"
            />
            <span className="text-lg font-bold text-foreground tracking-tight">FundRoom</span>
          </Link>
        ) : (
          <Link href="/admin/dashboard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/_static/fundroom-icon.png"
              alt="FundRoom AI"
              className="h-7 w-7 rounded"
            />
          </Link>
        )}
        <button
          onClick={() => setUserCollapsed(!userCollapsed)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hidden lg:flex lg:items-center lg:justify-center min-h-[44px] min-w-[44px]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPaths.some((p) =>
            pathname.startsWith(p),
          );
          const badgeCount = item.badgeKey && pendingCounts
            ? (pendingCounts as unknown as Record<string, number>)[item.badgeKey] || 0
            : 0;

          return (
            <div key={item.href}>
              {/* Section divider + label */}
              {item.sectionLabel && (
                <div className="pt-3 pb-1 first:pt-0">
                  <div className="border-t border-border mx-1 mb-2" />
                  {!collapsed && (
                    <p
                      className="px-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: `${item.activeColor ?? SUITE_COLORS.admin}80` }}
                    >
                      {item.sectionLabel}
                    </p>
                  )}
                  {collapsed && (
                    <div
                      className="mx-auto w-1.5 h-1.5 rounded-full mb-1"
                      style={{ backgroundColor: item.activeColor ?? SUITE_COLORS.admin }}
                      title={item.sectionLabel}
                    />
                  )}
                </div>
              )}
              <Link
                href={item.comingSoon ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors min-h-[40px] relative",
                  isActive
                    ? "font-medium border-l-2"
                    : item.comingSoon
                      ? "text-muted-foreground/50 cursor-default"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2",
                )}
                style={
                  isActive
                    ? {
                        color: item.activeColor ?? SUITE_COLORS.admin,
                        borderLeftColor: item.activeColor ?? SUITE_COLORS.admin,
                        backgroundColor: `${item.activeColor ?? SUITE_COLORS.admin}1A`,
                      }
                    : undefined
                }
                title={collapsed ? item.label : undefined}
                onClick={item.comingSoon ? (e) => e.preventDefault() : undefined}
              >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && (
                <span className="flex items-center gap-2 flex-1">
                  {item.label}
                  {item.comingSoon && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground/50">
                      Soon
                    </Badge>
                  )}
                  {badgeCount > 0 && (
                    <span className="ml-auto bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-xs font-bold font-mono px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {badgeCount}
                    </span>
                  )}
                </span>
              )}
              {collapsed && badgeCount > 0 && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-amber-500" />
              )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        {!collapsed && (
          <p className="text-xs text-muted-foreground text-center">
            {modeLabel}
          </p>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button — only visible below md (768px) */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-md bg-background border border-border shadow-sm md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen w-64 bg-background border-r border-border flex flex-col z-50 transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-2 rounded hover:bg-muted text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop/Tablet sidebar — visible at md+ (768px+), auto-collapsed on tablet (768-1023px) */}
      <aside
        className={cn(
          "sticky top-0 h-screen border-r border-border bg-muted/30 flex-col transition-all duration-200 hidden md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
