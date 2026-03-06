// ---------------------------------------------------------------------------
// DataRoom types
// ---------------------------------------------------------------------------

export type DataRoomTab = "files" | "vaults" | "activity";

/** A filed document in the org vault (matches Prisma DocumentFiling shape) */
export interface FiledDocument {
  id: string;
  filedFileName: string | null;
  orgVaultPath: string | null;
  sourceType: string;
  destinationType: string;
  filedFileUrl: string | null;
  filedFileSize: number | null;
  auditHash: string | null;
  envelopeId: string | null;
  contactVaultId: string | null;
  filedAt: string;
  createdAt: string;
  envelope?: {
    title: string;
    status: string;
  } | null;
}

/** A contact vault record (enriched by /api/dataroom/vaults) */
export interface ContactVaultRecord {
  id: string;
  totalDocuments: number;
  totalSizeBytes: number;
  expiresAt: string | null;
  createdAt: string;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    company: string | null;
  };
}

/** Filing activity event */
export interface FilingActivity {
  id: string;
  fileName: string;
  sourceType: string;
  destinationType: string;
  filedByEmail: string | null;
  createdAt: string;
}

/** Storage stats returned from API */
export interface StorageStats {
  totalFilings: number;
  byDestination: Record<string, number>;
  bySource: Record<string, number>;
  totalSizeBytes: number;
}

/** Folder node for virtual folder tree */
export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  fileCount: number;
}

// Source type labels
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  SIGNED_DOCUMENT: "Signed Document",
  NDA_AGREEMENT: "NDA Agreement",
  ACCREDITATION_RECORD: "Accreditation",
  MANUAL_UPLOAD: "Manual Upload",
  SHARED_DOCUMENT: "Shared Document",
  WIRE_PROOF: "Wire Proof",
  TAX_FORM: "Tax Form",
  IDENTITY_DOCUMENT: "Identity Document",
};

export const DEST_TYPE_LABELS: Record<string, string> = {
  ORG_VAULT: "Org Vault",
  CONTACT_VAULT: "Contact Vault",
  EMAIL: "Email Delivery",
};
