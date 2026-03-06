/**
 * CSRF Protection Tests
 *
 * Covers all three CSRF validator variants:
 * - validateCSRF (Pages Router)
 * - validateCSRFAppRouter (App Router)
 * - validateCSRFEdge (Edge / proxy.ts middleware)
 */

import { NextRequest } from "next/server";
import {
  validateCSRF,
  validateCSRFAppRouter,
  validateCSRFEdge,
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
} from "@/lib/security/csrf";

// Mock environment
const originalEnv = process.env;
beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_PLATFORM_DOMAIN: "fundroom.ai",
    NEXTAUTH_URL: "https://app.fundroom.ai",
    NODE_ENV: "production",
  };
});
afterAll(() => {
  process.env = originalEnv;
});

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function makePagesReq(
  method: string,
  headers: Record<string, string | undefined> = {},
) {
  return {
    method,
    headers: Object.fromEntries(
      Object.entries(headers).filter(([, v]) => v !== undefined),
    ),
  } as any;
}

function makePagesRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeAppRouterReq(
  method: string,
  headers: Record<string, string> = {},
) {
  return new NextRequest("https://app.fundroom.ai/api/test", {
    method,
    headers,
  });
}

function makeEdgeReq(method: string, headers: Record<string, string> = {}) {
  return new Request("https://app.fundroom.ai/api/test", {
    method,
    headers,
  });
}

// --------------------------------------------------------------------------
// validateCSRF (Pages Router)
// --------------------------------------------------------------------------

describe("validateCSRF (Pages Router)", () => {
  it("allows GET requests without any headers", () => {
    const req = makePagesReq("GET", {});
    const res = makePagesRes();
    expect(validateCSRF(req, res)).toBe(true);
  });

  it("allows POST with valid Origin", () => {
    const req = makePagesReq("POST", {
      origin: "https://app.fundroom.ai",
    });
    const res = makePagesRes();
    expect(validateCSRF(req, res)).toBe(true);
  });

  it("rejects POST with invalid Origin", () => {
    const req = makePagesReq("POST", {
      origin: "https://evil.com",
    });
    const res = makePagesRes();
    expect(validateCSRF(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows POST with valid Referer (no Origin)", () => {
    const req = makePagesReq("POST", {
      referer: "https://app.fundroom.ai/dashboard",
    });
    const res = makePagesRes();
    expect(validateCSRF(req, res)).toBe(true);
  });

  it("rejects POST when both Origin and Referer missing and no custom header", () => {
    const req = makePagesReq("POST", {});
    const res = makePagesRes();
    expect(validateCSRF(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden: missing origin verification",
    });
  });

  it("allows POST when both Origin and Referer missing but X-Requested-With: FundRoom present", () => {
    const req = makePagesReq("POST", {
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    });
    const res = makePagesRes();
    expect(validateCSRF(req, res)).toBe(true);
  });

  it("rejects POST when both missing and X-Requested-With has wrong value", () => {
    const req = makePagesReq("POST", {
      [CSRF_HEADER_NAME]: "WrongValue",
    });
    const res = makePagesRes();
    expect(validateCSRF(req, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// --------------------------------------------------------------------------
// validateCSRFAppRouter (App Router)
// --------------------------------------------------------------------------

describe("validateCSRFAppRouter (App Router)", () => {
  it("allows GET requests", () => {
    const req = makeAppRouterReq("GET");
    expect(validateCSRFAppRouter(req)).toBeNull();
  });

  it("allows POST with valid Origin", () => {
    const req = makeAppRouterReq("POST", {
      origin: "https://app.fundroom.ai",
    });
    expect(validateCSRFAppRouter(req)).toBeNull();
  });

  it("rejects POST with invalid Origin", () => {
    const req = makeAppRouterReq("POST", {
      origin: "https://evil.com",
    });
    const res = validateCSRFAppRouter(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("rejects POST when both Origin and Referer missing and no custom header", () => {
    const req = makeAppRouterReq("POST", {});
    const res = validateCSRFAppRouter(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("allows POST when both missing but X-Requested-With: FundRoom present", () => {
    const req = makeAppRouterReq("POST", {
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    });
    expect(validateCSRFAppRouter(req)).toBeNull();
  });

  it("rejects PATCH when both missing and no custom header", () => {
    const req = makeAppRouterReq("PATCH", {});
    const res = validateCSRFAppRouter(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("rejects DELETE when both missing and wrong custom header value", () => {
    const req = makeAppRouterReq("DELETE", {
      [CSRF_HEADER_NAME]: "SomethingElse",
    });
    const res = validateCSRFAppRouter(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });
});

// --------------------------------------------------------------------------
// validateCSRFEdge (Edge middleware)
// --------------------------------------------------------------------------

describe("validateCSRFEdge (Edge middleware)", () => {
  it("allows GET requests", () => {
    const req = makeEdgeReq("GET");
    expect(validateCSRFEdge(req)).toBeNull();
  });

  it("allows exempt webhook paths", () => {
    const req = new Request(
      "https://app.fundroom.ai/api/webhooks/stripe",
      { method: "POST" },
    );
    expect(validateCSRFEdge(req)).toBeNull();
  });

  it("allows exempt auth paths", () => {
    const req = new Request(
      "https://app.fundroom.ai/api/auth/callback",
      { method: "POST" },
    );
    expect(validateCSRFEdge(req)).toBeNull();
  });

  it("allows POST with valid Origin", () => {
    const req = makeEdgeReq("POST", {
      origin: "https://app.fundroom.ai",
    });
    expect(validateCSRFEdge(req)).toBeNull();
  });

  it("rejects POST with invalid Origin", () => {
    const req = makeEdgeReq("POST", {
      origin: "https://evil.com",
    });
    const res = validateCSRFEdge(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("rejects POST when both Origin and Referer missing and no custom header", () => {
    const req = makeEdgeReq("POST", {});
    const res = validateCSRFEdge(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("allows POST when both missing but X-Requested-With: FundRoom present", () => {
    const req = makeEdgeReq("POST", {
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
    });
    expect(validateCSRFEdge(req)).toBeNull();
  });

  it("rejects PUT when both missing and custom header has wrong value", () => {
    const req = new Request("https://app.fundroom.ai/api/test", {
      method: "PUT",
      headers: { [CSRF_HEADER_NAME]: "NotFundRoom" },
    });
    const res = validateCSRFEdge(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });
});
