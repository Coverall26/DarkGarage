import {
  User,
  FileCheck,
  Shield,
  Building2,
  DollarSign,
  CheckCircle2,
} from "lucide-react";

// --- Core Types ---

export interface InvestorProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  entityName: string | null;
  entityType: string | null;
  ndaSigned: boolean;
  ndaSignedAt: string | null;
  accreditationStatus: string | null;
  accreditationType: string | null;
  kycStatus: string | null;
  kycVerifiedAt: string | null;
  fundData: Record<string, unknown> | null;
  createdAt: string;
  investments: Array<{
    id: string;
    fundId: string;
    fundName: string;
    commitmentAmount: number;
    fundedAmount: number;
    transferStatus: string;
    proofStatus: string;
    createdAt: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
  stage: string;
  stageHistory: Array<{
    from: string;
    to: string;
    timestamp: string;
    by: string;
    notes?: string;
  }>;
  teamId: string;
}

export interface InvestorProfileClientProps {
  investorId: string;
}

export interface TimelineEvent {
  id: string;
  type: "stage_change" | "document" | "investment" | "wire" | "nda" | "accreditation" | "note";
  title: string;
  description?: string;
  timestamp: string;
  actor?: string;
  icon: typeof CheckCircle2;
  iconColor: string;
}

// --- Constants ---

export const STAGE_CONFIG: Record<
  string,
  { label: string; color: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }
> = {
  APPLIED: { label: "Applied", color: "text-blue-600", badgeVariant: "secondary" },
  UNDER_REVIEW: { label: "Under Review", color: "text-amber-600", badgeVariant: "secondary" },
  APPROVED: { label: "Approved", color: "text-emerald-600", badgeVariant: "default" },
  REJECTED: { label: "Rejected", color: "text-red-600", badgeVariant: "destructive" },
  COMMITTED: { label: "Committed", color: "text-purple-600", badgeVariant: "default" },
  DOCS_APPROVED: { label: "Docs Approved", color: "text-indigo-600", badgeVariant: "default" },
  FUNDED: { label: "Funded", color: "text-green-600", badgeVariant: "default" },
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "Individual",
  JOINT: "Joint Account",
  LLC: "LLC / Corporation",
  CORPORATION: "Corporation",
  TRUST: "Trust / Estate",
  PARTNERSHIP: "Partnership",
  RETIREMENT: "IRA / Retirement",
  IRA: "IRA / Retirement",
  CHARITY: "Charity / Foundation",
  OTHER: "Other Entity",
};

export const ACCREDITATION_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SELF_ATTESTED: "Self-Attested",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  NOT_STARTED: "Not Started",
};

export const KYC_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  PENDING: "In Progress",
  COMPLETED: "Completed",
  APPROVED: "Approved",
  DECLINED: "Declined",
  NEEDS_REVIEW: "Needs Review",
};

export const REPRESENTATION_LABELS = [
  { key: "accreditedCertification", label: "Accredited investor certification (SEC Rule 501(a))" },
  { key: "investingAsPrincipal", label: "Investing as principal (not agent/nominee)" },
  { key: "readOfferingDocs", label: "Read and understood offering documents" },
  { key: "riskAwareness", label: "Risk awareness — possible total loss" },
  { key: "restrictedSecurities", label: "Restricted securities acknowledgment" },
  { key: "amlOfacCompliance", label: "AML / OFAC compliance" },
  { key: "taxIdConsent", label: "Tax ID consent (K-1 preparation)" },
  { key: "independentAdvice", label: "Independent advice acknowledgment" },
];

export const ONBOARDING_STEPS = [
  { key: "account", label: "Account Created", icon: User },
  { key: "nda", label: "NDA Signed", icon: FileCheck },
  { key: "accreditation", label: "Accredited", icon: Shield },
  { key: "entity", label: "Entity Details", icon: Building2 },
  { key: "committed", label: "Committed", icon: DollarSign },
  { key: "funded", label: "Funded", icon: CheckCircle2 },
];

// --- Helper Functions ---

export function countRepresentations(reps: Record<string, boolean>): number {
  return REPRESENTATION_LABELS.filter(({ key }) => reps[key] === true).length;
}

export function getOnboardingStepStatus(
  step: string,
  investor: InvestorProfile,
): "completed" | "current" | "pending" {
  const funded = investor.investments.some((inv) => inv.fundedAmount > 0 && inv.fundedAmount >= inv.commitmentAmount);
  const committed = investor.investments.some((inv) => inv.commitmentAmount > 0);
  const hasEntity = !!investor.entityType;
  const accredited =
    investor.accreditationStatus === "VERIFIED" ||
    investor.accreditationStatus === "SELF_ATTESTED" ||
    investor.accreditationStatus === "SELF_CERTIFIED" ||
    investor.accreditationStatus === "THIRD_PARTY_VERIFIED" ||
    investor.accreditationStatus === "KYC_VERIFIED";

  const completionMap: Record<string, boolean> = {
    account: true, // Always completed if they exist
    nda: investor.ndaSigned,
    accreditation: accredited,
    entity: hasEntity,
    committed: committed,
    funded: funded,
  };

  if (completionMap[step]) return "completed";

  // Find the first incomplete step — that's "current"
  const steps = ONBOARDING_STEPS.map((s) => s.key);
  const firstIncomplete = steps.find((k) => !completionMap[k]);
  if (firstIncomplete === step) return "current";

  return "pending";
}

export function getAvailableTransitions(currentStage: string): string[] {
  const transitions: Record<string, string[]> = {
    APPLIED: ["UNDER_REVIEW", "REJECTED"],
    UNDER_REVIEW: ["APPROVED", "REJECTED"],
    APPROVED: ["COMMITTED", "REJECTED"],
    COMMITTED: ["DOCS_APPROVED", "FUNDED"],
    DOCS_APPROVED: ["FUNDED"],
    REJECTED: ["UNDER_REVIEW"],
    FUNDED: [],
  };
  return transitions[currentStage] || [];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatAddress(addr: Record<string, string>): string {
  const parts = [addr.street1, addr.street2, addr.city, addr.state, addr.zip].filter(Boolean);
  if (addr.country && addr.country !== "US") {
    parts.push(addr.country);
  }
  return parts.join(", ");
}
