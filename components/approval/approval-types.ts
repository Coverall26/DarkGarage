import type React from "react";
import {
  UserIcon,
  DollarSignIcon,
  FileTextIcon,
  ClipboardIcon,
} from "lucide-react";

export interface ApprovalItem {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  submissionType: "PROFILE" | "COMMITMENT" | "DOCUMENT" | "CHANGE_REQUEST";
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  fundId: string;
  fundName: string;
  teamId: string;
  entityType?: string;
  commitmentAmount?: number;
  accreditationStatus?: string;
  accreditationMethod?: string | null;
  accreditationDocumentIds?: string[];
  documentType?: string;
  // For change requests
  changeRequest?: {
    id: string;
    fieldName: string;
    currentValue: string;
    requestedValue: string;
    reason: string;
  };
  // Inline editable fields
  fields?: Array<{
    name: string;
    label: string;
    value: string;
    editable: boolean;
  }>;
}

export interface GPApprovalQueueProps {
  teamId: string;
  fundId?: string;
  onApprovalCountChange?: (count: number) => void;
}

export type TabValue = "all" | "pending" | "approved" | "rejected" | "changes_requested";

export const TABS: Array<{ value: TabValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes Requested" },
];

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  PROFILE: "Profile",
  COMMITMENT: "Commitment",
  DOCUMENT: "Document",
  CHANGE_REQUEST: "Change Request",
};

export const SUBMISSION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PROFILE: UserIcon,
  COMMITMENT: DollarSignIcon,
  DOCUMENT: FileTextIcon,
  CHANGE_REQUEST: ClipboardIcon,
};
