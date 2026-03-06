import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import { verifyEmailDomain } from "@/lib/email/domain-service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string }>;
};

/**
 * POST /api/teams/[teamId]/email-domain/verify
 * Trigger domain verification check in Resend.
 * Call after the org has added DNS records to their domain.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const status = await verifyEmailDomain(teamId);

    return NextResponse.json({
      domain: status.name,
      status: status.status,
      dnsRecords: status.dnsRecords,
    });
  } catch (error: unknown) {
    const msg = (error instanceof Error ? error.message : "") || "";
    if (msg.includes("No email domain configured")) {
      return NextResponse.json({ error: "No email domain configured for this team" }, { status: 400 });
    }
    return errorResponse(error);
  }
}
