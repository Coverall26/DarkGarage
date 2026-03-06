"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  LayoutGrid,
  Activity,
  Lock,
  Plus,
  Search,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { useTier } from "@/lib/hooks/use-tier";
import { ContactCapCounter } from "@/components/crm/ContactCapCounter";
import { PipelineIQUpgradeCard } from "@/components/pipelineiq/upgrade-card";
import { LockedActionTooltip } from "@/components/pipelineiq/locked-action-tooltip";
import { LiteContactTable } from "@/components/pipelineiq/lite-contact-table";
import { FrostedKanban } from "@/components/pipelineiq/frosted-kanban";
import { ActivityTimeline } from "@/components/pipelineiq/activity-timeline";
import { EmptyState } from "@/components/ui/empty-state";

// Dynamically import heavy CRM components for full users
const ContactKanban = dynamic(
  () =>
    import("@/components/crm/ContactKanban").then((m) => ({
      default: m.ContactKanban,
    })),
  {
    loading: () => (
      <div className="h-64 animate-pulse bg-muted rounded-lg" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  status: string;
  source: string;
  engagementScore: number;
  lastEngagedAt: string | null;
  createdAt: string;
  tags: string[] | null;
}

type TabKey = "contacts" | "pipeline" | "activity";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PipelineIQPageClient() {
  const { tier, limits, usage, isLoading: tierLoading } = useTier();

  const [activeTab, setActiveTab] = useState<TabKey>("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);

  // Determine module level
  const isLite =
    tier === "FREE" || (!limits?.hasKanban && tier !== "FUNDROOM");
  const isFull = !isLite;
  const contactLimit = usage?.contactLimit ?? 20;
  const contactCount = usage?.contactCount ?? 0;
  const isAtLimit = contactLimit !== null && contactCount >= contactLimit;

  // Fetch team context
  useEffect(() => {
    fetch("/api/admin/team-context")
      .then((r) => r.json())
      .then((d) => setTeamId(d.teamId))
      .catch(() => {});
  }, []);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts ?? data ?? []);
      }
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Filtered contacts
  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.firstName?.toLowerCase().includes(q) ?? false) ||
      (c.lastName?.toLowerCase().includes(q) ?? false) ||
      (c.company?.toLowerCase().includes(q) ?? false)
    );
  });

  // Pipeline stages
  const pipelineStages = limits?.pipelineStages ?? [
    "LEAD",
    "CONTACTED",
    "INTERESTED",
    "CONVERTED",
  ];

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------

  const tabs: { key: TabKey; label: string; icon: typeof Users; locked?: boolean }[] =
    [
      { key: "contacts", label: "Contacts", icon: Users },
      {
        key: "pipeline",
        label: "Pipeline",
        icon: LayoutGrid,
        locked: isLite,
      },
      { key: "activity", label: "Activity", icon: Activity },
    ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">PipelineIQ</h1>
          <p className="text-sm text-muted-foreground">
            {isLite
              ? "Track contacts and viewer activity"
              : "Full CRM pipeline with Kanban, outreach, and AI insights"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ContactCapCounter />
          {isLite && (
            <Badge
              variant="outline"
              className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-600"
            >
              Lite
            </Badge>
          )}
          {isFull && (
            <Badge className="bg-amber-600 text-white">Full</Badge>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
                isActive
                  ? "border-[#F59E0B] text-[#F59E0B]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
              {tab.locked && (
                <Lock className="h-3 w-3 text-amber-500 ml-1" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* ── Contacts Tab ── */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            {/* Search + Add */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  className="pl-9 text-base sm:text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchContacts}
                  className="min-h-[44px]"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
                {isLite ? (
                  <LockedActionTooltip action="Add Contact">
                    <Button size="sm" disabled className="min-h-[44px] opacity-60">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Contact
                      <Lock className="h-3 w-3 ml-1" />
                    </Button>
                  </LockedActionTooltip>
                ) : (
                  <Button
                    size="sm"
                    className="min-h-[44px] bg-[#F59E0B] hover:bg-[#D97706] text-white"
                    onClick={() => {
                      window.location.href = "/admin/raise-crm";
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Contact
                  </Button>
                )}
              </div>
            </div>

            {/* Upgrade card when at limit */}
            {isLite && isAtLimit && (
              <PipelineIQUpgradeCard
                contactCount={contactCount}
                contactLimit={contactLimit ?? 20}
              />
            )}

            {/* Contact List */}
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse bg-muted rounded-md"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={search ? "No matching contacts" : "No contacts yet"}
                description={
                  search
                    ? "Try adjusting your search terms."
                    : "Add your first contact to start building your pipeline."
                }
                actionLabel={search ? undefined : "Add Contact"}
                onAction={search ? undefined : () => toast.info("Use the + button above to add a contact.")}
                accentColor="#F59E0B"
              />
            ) : (
              <LiteContactTable
                contacts={filtered}
                isLite={isLite}
                onRefresh={fetchContacts}
              />
            )}
          </div>
        )}

        {/* ── Pipeline Tab ── */}
        {activeTab === "pipeline" && (
          <div>
            {isLite ? (
              <FrostedKanban
                contacts={contacts}
                pipelineStages={pipelineStages}
              />
            ) : (
              <ContactKanban
                contacts={contacts.map((c) => ({
                  ...c,
                  lastContactedAt: null,
                  investorId: null,
                  nextFollowUpAt: null,
                  createdAt: c.createdAt,
                  contactActivities: [],
                }))}
                pipelineStages={pipelineStages}
                tier={tier}
                aiCrmEnabled={false}
                onStatusChange={async (contactId: string, newStatus: string) => {
                  try {
                    const res = await fetch(`/api/contacts/${contactId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: newStatus }),
                    });
                    if (res.ok) {
                      fetchContacts();
                      toast.success("Contact moved");
                    }
                  } catch {
                    toast.error("Failed to update");
                  }
                }}
                onCardClick={() => {}}
              />
            )}
          </div>
        )}

        {/* ── Activity Tab ── */}
        {activeTab === "activity" && (
          <ActivityTimeline teamId={teamId} />
        )}
      </div>
    </div>
  );
}
