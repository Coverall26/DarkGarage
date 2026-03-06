"use client";

import { Zap, TrendingUp, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  status: string;
  engagementScore: number;
}

interface FrostedKanbanProps {
  contacts: Contact[];
  pipelineStages: string[];
}

const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  CONVERTED: "Converted",
  NDA_SIGNED: "NDA Signed",
  ACCREDITED: "Accredited",
  COMMITTED: "Committed",
  FUNDED: "Funded",
};

const STAGE_COLORS: Record<string, string> = {
  LEAD: "bg-gray-200 dark:bg-gray-700",
  CONTACTED: "bg-blue-200 dark:bg-blue-800",
  INTERESTED: "bg-amber-200 dark:bg-amber-800",
  CONVERTED: "bg-green-200 dark:bg-green-800",
  NDA_SIGNED: "bg-indigo-200 dark:bg-indigo-800",
  ACCREDITED: "bg-purple-200 dark:bg-purple-800",
  COMMITTED: "bg-emerald-200 dark:bg-emerald-800",
  FUNDED: "bg-teal-200 dark:bg-teal-800",
};

/**
 * Blurred/frosted-glass Kanban board for PipelineIQ free-tier users.
 * Shows a realistic preview of the Kanban with a centered upgrade overlay.
 */
export function FrostedKanban({
  contacts,
  pipelineStages,
}: FrostedKanbanProps) {
  // Group contacts by stage for the preview
  const grouped = pipelineStages.reduce(
    (acc, stage) => {
      acc[stage] = contacts.filter((c) => c.status === stage);
      return acc;
    },
    {} as Record<string, Contact[]>,
  );

  return (
    <div className="relative rounded-lg overflow-hidden">
      {/* Blurred Kanban Preview */}
      <div className="blur-[3px] pointer-events-none select-none">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          {pipelineStages.map((stage) => {
            const stageContacts = grouped[stage] ?? [];
            const bgColor =
              STAGE_COLORS[stage] ?? "bg-gray-200 dark:bg-gray-700";
            const label = STAGE_LABELS[stage] ?? stage;

            return (
              <div
                key={stage}
                className="rounded-lg border border-border bg-background p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {stageContacts.length}
                  </span>
                </div>
                {/* Fake cards */}
                {stageContacts.length === 0 && (
                  <div className="h-16 rounded-md border border-dashed border-border" />
                )}
                {stageContacts.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-md p-2.5 ${bgColor} space-y-1`}
                  >
                    <div className="h-3 w-3/4 rounded bg-foreground/10" />
                    <div className="h-2 w-1/2 rounded bg-foreground/10" />
                  </div>
                ))}
                {stageContacts.length > 3 && (
                  <div className="text-center text-xs text-muted-foreground">
                    +{stageContacts.length - 3} more
                  </div>
                )}
                {/* If no real contacts, show placeholder cards */}
                {stageContacts.length === 0 &&
                  [1, 2].map((i) => (
                    <div
                      key={i}
                      className={`rounded-md p-2.5 ${bgColor} space-y-1`}
                    >
                      <div className="h-3 w-3/4 rounded bg-foreground/10" />
                      <div className="h-2 w-1/2 rounded bg-foreground/10" />
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/30 dark:bg-background/50 backdrop-blur-[1px]">
        <div className="rounded-xl border border-border bg-background/95 dark:bg-background/95 shadow-xl p-6 max-w-sm mx-4 text-center space-y-4">
          <div className="mx-auto rounded-full bg-amber-100 dark:bg-amber-900/50 p-3 w-fit">
            <Users className="h-6 w-6 text-[#F59E0B]" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Unlock Pipeline View
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Drag-and-drop Kanban board, automated stage transitions, and
              AI-powered pipeline insights.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/admin/settings?tab=billing" className="w-full">
              <Button className="w-full min-h-[44px] bg-[#F59E0B] hover:bg-[#D97706] text-white">
                <Zap className="h-4 w-4 mr-1.5" />
                Unlock PipelineIQ — $15/mo
              </Button>
            </Link>
            <Link href="/admin/settings?tab=billing" className="w-full">
              <Button
                variant="outline"
                className="w-full min-h-[44px]"
              >
                <TrendingUp className="h-4 w-4 mr-1.5" />
                Upgrade to Pro — $29/mo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
