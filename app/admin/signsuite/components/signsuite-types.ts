import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Send,
  Eye,
  PenLine,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { statusBadgeClasses } from "@/lib/design-tokens";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Recipient {
  id?: string;
  name: string;
  email: string;
  role: "SIGNER" | "CC" | "CERTIFIED_DELIVERY";
  order: number;
  status?: string;
  signedAt?: string | null;
  viewedAt?: string | null;
  declinedAt?: string | null;
  declinedReason?: string | null;
}

export interface Envelope {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  signingMode: string;
  emailSubject?: string | null;
  emailMessage?: string | null;
  expiresAt?: string | null;
  reminderEnabled: boolean;
  reminderDays: number;
  maxReminders: number;
  sourceFileName?: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  completedAt?: string | null;
  declinedAt?: string | null;
  declinedBy?: string | null;
  voidedAt?: string | null;
  voidedReason?: string | null;
  recipients: Recipient[];
  createdBy?: { name: string | null; email: string };
}

export interface SignatureTemplate {
  id: string;
  name: string;
  description: string | null;
  file: string;
  numPages: number | null;
  usageCount: number;
  defaultRecipients: Recipient[] | null;
  fields: FieldPlacement[] | null;
  defaultEmailSubject: string | null;
  defaultEmailMessage: string | null;
  defaultExpirationDays: number | null;
  createdAt: string;
}

export interface FieldPlacement {
  id: string;
  type: string;
  label: string;
  page: number;
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage of page width
  height: number; // percentage of page height
  required: boolean;
  recipientIndex: number; // which recipient this field belongs to
  options?: string[]; // for DROPDOWN/RADIO
  fieldFormat?: string; // for NUMERIC/CURRENCY
  groupId?: string; // for RADIO group linking
  minValue?: number; // for NUMERIC/CURRENCY min bound
  maxValue?: number; // for NUMERIC/CURRENCY max bound
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

export interface StatusInfo {
  icon: LucideIcon;
  color: string;
  badgeClassName: string;
  label: string;
}

export const STATUS_CONFIG: Record<string, StatusInfo> = {
  DRAFT: { icon: FileText, color: "text-gray-500", badgeClassName: statusBadgeClasses.draft, label: "Draft" },
  PREPARING: { icon: Clock, color: "text-blue-500", badgeClassName: statusBadgeClasses.preparing, label: "Preparing" },
  SENT: { icon: Send, color: "text-blue-600", badgeClassName: statusBadgeClasses.sent, label: "Sent" },
  VIEWED: { icon: Eye, color: "text-indigo-500", badgeClassName: statusBadgeClasses.viewed, label: "Viewed" },
  PARTIALLY_SIGNED: { icon: PenLine, color: "text-amber-500", badgeClassName: statusBadgeClasses.partiallySigned, label: "Partially Signed" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-600", badgeClassName: statusBadgeClasses.completed, label: "Completed" },
  DECLINED: { icon: XCircle, color: "text-red-500", badgeClassName: statusBadgeClasses.declined, label: "Declined" },
  VOIDED: { icon: Ban, color: "text-gray-400", badgeClassName: statusBadgeClasses.voided, label: "Voided" },
  EXPIRED: { icon: AlertTriangle, color: "text-amber-600", badgeClassName: statusBadgeClasses.expired, label: "Expired" },
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export type TabKey = "all" | "active" | "completed" | "templates" | "drafts" | "batches";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "templates", label: "Templates" },
  { key: "drafts", label: "Drafts" },
  { key: "batches", label: "Bulk Sends" },
];
