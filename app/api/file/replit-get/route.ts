export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { log } from "@/lib/utils";
import { reportError } from "@/lib/error";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

const REPLIT_SIDECAR_ENDPOINT =
  process.env.REPLIT_SIDECAR_ENDPOINT || "http://127.0.0.1:1106";

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}`,
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    // Authentication: Only accept INTERNAL_API_KEY (server-side calls)
    // Client calls must go through the proxy endpoint for team authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
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
    if (token !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = (await req.json()) as { key: string };

    if (!key) {
      return NextResponse.json(
        { error: "Missing required field: key" },
        { status: 400 },
      );
    }

    const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateObjectDir) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    let objectEntityDir = privateObjectDir;
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    let entityPath = key;
    if (key.startsWith("/objects/")) {
      entityPath = key.slice("/objects/".length);
    }

    const fullPath = `${objectEntityDir}${entityPath}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const signedUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: 3600,
    });

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
