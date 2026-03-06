export interface WireInstructions {
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode?: string;
  beneficiaryName: string;
  beneficiaryAddress?: string;
  reference?: string;
  notes?: string;
}

export interface PendingTransaction {
  id: string;
  investorName: string;
  investorEmail: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  fundName: string;
  initiatedAt: string;
  description: string | null;
}

export interface ConfirmForm {
  fundsReceivedDate: string;
  amountReceived: string;
  bankReference: string;
  confirmationNotes: string;
  confirmed: boolean;
  bankStatementFileName: string;
}

export const formatCurrency = (value: number): string =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};
