import { Suspense } from "react";
import { Metadata } from "next";
import LoadingSpinner from "@/components/ui/loading-spinner";
import BulkSendClient from "./page-client";

export const metadata: Metadata = {
  title: "Bulk Send — SignSuite | FundRoom AI",
  description: "Send a document for signature to multiple recipients at once",
};

export default function BulkSendPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      }
    >
      <BulkSendClient />
    </Suspense>
  );
}
