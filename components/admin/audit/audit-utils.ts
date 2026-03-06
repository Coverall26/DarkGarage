import {
  Shield,
  FileText,
  Eye,
  PenTool,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { createElement } from "react";

// ─── Signature Audit Types ──────────────────────────────────────────────────

export interface SignatureAuditLog {
  id: string;
  event: string;
  documentId: string;
  documentTitle?: string;
  recipientEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// ─── General Audit Log Types ────────────────────────────────────────────────

export interface GeneralAuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
}

// ─── Chain Integrity Types ──────────────────────────────────────────────────

export interface ChainIntegrity {
  isValid: boolean;
  chainLength: number;
  lastVerifiedAt: string;
  genesisHash: string;
  latestHash: string;
}

export interface VerificationResult {
  isValid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  firstInvalidEntry?: string;
  errors: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const SIGNATURE_EVENT_TYPES = [
  { value: "all", label: "All Events" },
  { value: "document.created", label: "Document Created" },
  { value: "document.sent", label: "Document Sent" },
  { value: "document.viewed", label: "Document Viewed" },
  { value: "document.downloaded", label: "Document Downloaded" },
  { value: "recipient.signed", label: "Signature Completed" },
  { value: "recipient.declined", label: "Signature Declined" },
  { value: "document.completed", label: "Document Completed" },
  { value: "document.voided", label: "Document Voided" },
  { value: "document.expired", label: "Document Expired" },
  { value: "reminder.sent", label: "Reminder Sent" },
];

export const GENERAL_EVENT_TYPES = [
  { value: "all", label: "All Events" },
  { value: "SETTINGS_UPDATED", label: "Settings Updated" },
  { value: "INVESTOR_CREATED", label: "Investor Created" },
  { value: "INVESTOR_UPDATED", label: "Investor Updated" },
  { value: "INVESTOR_APPROVED", label: "Investor Approved" },
  { value: "INVESTOR_REJECTED", label: "Investor Rejected" },
  { value: "INVESTOR_REVIEWED", label: "Investor Reviewed" },
  { value: "INVESTOR_MANUAL_ENTRY", label: "Manual Entry" },
  { value: "BULK_INVESTOR_IMPORT", label: "Bulk Import" },
  { value: "DOCUMENT_VIEWED", label: "Document Viewed" },
  { value: "DOCUMENT_DOWNLOADED", label: "Document Downloaded" },
  { value: "DOCUMENT_SIGNED", label: "Document Signed" },
  { value: "DOCUMENT_COMPLETED", label: "Document Completed" },
  { value: "SUBSCRIPTION_CREATED", label: "Subscription Created" },
  { value: "NDA_SIGNED", label: "NDA Signed" },
  { value: "KYC_INITIATED", label: "KYC Initiated" },
  { value: "KYC_COMPLETED", label: "KYC Completed" },
  { value: "CAPITAL_CALL_CREATED", label: "Capital Call" },
  { value: "DISTRIBUTION_CREATED", label: "Distribution" },
  { value: "FUND_SETTINGS_UPDATE", label: "Fund Settings" },
  { value: "FUNDROOM_ACTIVATED", label: "FundRoom Activated" },
  { value: "USER_LOGIN", label: "User Login" },
  { value: "USER_REGISTERED", label: "User Registered" },
  { value: "ADMIN_ACTION", label: "Admin Action" },
  { value: "AUDIT_LOG_EXPORT", label: "Audit Export" },
];

export const RESOURCE_TYPES = [
  { value: "all", label: "All Resources" },
  { value: "Document", label: "Document" },
  { value: "SignatureDocument", label: "Signature Document" },
  { value: "Investor", label: "Investor" },
  { value: "Investment", label: "Investment" },
  { value: "Fund", label: "Fund" },
  { value: "User", label: "User" },
  { value: "Organization", label: "Organization" },
  { value: "Transaction", label: "Transaction" },
  { value: "Subscription", label: "Subscription" },
  { value: "AuditLog", label: "Audit Log" },
  { value: "FundroomActivation", label: "Activation" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, { icon: typeof Shield; className: string }> = {
  "document.created": { icon: FileText, className: "h-4 w-4 text-blue-500" },
  "document.sent": { icon: PenTool, className: "h-4 w-4 text-purple-500" },
  "document.viewed": { icon: Eye, className: "h-4 w-4 text-gray-500" },
  "recipient.signed": { icon: CheckCircle, className: "h-4 w-4 text-green-500" },
  "recipient.declined": { icon: XCircle, className: "h-4 w-4 text-red-500" },
  "document.completed": { icon: CheckCircle, className: "h-4 w-4 text-emerald-600" },
  "document.voided": { icon: AlertTriangle, className: "h-4 w-4 text-orange-500" },
  "document.expired": { icon: Clock, className: "h-4 w-4 text-amber-500" },
  "reminder.sent": { icon: RefreshCw, className: "h-4 w-4 text-indigo-500" },
};

export const getSignatureEventIcon = (event: string) => {
  const entry = ICON_MAP[event];
  if (entry) {
    return createElement(entry.icon, { className: entry.className });
  }
  return createElement(Shield, { className: "h-4 w-4 text-gray-400" });
};

export const getSignatureEventLabel = (event: string) => {
  const eventType = SIGNATURE_EVENT_TYPES.find((e) => e.value === event);
  return eventType?.label || event.replace(".", " ").replace(/_/g, " ");
};

export const getSignatureEventBadgeVariant = (event: string) => {
  if (event.includes("signed") || event.includes("completed")) return "default" as const;
  if (event.includes("declined") || event.includes("voided")) return "destructive" as const;
  if (event.includes("viewed") || event.includes("downloaded")) return "secondary" as const;
  return "outline" as const;
};

export const getGeneralEventBadgeVariant = (eventType: string) => {
  if (eventType.includes("APPROVED") || eventType.includes("COMPLETED") || eventType.includes("SIGNED") || eventType.includes("ACTIVATED"))
    return "default" as const;
  if (eventType.includes("REJECTED") || eventType.includes("FAILED") || eventType.includes("DEACTIVATED"))
    return "destructive" as const;
  if (eventType.includes("VIEWED") || eventType.includes("DOWNLOADED") || eventType.includes("LOGIN"))
    return "secondary" as const;
  return "outline" as const;
};

export const formatEventType = (eventType: string) => {
  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
