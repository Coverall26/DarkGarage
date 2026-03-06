"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

/**
 * Error boundary for offering/dataroom pages (/offering/*).
 * Light theme since offering pages are public-facing.
 */
export default function OfferingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Offering page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F4F6] px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          Page Unavailable
        </h2>
        <p className="text-gray-600 mb-2 text-sm">
          This offering page couldn&apos;t be loaded right now.
          Please try again or contact the fund administrator.
        </p>
        {error.digest && (
          <p className="text-gray-400 text-xs mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <Button
            onClick={reset}
            className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white h-11"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
