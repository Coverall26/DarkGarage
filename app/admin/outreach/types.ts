// ---------------------------------------------------------------------------
// Outreach Center — Shared Types & Constants
// ---------------------------------------------------------------------------

import { Clock, ListOrdered, FileText, Users } from "lucide-react";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  stepOrder: number;
  delayDays: number;
  templateId: string | null;
  aiPrompt: string | null;
  condition: string;
}

export interface Sequence {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: SequenceStep[];
  stats: {
    totalEnrolled: number;
    active: number;
    completed: number;
  };
  createdAt: string;
}

export interface FollowUp {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  company: string | null;
  nextFollowUpAt: string | null;
  engagementScore: number;
  status: string;
}

export type Tab = "queue" | "sequences" | "templates" | "bulk";

export const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "queue", label: "Follow-up Queue", icon: Clock },
  { key: "sequences", label: "Sequences", icon: ListOrdered },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "bulk", label: "Bulk Send", icon: Users },
];

export const CATEGORY_LABELS: Record<string, string> = {
  INVITATION: "Invitation",
  FOLLOW_UP: "Follow-up",
  COMMITMENT: "Commitment",
  WIRE: "Wire",
  UPDATE: "Update",
  CUSTOM: "Custom",
};

export const CONDITION_LABELS: Record<string, string> = {
  ALWAYS: "Always send",
  IF_NO_REPLY: "If no reply",
  IF_NOT_OPENED: "If not opened",
  IF_NOT_CLICKED: "If not clicked",
};
