"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";

import type { InvestorFormData, LeadMatch, FundOption } from "./types";
import { STEPS, initialFormData } from "./types";
import {
  BasicInfoStep,
  InvestorDetailsStep,
  CommitmentStep,
  DocumentsStep,
  ReviewStep,
} from "./sections";

/**
 * Manual Investor Entry Wizard (5 Steps)
 *
 * Step 1: Basic Info — First/Last Name, Email, Phone, Lead Source
 * Step 2: Investor Details — Entity architecture + accreditation
 * Step 3: Commitment — Fund, amount, date, funding status, payments
 * Step 4: Documents — Upload signed docs per type with date-signed
 * Step 5: Review & Save — Summary + vault access option
 */

export default function ManualInvestorWizardClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<InvestorFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [leadMatch, setLeadMatch] = useState<LeadMatch | null>(null);
  const [checkingLead, setCheckingLead] = useState(false);

  useEffect(() => {
    fetch("/api/admin/fund/list")
      .then((res) => res.json())
      .then((data) => setFunds(data.funds || []))
      .catch((e) => console.error("Failed to load funds:", e));
  }, []);

  // Lead matching: check if email exists as a dataroom viewer
  const checkLeadMatch = async (email: string) => {
    if (!z.string().email().safeParse(email).success) return;
    setCheckingLead(true);
    try {
      const res = await fetch(
        `/api/admin/investors/check-lead?email=${encodeURIComponent(email)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.match) {
          setLeadMatch(data.match);
          if (!formData.leadSource) {
            updateField("leadSource", "DATAROOM");
          }
        } else {
          setLeadMatch(null);
        }
      }
    } catch (error) {
      // Silently fail — lead matching is non-critical
    } finally {
      setCheckingLead(false);
    }
  };

  const updateField = <K extends keyof InvestorFormData>(
    field: K,
    value: InvestorFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1:
        return (
          formData.firstName.length >= 1 &&
          formData.lastName.length >= 1 &&
          z.string().email().safeParse(formData.email).success
        );
      case 2:
        return formData.entityType.length > 0;
      case 3:
        return (
          formData.fundId.length > 0 &&
          Number(formData.commitmentAmount) > 0
        );
      case 4:
        return true; // Documents are optional for manual entry
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, formData]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Convert document files to base64 for JSON submission
      const docsWithData = await Promise.all(
        formData.documents.map(async (doc) => {
          if (!doc.file) return null;
          const buffer = await doc.file.arrayBuffer();
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(buffer)),
          );
          return {
            type: doc.type,
            filename: doc.name,
            dateSigned: doc.dateSigned,
            fileData: base64,
            mimeType: doc.file.type,
            fileSize: doc.file.size,
          };
        }),
      );

      const res = await fetch("/api/admin/investors/manual-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          leadSource: formData.leadSource || undefined,
          entityType: formData.entityType,
          entityName: formData.entityName || undefined,
          taxId: formData.taxId || undefined,
          address: formData.address || undefined,
          accreditationStatus: formData.accreditationStatus,
          accreditationType: formData.accreditationType || undefined,
          accreditationVerifierName:
            formData.accreditationVerifierName || undefined,
          accreditationDate: formData.accreditationDate || undefined,
          minimumInvestmentThreshold: formData.minimumInvestmentThreshold
            ? Number(formData.minimumInvestmentThreshold)
            : undefined,
          fundId: formData.fundId,
          commitmentAmount: Number(formData.commitmentAmount),
          commitmentDate: formData.commitmentDate,
          specialTerms: formData.specialTerms || undefined,
          fundingStatus:
            formData.fundingStatus === "INSTALLMENTS"
              ? "PARTIALLY_FUNDED"
              : formData.fundingStatus,
          payments: formData.payments.filter((p) => p.amount),
          sendVaultAccess: formData.sendVaultAccess,
          notes: formData.notes || undefined,
          documents: docsWithData.filter(Boolean),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Investor added successfully");
        router.push(`/admin/investors/${data.investorId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to add investor");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fullName = `${formData.firstName} ${formData.lastName}`.trim();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/investors">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Add Investor Manually</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 5 — {STEPS[step - 1].label}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.id === step;
          const isComplete = s.id < step;
          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => s.id < step && setStep(s.id)}
                disabled={s.id > step}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : isComplete
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden md:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-px w-8 ${
                    isComplete ? "bg-blue-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {step === 1 && (
            <BasicInfoStep
              formData={formData}
              updateField={updateField}
              leadMatch={leadMatch}
              checkingLead={checkingLead}
              checkLeadMatch={checkLeadMatch}
            />
          )}

          {step === 2 && (
            <InvestorDetailsStep
              formData={formData}
              updateField={updateField}
            />
          )}

          {step === 3 && (
            <CommitmentStep
              formData={formData}
              updateField={updateField}
              funds={funds}
            />
          )}

          {step === 4 && (
            <DocumentsStep
              formData={formData}
              updateField={updateField}
            />
          )}

          {step === 5 && (
            <ReviewStep
              formData={formData}
              updateField={updateField}
              fullName={fullName}
              funds={funds}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Add Investor
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
