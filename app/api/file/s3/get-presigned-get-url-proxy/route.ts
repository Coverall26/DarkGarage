export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = (await req.json()) as { key: string };

    if (!key) {
      return NextResponse.json(
        { error: "Key is required" },
        { status: 400 },
      );
    }

    // Extract teamId from key (format: teamId/docId/filename)
    const teamId = key.split("/")[0];
    if (!teamId) {
      return NextResponse.json(
        { error: "Invalid key format" },
        { status: 400 },
      );
    }

    // Check if user belongs to the team that owns the file
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: {
            userId: (session.user as CustomUser).id,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this team" },
        { status: 403 },
      );
    }

    // Forward to the internal presigned URL endpoint
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/file/s3/get-presigned-get-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({ key }),
      },
    );

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let error: Record<string, unknown>;

      if (contentType && contentType.includes("application/json")) {
        try {
          error = await response.json();
        } catch {
          error = {
            error:
              (await response.text()) ||
              `Request failed with status ${response.status}`,
          };
        }
      } else {
        const textError = await response.text();
        error = {
          error: textError || `Request failed with status ${response.status}`,
        };
      }

      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
