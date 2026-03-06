import crypto from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getCloudfrontSignedUrl } from "@aws-sdk/cloudfront-signer";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";

import { ONE_HOUR, ONE_SECOND } from "@/lib/constants";
import { reportError } from "@/lib/error";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import { log } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Extract the API Key from the Authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if the API Key matches
  if (!process.env.INTERNAL_API_KEY) {
    log({
      message: "INTERNAL_API_KEY environment variable is not set",
      type: "error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
  // Timing-safe comparison to prevent timing attacks on API key guessing
  const tokenBuf = Buffer.from(token);
  const keyBuf = Buffer.from(process.env.INTERNAL_API_KEY);
  if (tokenBuf.length !== keyBuf.length || !crypto.timingSafeEqual(tokenBuf, keyBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = (await req.json()) as { key: string };

  try {
    // Extract teamId from key (format: teamId/docId/filename)
    const teamId = key.split("/")[0];
    if (!teamId) {
      log({
        message: `Invalid key format: ${key}`,
        type: "error",
      });
      return NextResponse.json(
        { error: "Invalid key format" },
        { status: 400 },
      );
    }

    const { client, config } = await getTeamS3ClientAndConfig(teamId);

    if (config.distributionHost) {
      const distributionUrl = new URL(
        key,
        `https://${config.distributionHost}`,
      );

      const url = getCloudfrontSignedUrl({
        url: distributionUrl.toString(),
        keyPairId: `${config.distributionKeyId}`,
        privateKey: `${config.distributionKeyContents}`,
        dateLessThan: new Date(Date.now() + ONE_HOUR).toISOString(),
      });

      return NextResponse.json({ url });
    }

    const getObjectCommand = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const url = await getS3SignedUrl(client, getObjectCommand, {
      expiresIn: ONE_HOUR / ONE_SECOND,
    });

    return NextResponse.json({ url });
  } catch (error) {
    reportError(error as Error);
    log({
      message: `Error getting presigned get url for ${key} \n\n ${error}`,
      type: "error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
