// @deprecated — This file is kept for backward compatibility. New imports should use:
//   import { SignSuiteSignFlow } from "@/components/esign/signsuite-sign-flow";
// See signsuite-sign-flow.tsx for the v3 brand alias.
"use client";

/**
 * FundRoomSignFlow — Wrapper that bridges the signing-documents API with FundRoomSign.
 *
 * Fetches the LP's assigned documents from /api/lp/signing-documents,
 * pre-fetches sign data (fileUrl + fields) for each unsigned doc via GET /api/sign/{token},
 * transforms responses into the FundRoomSign prop format, and renders the consolidated
 * split-screen signing experience.
 *
 * Drop-in replacement for SequentialSigningFlow — same props interface.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2Icon,
  FileTextIcon,
  ArrowRightIcon,
  CheckCircle2,
  ShieldCheckIcon,
  AlertCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import type {
  SigningDocument,
  InvestorAutoFillData,
} from "./fundroom-sign-types";

// Lazy-load the heavy FundRoomSign component
const FundRoomSign = React.lazy(() => import("./FundRoomSign"));

// --- Types for API responses ---

interface SigningDocumentsApiDoc {
  id: string;
  title: string;
  description: string | null;
  documentStatus: string;
  recipientId: string;
  recipientStatus: string;
  signingToken: string | null;
  signingUrl: string | null;
  signedAt: string | null;
  numPages: number | null;
  completedAt: string | null;
  fundId: string | null;
  requiredForOnboarding: boolean;
  signedFileUrl: string | null;
  signedFileType: string | null;
  documentSignedAt: string | null;
}

interface SigningDocumentsApiResponse {
  documents: SigningDocumentsApiDoc[];
  progress: { total: number; signed: number; complete: boolean };
  currentDocumentId: string | null;
}

interface SignDataApiResponse {
  recipient: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  document: {
    id: string;
    title: string;
    description: string | null;
    numPages: number;
    teamName: string;
    fileUrl: string;
    expirationDate: string | null;
  };
  fields: Array<{
    id: string;
    type: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
    placeholder: string | null;
    value: string | null;
    options?: string[] | null;
    fieldFormat?: string | null;
    groupId?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
  }>;
}

// --- Props (same interface as SequentialSigningFlow for drop-in replacement) ---

export interface FundRoomSignFlowProps {
  onComplete: () => void;
  onProgress?: (signed: number, total: number) => void;
  fundId?: string;
}

type FlowState = "loading" | "no-documents" | "ready" | "complete" | "error";

export function FundRoomSignFlow({
  onComplete,
  onProgress,
  fundId,
}: FundRoomSignFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>("loading");
  const [documents, setDocuments] = useState<SigningDocument[]>([]);
  const [investorData, setInvestorData] = useState<InvestorAutoFillData | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const hasLoadedRef = useRef(false);

  const loadDocuments = useCallback(async () => {
    setFlowState("loading");
    setErrorMessage("");

    try {
      // Step 1: Fetch document list
      const url = fundId
        ? `/api/lp/signing-documents?fundId=${encodeURIComponent(fundId)}`
        : "/api/lp/signing-documents";

      const listResponse = await fetch(url);
      if (!listResponse.ok) {
        if (listResponse.status === 404) {
          setFlowState("no-documents");
          return;
        }
        throw new Error("Failed to fetch signing documents");
      }

      const listData: SigningDocumentsApiResponse = await listResponse.json();

      // Already complete?
      if (listData.progress.complete) {
        setFlowState("complete");
        return;
      }

      // No documents?
      if (listData.documents.length === 0) {
        setFlowState("no-documents");
        return;
      }

      // Step 2: Pre-fetch sign data for each unsigned document
      const unsignedDocs = listData.documents.filter(
        (d) => d.recipientStatus !== "SIGNED" && d.recipientStatus !== "DECLINED",
      );

      // Also include already-signed docs so FundRoomSign can show them in the queue
      const signedDocs = listData.documents.filter(
        (d) => d.recipientStatus === "SIGNED",
      );

      // Fetch sign data in parallel for unsigned docs
      const signDataResults = await Promise.allSettled(
        unsignedDocs.map(async (doc) => {
          if (!doc.signingToken) {
            return { doc, signData: null };
          }
          const signResponse = await fetch(`/api/sign/${doc.signingToken}`);
          if (!signResponse.ok) {
            // Non-fatal — doc will be skipped with a warning
            console.warn(
              `Failed to fetch sign data for ${doc.title}: ${signResponse.status}`,
            );
            return { doc, signData: null };
          }
          const signData: SignDataApiResponse = await signResponse.json();
          return { doc, signData };
        }),
      );

      // Extract investor auto-fill data from the first successful response
      let autoFillData: InvestorAutoFillData | undefined;
      for (const result of signDataResults) {
        if (result.status === "fulfilled" && result.value.signData) {
          const { recipient } = result.value.signData;
          autoFillData = {
            investorName: recipient.name,
            email: recipient.email,
          };
          break;
        }
      }
      setInvestorData(autoFillData);

      // Transform unsigned docs into FundRoomSign's format
      const transformedUnsigned: SigningDocument[] = [];
      for (const result of signDataResults) {
        if (result.status !== "fulfilled") continue;
        const { doc, signData } = result.value;

        if (!signData) {
          // No sign data — still include doc but without fileUrl/fields
          // FundRoomSign will show it in the queue but can't open it
          transformedUnsigned.push({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            fileUrl: "",
            fields: [],
            recipientId: doc.recipientId,
            recipientStatus: doc.recipientStatus,
            signingToken: doc.signingToken || "",
            signedAt: doc.signedAt,
          });
          continue;
        }

        transformedUnsigned.push({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          fileUrl: signData.document.fileUrl,
          fields: signData.fields.map((f) => ({
            id: f.id,
            type: f.type as SigningDocument["fields"][0]["type"],
            pageNumber: f.pageNumber,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
            label: null,
            placeholder: f.placeholder,
            value: f.value,
            recipientId: doc.recipientId,
            options: (f.options as string[]) ?? undefined,
            fieldFormat: f.fieldFormat ?? undefined,
            groupId: f.groupId ?? undefined,
            minValue: f.minValue ?? undefined,
            maxValue: f.maxValue ?? undefined,
          })),
          recipientId: doc.recipientId,
          recipientStatus: doc.recipientStatus,
          signingToken: doc.signingToken || "",
          signedAt: doc.signedAt,
        });
      }

      // Include already-signed docs at the front (for queue display)
      const transformedSigned: SigningDocument[] = signedDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        fileUrl: doc.signedFileUrl || "",
        fields: [],
        recipientId: doc.recipientId,
        recipientStatus: doc.recipientStatus,
        signingToken: doc.signingToken || "",
        signedAt: doc.signedAt,
      }));

      const allTransformed = [...transformedSigned, ...transformedUnsigned];

      if (allTransformed.length === 0) {
        setFlowState("no-documents");
        return;
      }

      setDocuments(allTransformed);
      onProgress?.(
        listData.progress.signed,
        listData.progress.total,
      );
      setFlowState("ready");
    } catch (error) {
      console.error("FundRoomSignFlow: Failed to load documents:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load signing documents",
      );
      setFlowState("error");
    }
  }, [fundId, onProgress]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadDocuments();
    }
  }, [loadDocuments]);

  const handleRetry = () => {
    hasLoadedRef.current = false;
    loadDocuments();
  };

  // --- Loading state ---
  if (flowState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2Icon className="h-8 w-8 animate-spin text-gray-400 mb-3" />
        <p className="text-sm text-gray-500">Loading documents for signing...</p>
      </div>
    );
  }

  // --- Error state ---
  if (flowState === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircleIcon className="h-12 w-12 text-red-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">
          Unable to Load Documents
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-md mb-4">
          {errorMessage || "Something went wrong. Please try again."}
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={handleRetry}
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={onComplete}
          >
            Skip for Now
          </Button>
        </div>
      </div>
    );
  }

  // --- No documents state ---
  if (flowState === "no-documents") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileTextIcon className="h-12 w-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">
          No Documents to Sign
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          There are no documents requiring your signature at this time.
          Your fund manager will send documents when they&apos;re ready.
        </p>
        <Button
          variant="outline"
          className="mt-4 min-h-[44px]"
          onClick={onComplete}
        >
          Continue
          <ArrowRightIcon className="h-4 w-4 ml-2" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // --- Complete state ---
  if (flowState === "complete") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          All Documents Signed
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-md mb-6">
          You have signed all required documents. Copies have been sent to your email.
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />
          <span>Securely signed and recorded</span>
        </div>
        <Button onClick={onComplete} className="min-h-[44px]">
          Continue
          <ArrowRightIcon className="h-4 w-4 ml-2" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // --- Ready → Render FundRoomSign ---
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2Icon className="h-8 w-8 animate-spin text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">Loading signing interface...</p>
        </div>
      }
    >
      <FundRoomSign
        documents={documents}
        investorData={investorData}
        onComplete={onComplete}
        onProgress={onProgress}
        fundId={fundId}
      />
    </React.Suspense>
  );
}

export default FundRoomSignFlow;
