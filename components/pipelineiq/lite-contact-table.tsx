"use client";

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Mail, Tag, Download, Filter, Lock } from "lucide-react";
import { LockedActionTooltip } from "./locked-action-tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  status: string;
  source: string;
  engagementScore: number;
  lastEngagedAt: string | null;
  createdAt: string;
}

interface LiteContactTableProps {
  contacts: Contact[];
  isLite: boolean;
  onRefresh: () => void;
}

// Source badge colors
const SOURCE_COLORS: Record<string, string> = {
  DATAROOM: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  MANUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  IMPORT: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  LP_REGISTRATION: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  EXPRESS_INTEREST: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  ESIGN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
};

const SOURCE_LABELS: Record<string, string> = {
  DATAROOM: "DataRoom",
  MANUAL: "Manual",
  IMPORT: "Import",
  LP_REGISTRATION: "Investor Signup",
  EXPRESS_INTEREST: "Interest",
  ESIGN: "E-Sign",
};

// Engagement tier
function getEngagementTier(score: number): { label: string; color: string } {
  if (score >= 15) return { label: "Hot", color: "text-red-600 dark:text-red-400" };
  if (score >= 5) return { label: "Warm", color: "text-amber-600 dark:text-amber-400" };
  if (score >= 1) return { label: "Cool", color: "text-blue-600 dark:text-blue-400" };
  return { label: "None", color: "text-muted-foreground" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiteContactTable({
  contacts,
  isLite,
  onRefresh,
}: LiteContactTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Mail className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">No contacts yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Contacts from DataRoom viewers and investor signups will appear here
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar — locked actions for Lite */}
      {isLite && (
        <div className="flex items-center gap-2 pb-2">
          <LockedActionTooltip action="Email">
            <button
              disabled
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/60 border border-dashed border-muted-foreground/30 rounded-md cursor-not-allowed"
            >
              <Mail className="h-3 w-3" /> Email
              <Lock className="h-2.5 w-2.5 ml-0.5" />
            </button>
          </LockedActionTooltip>
          <LockedActionTooltip action="Export">
            <button
              disabled
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/60 border border-dashed border-muted-foreground/30 rounded-md cursor-not-allowed"
            >
              <Download className="h-3 w-3" /> Export
              <Lock className="h-2.5 w-2.5 ml-0.5" />
            </button>
          </LockedActionTooltip>
          <LockedActionTooltip action="Tag">
            <button
              disabled
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/60 border border-dashed border-muted-foreground/30 rounded-md cursor-not-allowed"
            >
              <Tag className="h-3 w-3" /> Tag
              <Lock className="h-2.5 w-2.5 ml-0.5" />
            </button>
          </LockedActionTooltip>
          <LockedActionTooltip action="Filter">
            <button
              disabled
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/60 border border-dashed border-muted-foreground/30 rounded-md cursor-not-allowed"
            >
              <Filter className="h-3 w-3" /> Filter
              <Lock className="h-2.5 w-2.5 ml-0.5" />
            </button>
          </LockedActionTooltip>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                Name
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                Email
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                Company
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                Last Activity
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                Source
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                Engagement
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const name =
                [contact.firstName, contact.lastName]
                  .filter(Boolean)
                  .join(" ") || "—";
              const srcColor =
                SOURCE_COLORS[contact.source] ??
                "bg-muted text-muted-foreground";
              const srcLabel =
                SOURCE_LABELS[contact.source] ?? contact.source;
              const eng = getEngagementTier(contact.engagementScore);

              return (
                <tr
                  key={contact.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {contact.email}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {contact.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell font-mono text-xs tabular-nums">
                    {contact.lastEngagedAt
                      ? formatDistanceToNow(new Date(contact.lastEngagedAt), {
                          addSuffix: true,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={`text-xs px-1.5 py-0 ${srcColor}`}
                    >
                      {srcLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs font-medium ${eng.color}`}>
                      {eng.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
