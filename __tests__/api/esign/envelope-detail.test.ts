/**
 * Tests for /api/esign/envelopes/[id] — GET detail + PATCH update + DELETE
 *
 * GET: Returns envelope with recipients and filings.
 * PATCH: Updates draft/preparing envelopes.
 * DELETE: Hard-deletes draft or voids in-progress envelopes.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

const mockVoidEnvelope = jest.fn();
jest.mock("@/lib/esign/envelope-service", () => ({
  voidEnvelope: (...args: unknown[]) => mockVoidEnvelope(...args),
}));

jest.mock("@/lib/middleware/validate", () => ({
  validateBody: jest.fn().mockImplementation(async (req: Request, _schema: unknown) => {
    const body = await req.json();
    return { data: body, error: null };
  }),
}));

jest.mock("@/lib/validations/esign-outreach", () => ({
  EnvelopeUpdateSchema: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let GET: typeof import("@/app/api/esign/envelopes/[id]/route").GET;
let PATCH: typeof import("@/app/api/esign/envelopes/[id]/route").PATCH;
let DELETE: typeof import("@/app/api/esign/envelopes/[id]/route").DELETE;

const mockSessionData = {
  user: { id: "user-1", email: "gp@fundroom.ai", name: "GP Admin" },
  expires: "2099-01-01",
};

const mockTeam = { teamId: "team-1" };

const mockEnvelope = {
  id: "env-1",
  title: "NDA",
  status: "DRAFT",
  teamId: "team-1",
  recipients: [],
  filings: [],
  createdBy: { name: "GP Admin", email: "gp@fundroom.ai" },
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(
  method: string,
  body?: unknown
): Request {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { "Content-Type": "application/json" };
  }
  return new Request("http://localhost:5000/api/esign/envelopes/env-1", options);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  (getServerSession as jest.Mock).mockResolvedValue(mockSessionData);
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(mockTeam);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });
  (prisma.envelope.findUnique as jest.Mock).mockResolvedValue(mockEnvelope);

  const mod = await import("@/app/api/esign/envelopes/[id]/route");
  GET = mod.GET;
  PATCH = mod.PATCH;
  DELETE = mod.DELETE;
});

// ============================================================================
// GET /api/esign/envelopes/[id]
// ============================================================================

describe("GET /api/esign/envelopes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest("GET") as any, makeParams("env-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active team", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest("GET") as any, makeParams("env-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("No active team");
  });

  it("returns 404 when envelope not found", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest("GET") as any, makeParams("env-404"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Envelope not found");
  });

  it("returns 403 when envelope belongs to different team", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      teamId: "other-team",
    });

    const res = await GET(makeRequest("GET") as any, makeParams("env-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Access denied");
  });

  it("returns envelope details on success", async () => {
    const res = await GET(makeRequest("GET") as any, makeParams("env-1"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe("env-1");
    expect(data.title).toBe("NDA");
  });

  it("returns 500 on internal error", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockRejectedValue(
      new Error("DB error")
    );

    const res = await GET(makeRequest("GET") as any, makeParams("env-1"));
    expect(res.status).toBe(500);
  });
});

// ============================================================================
// PATCH /api/esign/envelopes/[id]
// ============================================================================

describe("PATCH /api/esign/envelopes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await PATCH(
      makeRequest("PATCH", { title: "Updated" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when envelope not found", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await PATCH(
      makeRequest("PATCH", { title: "Updated" }) as any,
      makeParams("env-404")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when envelope belongs to different team", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      teamId: "other-team",
    });

    const res = await PATCH(
      makeRequest("PATCH", { title: "Updated" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when envelope is not DRAFT or PREPARING", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      status: "SENT",
    });

    const res = await PATCH(
      makeRequest("PATCH", { title: "Updated" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("DRAFT or PREPARING");
  });

  it("updates envelope on success", async () => {
    const updated = { ...mockEnvelope, title: "Updated NDA" };
    (prisma.envelope.update as jest.Mock).mockResolvedValue(updated);

    const res = await PATCH(
      makeRequest("PATCH", { title: "Updated NDA" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.title).toBe("Updated NDA");

    expect(prisma.envelope.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "env-1" },
        data: expect.objectContaining({ title: "Updated NDA" }),
      })
    );
  });

  it("allows updates in PREPARING status", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      status: "PREPARING",
    });
    (prisma.envelope.update as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      status: "PREPARING",
      title: "Prepared",
    });

    const res = await PATCH(
      makeRequest("PATCH", { title: "Prepared" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 on internal error", async () => {
    (prisma.envelope.update as jest.Mock).mockRejectedValue(
      new Error("DB error")
    );

    const res = await PATCH(
      makeRequest("PATCH", { title: "Updated" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(500);
  });
});

// ============================================================================
// DELETE /api/esign/envelopes/[id]
// ============================================================================

describe("DELETE /api/esign/envelopes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active team", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when envelope not found", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await DELETE(
      makeRequest("DELETE") as any,
      makeParams("env-404")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when envelope belongs to different team", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      teamId: "other-team",
    });

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(403);
  });

  it("hard-deletes DRAFT envelope", async () => {
    (prisma.envelope.delete as jest.Mock).mockResolvedValue({});

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(prisma.envelope.delete).toHaveBeenCalledWith({
      where: { id: "env-1" },
    });
  });

  it("hard-deletes PREPARING envelope", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      status: "PREPARING",
    });
    (prisma.envelope.delete as jest.Mock).mockResolvedValue({});

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 when trying to delete a COMPLETED envelope", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      status: "COMPLETED",
    });

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("completed");
  });

  it("voids a SENT envelope instead of deleting", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnvelope,
      status: "SENT",
    });
    mockVoidEnvelope.mockResolvedValue({
      id: "env-1",
      status: "VOIDED",
    });

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(200);

    expect(mockVoidEnvelope).toHaveBeenCalledWith("env-1", "user-1", undefined);
    expect(prisma.envelope.delete).not.toHaveBeenCalled();
  });

  it("returns 500 on internal error", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB error")
    );

    const res = await DELETE(makeRequest("DELETE") as any, makeParams("env-1"));
    expect(res.status).toBe(500);
  });
});
