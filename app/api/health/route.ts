export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { checkDatabaseHealth } from "@/lib/prisma";
import { checkRedisHealth } from "@/lib/redis";
import { isResendConfigured } from "@/lib/resend";
import { validateEnv } from "@/lib/env";

interface ServiceStatus {
  status: "up" | "down" | "not_configured";
  latency_ms?: number;
  provider?: string;
  backend?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    storage: ServiceStatus;
    email: ServiceStatus;
  };
  envErrors?: number;
}

const startTime = Date.now();

export async function GET() {
  const services: HealthResponse["services"] = {
    database: { status: "down" },
    redis: { status: "not_configured" },
    storage: { status: "not_configured" },
    email: { status: "not_configured" },
  };

  // -- Database check (SELECT 1) --
  try {
    const dbResult = await checkDatabaseHealth();
    services.database = {
      status: "up",
      latency_ms: dbResult.latencyMs,
    };
  } catch {
    services.database = { status: "down" };
  }

  // -- Redis check (PING) --
  try {
    const redisResult = await checkRedisHealth();
    services.redis = {
      status: redisResult.connected ? "up" : "not_configured",
      latency_ms: redisResult.latencyMs ?? undefined,
      backend: redisResult.backend,
    };
  } catch {
    services.redis = { status: "down" };
  }

  // -- Storage check (provider configured) --
  const storageProvider = process.env.STORAGE_PROVIDER;
  if (storageProvider) {
    services.storage = {
      status: "up",
      provider: storageProvider,
    };
  }

  // -- Email check (Resend API key valid) --
  if (isResendConfigured()) {
    services.email = { status: "up" };
  }

  // -- Env var validation --
  const envResult = validateEnv();

  // -- Determine overall status --
  let overallStatus: HealthResponse["status"] = "healthy";

  if (!envResult.valid || services.database.status === "down") {
    overallStatus = "unhealthy";
  } else if (
    services.storage.status === "not_configured" ||
    services.redis.status === "not_configured" ||
    services.email.status === "not_configured"
  ) {
    overallStatus = "degraded";
  }

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  const body: HealthResponse = {
    status: overallStatus,
    version: process.env.npm_package_version || "0.9.13",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services,
    ...(envResult.errors.length > 0 && {
      envErrors: envResult.errors.length,
    }),
  };

  return NextResponse.json(body, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
