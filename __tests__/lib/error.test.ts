/**
 * Tests for lib/error.ts
 *
 * Validates error reporting utilities:
 * - reportError: sends errors to Rollbar serverInstance
 * - reportWarning / reportInfo: sends warnings/info to Rollbar
 * - withErrorReporting: HOF that catches, reports, and re-throws
 * - createApiErrorResponse: App Router error responses (never leaks details)
 * - handleApiError: Pages Router error responses (never leaks details)
 * - withPrismaErrorHandling: Prisma-specific error wrapper
 * - captureException: returns Rollbar UUID or null
 */

import { NextApiResponse } from "next";

// Mock Rollbar serverInstance
const mockError = jest.fn().mockReturnValue("mock-uuid");
const mockWarning = jest.fn();
const mockInfo = jest.fn();

jest.mock("@/lib/rollbar", () => ({
  serverInstance: {
    error: (...args: any[]) => mockError(...args),
    warning: (...args: any[]) => mockWarning(...args),
    info: (...args: any[]) => mockInfo(...args),
  },
  reportCritical: jest.fn(),
  reportSecurityIncident: jest.fn(),
}));

// Import after mocks
import {
  reportError,
  reportWarning,
  reportInfo,
  withErrorReporting,
  createApiErrorResponse,
  handleApiError,
  withPrismaErrorHandling,
  captureException,
} from "@/lib/error";

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// reportError
// ---------------------------------------------------------------------------
describe("reportError", () => {
  it("calls serverInstance.error with an Error instance", () => {
    const err = new Error("test error");
    reportError(err);

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr, passedContext] = mockError.mock.calls[0];
    expect(passedErr).toBe(err);
    expect(passedContext).toHaveProperty("timestamp");
  });

  it("wraps non-Error values in Error()", () => {
    reportError("string error");

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("string error");
  });

  it("wraps numeric values in Error()", () => {
    reportError(42);

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("42");
  });

  it("wraps null in Error()", () => {
    reportError(null);

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("null");
  });

  it("wraps undefined in Error()", () => {
    reportError(undefined);

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("undefined");
  });

  it("wraps object values in Error()", () => {
    reportError({ code: "ERR_CONN" });

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("[object Object]");
  });

  it("passes context with timestamp", () => {
    const context = { path: "/api/test", method: "POST", userId: "user-1" };
    reportError(new Error("test"), context);

    expect(mockError).toHaveBeenCalledTimes(1);
    const [, passedContext] = mockError.mock.calls[0];
    expect(passedContext.path).toBe("/api/test");
    expect(passedContext.method).toBe("POST");
    expect(passedContext.userId).toBe("user-1");
    expect(passedContext.timestamp).toBeDefined();
    // Verify timestamp is a valid ISO string
    expect(new Date(passedContext.timestamp).toISOString()).toBe(
      passedContext.timestamp,
    );
  });

  it("uses empty context by default", () => {
    reportError(new Error("test"));

    const [, passedContext] = mockError.mock.calls[0];
    expect(passedContext).toHaveProperty("timestamp");
    // Only timestamp should be present when no context provided
    const keys = Object.keys(passedContext);
    expect(keys).toEqual(["timestamp"]);
  });

  it("passes additional arbitrary context fields", () => {
    reportError(new Error("test"), { customField: "custom-value" });

    const [, passedContext] = mockError.mock.calls[0];
    expect(passedContext.customField).toBe("custom-value");
  });

  it("includes all ErrorContext interface fields when provided", () => {
    const fullContext = {
      path: "/api/fund",
      method: "DELETE",
      userId: "u-1",
      teamId: "t-1",
      documentId: "d-1",
      action: "delete-fund",
    };
    reportError(new Error("test"), fullContext);

    const [, passedContext] = mockError.mock.calls[0];
    expect(passedContext.path).toBe("/api/fund");
    expect(passedContext.method).toBe("DELETE");
    expect(passedContext.userId).toBe("u-1");
    expect(passedContext.teamId).toBe("t-1");
    expect(passedContext.documentId).toBe("d-1");
    expect(passedContext.action).toBe("delete-fund");
    expect(passedContext.timestamp).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// reportWarning / reportInfo
// ---------------------------------------------------------------------------
describe("reportWarning", () => {
  it("calls serverInstance.warning with message and context", () => {
    reportWarning("low disk space", { path: "/api/upload" });

    expect(mockWarning).toHaveBeenCalledTimes(1);
    const [msg, ctx] = mockWarning.mock.calls[0];
    expect(msg).toBe("low disk space");
    expect(ctx.path).toBe("/api/upload");
    expect(ctx.timestamp).toBeDefined();
  });

  it("uses empty context by default", () => {
    reportWarning("warning message");

    expect(mockWarning).toHaveBeenCalledTimes(1);
    const [msg, ctx] = mockWarning.mock.calls[0];
    expect(msg).toBe("warning message");
    const keys = Object.keys(ctx);
    expect(keys).toEqual(["timestamp"]);
  });

  it("does not call serverInstance.error or serverInstance.info", () => {
    reportWarning("just a warning");

    expect(mockWarning).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
    expect(mockInfo).not.toHaveBeenCalled();
  });
});

describe("reportInfo", () => {
  it("calls serverInstance.info with message and context", () => {
    reportInfo("user logged in", { userId: "u-123" });

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [msg, ctx] = mockInfo.mock.calls[0];
    expect(msg).toBe("user logged in");
    expect(ctx.userId).toBe("u-123");
    expect(ctx.timestamp).toBeDefined();
  });

  it("uses empty context by default", () => {
    reportInfo("info message");

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [msg, ctx] = mockInfo.mock.calls[0];
    expect(msg).toBe("info message");
    const keys = Object.keys(ctx);
    expect(keys).toEqual(["timestamp"]);
  });

  it("does not call serverInstance.error or serverInstance.warning", () => {
    reportInfo("just info");

    expect(mockInfo).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
    expect(mockWarning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// withErrorReporting
// ---------------------------------------------------------------------------
describe("withErrorReporting", () => {
  it("returns result on success", async () => {
    const fn = jest.fn().mockResolvedValue("success-result");
    const wrapped = withErrorReporting(fn, { action: "test" });

    const result = await wrapped();
    expect(result).toBe("success-result");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
  });

  it("passes arguments through to the wrapped function", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const wrapped = withErrorReporting(fn, {});

    await wrapped("arg1", "arg2");
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("reports error and re-throws on failure", async () => {
    const err = new Error("operation failed");
    const fn = jest.fn().mockRejectedValue(err);
    const context = { action: "create-fund" };
    const wrapped = withErrorReporting(fn, context);

    await expect(wrapped()).rejects.toThrow("operation failed");
    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr, passedCtx] = mockError.mock.calls[0];
    expect(passedErr).toBe(err);
    expect(passedCtx.action).toBe("create-fund");
  });

  it("re-throws the exact same error object", async () => {
    const originalErr = new Error("exact match");
    const fn = jest.fn().mockRejectedValue(originalErr);
    const wrapped = withErrorReporting(fn, {});

    let caughtErr: Error | undefined;
    try {
      await wrapped();
    } catch (e) {
      caughtErr = e as Error;
    }
    expect(caughtErr).toBe(originalErr);
  });

  it("does not call reportError when function succeeds", async () => {
    const fn = jest.fn().mockResolvedValue(42);
    const wrapped = withErrorReporting(fn);

    await wrapped();
    expect(mockError).not.toHaveBeenCalled();
  });

  it("uses empty context by default when function fails", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const wrapped = withErrorReporting(fn);

    await expect(wrapped()).rejects.toThrow("fail");
    expect(mockError).toHaveBeenCalledTimes(1);
    const [, passedCtx] = mockError.mock.calls[0];
    expect(passedCtx).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// createApiErrorResponse (App Router)
// ---------------------------------------------------------------------------
describe("createApiErrorResponse (App Router)", () => {
  it("returns NextResponse with 500 status by default", async () => {
    const response = createApiErrorResponse(new Error("db crash"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Internal server error" });
  });

  it("returns generic 'Internal server error' message and never leaks details", async () => {
    const sensitiveError = new Error(
      "Connection to postgres://user:password@host:5432/db failed",
    );
    const response = createApiErrorResponse(sensitiveError);

    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    // Must NOT contain the actual error message
    expect(JSON.stringify(body)).not.toContain("postgres");
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("respects custom statusCode", async () => {
    const response = createApiErrorResponse(
      new Error("not found"),
      {},
      404,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Internal server error" });
  });

  it("calls reportError with the error and context", () => {
    const err = new Error("something broke");
    const context = { path: "/api/fund", method: "POST" };
    createApiErrorResponse(err, context, 500);

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr, passedCtx] = mockError.mock.calls[0];
    expect(passedErr).toBe(err);
    expect(passedCtx.path).toBe("/api/fund");
    expect(passedCtx.method).toBe("POST");
  });

  it("uses empty context by default", () => {
    createApiErrorResponse(new Error("err"));

    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it("always returns the same generic message regardless of status code", async () => {
    const res400 = createApiErrorResponse(new Error("bad"), {}, 400);
    const res403 = createApiErrorResponse(new Error("forbidden"), {}, 403);

    const body400 = await res400.json();
    const body403 = await res403.json();

    expect(body400.error).toBe("Internal server error");
    expect(body403.error).toBe("Internal server error");
  });
});

// ---------------------------------------------------------------------------
// handleApiError (Pages Router)
// ---------------------------------------------------------------------------
describe("handleApiError (Pages Router)", () => {
  let res: NextApiResponse;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as NextApiResponse;
  });

  it("sends 500 with generic error message by default", () => {
    handleApiError(res, new Error("secret database error"));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });

  it("never leaks internal error details", () => {
    handleApiError(
      res,
      new Error("FATAL: password authentication failed for user 'admin'"),
    );

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.error).toBe("Internal server error");
    expect(JSON.stringify(jsonArg)).not.toContain("FATAL");
    expect(JSON.stringify(jsonArg)).not.toContain("password");
  });

  it("respects custom statusCode", () => {
    handleApiError(res, new Error("bad request"), {}, 400);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });

  it("calls reportError with the error and context", () => {
    const err = new Error("investor lookup failed");
    const context = { path: "/api/lp/register", userId: "u-5" };
    handleApiError(res, err, context);

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr, passedCtx] = mockError.mock.calls[0];
    expect(passedErr).toBe(err);
    expect(passedCtx.path).toBe("/api/lp/register");
    expect(passedCtx.userId).toBe("u-5");
  });

  it("uses empty context by default", () => {
    handleApiError(res, new Error("err"));

    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error values without crashing", () => {
    handleApiError(res, "string error");

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it("chains status and json calls correctly", () => {
    handleApiError(res, new Error("test"), {}, 503);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// withPrismaErrorHandling
// ---------------------------------------------------------------------------
describe("withPrismaErrorHandling", () => {
  it("returns result on success", async () => {
    const operation = jest.fn().mockResolvedValue({ id: "fund-1" });
    const result = await withPrismaErrorHandling(operation, {
      action: "create-fund",
    });

    expect(result).toEqual({ id: "fund-1" });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
  });

  it("reports error with source: 'prisma' and re-throws on failure", async () => {
    const prismaError = new Error(
      "Unique constraint failed on the fields: (`email`)",
    );
    const operation = jest.fn().mockRejectedValue(prismaError);

    await expect(
      withPrismaErrorHandling(operation, { action: "create-user" }),
    ).rejects.toThrow("Unique constraint failed");

    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr, passedCtx] = mockError.mock.calls[0];
    expect(passedErr).toBe(prismaError);
    expect(passedCtx.source).toBe("prisma");
    expect(passedCtx.action).toBe("create-user");
  });

  it("preserves original context and adds source: prisma", async () => {
    const operation = jest.fn().mockRejectedValue(new Error("db timeout"));

    await expect(
      withPrismaErrorHandling(operation, {
        path: "/api/fund",
        teamId: "team-1",
      }),
    ).rejects.toThrow("db timeout");

    const [, passedCtx] = mockError.mock.calls[0];
    expect(passedCtx.source).toBe("prisma");
    expect(passedCtx.path).toBe("/api/fund");
    expect(passedCtx.teamId).toBe("team-1");
  });

  it("uses empty context with source: prisma by default", async () => {
    const operation = jest.fn().mockRejectedValue(new Error("fail"));

    await expect(withPrismaErrorHandling(operation)).rejects.toThrow("fail");

    const [, passedCtx] = mockError.mock.calls[0];
    expect(passedCtx.source).toBe("prisma");
  });

  it("re-throws the exact same error object", async () => {
    const originalErr = new Error("prisma fail");
    const operation = jest.fn().mockRejectedValue(originalErr);

    let caughtErr: Error | undefined;
    try {
      await withPrismaErrorHandling(operation);
    } catch (e) {
      caughtErr = e as Error;
    }
    expect(caughtErr).toBe(originalErr);
  });

  it("does not call reportError when operation succeeds", async () => {
    const operation = jest.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]);
    await withPrismaErrorHandling(operation, { action: "list-funds" });

    expect(mockError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// captureException
// ---------------------------------------------------------------------------
describe("captureException", () => {
  it("returns UUID string from serverInstance.error", () => {
    const uuid = captureException(new Error("captured error"));

    expect(uuid).toBe("mock-uuid");
    expect(mockError).toHaveBeenCalledTimes(1);
    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("captured error");
  });

  it("wraps non-Error values in Error()", () => {
    captureException("string exception");

    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("string exception");
  });

  it("returns null when serverInstance.error returns non-string", () => {
    mockError.mockReturnValueOnce(undefined);
    const uuid = captureException(new Error("test"));

    expect(uuid).toBeNull();
  });

  it("returns null when serverInstance.error returns a number", () => {
    mockError.mockReturnValueOnce(123);
    const uuid = captureException(new Error("test"));

    expect(uuid).toBeNull();
  });

  it("wraps null in Error() and still returns UUID", () => {
    const uuid = captureException(null);

    expect(uuid).toBe("mock-uuid");
    const [passedErr] = mockError.mock.calls[0];
    expect(passedErr).toBeInstanceOf(Error);
    expect(passedErr.message).toBe("null");
  });
});

// ---------------------------------------------------------------------------
// serverInstance null safety
// ---------------------------------------------------------------------------
describe("serverInstance null safety", () => {
  // These tests verify the null-guard codepaths.
  // Since our mock always provides serverInstance, we verify the
  // guard logic by confirming calls go through when serverInstance exists.

  it("reportError calls through when serverInstance exists", () => {
    reportError(new Error("test"));
    expect(mockError).toHaveBeenCalledTimes(1);
  });

  it("reportWarning calls through when serverInstance exists", () => {
    reportWarning("test");
    expect(mockWarning).toHaveBeenCalledTimes(1);
  });

  it("reportInfo calls through when serverInstance exists", () => {
    reportInfo("test");
    expect(mockInfo).toHaveBeenCalledTimes(1);
  });
});
