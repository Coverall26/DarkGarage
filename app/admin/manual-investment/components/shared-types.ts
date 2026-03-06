export type ManualInvestment = {
  id: string;
  investorId: string;
  fundId: string;
  documentType: string;
  documentTitle: string;
  documentNumber: string | null;
  commitmentAmount: string;
  fundedAmount: string;
  unfundedAmount: string | null;
  units: string | null;
  shares: string | null;
  pricePerUnit: string | null;
  ownershipPercent: string | null;
  signedDate: string;
  effectiveDate: string | null;
  fundedDate: string | null;
  transferMethod: string | null;
  transferStatus: string;
  transferRef: string | null;
  bankName: string | null;
  accountLast4: string | null;
  status: string;
  isVerified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  proofStatus: string;
  proofFileName: string | null;
  proofUploadedAt: string | null;
  proofVerifiedAt: string | null;
  proofRejectedAt: string | null;
  proofRejectionReason: string | null;
  proofNotes: string | null;
  notes: string | null;
  createdAt: string;
  investor: {
    id: string;
    user: { name: string | null; email: string };
  };
  fund: { id: string; name: string };
};

export type Fund = { id: string; name: string };

export type TabKey = "all" | "needs_review" | "proof_uploaded" | "verified" | "rejected";

export type TabCounts = Record<TabKey, number>;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const PROOF_STATUS_LABELS: Record<string, string> = {
  NOT_UPLOADED: "No Proof",
  UPLOADED: "Proof Uploaded",
  VERIFIED: "Proof Verified",
  REJECTED: "Proof Rejected",
  RECEIVED: "Proof Received",
  PENDING: "Pending Review",
  NOT_REQUIRED: "Not Required",
};

export const PROOF_STATUS_COLORS: Record<string, string> = {
  NOT_UPLOADED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  UPLOADED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  VERIFIED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  RECEIVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  NOT_REQUIRED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  SUBMITTED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs Review" },
  { key: "proof_uploaded", label: "Proof Uploaded" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

export function formatCurrency(value: string | number | null | undefined): string {
  if (value == null) return "$0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function filterByTab(investments: ManualInvestment[], tab: TabKey): ManualInvestment[] {
  switch (tab) {
    case "needs_review":
      return investments.filter(
        (i) =>
          !i.isVerified ||
          i.status === "SUBMITTED" ||
          i.status === "DRAFT",
      );
    case "proof_uploaded":
      return investments.filter(
        (i) =>
          i.proofStatus === "UPLOADED" ||
          i.proofStatus === "PENDING" ||
          i.proofStatus === "RECEIVED",
      );
    case "verified":
      return investments.filter(
        (i) => i.isVerified && i.proofStatus === "VERIFIED",
      );
    case "rejected":
      return investments.filter(
        (i) =>
          i.status === "REJECTED" || i.proofStatus === "REJECTED",
      );
    default:
      return investments;
  }
}
