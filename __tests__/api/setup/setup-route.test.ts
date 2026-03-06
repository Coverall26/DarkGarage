/**
 * Setup Route Tests
 *
 * Tests for:
 *   POST /api/setup — Save wizard step progress
 *   GET  /api/setup — Get current wizard state
 *
 * Validates: auth enforcement, input validation, audit logging,
 * happy path, and error handling.
 */

import { NextRequest, NextResponse } from "next/server";

const mockRequireAuthAppRouter = jest.fn();
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
const mockReportError = jest.fn();

jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: any[]) => mockRequireAuthAppRouter(...args),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: any[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: (...args: any[]) => mockReportError(...args),
}));

import { POST, GET } from "@/app/api/setup/route";

// --- Helpers ---

const USER_ID = "user-setup-001";

function mockAuth() {
  mockRequireAuthAppRouter.mockResolvedValue({
    userId: USER_ID,
    email: "gp@example.com",
    teamId: "",
    role: "MEMBER",
    session: { user: { id: USER_ID, email: "gp@example.com" } },
  });
}

function mockAuthDenied() {
  mockRequireAuthAppRouter.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}

function makePostRequest(body: any) {
  return new NextRequest("http://localhost/api/setup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/setup", {
    method: "GET",
  });
}

// --- Tests ---

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/setup", () => {
  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuthDenied();

      const res = await POST(makePostRequest({ step: 0, data: {} }));
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Input Validation", () => {
    it("returns 400 when step is missing", async () => {
      mockAuth();

      const res = await POST(makePostRequest({ data: { name: "test" } }));
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid request body");
    });

    it("returns 400 when step is not a number", async () => {
      mockAuth();

      const res = await POST(
        makePostRequest({ step: "two", data: { name: "test" } }),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid request body");
    });

    it("returns 400 when data is missing", async () => {
      mockAuth();

      const res = await POST(makePostRequest({ step: 0 }));
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid request body");
    });

    it("returns 400 when data is null", async () => {
      mockAuth();

      const res = await POST(makePostRequest({ step: 0, data: null }));
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid request body");
    });

    it("returns 400 when body is empty object", async () => {
      mockAuth();

      const res = await POST(makePostRequest({}));
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid request body");
    });
  });

  describe("Happy Path", () => {
    it("saves step 0 (company_info) successfully", async () => {
      mockAuth();

      const res = await POST(
        makePostRequest({ step: 0, data: { companyName: "Acme Capital" } }),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.step).toBe(0);
    });

    it("saves step 4 (dataroom) successfully", async () => {
      mockAuth();

      const res = await POST(
        makePostRequest({ step: 4, data: { dataroomName: "My Dataroom" } }),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.step).toBe(4);
    });

    it("saves step 8 (launch) successfully", async () => {
      mockAuth();

      const res = await POST(
        makePostRequest({ step: 8, data: { ready: true } }),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.step).toBe(8);
    });

    it("accepts step numbers beyond defined step names", async () => {
      mockAuth();

      const res = await POST(
        makePostRequest({ step: 15, data: { extra: true } }),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.step).toBe(15);
    });
  });

  describe("Audit Logging", () => {
    it("logs audit event with correct step name", async () => {
      mockAuth();

      await POST(
        makePostRequest({ step: 2, data: { raiseType: "GP_FUND" } }),
      );

      expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "SETTINGS_UPDATED",
          userId: USER_ID,
          resourceType: "Organization",
          metadata: expect.objectContaining({
            action: "wizard_step_saved",
            step: 2,
            stepName: "raise_style",
          }),
        }),
      );
    });

    it("logs audit event with undefined stepName for out-of-range step", async () => {
      mockAuth();

      await POST(makePostRequest({ step: 20, data: { foo: "bar" } }));

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            step: 20,
            stepName: undefined,
          }),
        }),
      );
    });

    it("logs correct step names for all 9 wizard steps", async () => {
      const expectedStepNames = [
        "company_info",
        "branding",
        "raise_style",
        "team_invites",
        "dataroom",
        "fund_details",
        "lp_onboarding",
        "integrations",
        "launch",
      ];

      for (let i = 0; i < expectedStepNames.length; i++) {
        jest.clearAllMocks();
        mockAuth();

        await POST(makePostRequest({ step: i, data: { test: true } }));

        expect(mockLogAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              stepName: expectedStepNames[i],
            }),
          }),
        );
      }
    });
  });

  describe("Error Handling", () => {
    it("returns 500 and calls reportError when audit logging throws", async () => {
      mockAuth();
      mockLogAuditEvent.mockRejectedValueOnce(new Error("Audit DB down"));

      const res = await POST(
        makePostRequest({ step: 0, data: { name: "test" } }),
      );
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledTimes(1);
    });
  });
});

describe("GET /api/setup", () => {
  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuthDenied();

      const res = await GET();
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Happy Path", () => {
    it("returns success with null data", async () => {
      mockAuth();

      const res = await GET();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });
  });
});
