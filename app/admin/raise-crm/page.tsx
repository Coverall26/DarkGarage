import { Suspense } from "react";
import { Metadata } from "next";
import PipelineIQPageClient from "./page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PipelineIQ — Investor Pipeline | FundRoom AI",
};

export default function PipelineIQPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-96 w-full animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <PipelineIQPageClient />
    </Suspense>
  );
}
