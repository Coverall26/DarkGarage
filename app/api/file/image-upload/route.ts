export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { getServerSession } from "next-auth/next";

import { CustomUser } from "@/lib/types";
import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { appRouterUploadRateLimit } from "@/lib/security/rate-limiter";

const uploadConfig = {
  profile: {
    allowedContentTypes: ["image/png", "image/jpg"],
    maximumSizeInBytes: 2 * 1024 * 1024, // 2MB
  },
  assets: {
    allowedContentTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
      "image/x-icon",
      "image/ico",
    ],
    maximumSizeInBytes: 5 * 1024 * 1024, // 5MB
  },
};

// logo-upload/?type= "profile" | "assets"
export async function POST(req: NextRequest) {
  const blocked = await appRouterUploadRateLimit(req);
  if (blocked) return blocked;

  const type = req.nextUrl.searchParams.get("type");

  if (!type || !(type in uploadConfig)) {
    return NextResponse.json(
      { error: "Invalid upload type specified." },
      { status: 400 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Missing required upload body" },
      { status: 400 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req as unknown as Request,
      onBeforeGenerateToken: async (pathname: string) => {
        // Generate a client token for the browser to upload the file
        const session = await getServerSession(authOptions);
        if (!session) {
          throw new Error("Unauthorized");
        }

        return {
          addRandomSuffix: true,
          allowedContentTypes:
            uploadConfig[type as keyof typeof uploadConfig].allowedContentTypes,
          maximumSizeInBytes:
            uploadConfig[type as keyof typeof uploadConfig].maximumSizeInBytes,
          metadata: JSON.stringify({
            userId: (session.user as CustomUser).id,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          // Run any logic after the file upload completed
        } catch (error) {
          reportError(error as Error);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // The webhook will retry 5 times waiting for a 200
    reportError(error as Error);
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }
}
