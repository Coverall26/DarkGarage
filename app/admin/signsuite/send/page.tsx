import { Suspense } from "react";
import { Metadata } from "next";
import LoadingSpinner from "@/components/ui/loading-spinner";
import SignSuiteSendClient from "./page-client";

export const metadata: Metadata = {
  title: "Send for Signature — SignSuite | FundRoom AI",
  description: "Send a document for signature via SignSuite",
};

export default function SignSuiteSendPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      }
    >
      <SignSuiteSendClient />
    </Suspense>
  );
}
