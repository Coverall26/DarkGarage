import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth/auth-options";
import { LPHeader } from "@/components/lp/lp-header";
import { LPBottomTabBar } from "@/components/lp/bottom-tab-bar";

/**
 * LP Portal Layout — Dark theme is an intentional V1 design decision.
 * The dark gradient provides a premium fintech aesthetic consistent with
 * the FundRoom brand (Deep Navy #0A1628 backgrounds per Brand Guidelines).
 * All text uses white/gray-300 on gray-900 backgrounds meeting WCAG AA 4.5:1 contrast.
 * V2: Consider adding theme toggle in LP Settings tab or respecting prefers-color-scheme.
 *
 * Server-side auth: Redirects unauthenticated users to /lp/login.
 * Exception: /lp/onboard is accessible without auth (investor registration wizard).
 * Pathname is injected by proxy.ts via x-lp-pathname header.
 */

/** Paths under /lp/ that are accessible without authentication */
const PUBLIC_LP_PATHS = ["/lp/onboard"];

function isPublicLPPath(pathname: string): boolean {
  return PUBLIC_LP_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export default async function LPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-lp-pathname") ?? "";

  // Skip auth check for public LP paths (e.g., onboarding wizard)
  if (!isPublicLPPath(pathname)) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      redirect("/lp/login");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:bg-[#0066FF] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>
      <LPHeader />
      <main id="main-content" className="pb-20 md:pb-0" tabIndex={-1}>{children}</main>
      <LPBottomTabBar />
    </div>
  );
}
