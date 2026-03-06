import { Suspense } from "react";
import { Metadata } from "next";
import RaiseRoomPageClient from "./page-client";

export const metadata: Metadata = {
  title: "Raise Dashboard — Capital Raise | FundRoom AI",
};

export default function RaiseRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      }
    >
      <RaiseRoomPageClient />
    </Suspense>
  );
}
