export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import slugify from "@sindresorhus/slugify";
import { getServerSession } from "next-auth";
import path from "node:path";

import { ONE_HOUR, ONE_SECOND } from "@/lib/constants";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { MultipartUploadSchema } from "@/lib/zod/schemas/multipart";
import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { appRouterUploadRateLimit } from "@/lib/security/rate-limiter";

export async function POST(req: NextRequest) {
  const blocked = await appRouterUploadRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validate request body with Zod
    const validationResult = MultipartUploadSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const data = validationResult.data;
    const { action, fileName, contentType, teamId, docId } = data;

    // Verify team access
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: {
            userId: (session.user as CustomUser).id,
          },
        },
      },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Unauthorized to access this team" },
        { status: 403 },
      );
    }

    // Get the basename and extension for the file
    const { name, ext } = path.parse(fileName);
    const slugifiedName = slugify(name) + ext;
    const key = `${team.id}/${docId}/${slugifiedName}`;

    const { client, config } = await getTeamS3ClientAndConfig(team.id);

    switch (action) {
      case "initiate": {
        // Step 1: Start multipart upload
        const createCommand = new CreateMultipartUploadCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: contentType,
          ContentDisposition: `attachment; filename="${slugifiedName}"`,
        });

        const createResponse = await client.send(createCommand);

        return NextResponse.json({
          uploadId: createResponse.UploadId,
          key,
          fileName: slugifiedName,
        });
      }

      case "get-part-urls": {
        // Step 2: Generate pre-signed URLs for each part
        if (data.action !== "get-part-urls") {
          return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 },
          );
        }

        const { uploadId, fileSize, partSize } = data;

        const numParts = Math.ceil(fileSize / partSize);
        const urls = await Promise.all(
          Array.from({ length: numParts }, async (_, index) => {
            const partNumber = index + 1;
            const command = new UploadPartCommand({
              Bucket: config.bucket,
              Key: key,
              PartNumber: partNumber,
              UploadId: uploadId,
            });

            const url = await getSignedUrl(client, command, {
              expiresIn: ONE_HOUR / ONE_SECOND,
            });

            return { partNumber, url };
          }),
        );

        return NextResponse.json({ urls });
      }

      case "complete": {
        // Step 3: Complete multipart upload
        if (data.action !== "complete") {
          return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 },
          );
        }

        const { uploadId, parts } = data;

        const completeCommand = new CompleteMultipartUploadCommand({
          Bucket: config.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
          },
        });

        try {
          await client.send(completeCommand);

          return NextResponse.json({
            success: true,
            key,
            fileName: slugifiedName,
          });
        } catch (completeError) {
          reportError(completeError as Error);

          // Cleanup: Abort the multipart upload to prevent storage costs
          try {
            const abortCommand = new AbortMultipartUploadCommand({
              Bucket: config.bucket,
              Key: key,
              UploadId: uploadId,
            });

            await client.send(abortCommand);
          } catch (abortError) {
            reportError(abortError as Error);
            // Log but don't fail the request - the upload already failed
          }

          return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
          );
        }
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
