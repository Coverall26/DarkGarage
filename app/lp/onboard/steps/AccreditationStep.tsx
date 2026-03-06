"use client";

/**
 * AccreditationStep — LP Onboarding Step 4.
 * Collects: accreditation type, investor certifications.
 * When fund is 506(c): additional fields for no-third-party financing,
 * source of funds, and occupation/employer.
 * For 506(c) funds where minimum investment threshold is NOT met ($200K),
 * offers document upload verification as an alternative to self-certification.
 * Pure UI — state managed by parent.
 */

import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Check,
  X,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { ACCREDITATION_METHODS } from "@/lib/entity";
import type { FormData, FundContext, UpdateFieldFn } from "./types";

/** 506(c) verification document types */
const VERIFICATION_DOC_TYPES = [
  {
    value: "TAX_RETURNS",
    label: "Tax Returns (last 2 years)",
    description: "Showing $200K+ individual income or $300K+ joint income",
  },
  {
    value: "BANK_STATEMENTS",
    label: "Bank/Brokerage Statements",
    description: "Showing $1M+ net worth excluding primary residence",
  },
  {
    value: "CPA_ATTORNEY_LETTER",
    label: "CPA, Attorney, or Broker-Dealer Verification Letter",
    description: "Written confirmation of accredited investor status",
  },
  {
    value: "PROFESSIONAL_CERTIFICATION",
    label: "Professional Certification",
    description: "Series 7, 65, or 82 license held in good standing",
  },
] as const;

interface UploadedDoc {
  id: string;
  name: string;
  docSubType: string;
  status: string;
}

interface AccreditationStepProps {
  formData: FormData;
  updateField: UpdateFieldFn;
  fundContext: FundContext | null;
  logCertificationAudit: (
    certificationIndex: number,
    certificationField: string,
    certificationText: string,
    checked: boolean,
    certificationCategory?: string,
  ) => void;
}

export default function AccreditationStep({
  formData,
  updateField,
  fundContext,
  logCertificationAudit,
}: AccreditationStepProps) {
  const is506c = fundContext?.regulationDExemption === "506C";
  const minimumInvestment = fundContext?.minimumInvestment ?? 0;
  const highValueThresholdMet = minimumInvestment >= 200000;

  // 506(c) doc upload state (local — doc IDs synced to parent via updateField)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show doc upload option only for 506(c) when high-value threshold is NOT met
  const showDocUploadOption = is506c && !highValueThresholdMet;

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedDocType) return;

      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        toast.error("File size must be under 25 MB");
        return;
      }

      const validTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
      ];
      if (!validTypes.includes(file.type)) {
        toast.error("Only PDF, PNG, and JPG files are accepted");
        return;
      }

      setUploading(true);
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch("/api/lp/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fundId: fundContext?.fundId,
            documentType: "ACCREDITATION_PROOF",
            title: `${VERIFICATION_DOC_TYPES.find((t) => t.value === selectedDocType)?.label || selectedDocType} - ${file.name}`,
            fileName: file.name,
            fileData: base64,
            metadata: {
              verificationDocType: selectedDocType,
              uploadedDuring: "LP_ONBOARDING_ACCREDITATION",
            },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        const newDoc: UploadedDoc = {
          id: data.documentId || data.id,
          name: file.name,
          docSubType: selectedDocType,
          status: "UPLOADED_PENDING_REVIEW",
        };

        const updatedDocs = [...uploadedDocs, newDoc];
        setUploadedDocs(updatedDocs);

        // Sync doc IDs to parent form state
        const docIds = updatedDocs.map((d) => d.id);
        updateField("accreditationDocIds", docIds);

        toast.success("Document uploaded successfully");
        setSelectedDocType("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to upload document",
        );
      } finally {
        setUploading(false);
      }
    },
    [selectedDocType, fundContext?.fundId, uploadedDocs, updateField],
  );

  const removeDoc = useCallback(
    (docId: string) => {
      const updatedDocs = uploadedDocs.filter((d) => d.id !== docId);
      setUploadedDocs(updatedDocs);
      updateField(
        "accreditationDocIds",
        updatedDocs.map((d) => d.id),
      );
    },
    [uploadedDocs, updateField],
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-gray-300 mb-2 block">
          How do you qualify as an accredited investor?
        </Label>
        <div className="grid gap-2">
          {ACCREDITATION_METHODS.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => updateField("accreditationType", method.value)}
              className={`w-full text-left p-3 min-h-[44px] rounded-lg border transition-colors ${
                formData.accreditationType === method.value
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-gray-600 bg-gray-700/30 hover:border-gray-500"
              }`}
            >
              <span className="text-white font-medium text-sm">
                {method.label}
              </span>
              <p className="text-gray-400 text-xs mt-0.5">
                {method.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-700">
        <div className="flex items-start gap-3 min-h-[44px]">
          <Checkbox
            id="confirmAccredited"
            checked={formData.confirmAccredited}
            onCheckedChange={(checked) => {
              const isChecked = checked === true;
              updateField("confirmAccredited", isChecked);
              logCertificationAudit(
                1,
                "confirmAccredited",
                "I confirm that I meet the SEC definition of an accredited investor under Rule 501 of Regulation D.",
                isChecked,
                "ACCREDITATION",
              );
            }}
            className="mt-1 h-5 w-5 border-gray-500 data-[state=checked]:bg-emerald-600"
          />
          <Label
            htmlFor="confirmAccredited"
            className="text-gray-300 text-sm leading-relaxed cursor-pointer"
          >
            I confirm that I meet the SEC definition of an accredited investor
            under Rule 501 of Regulation D.
          </Label>
        </div>
        <div className="flex items-start gap-3 min-h-[44px]">
          <Checkbox
            id="confirmRiskAware"
            checked={formData.confirmRiskAware}
            onCheckedChange={(checked) => {
              const isChecked = checked === true;
              updateField("confirmRiskAware", isChecked);
              logCertificationAudit(
                2,
                "confirmRiskAware",
                "I understand that investments in private securities involve significant risk, including the potential loss of the entire investment.",
                isChecked,
                "ACCREDITATION",
              );
            }}
            className="mt-1 h-5 w-5 border-gray-500 data-[state=checked]:bg-emerald-600"
          />
          <Label
            htmlFor="confirmRiskAware"
            className="text-gray-300 text-sm leading-relaxed cursor-pointer"
          >
            I understand that investments in private securities involve
            significant risk, including the potential loss of the entire
            investment.
          </Label>
        </div>
      </div>

      {/* 506(c) Enhanced Certifications — only shown for Rule 506(c) offerings */}
      {is506c && (
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
            <p className="text-blue-300 text-xs leading-relaxed">
              This offering is conducted under Rule 506(c) of Regulation D,
              which requires enhanced verification of accredited investor
              status. The following additional certifications are required.
            </p>
          </div>

          <div className="flex items-start gap-3 min-h-[44px]">
            <Checkbox
              id="noThirdPartyFinancing"
              checked={formData.noThirdPartyFinancing}
              onCheckedChange={(checked) => {
                const isChecked = checked === true;
                updateField("noThirdPartyFinancing", isChecked);
                logCertificationAudit(
                  3,
                  "noThirdPartyFinancing",
                  "I certify that my investment is not financed by any third party for the purpose of meeting the accredited investor thresholds.",
                  isChecked,
                  "506C_ENHANCED",
                );
              }}
              className="mt-1 h-5 w-5 border-gray-500 data-[state=checked]:bg-emerald-600"
            />
            <Label
              htmlFor="noThirdPartyFinancing"
              className="text-gray-300 text-sm leading-relaxed cursor-pointer"
            >
              I certify that my investment is not financed by any third party
              for the purpose of meeting the accredited investor thresholds.
            </Label>
          </div>

          <div>
            <Label className="text-gray-300 text-sm">Source of Funds</Label>
            <Select
              value={formData.sourceOfFunds}
              onValueChange={(v) => updateField("sourceOfFunds", v)}
            >
              <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white mt-1">
                <SelectValue placeholder="Select source of funds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALARY">
                  Salary / Employment Income
                </SelectItem>
                <SelectItem value="INVESTMENT_RETURNS">
                  Investment Returns
                </SelectItem>
                <SelectItem value="BUSINESS_INCOME">
                  Business Income
                </SelectItem>
                <SelectItem value="INHERITANCE">Inheritance</SelectItem>
                <SelectItem value="SAVINGS">Personal Savings</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-300 text-sm">
              Occupation / Employer
            </Label>
            <Input
              placeholder="e.g., Software Engineer at Acme Corp"
              value={formData.occupation}
              onChange={(e) => updateField("occupation", e.target.value)}
              className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 text-base sm:text-sm mt-1"
            />
          </div>
        </div>
      )}

      {/* 506(c) Document Upload Verification Section */}
      {showDocUploadOption && (
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <Label className="text-gray-200 text-sm font-medium">
              Verification Documents (Optional)
            </Label>
          </div>

          <div className="bg-amber-900/15 border border-amber-700/30 rounded-lg p-3">
            <p className="text-amber-300 text-xs leading-relaxed">
              For commitments below $200,000, you may optionally upload
              verification documents to support your accredited investor status.
              Documents will be reviewed by the fund manager. Self-certification
              above is still sufficient to proceed.
            </p>
          </div>

          {/* Verification method selector */}
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() =>
                updateField(
                  "accreditationVerificationMethod",
                  "SELF_CERTIFICATION",
                )
              }
              className={`w-full text-left p-3 min-h-[44px] rounded-lg border transition-colors ${
                formData.accreditationVerificationMethod ===
                "SELF_CERTIFICATION"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-gray-600 bg-gray-700/30 hover:border-gray-500"
              }`}
            >
              <span className="text-white font-medium text-sm">
                Self-Certification Only
              </span>
              <p className="text-gray-400 text-xs mt-0.5">
                Proceed with the checkboxes above (no documents required)
              </p>
            </button>
            <button
              type="button"
              onClick={() =>
                updateField(
                  "accreditationVerificationMethod",
                  "DOCUMENT_UPLOAD",
                )
              }
              className={`w-full text-left p-3 min-h-[44px] rounded-lg border transition-colors ${
                formData.accreditationVerificationMethod === "DOCUMENT_UPLOAD"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-gray-600 bg-gray-700/30 hover:border-gray-500"
              }`}
            >
              <span className="text-white font-medium text-sm">
                Upload Verification Documents
              </span>
              <p className="text-gray-400 text-xs mt-0.5">
                Provide tax returns, bank statements, or a professional letter
              </p>
            </button>
          </div>

          {/* Document upload section — shown when DOCUMENT_UPLOAD is selected */}
          {formData.accreditationVerificationMethod === "DOCUMENT_UPLOAD" && (
            <div className="space-y-3 bg-gray-800/50 rounded-lg p-4">
              {/* Uploaded documents list */}
              {uploadedDocs.length > 0 && (
                <div className="space-y-2 mb-3">
                  <Label className="text-gray-400 text-xs uppercase tracking-wider">
                    Uploaded Documents
                  </Label>
                  {uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between bg-gray-700/40 rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText
                          className="h-4 w-4 text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {VERIFICATION_DOC_TYPES.find(
                              (t) => t.value === doc.docSubType,
                            )?.label || doc.docSubType}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className="text-amber-400 border-amber-600 text-xs"
                        >
                          Pending Review
                        </Badge>
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                          aria-label={`Remove ${doc.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload new document */}
              <div className="space-y-2">
                <Select
                  value={selectedDocType}
                  onValueChange={setSelectedDocType}
                >
                  <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_DOC_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <span className="font-medium">{type.label}</span>
                          <p className="text-xs text-muted-foreground">
                            {type.description}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    selectedDocType
                      ? "border-gray-500 hover:border-emerald-500/50 cursor-pointer"
                      : "border-gray-700 opacity-50"
                  }`}
                  onClick={() =>
                    selectedDocType && fileInputRef.current?.click()
                  }
                  role="button"
                  tabIndex={selectedDocType ? 0 : -1}
                  onKeyDown={(e) => {
                    if (
                      selectedDocType &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  aria-label="Upload verification document"
                >
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                      <span className="text-sm text-gray-300">
                        Uploading...
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload
                        className="h-6 w-6 text-gray-400 mx-auto mb-1"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-gray-300">
                        {selectedDocType
                          ? "Click to select file"
                          : "Select document type first"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        PDF, PNG, or JPG — Max 25 MB
                      </p>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={!selectedDocType || uploading}
                />
              </div>

              {uploadedDocs.length > 0 && (
                <div className="flex items-start gap-2 bg-emerald-900/15 border border-emerald-700/30 rounded-md p-2.5">
                  <Check
                    className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="text-emerald-300 text-xs leading-relaxed">
                    {uploadedDocs.length} document
                    {uploadedDocs.length !== 1 ? "s" : ""} uploaded. The fund
                    manager will review your verification documents. You may
                    continue with onboarding while documents are under review.
                  </p>
                </div>
              )}

              {uploadedDocs.length === 0 && (
                <div className="flex items-start gap-2 bg-gray-700/30 rounded-md p-2.5">
                  <AlertTriangle
                    className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Upload at least one verification document. You can still
                    proceed with self-certification only by selecting that
                    option above.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Validation: can proceed from step 4? */
export function canProceedStep4(
  formData: FormData,
  fundContext: FundContext | null,
): boolean {
  const is506c = fundContext?.regulationDExemption === "506C";
  return !!(
    formData.accreditationType &&
    formData.confirmAccredited &&
    formData.confirmRiskAware &&
    (!is506c ||
      (formData.noThirdPartyFinancing &&
        formData.sourceOfFunds &&
        formData.occupation))
  );
}
