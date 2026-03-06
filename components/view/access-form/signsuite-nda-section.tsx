"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";

import { Brand, DataroomBrand } from "@prisma/client";
import {
  CheckCircle2Icon,
  FileSignatureIcon,
  Loader2Icon,
  ShieldCheckIcon,
} from "lucide-react";

import { determineTextColor } from "@/lib/utils/determine-text-color";

import { Button } from "@/components/ui/button";

import { DEFAULT_ACCESS_FORM_TYPE } from ".";

type SignSuiteNdaStatus = "idle" | "checking" | "not_signed" | "signing" | "signed" | "error";

export default function SignSuiteNdaSection({
  data,
  setData,
  brand,
  linkId,
  signSuiteNdaDocumentId,
}: {
  data: DEFAULT_ACCESS_FORM_TYPE;
  setData: Dispatch<SetStateAction<DEFAULT_ACCESS_FORM_TYPE>>;
  brand?: Partial<Brand> | Partial<DataroomBrand> | null;
  linkId: string;
  signSuiteNdaDocumentId: string;
}) {
  const [status, setStatus] = useState<SignSuiteNdaStatus>("idle");
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textColor = determineTextColor(brand?.accentColor);

  // Check if the user has already signed the NDA when email is available
  const checkNdaStatus = useCallback(async () => {
    if (!data.email || !linkId) return;

    setStatus("checking");
    try {
      const res = await fetch(
        `/api/esign/nda-sign?linkId=${encodeURIComponent(linkId)}&email=${encodeURIComponent(data.email)}`,
      );

      if (res.ok) {
        const result = await res.json();
        if (result.signed) {
          setStatus("signed");
          setData((prev) => ({ ...prev, hasCompletedSignSuiteNda: true }));
        } else {
          setStatus("not_signed");
        }
      } else {
        setStatus("not_signed");
      }
    } catch {
      setStatus("not_signed");
    }
  }, [data.email, linkId, setData]);

  useEffect(() => {
    if (data.email && data.email.includes("@")) {
      checkNdaStatus();
    }
  }, [data.email, checkNdaStatus]);

  // Initiate NDA signing
  const handleInitiateSigning = async () => {
    if (!data.email) return;

    setStatus("signing");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/esign/nda-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId,
          signerEmail: data.email,
          signerName: data.name || undefined,
          signSuiteNdaDocumentId,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.signingUrl) {
          setSigningUrl(result.signingUrl);
        } else if (result.alreadySigned) {
          setStatus("signed");
          setData((prev) => ({ ...prev, hasCompletedSignSuiteNda: true }));
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to initiate NDA signing" }));
        setErrorMessage(err.error || "Failed to initiate NDA signing");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  };

  // Handle signing completion callback (called when signer returns from signing page)
  const handleSigningComplete = async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/esign/nda-sign/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId,
          signerEmail: data.email,
        }),
      });

      if (res.ok) {
        setStatus("signed");
        setSigningUrl(null);
        setData((prev) => ({ ...prev, hasCompletedSignSuiteNda: true }));
      } else {
        // Check status again - signing may still be in progress
        await checkNdaStatus();
      }
    } catch {
      await checkNdaStatus();
    }
  };

  // If the user is currently in the signing flow (has a signing URL)
  if (signingUrl) {
    return (
      <div className="space-y-3 pt-5">
        <div className="flex items-center gap-2">
          <FileSignatureIcon
            className="h-5 w-5"
            style={{ color: textColor }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: textColor }}
          >
            NDA Signing Required
          </span>
        </div>

        <p
          className="text-xs"
          style={{ color: textColor === "white" ? "rgb(156, 163, 175)" : "rgb(107, 114, 128)" }}
        >
          Please complete the NDA signing in the window below, then click
          &quot;I&apos;ve Completed Signing&quot;.
        </p>

        {/* Embedded signing iframe */}
        <div className="overflow-hidden rounded-md border border-gray-600">
          <iframe
            src={signingUrl}
            className="h-[400px] w-full"
            title="NDA Signing"
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleSigningComplete}
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <CheckCircle2Icon className="mr-2 h-4 w-4" />
            I&apos;ve Completed Signing
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // Open in new tab as fallback
              window.open(signingUrl, "_blank");
            }}
            className="border-gray-600"
            style={{ color: textColor }}
          >
            Open in New Tab
          </Button>
        </div>
      </div>
    );
  }

  // Signed state
  if (status === "signed") {
    return (
      <div className="flex items-center gap-2 pt-5">
        <ShieldCheckIcon className="h-5 w-5 text-emerald-500" />
        <span
          className="text-sm font-medium"
          style={{ color: textColor }}
        >
          NDA signed — you may proceed
        </span>
      </div>
    );
  }

  // Not signed / signing / error states
  return (
    <div className="space-y-3 pt-5">
      <div className="flex items-center gap-2">
        <FileSignatureIcon
          className="h-5 w-5"
          style={{ color: textColor }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: textColor }}
        >
          NDA Signing Required
        </span>
      </div>

      <p
        className="text-xs"
        style={{ color: textColor === "white" ? "rgb(156, 163, 175)" : "rgb(107, 114, 128)" }}
      >
        You must sign a Non-Disclosure Agreement before accessing this content. Your
        signature will be securely recorded via SignSuite.
      </p>

      {errorMessage && (
        <p className="text-xs text-red-400" role="alert">
          {errorMessage}
        </p>
      )}

      <Button
        type="button"
        onClick={handleInitiateSigning}
        disabled={!data.email || status === "checking" || status === "signing"}
        className="w-full bg-white/10 hover:bg-white/20"
        style={{ color: textColor, borderColor: textColor }}
      >
        {status === "checking" || status === "signing" ? (
          <>
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            {status === "checking" ? "Checking..." : "Preparing..."}
          </>
        ) : (
          <>
            <FileSignatureIcon className="mr-2 h-4 w-4" />
            Sign NDA to Continue
          </>
        )}
      </Button>
    </div>
  );
}
