"use client";

import { STATUS_CONFIG } from "./signsuite-types";
import { statusBadgeClasses } from "@/lib/design-tokens";

/**
 * Envelope-level status badge (icon + label in colored pill).
 * Uses gold standard pattern: bg-{color}-100 text-{color}-700 dark:bg-{color}-900/30 dark:text-{color}-400
 */
export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: "text-gray-500",
    badgeClassName: statusBadgeClasses.draft,
  };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeClassName}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}

/**
 * Per-recipient signing status.
 */
const RECIPIENT_MAP: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: statusBadgeClasses.recipientPending },
  SENT: { label: "Sent", className: statusBadgeClasses.recipientSent },
  VIEWED: { label: "Viewed", className: statusBadgeClasses.recipientViewed },
  SIGNED: { label: "Signed", className: statusBadgeClasses.recipientSigned },
  DECLINED: { label: "Declined", className: statusBadgeClasses.recipientDeclined },
  COMPLETED: { label: "Completed", className: statusBadgeClasses.recipientCompleted },
};

export function RecipientStatusBadge({ status }: { status: string }) {
  const cfg = RECIPIENT_MAP[status] || {
    label: status,
    className: "text-gray-400 dark:text-gray-500",
  };
  return (
    <span className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
  );
}
