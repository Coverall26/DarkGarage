import { NextRequest, NextResponse } from "next/server";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import slugify from "@sindresorhus/slugify";
import { getServerSession } from "next-auth/next";
import path from "node:path";

import { authOptions } from "@/lib/auth/auth-options";
import { ONE_HOUR, ONE_SECOND } from "@/lib/constants";
import { errorResponse } from "@/lib/errors";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileName, contentType, teamId, docId } = (await req.json()) as {
    fileName: string;
    contentType: string;
    teamId: string;
    docId: string;
  };

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

  try {
    // Get the basename and extension for the file
    const { name, ext } = path.parse(fileName);

    const slugifiedName = slugify(name) + ext;
    const key = `${team.id}/${docId}/${slugifiedName}`;

    const { client, config } = await getTeamS3ClientAndConfig(team.id);

    const putObjectCommand = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentDisposition: `attachment; filename="${slugifiedName}"`,
    });

    const url = await getSignedUrl(client, putObjectCommand, {
      expiresIn: ONE_HOUR / ONE_SECOND,
    });

    return NextResponse.json({ url, key, docId, fileName: slugifiedName });
  } catch (error) {
    return errorResponse(error);
  }
}
