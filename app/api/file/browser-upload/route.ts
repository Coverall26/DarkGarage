export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { getServerSession } from "next-auth/next";

import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { appRouterUploadRateLimit } from "@/lib/security/rate-limiter";

export async function POST(req: NextRequest) {
  // Rate limit: 20 uploads per minute
  const blocked = await appRouterUploadRateLimit(req);
  if (blocked) return blocked;

  let body: HandleUploadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Missing required upload body" },
      { status: 400 },
    );
  }

  if (!body || !body.type) {
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

        const userId = (session.user as CustomUser).id;
        const team = await prisma.team.findFirst({
          where: {
            users: {
              some: {
                userId,
              },
            },
          },
          select: {
            plan: true,
          },
        });

        // Self-hosted: 100MB limit for all users
        const maxSize = 100 * 1024 * 1024; // 100 MB

        return {
          addRandomSuffix: true,
          allowedContentTypes: [
            // PDF
            "application/pdf",
            // Excel & Spreadsheets
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel.sheet.macroEnabled.12",
            "text/csv",
            "text/tab-separated-values",
            "application/vnd.oasis.opendocument.spreadsheet",
            // Word & Documents
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.oasis.opendocument.text",
            "application/rtf",
            "text/rtf",
            "text/plain",
            // PowerPoint & Presentations
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.oasis.opendocument.presentation",
            "application/vnd.apple.keynote",
            "application/x-iwork-keynote-sffkey",
            // Images
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
            "image/webp",
            "image/svg+xml",
            "image/vnd.dwg",
            "image/vnd.dxf",
            // Video
            "video/mp4",
            "video/quicktime",
            "video/x-msvideo",
            "video/webm",
            "video/ogg",
            // Audio
            "audio/mp4",
            "audio/x-m4a",
            "audio/m4a",
            "audio/mpeg",
            // Archives
            "application/zip",
            "application/x-zip-compressed",
            // Other formats
            "application/vnd.google-earth.kml+xml",
            "application/vnd.google-earth.kmz",
            "application/vnd.ms-outlook",
          ],
          maximumSizeInBytes: maxSize,
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
