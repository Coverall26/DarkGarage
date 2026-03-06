export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";

export async function GET(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uploadTransport = process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT || "vercel";

    return NextResponse.json({ transport: uploadTransport });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
