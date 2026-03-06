// @deprecated — This file is kept for backward compatibility. New imports should use:
//   import { SignSuiteSign } from "@/components/esign/signsuite-sign";
// See signsuite-sign.tsx for the v3 brand alias.
"use client";

import React, { useState, useCallback } from "react";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
import { CheckCircle2, PenIcon } from "lucide-react";

// Re-export types for backward compatibility
export type {
  SignatureField,
  InvestorAutoFillData,
  SigningDocument,
} from "./fundroom-sign-types";

import type {
  SignatureField,
  SigningDocument,
  SigningQueueItem,
  FundRoomSignProps,
} from "./fundroom-sign-types";

import {
  CompletionScreen,
  DocumentQueue,
  PdfViewerPanel,
  SignaturePanel,
  SignatureCaptureModal,
  ConfirmationModal,
  FullscreenPdfModal,
} from "./fundroom-sign-sections";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ----- Main FundRoomSign Orchestrator -----

export default function FundRoomSign({
  document: singleDoc,
  documents: multiDocs,
  investorData,
  onComplete,
  onProgress,
  fundId,
}: FundRoomSignProps) {
  // Normalize to queue
  const allDocs = multiDocs || (singleDoc ? [singleDoc] : []);
  const [queue, setQueue] = useState<SigningQueueItem[]>(() =>
    allDocs.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.signedAt ? "signed" : ("pending" as const),
      signingToken: d.signingToken,
    })),
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeDoc, setActiveDoc] = useState<SigningDocument | null>(null);

  // PDF state
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  // Signing state
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [initialsData, setInitialsData] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const signedCount = queue.filter((q) => q.status === "signed").length;
  const totalCount = queue.length;
  const allSigned = signedCount === totalCount && totalCount > 0;

  // Pre-fill auto-fill fields when doc loads
  const prefillFields = useCallback(
    (doc: SigningDocument) => {
      const values: Record<string, string> = {};
      doc.fields.forEach((field) => {
        switch (field.type) {
          case "NAME":
            values[field.id] = investorData?.investorName || "";
            break;
          case "EMAIL":
            values[field.id] = investorData?.email || "";
            break;
          case "DATE_SIGNED":
            values[field.id] = new Date().toLocaleDateString();
            break;
          case "COMPANY":
            values[field.id] = investorData?.entityName || investorData?.company || "";
            break;
          case "TITLE":
            values[field.id] = investorData?.title || "";
            break;
          case "ADDRESS":
            values[field.id] = investorData?.address || "";
            break;
          default:
            if (field.value) values[field.id] = field.value;
        }
      });
      setFieldValues(values);
    },
    [investorData],
  );

  const openDocument = (index: number) => {
    const doc = allDocs[index];
    if (!doc) return;
    setActiveIndex(index);
    setActiveDoc(doc);
    setCurrentPage(1);
    setScale(1.0);
    setPdfLoading(true);
    setSignatureData(null);
    setInitialsData(null);
    setConsentConfirmed(false);
    prefillFields(doc);
    setQueue((prev) =>
      prev.map((q, i) => (i === index ? { ...q, status: "signing" } : q)),
    );
  };

  const handleFieldClick = (field: SignatureField) => {
    if (field.type === "SIGNATURE" || field.type === "INITIALS") {
      setActiveFieldId(field.id);
      setShowSignatureModal(true);
    }
  };

  const handleSignatureCapture = (dataUrl: string) => {
    if (!activeFieldId || !activeDoc) return;
    const field = activeDoc.fields.find((f) => f.id === activeFieldId);
    if (field?.type === "INITIALS") {
      setInitialsData(dataUrl);
    } else {
      setSignatureData(dataUrl);
    }
    setFieldValues((prev) => ({ ...prev, [activeFieldId]: "signed" }));
    setShowSignatureModal(false);
    setActiveFieldId(null);
  };

  const isFieldComplete = (field: SignatureField): boolean => {
    if (field.type === "SIGNATURE") return !!signatureData && !!fieldValues[field.id];
    if (field.type === "INITIALS") return !!initialsData && !!fieldValues[field.id];
    return !!fieldValues[field.id];
  };

  const allRequiredComplete = activeDoc
    ? activeDoc.fields
        .filter((f) => f.required)
        .every((f) => isFieldComplete(f))
    : false;

  const handleSignDocument = () => {
    if (!allRequiredComplete) {
      toast.error("Please complete all required fields before signing");
      return;
    }
    if (!consentConfirmed) {
      toast.error("You must agree to the terms before signing");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSign = async () => {
    if (!activeDoc || activeIndex === null) return;
    setShowConfirmModal(false);
    setIsSubmitting(true);

    try {
      const fieldData = activeDoc.fields.map((f) => ({
        id: f.id,
        value:
          f.type === "SIGNATURE"
            ? signatureData
            : f.type === "INITIALS"
              ? initialsData
              : fieldValues[f.id] || null,
      }));

      const response = await fetch(`/api/sign/${activeDoc.signingToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fieldData,
          signatureImage: signatureData,
          initialsImage: initialsData,
          consentConfirmed: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit signature");
      }

      toast.success(`${activeDoc.title} signed successfully`);

      // Update queue
      const newQueue = queue.map((q, i) =>
        i === activeIndex ? { ...q, status: "signed" as const } : q,
      );
      setQueue(newQueue);

      const newSignedCount = newQueue.filter((q) => q.status === "signed").length;
      onProgress?.(newSignedCount, totalCount);

      // Auto-advance to next unsigned document
      const nextIndex = newQueue.findIndex(
        (q, i) => i > activeIndex && q.status !== "signed",
      );
      if (nextIndex >= 0) {
        openDocument(nextIndex);
      } else {
        // All signed
        setActiveDoc(null);
        setActiveIndex(null);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign document",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setActiveDoc(null);
    setActiveIndex(null);
  };

  // Get field visual style based on page position
  const getFieldStyle = (field: SignatureField): React.CSSProperties => {
    if (!pageSize) return { display: "none" };
    return {
      position: "absolute",
      left: `${field.x}%`,
      top: `${field.y}%`,
      width: `${field.width}%`,
      height: `${field.height}%`,
      zIndex: 10,
    };
  };

  const getFieldContent = (field: SignatureField) => {
    const complete = isFieldComplete(field);

    if (field.type === "SIGNATURE") {
      if (complete && signatureData) {
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-white/90 rounded border border-green-300">
            <img src={signatureData} alt="Signature" className="max-w-full max-h-full object-contain p-0.5" />
            <CheckCircle2 className="absolute top-0.5 right-0.5 h-3 w-3 text-green-600" />
          </div>
        );
      }
      return (
        <div className="w-full h-full flex items-center justify-center bg-yellow-50/90 border-2 border-dashed border-yellow-400 rounded cursor-pointer hover:bg-yellow-100 transition-colors animate-pulse">
          <div className="flex flex-col items-center gap-0.5">
            <PenIcon className="h-4 w-4 text-yellow-700" />
            <span className="text-xs font-medium text-yellow-800">Sign here</span>
          </div>
          {field.required && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>
      );
    }

    if (field.type === "INITIALS") {
      if (complete && initialsData) {
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-white/90 rounded border border-green-300">
            <img src={initialsData} alt="Initials" className="max-w-full max-h-full object-contain p-0.5" />
            <CheckCircle2 className="absolute top-0.5 right-0.5 h-3 w-3 text-green-600" />
          </div>
        );
      }
      return (
        <div className="w-full h-full flex items-center justify-center bg-yellow-50/90 border-2 border-dashed border-yellow-400 rounded cursor-pointer hover:bg-yellow-100 transition-colors animate-pulse">
          <span className="text-xs font-medium text-yellow-800">Initial</span>
          {field.required && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>
      );
    }

    if (field.type === "DATE_SIGNED") {
      return (
        <div className="w-full h-full flex items-center px-1 bg-gray-50/90 border border-gray-300 rounded text-xs text-gray-700">
          {fieldValues[field.id] || new Date().toLocaleDateString()}
        </div>
      );
    }

    if (field.type === "NAME") {
      return (
        <div className="w-full h-full flex items-center px-1 bg-gray-50/90 border border-gray-300 rounded text-xs text-gray-700">
          {fieldValues[field.id] || investorData?.investorName || ""}
        </div>
      );
    }

    if (field.type === "CHECKBOX") {
      return (
        <div className="w-full h-full flex items-center justify-center min-h-[44px] min-w-[44px]">
          <input
            type="checkbox"
            checked={fieldValues[field.id] === "true"}
            onChange={(e) =>
              setFieldValues((prev) => ({
                ...prev,
                [field.id]: e.target.checked ? "true" : "",
              }))
            }
            className="h-5 w-5 rounded border-gray-400 cursor-pointer accent-[#0066FF]"
          />
        </div>
      );
    }

    // DROPDOWN — select from predefined options
    if (field.type === "DROPDOWN") {
      const options = field.options || [];
      return (
        <select
          value={fieldValues[field.id] || ""}
          onChange={(e) =>
            setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
          }
          className="w-full h-full px-1 text-base bg-white/90 border border-gray-300 rounded focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none cursor-pointer min-h-[44px]"
        >
          <option value="">{field.placeholder || "Select an option..."}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    // RADIO — select one from a group
    if (field.type === "RADIO") {
      const options = field.options || [];
      if (options.length === 0) {
        // Single radio button (part of a group rendered individually)
        return (
          <div className="w-full h-full flex items-center justify-center min-h-[44px] min-w-[44px]">
            <input
              type="radio"
              name={field.groupId || field.id}
              checked={fieldValues[field.id] === "true"}
              onChange={() =>
                setFieldValues((prev) => ({ ...prev, [field.id]: "true" }))
              }
              className="h-5 w-5 cursor-pointer accent-[#0066FF]"
            />
          </div>
        );
      }
      // Radio group with options
      return (
        <div className="w-full h-full flex flex-col gap-1 px-1 py-0.5 bg-white/90 border border-gray-300 rounded overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-1.5 cursor-pointer min-h-[28px]"
            >
              <input
                type="radio"
                name={field.groupId || field.id}
                value={opt}
                checked={fieldValues[field.id] === opt}
                onChange={() =>
                  setFieldValues((prev) => ({ ...prev, [field.id]: opt }))
                }
                className="h-4 w-4 cursor-pointer accent-[#0066FF] flex-shrink-0"
              />
              <span className="text-xs text-gray-700 leading-tight">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    // NUMERIC — number input
    if (field.type === "NUMERIC") {
      return (
        <input
          type="number"
          value={fieldValues[field.id] || ""}
          onChange={(e) =>
            setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
          }
          placeholder={field.placeholder || "Enter number"}
          min={field.minValue}
          max={field.maxValue}
          step={field.fieldFormat === "integer" ? "1" : "any"}
          className="w-full h-full px-1 text-base bg-white/90 border border-gray-300 rounded focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none font-mono tabular-nums"
        />
      );
    }

    // CURRENCY — currency input with formatting
    if (field.type === "CURRENCY") {
      return (
        <div className="relative w-full h-full">
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
          <input
            type="number"
            value={fieldValues[field.id] || ""}
            onChange={(e) =>
              setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
            }
            placeholder={field.placeholder || "0.00"}
            min={field.minValue ?? 0}
            max={field.maxValue}
            step="0.01"
            className="w-full h-full pl-4 pr-1 text-base bg-white/90 border border-gray-300 rounded focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none font-mono tabular-nums"
          />
        </div>
      );
    }

    // ATTACHMENT — file upload placeholder
    if (field.type === "ATTACHMENT") {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50/90 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-100 transition-colors min-h-[44px]">
          <span className="text-xs font-medium text-gray-500">
            {fieldValues[field.id] ? "File attached" : "Tap to attach file"}
          </span>
          {field.required && !fieldValues[field.id] && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Required
            </span>
          )}
        </div>
      );
    }

    // FORMULA — read-only calculated field
    if (field.type === "FORMULA") {
      return (
        <div className="w-full h-full flex items-center px-1 bg-blue-50/90 border border-blue-200 rounded text-xs text-blue-800 font-mono tabular-nums">
          {fieldValues[field.id] || "—"}
        </div>
      );
    }

    // TEXT, COMPANY, TITLE, ADDRESS, EMAIL
    return (
      <input
        type="text"
        value={fieldValues[field.id] || ""}
        onChange={(e) =>
          setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
        }
        placeholder={field.placeholder || field.type.toLowerCase().replace("_", " ")}
        className="w-full h-full px-1 text-base bg-white/90 border border-gray-300 rounded focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none"
        readOnly={
          field.type === "EMAIL" && !!investorData?.email
        }
      />
    );
  };

  const currentPageFields = activeDoc?.fields.filter((f) => f.pageNumber === currentPage) || [];
  const totalRequired = activeDoc?.fields.filter((f) => f.required).length || 0;
  const completedRequired = activeDoc?.fields.filter((f) => f.required && isFieldComplete(f)).length || 0;

  // ----- Completion Screen -----
  if (allSigned) {
    return (
      <CompletionScreen
        totalCount={totalCount}
        onComplete={onComplete}
      />
    );
  }

  // ----- Document Queue (no active doc) -----
  if (activeIndex === null || !activeDoc) {
    return (
      <DocumentQueue
        queue={queue}
        signedCount={signedCount}
        totalCount={totalCount}
        onOpenDocument={openDocument}
      />
    );
  }

  // ----- Active Signing View (Split Screen) -----
  return (
    <div className="flex flex-col h-full">
      {/* Multi-doc progress bar */}
      {totalCount > 1 && (
        <div className="bg-gray-50 border-b px-4 py-2 flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">
            Signing {(activeIndex || 0) + 1} of {totalCount}: {activeDoc.title}
          </span>
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#0066FF] h-1.5 rounded-full transition-all"
              style={{
                width: `${((signedCount + 1) / totalCount) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Split-screen layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left panel (60%) -- Document viewer */}
        <PdfViewerPanel
          activeDoc={activeDoc}
          currentPage={currentPage}
          numPages={numPages}
          scale={scale}
          pdfLoading={pdfLoading}
          pageSize={pageSize}
          currentPageFields={currentPageFields}
          totalRequired={totalRequired}
          completedRequired={completedRequired}
          onBack={handleBack}
          onPageChange={setCurrentPage}
          onScaleChange={setScale}
          onPdfLoadSuccess={(n) => {
            setNumPages(n);
            setPdfLoading(false);
          }}
          onPageSizeChange={setPageSize}
          onFieldClick={handleFieldClick}
          getFieldStyle={getFieldStyle}
          getFieldContent={getFieldContent}
          onShowFullscreen={() => setShowFullscreen(true)}
        />

        {/* Right panel (40%) -- Signature & Fields */}
        <SignaturePanel
          activeDoc={activeDoc}
          investorData={investorData}
          signatureData={signatureData}
          initialsData={initialsData}
          consentConfirmed={consentConfirmed}
          isSubmitting={isSubmitting}
          allRequiredComplete={allRequiredComplete}
          onSignatureCapture={(data) => setSignatureData(data)}
          onInitialsCapture={(data) => setInitialsData(data)}
          onConsentChange={setConsentConfirmed}
          onSignDocument={handleSignDocument}
        />
      </div>

      {/* Signature Capture Modal (for clicking fields on PDF) */}
      <SignatureCaptureModal
        open={showSignatureModal}
        onOpenChange={setShowSignatureModal}
        activeFieldId={activeFieldId}
        activeDoc={activeDoc}
        investorData={investorData}
        onCapture={handleSignatureCapture}
        onCancel={() => {
          setShowSignatureModal(false);
          setActiveFieldId(null);
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        activeDocTitle={activeDoc.title}
        onConfirm={handleConfirmSign}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Fullscreen PDF Modal */}
      <FullscreenPdfModal
        open={showFullscreen}
        onOpenChange={setShowFullscreen}
        activeDoc={activeDoc}
        numPages={numPages}
      />
    </div>
  );
}
