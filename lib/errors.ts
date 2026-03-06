/**
 * Structured Error System for FundRoom AI
 *
 * Typed error classes with error codes and HTTP status mapping.
 * Use `Errors` factory for common error patterns.
 * Use `errorResponse()` for App Router, `pagesErrorResponse()` for Pages Router.
 *
 * Usage:
 *   import { Errors, errorResponse } from "@/lib/errors";
 *   throw Errors.NotFound("Fund", fundId);
 *   // In catch: return errorResponse(error);
 */

import { NextResponse } from "next/server";
import type { NextApiResponse } from "next";

import { reportError } from "@/lib/error";

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "RESOURCE_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "PAYMENT_REQUIRED"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "UNPROCESSABLE_ENTITY";

const HTTP_STATUS: Record<ErrorCode, number> = {
  RESOURCE_NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  BAD_REQUEST: 400,
  PAYMENT_REQUIRED: 402,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  UNPROCESSABLE_ENTITY: 422,
};

// ---------------------------------------------------------------------------
// AppError Class
// ---------------------------------------------------------------------------

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = HTTP_STATUS[code];
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Errors Factory
// ---------------------------------------------------------------------------

export const Errors = {
  NotFound: (resource: string, id?: string) =>
    new AppError(
      "RESOURCE_NOT_FOUND",
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      { resource, id },
    ),

  Unauthorized: (message = "Authentication required") =>
    new AppError("UNAUTHORIZED", message),

  Forbidden: (message = "You do not have permission to perform this action") =>
    new AppError("FORBIDDEN", message),

  ValidationFailed: (
    message: string,
    errors?: Array<{ path: string; message: string }>,
  ) => new AppError("VALIDATION_FAILED", message, { errors }),

  RateLimited: (message = "Too many requests. Please try again later.") =>
    new AppError("RATE_LIMITED", message),

  Conflict: (message: string) => new AppError("CONFLICT", message),

  BadRequest: (message: string) => new AppError("BAD_REQUEST", message),

  PaymentRequired: (message = "Active subscription required") =>
    new AppError("PAYMENT_REQUIRED", message),

  MethodNotAllowed: (allowed: string[]) =>
    new AppError("METHOD_NOT_ALLOWED", `Method not allowed`, {
      allowed,
    }),

  Internal: (message = "Internal server error") =>
    new AppError("INTERNAL_ERROR", message),

  ServiceUnavailable: (message = "Service temporarily unavailable") =>
    new AppError("SERVICE_UNAVAILABLE", message),

  Unprocessable: (message: string) =>
    new AppError("UNPROCESSABLE_ENTITY", message),
} as const;

// ---------------------------------------------------------------------------
// Response Helpers
// ---------------------------------------------------------------------------

/**
 * App Router error response handler.
 * If the error is an AppError, returns typed JSON with error code.
 * Otherwise, reports to Rollbar and returns generic 500.
 */
export function errorResponse(error: unknown, _context?: string): NextResponse {
  if (error instanceof AppError) {
    const body: Record<string, unknown> = {
      error: error.message,
      code: error.code,
    };
    // Include validation details for 400-level errors
    if (error.details?.errors && error.statusCode < 500) {
      body.details = error.details.errors;
    }
    return NextResponse.json(body, { status: error.statusCode });
  }

  // Unknown error — report and return generic 500
  reportError(error);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

/**
 * Pages Router error response handler.
 * If the error is an AppError, returns typed JSON with error code.
 * Otherwise, reports to Rollbar and returns generic 500.
 */
export function pagesErrorResponse(
  res: NextApiResponse,
  error: unknown,
): void {
  if (error instanceof AppError) {
    const body: Record<string, unknown> = {
      error: error.message,
      code: error.code,
    };
    if (error.details?.errors && error.statusCode < 500) {
      body.details = error.details.errors;
    }
    res.status(error.statusCode).json(body);
    return;
  }

  reportError(error);
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}
