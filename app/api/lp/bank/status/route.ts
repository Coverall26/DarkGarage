import { NextResponse } from "next/server";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/lp/bank/status
 * Returns bank linking status for authenticated LP.
 *
 * DISABLED: Plaid is Phase 2. Manual wire transfer is the MVP payment method.
 * Set PLAID_ENABLED=true and provide PLAID_CLIENT_ID + PLAID_SECRET to activate.
 */
export async function GET() {
  // Defense-in-depth: LP auth check (additive to edge middleware)
  const auth = await requireLPAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    configured: false,
    hasBankLink: false,
    bankLink: null,
    phase: "V2",
  });
}
