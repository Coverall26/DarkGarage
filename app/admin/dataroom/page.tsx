import { Suspense } from "react";
import { Metadata } from "next";
import DataRoomPageClient from "./page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DataRoom — Secure Documents | FundRoom AI",
};

export default function DataRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="h-64 animate-pulse bg-muted rounded-lg" />
        </div>
      }
    >
      <DataRoomPageClient />
    </Suspense>
  );
}
