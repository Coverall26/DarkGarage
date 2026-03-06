import {
  User,
  Building2,
  DollarSign,
  FileText,
  ClipboardCheck,
} from "lucide-react";

/**
 * Manual Investor Entry Wizard — Shared Types & Constants
 *
 * Step 1: Basic Info — First/Last Name, Email, Phone, Lead Source
 * Step 2: Investor Details — Entity architecture + accreditation
 * Step 3: Commitment — Fund, amount, date, funding status, payments
 * Step 4: Documents — Upload signed docs per type with date-signed
 * Step 5: Review & Save — Summary + vault access option
 */

export const STEPS = [
  { id: 1, label: "Basic Info", icon: User },
  { id: 2, label: "Investor Details", icon: Building2 },
  { id: 3, label: "Commitment", icon: DollarSign },
  { id: 4, label: "Documents", icon: FileText },
  { id: 5, label: "Review & Save", icon: ClipboardCheck },
] as const;

export const ENTITY_TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "LLC", label: "LLC" },
  { value: "TRUST", label: "Trust" },
  { value: "RETIREMENT", label: "401k / IRA" },
  { value: "OTHER", label: "Other Entity" },
] as const;

export const LEAD_SOURCES = [
  { value: "DIRECT", label: "Direct Relationship" },
  { value: "REFERRAL", label: "Referral" },
  { value: "EVENT", label: "Event" },
  { value: "CONFERENCE", label: "Conference" },
  { value: "DATAROOM", label: "Dataroom Viewer" },
  { value: "OTHER", label: "Other" },
] as const;

export const PAYMENT_METHODS = [
  { value: "wire", label: "Wire Transfer" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH" },
  { value: "other", label: "Other" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "NDA", label: "Non-Disclosure Agreement" },
  { value: "SUBSCRIPTION_AGREEMENT", label: "Subscription Agreement" },
  { value: "LPA", label: "LPA / SAFE" },
  { value: "SIDE_LETTER", label: "Side Letter" },
  { value: "ACCREDITATION_PROOF", label: "Accreditation Letter" },
  { value: "FORMATION_DOCS", label: "Formation Documents" },
  { value: "K1_TAX_FORM", label: "Tax Form (W-9/W-8BEN)" },
  { value: "OTHER", label: "Other Document" },
] as const;

export interface PaymentRecord {
  amount: string;
  dateReceived: string;
  method: string;
  bankReference: string;
  notes: string;
}

export interface LeadMatch {
  email: string;
  viewedAt: string;
  linkId: string;
  documentName: string;
  source: string;
}

export interface InvestorFormData {
  // Step 1
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  leadSource: string;
  // Step 2
  entityType: string;
  entityName: string;
  taxId: string;
  address: string;
  accreditationStatus: string;
  accreditationType: string;
  accreditationVerifierName: string;
  accreditationDate: string;
  minimumInvestmentThreshold: string;
  // Step 3
  fundId: string;
  commitmentAmount: string;
  commitmentDate: string;
  specialTerms: string;
  fundingStatus: string;
  payments: PaymentRecord[];
  // Step 4
  documents: Array<{
    type: string;
    name: string;
    file: File | null;
    dateSigned: string;
  }>;
  // Step 5
  sendVaultAccess: boolean;
  notes: string;
}

export const initialFormData: InvestorFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  leadSource: "",
  entityType: "INDIVIDUAL",
  entityName: "",
  taxId: "",
  address: "",
  accreditationStatus: "SELF_CERTIFIED",
  accreditationType: "",
  accreditationVerifierName: "",
  accreditationDate: new Date().toISOString().split("T")[0],
  minimumInvestmentThreshold: "",
  fundId: "",
  commitmentAmount: "",
  commitmentDate: new Date().toISOString().split("T")[0],
  specialTerms: "",
  fundingStatus: "COMMITTED",
  payments: [],
  documents: [],
  sendVaultAccess: true,
  notes: "",
};

export type UpdateFieldFn = <K extends keyof InvestorFormData>(
  field: K,
  value: InvestorFormData[K],
) => void;

export interface FundOption {
  id: string;
  name: string;
  targetSize?: number;
}
