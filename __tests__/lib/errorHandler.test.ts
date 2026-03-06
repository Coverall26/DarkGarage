/**
 * Tests for lib/errorHandler.ts
 *
 * Validates:
 * - errorhandler(): Pages Router catch-block handler
 *   - Returns 400 with "Access denied" for TeamError
 *   - Returns 400 with "Document not found" for DocumentError
 *   - Returns 500 with "Internal server error" for generic errors
 *   - Calls reportError for all error types
 * - TeamError class: statusCode 400, instanceof Error
 * - DocumentError class: statusCode 400, instanceof Error
 */

import { NextApiResponse } from "next";

// Override the global jest.setup.ts mock of @/lib/errorHandler so we get the
// real TeamError, DocumentError classes and the real errorhandler function.
jest.unmock("@/lib/errorHandler");

// Mock reportError from lib/error
const mockReportError = jest.fn();
jest.mock("@/lib/error", () => ({
  reportError: (...args: any[]) => mockReportError(...args),
}));

// Import after mocks — these are the REAL exports because we called unmock above
import { errorhandler, TeamError, DocumentError } from "@/lib/errorHandler";

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// errorhandler
// ---------------------------------------------------------------------------
describe("errorhandler", () => {
  let res: NextApiResponse;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as NextApiResponse;
  });

  it('returns 400 with "Access denied" for TeamError', () => {
    const err = new TeamError("User is not a member of team-123");
    errorhandler(err, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Access denied" });
  });

  it('returns 400 with "Document not found" for DocumentError', () => {
    const err = new DocumentError("Document doc-456 does not exist");
    errorhandler(err, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Document not found" });
  });

  it('returns 500 with "Internal server error" for generic Error', () => {
    const err = new Error("Something unexpected happened");
    errorhandler(err, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });

  it("calls reportError for TeamError", () => {
    const err = new TeamError("team access denied");
    errorhandler(err, res);

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith(err);
  });

  it("calls reportError for DocumentError", () => {
    const err = new DocumentError("doc missing");
    errorhandler(err, res);

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith(err);
  });

  it("calls reportError for generic Error", () => {
    const err = new Error("generic failure");
    errorhandler(err, res);

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith(err);
  });

  it("calls reportError for non-Error values", () => {
    errorhandler("string error", res);

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith("string error");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });

  it("never leaks the original TeamError message to the client", () => {
    const err = new TeamError(
      "Sensitive: user rciesco@fundroom.ai attempted access to team-xyz",
    );
    errorhandler(err, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.error).toBe("Access denied");
    expect(JSON.stringify(jsonArg)).not.toContain("rciesco");
    expect(JSON.stringify(jsonArg)).not.toContain("team-xyz");
  });

  it("never leaks the original DocumentError message to the client", () => {
    const err = new DocumentError(
      "Document at s3://bucket/private/doc-789.pdf not found",
    );
    errorhandler(err, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.error).toBe("Document not found");
    expect(JSON.stringify(jsonArg)).not.toContain("s3://");
    expect(JSON.stringify(jsonArg)).not.toContain("doc-789");
  });

  it("never leaks the original generic Error message to the client", () => {
    const err = new Error(
      "FATAL: password authentication failed for user 'admin'",
    );
    errorhandler(err, res);

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.error).toBe("Internal server error");
    expect(JSON.stringify(jsonArg)).not.toContain("FATAL");
    expect(JSON.stringify(jsonArg)).not.toContain("password");
  });

  it("handles null error value", () => {
    errorhandler(null, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
    expect(mockReportError).toHaveBeenCalledWith(null);
  });

  it("handles undefined error value", () => {
    errorhandler(undefined, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
    expect(mockReportError).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// TeamError
// ---------------------------------------------------------------------------
describe("TeamError", () => {
  it("has statusCode 400", () => {
    const err = new TeamError("access denied");
    expect(err.statusCode).toBe(400);
  });

  it("is an instanceof Error", () => {
    const err = new TeamError("access denied");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instanceof TeamError", () => {
    const err = new TeamError("access denied");
    expect(err).toBeInstanceOf(TeamError);
  });

  it("preserves message", () => {
    const err = new TeamError("user not in team");
    expect(err.message).toBe("user not in team");
  });

  it("has name 'Error' (default Error class name)", () => {
    const err = new TeamError("test");
    // Custom error classes that don't set this.name inherit "Error"
    expect(err.name).toBe("Error");
  });

  it("has a stack trace", () => {
    const err = new TeamError("test");
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// DocumentError
// ---------------------------------------------------------------------------
describe("DocumentError", () => {
  it("has statusCode 400", () => {
    const err = new DocumentError("not found");
    expect(err.statusCode).toBe(400);
  });

  it("is an instanceof Error", () => {
    const err = new DocumentError("not found");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instanceof DocumentError", () => {
    const err = new DocumentError("not found");
    expect(err).toBeInstanceOf(DocumentError);
  });

  it("preserves message", () => {
    const err = new DocumentError("document doc-123 not found");
    expect(err.message).toBe("document doc-123 not found");
  });

  it("has a stack trace", () => {
    const err = new DocumentError("test");
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe("string");
  });

  it("is not an instanceof TeamError", () => {
    const err = new DocumentError("not found");
    expect(err).not.toBeInstanceOf(TeamError);
  });
});

// ---------------------------------------------------------------------------
// TeamError vs DocumentError discrimination
// ---------------------------------------------------------------------------
describe("TeamError vs DocumentError discrimination", () => {
  it("TeamError and DocumentError produce different client messages", () => {
    const teamRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as NextApiResponse;

    const docRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as NextApiResponse;

    errorhandler(new TeamError("team issue"), teamRes);
    errorhandler(new DocumentError("doc issue"), docRes);

    const teamMsg = (teamRes.json as jest.Mock).mock.calls[0][0];
    const docMsg = (docRes.json as jest.Mock).mock.calls[0][0];

    expect(teamMsg.error).toBe("Access denied");
    expect(docMsg.error).toBe("Document not found");
    expect(teamMsg.error).not.toBe(docMsg.error);
  });

  it("both use statusCode 400 but generic Error uses 500", () => {
    const res1 = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as NextApiResponse;
    const res2 = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as NextApiResponse;
    const res3 = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as NextApiResponse;

    errorhandler(new TeamError("t"), res1);
    errorhandler(new DocumentError("d"), res2);
    errorhandler(new Error("e"), res3);

    expect(res1.status).toHaveBeenCalledWith(400);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res3.status).toHaveBeenCalledWith(500);
  });
});
