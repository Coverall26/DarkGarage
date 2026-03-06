// @deprecated — Use components/esign/signsuite-types.ts for new imports.
// This file is the canonical implementation; the SignSuite alias re-exports from here.
// Types, interfaces, and constants for the SignSuite signing component

export interface SignatureField {
  id: string;
  type:
    | "SIGNATURE"
    | "INITIALS"
    | "TEXT"
    | "CHECKBOX"
    | "DATE_SIGNED"
    | "NAME"
    | "EMAIL"
    | "COMPANY"
    | "TITLE"
    | "ADDRESS"
    | "DROPDOWN"
    | "RADIO"
    | "NUMERIC"
    | "CURRENCY"
    | "ATTACHMENT"
    | "FORMULA";
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label: string | null;
  placeholder: string | null;
  value: string | null;
  recipientId?: string;
  options?: string[];
  fieldFormat?: string;
  groupId?: string;
  minValue?: number;
  maxValue?: number;
}

export interface InvestorAutoFillData {
  investorName: string;
  entityName?: string;
  investmentAmount?: number;
  email?: string;
  address?: string;
  company?: string;
  title?: string;
}

export interface SigningDocument {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fields: SignatureField[];
  recipientId: string;
  recipientStatus: string;
  signingToken: string;
  signedAt: string | null;
}

export interface SigningQueueItem {
  id: string;
  title: string;
  status: "pending" | "signing" | "signed";
  signingToken: string;
}

export interface FundRoomSignProps {
  /** Single document mode */
  document?: SigningDocument;
  /** Multi-document queue mode */
  documents?: SigningDocument[];
  /** Pre-filled investor data */
  investorData?: InvestorAutoFillData;
  /** Called when all documents are signed */
  onComplete: () => void;
  /** Called on progress update */
  onProgress?: (signed: number, total: number) => void;
  /** Fund ID for API calls */
  fundId?: string;
}

export interface SignatureCaptureProps {
  onCapture: (dataUrl: string) => void;
  initialName?: string;
  isInitials?: boolean;
  className?: string;
}

export interface CompletionScreenProps {
  totalCount: number;
  onComplete: () => void;
}

export interface DocumentQueueProps {
  queue: SigningQueueItem[];
  signedCount: number;
  totalCount: number;
  onOpenDocument: (index: number) => void;
}

export interface PdfViewerPanelProps {
  activeDoc: SigningDocument;
  currentPage: number;
  numPages: number;
  scale: number;
  pdfLoading: boolean;
  pageSize: { width: number; height: number } | null;
  currentPageFields: SignatureField[];
  totalRequired: number;
  completedRequired: number;
  onBack: () => void;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
  onPdfLoadSuccess: (numPages: number) => void;
  onPageSizeChange: (size: { width: number; height: number }) => void;
  onFieldClick: (field: SignatureField) => void;
  getFieldStyle: (field: SignatureField) => React.CSSProperties;
  getFieldContent: (field: SignatureField) => React.ReactNode;
  onShowFullscreen: () => void;
}

export interface SignaturePanelProps {
  activeDoc: SigningDocument;
  investorData?: InvestorAutoFillData;
  signatureData: string | null;
  initialsData: string | null;
  consentConfirmed: boolean;
  isSubmitting: boolean;
  allRequiredComplete: boolean;
  onSignatureCapture: (data: string) => void;
  onInitialsCapture: (data: string) => void;
  onConsentChange: (confirmed: boolean) => void;
  onSignDocument: () => void;
}

export interface SignatureCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeFieldId: string | null;
  activeDoc: SigningDocument | null;
  investorData?: InvestorAutoFillData;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDocTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface FullscreenPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDoc: SigningDocument;
  numPages: number;
}
