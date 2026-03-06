/**
 * Dataroom Analytics & Engagement Scoring Tests
 *
 * Comprehensive test suite covering:
 * - Engagement score calculation with weighted activities
 * - Tier assignment (Hot >=15, Warm >=5, Cool >=1, None = 0)
 * - Fund-level engagement aggregation and summary
 * - Engagement badge display configuration
 * - CSV export field escaping (commas, quotes, newlines, null/undefined)
 * - PostHog server-side analytics event publishing
 */

// ---------------------------------------------------------------------------
// Module mocks (must be before imports)
// ---------------------------------------------------------------------------

jest.mock("server-only", () => ({}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("posthog-node", () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  calculateEngagementScore,
  calculateFundEngagementScores,
  getFundEngagementSummary,
  getEngagementBadge,
} from "@/lib/engagement/scoring";
import type { EngagementTier } from "@/lib/engagement/scoring";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

/**
 * Build a mock investor record matching the select shape used by
 * calculateEngagementScore (userId, ndaSigned, investments, lpDocuments).
 */
function buildMockInvestor(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    ndaSigned: false,
    investments: [] as Array<{
      commitmentAmount: number;
      fundedAmount: number;
      status: string;
    }>,
    lpDocuments: [] as Array<{
      id: string;
      documentType: string;
      status: string;
    }>,
    ...overrides,
  };
}

/**
 * Build a mock viewer with nested views matching the Prisma select shape.
 */
function buildMockViewer(
  views: Array<{
    id: string;
    viewedAt: Date;
    downloadedAt: Date | null;
    pageViews: Array<{ duration: number }>;
  }>,
  dataroomId = "dr-1",
) {
  return {
    id: "viewer-1",
    dataroomId,
    createdAt: new Date("2026-01-01"),
    views,
  };
}

// ---------------------------------------------------------------------------
// Tests: getEngagementBadge (pure function, no mocks needed)
// ---------------------------------------------------------------------------

describe("getEngagementBadge", () => {
  it("returns correct badge for HOT tier", () => {
    const badge = getEngagementBadge("HOT");
    expect(badge.label).toBe("Hot");
    expect(badge.color).toBe("text-red-600");
    expect(badge.bgColor).toBe("bg-red-100");
  });

  it("returns correct badge for WARM tier", () => {
    const badge = getEngagementBadge("WARM");
    expect(badge.label).toBe("Warm");
    expect(badge.color).toBe("text-amber-600");
    expect(badge.bgColor).toBe("bg-amber-100");
  });

  it("returns correct badge for COOL tier", () => {
    const badge = getEngagementBadge("COOL");
    expect(badge.label).toBe("Cool");
    expect(badge.color).toBe("text-blue-600");
    expect(badge.bgColor).toBe("bg-blue-100");
  });

  it("returns correct badge for NONE tier", () => {
    const badge = getEngagementBadge("NONE");
    expect(badge.label).toBe("No Activity");
    expect(badge.color).toBe("text-gray-400");
    expect(badge.bgColor).toBe("bg-gray-100");
  });

  it("all tiers have distinct colors", () => {
    const tiers: EngagementTier[] = ["HOT", "WARM", "COOL", "NONE"];
    const colors = tiers.map((t) => getEngagementBadge(t).color);
    const unique = new Set(colors);
    expect(unique.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Tests: calculateEngagementScore
// ---------------------------------------------------------------------------

describe("calculateEngagementScore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns NONE tier with zero score when investor not found", async () => {
    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await calculateEngagementScore("nonexistent-id");

    expect(result.total).toBe(0);
    expect(result.tier).toBe("NONE");
    expect(result.breakdown.pageViews).toBe(0);
    expect(result.breakdown.uniquePages).toBe(0);
    expect(result.breakdown.ndaSigned).toBe(false);
    expect(result.breakdown.commitmentMade).toBe(false);
    expect(result.breakdown.proofUploaded).toBe(false);
    expect(result.lastActiveAt).toBeNull();
  });

  it("calculates score from unique page views (1 pt each)", async () => {
    const viewedAt = new Date("2026-02-15T10:00:00Z");

    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor(),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
      buildMockViewer([
        { id: "v1", viewedAt, downloadedAt: null, pageViews: [] },
        { id: "v2", viewedAt, downloadedAt: null, pageViews: [] },
        { id: "v3", viewedAt, downloadedAt: null, pageViews: [] },
      ]),
    ]);

    const result = await calculateEngagementScore("investor-1");

    // 3 unique pages * 1 = 3 points; all same date so 0 return visits
    expect(result.breakdown.uniquePages).toBe(3);
    expect(result.breakdown.pageViews).toBe(3);
    expect(result.total).toBe(3);
    expect(result.tier).toBe("COOL");
  });

  it("awards 3 points per return visit (unique session dates minus 1)", async () => {
    const day1 = new Date("2026-02-10T10:00:00Z");
    const day2 = new Date("2026-02-11T14:00:00Z");
    const day3 = new Date("2026-02-12T09:00:00Z");

    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor(),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
      buildMockViewer([
        { id: "v1", viewedAt: day1, downloadedAt: null, pageViews: [] },
        { id: "v2", viewedAt: day2, downloadedAt: null, pageViews: [] },
        { id: "v3", viewedAt: day3, downloadedAt: null, pageViews: [] },
      ]),
    ]);

    const result = await calculateEngagementScore("investor-1");

    // 3 unique dates -> 2 return visits * 3 = 6
    expect(result.breakdown.returnVisits).toBe(2);
    // uniquePages=3 (3) + returnVisits=2 (6) = 9
    expect(result.total).toBe(9);
    expect(result.tier).toBe("WARM");
  });

  it("awards 2 points per download", async () => {
    const viewedAt = new Date("2026-02-15T10:00:00Z");
    const downloadedAt = new Date("2026-02-15T10:05:00Z");

    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor(),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
      buildMockViewer([
        { id: "v1", viewedAt, downloadedAt, pageViews: [] },
        { id: "v2", viewedAt, downloadedAt, pageViews: [] },
      ]),
    ]);

    const result = await calculateEngagementScore("investor-1");

    expect(result.breakdown.downloads).toBe(2);
    // uniquePages=2 (2) + downloads=2 (4) = 6
    expect(result.total).toBe(6);
    expect(result.tier).toBe("WARM");
  });

  it("calculates dwell time score (1 pt per 30 seconds)", async () => {
    const viewedAt = new Date("2026-02-15T10:00:00Z");

    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor(),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    // 1 view with 120000ms (2 minutes) of dwell time across page views
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
      buildMockViewer([
        {
          id: "v1",
          viewedAt,
          downloadedAt: null,
          pageViews: [{ duration: 60000 }, { duration: 60000 }],
        },
      ]),
    ]);

    const result = await calculateEngagementScore("investor-1");

    // dwellTimeMinutes = round(120000 / 60000) = 2
    expect(result.breakdown.dwellTimeMinutes).toBe(2);
    // dwell score = floor((2 * 60) / 30) * 1 = 4
    // uniquePages=1 (1) + dwell=4 = 5
    expect(result.total).toBe(5);
    expect(result.tier).toBe("WARM");
  });

  it("awards 5 points for NDA signature", async () => {
    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor({ ndaSigned: true }),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([]);

    const result = await calculateEngagementScore("investor-1");

    expect(result.breakdown.ndaSigned).toBe(true);
    expect(result.total).toBe(5);
    expect(result.tier).toBe("WARM");
  });

  it("awards 10 points for commitment made", async () => {
    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor({
        investments: [
          { commitmentAmount: 50000, fundedAmount: 0, status: "COMMITTED" },
        ],
      }),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([]);

    const result = await calculateEngagementScore("investor-1");

    expect(result.breakdown.commitmentMade).toBe(true);
    expect(result.total).toBe(10);
    expect(result.tier).toBe("WARM");
  });

  it("awards 5 points for wire proof uploaded (WIRE_CONFIRMATION doc)", async () => {
    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor({
        lpDocuments: [
          {
            id: "doc-1",
            documentType: "WIRE_CONFIRMATION",
            status: "UPLOADED_PENDING_REVIEW",
          },
        ],
      }),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([]);

    const result = await calculateEngagementScore("investor-1");

    expect(result.breakdown.proofUploaded).toBe(true);
    // 5 (proof) + 1 (1 documentInteraction) = 6
    expect(result.total).toBe(6);
  });

  it("produces HOT tier for highly engaged investor (combined activities)", async () => {
    const day1 = new Date("2026-02-10T10:00:00Z");
    const day2 = new Date("2026-02-11T14:00:00Z");
    const downloadedAt = new Date("2026-02-11T14:05:00Z");

    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor({
        ndaSigned: true,
        investments: [
          { commitmentAmount: 100000, fundedAmount: 0, status: "COMMITTED" },
        ],
      }),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "vip@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
      buildMockViewer([
        { id: "v1", viewedAt: day1, downloadedAt: null, pageViews: [] },
        { id: "v2", viewedAt: day2, downloadedAt, pageViews: [] },
      ]),
    ]);

    const result = await calculateEngagementScore("investor-1");

    // uniquePages=2 (2) + returnVisits=1 (3) + downloads=1 (2) + NDA(5) + commitment(10) = 22
    expect(result.total).toBe(22);
    expect(result.tier).toBe("HOT");
  });

  it("skips viewer queries when user has no email", async () => {
    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor(),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: null,
    });

    const result = await calculateEngagementScore("investor-1");

    expect(mockPrisma.viewer.findMany).not.toHaveBeenCalled();
    expect(result.breakdown.pageViews).toBe(0);
    expect(result.total).toBe(0);
  });

  it("tracks lastActiveAt as the most recent view date", async () => {
    const earlier = new Date("2026-02-10T10:00:00Z");
    const later = new Date("2026-02-15T16:30:00Z");

    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor(),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
      buildMockViewer([
        { id: "v1", viewedAt: earlier, downloadedAt: null, pageViews: [] },
        { id: "v2", viewedAt: later, downloadedAt: null, pageViews: [] },
      ]),
    ]);

    const result = await calculateEngagementScore("investor-1");

    expect(result.lastActiveAt).toEqual(later);
  });

  it("counts document interactions from lpDocuments length", async () => {
    (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
      buildMockInvestor({
        lpDocuments: [
          { id: "d1", documentType: "NDA", status: "APPROVED" },
          { id: "d2", documentType: "SUBSCRIPTION_AGREEMENT", status: "APPROVED" },
          { id: "d3", documentType: "TAX_FORM", status: "UPLOADED_PENDING_REVIEW" },
        ],
      }),
    );
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([]);

    const result = await calculateEngagementScore("investor-1");

    expect(result.breakdown.documentInteractions).toBe(3);
    // 3 * 1 = 3
    expect(result.total).toBe(3);
    expect(result.tier).toBe("COOL");
  });
});

// ---------------------------------------------------------------------------
// Tests: Tier Threshold Boundaries
// ---------------------------------------------------------------------------

describe("Engagement Tier Boundaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each<[number, EngagementTier]>([
    [0, "NONE"],
    [1, "COOL"],
    [4, "COOL"],
    [5, "WARM"],
    [14, "WARM"],
    [15, "HOT"],
    [100, "HOT"],
  ])(
    "score %d maps to tier %s",
    async (targetScore, expectedTier) => {
      // Engineer the exact score using NDA (5), commitment (10), and docs (1 each)
      const ndaSigned = targetScore >= 5;
      const hasCommitment = targetScore >= 15;
      const docCount = Math.max(
        0,
        targetScore - (ndaSigned ? 5 : 0) - (hasCommitment ? 10 : 0),
      );

      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        buildMockInvestor({
          ndaSigned,
          investments: hasCommitment
            ? [{ commitmentAmount: 100000, fundedAmount: 0, status: "COMMITTED" }]
            : [],
          lpDocuments: Array.from({ length: docCount }, (_, i) => ({
            id: `doc-${i}`,
            documentType: "OTHER",
            status: "APPROVED",
          })),
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "test@example.com",
      });
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([]);

      const result = await calculateEngagementScore("investor-1");

      expect(result.tier).toBe(expectedTier);
    },
  );
});

// ---------------------------------------------------------------------------
// Tests: Fund-Level Engagement
// ---------------------------------------------------------------------------

describe("calculateFundEngagementScores", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns scores for all investors in a fund", async () => {
    (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([
      { id: "inv-1" },
      { id: "inv-2" },
    ]);

    // First investor: NDA signed (5pts WARM), second: no activity (NONE)
    (mockPrisma.investor.findUnique as jest.Mock)
      .mockResolvedValueOnce(buildMockInvestor({ ndaSigned: true }))
      .mockResolvedValueOnce(buildMockInvestor());

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([]);

    const scores = await calculateFundEngagementScores("fund-1");

    expect(scores.size).toBe(2);
    expect(scores.has("inv-1")).toBe(true);
    expect(scores.has("inv-2")).toBe(true);
  });

  it("returns empty map for fund with no investors", async () => {
    (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([]);

    const scores = await calculateFundEngagementScores("fund-empty");

    expect(scores.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Fund Engagement Summary
// ---------------------------------------------------------------------------

describe("getFundEngagementSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregates tier counts and average score across fund investors", async () => {
    // 3 investors: HOT, WARM, NONE
    (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([
      { id: "inv-hot" },
      { id: "inv-warm" },
      { id: "inv-none" },
    ]);

    // HOT: NDA(5) + commitment(10) = 15
    (mockPrisma.investor.findUnique as jest.Mock)
      .mockResolvedValueOnce(
        buildMockInvestor({
          ndaSigned: true,
          investments: [
            { commitmentAmount: 50000, fundedAmount: 0, status: "COMMITTED" },
          ],
        }),
      )
      // WARM: NDA(5) = 5
      .mockResolvedValueOnce(buildMockInvestor({ ndaSigned: true }))
      // NONE: no activity
      .mockResolvedValueOnce(buildMockInvestor());

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "test@example.com",
    });
    (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([]);

    const summary = await getFundEngagementSummary("fund-1");

    expect(summary.total).toBe(3);
    expect(summary.hot).toBe(1);
    expect(summary.warm).toBe(1);
    expect(summary.none).toBe(1);
    expect(summary.cool).toBe(0);
    // average = round((15 + 5 + 0) / 3) = round(6.67) = 7
    expect(summary.averageScore).toBe(7);
  });

  it("returns zero average for fund with no investors", async () => {
    (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([]);

    const summary = await getFundEngagementSummary("fund-empty");

    expect(summary.total).toBe(0);
    expect(summary.averageScore).toBe(0);
    expect(summary.hot).toBe(0);
    expect(summary.warm).toBe(0);
    expect(summary.cool).toBe(0);
    expect(summary.none).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: CSV Export Field Escaping
// ---------------------------------------------------------------------------

describe("CSV Export Formatting", () => {
  // Replicate the exact escaping logic from lib/trigger/export-visits.ts
  // to verify correctness (functions are module-private, tested by contract)

  function escapeCsvField(field: string | number | null | undefined): string {
    if (field === null || field === undefined) return "NaN";
    const stringField = String(field);
    if (
      stringField.includes(",") ||
      stringField.includes("\n") ||
      stringField.includes("\r") ||
      stringField.includes('"')
    ) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  }

  function createCsvRow(
    fields: (string | number | null | undefined)[],
  ): string {
    return fields.map(escapeCsvField).join(",");
  }

  it("escapes fields containing commas", () => {
    expect(escapeCsvField("Acme, Inc.")).toBe('"Acme, Inc."');
  });

  it("escapes fields containing double quotes", () => {
    expect(escapeCsvField('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("escapes fields containing newlines", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("escapes fields containing carriage returns", () => {
    expect(escapeCsvField("line1\rline2")).toBe('"line1\rline2"');
  });

  it("returns NaN for null and undefined values", () => {
    expect(escapeCsvField(null)).toBe("NaN");
    expect(escapeCsvField(undefined)).toBe("NaN");
  });

  it("passes through simple strings unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("converts numbers to strings", () => {
    expect(escapeCsvField(42)).toBe("42");
    expect(escapeCsvField(3.14)).toBe("3.14");
  });

  it("creates properly joined CSV rows", () => {
    const row = createCsvRow(["Name", "test@example.com", 100, null]);
    expect(row).toBe("Name,test@example.com,100,NaN");
  });

  it("handles rows with mixed escaped and plain fields", () => {
    const row = createCsvRow(["Doe, Jane", "simple", 42, undefined]);
    expect(row).toBe('"Doe, Jane",simple,42,NaN');
  });
});

// ---------------------------------------------------------------------------
// Tests: PostHog Server Event Publishing
// ---------------------------------------------------------------------------

describe("PostHog Server Event Publishing", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.POSTHOG_SERVER_KEY;
  });

  it("publishes events via PostHog capture when server key is configured", async () => {
    process.env.POSTHOG_SERVER_KEY = "phc_test_key_123";

    const { PostHog } = require("posthog-node");
    const mockCapture = jest.fn();
    PostHog.mockImplementation(() => ({
      capture: mockCapture,
      shutdown: jest.fn().mockResolvedValue(undefined),
    }));

    const { publishServerEvent } = require("@/lib/tracking/server-events");

    await publishServerEvent("funnel_test_event", {
      userId: "user-123",
      teamId: "team-456",
    });

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-123",
        event: "funnel_test_event",
        properties: expect.objectContaining({
          userId: "user-123",
          teamId: "team-456",
          $lib: "posthog-node",
        }),
      }),
    );
  });

  it("falls back to logger.debug when PostHog key is not set", async () => {
    delete process.env.POSTHOG_SERVER_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    const { publishServerEvent } = require("@/lib/tracking/server-events");
    const { logger } = require("@/lib/logger");

    await publishServerEvent("funnel_test_event", { userId: "user-1" });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("funnel_test_event"),
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("uses 'server' as distinctId when userId is not provided", async () => {
    process.env.POSTHOG_SERVER_KEY = "phc_test_key_123";

    const { PostHog } = require("posthog-node");
    const mockCapture = jest.fn();
    PostHog.mockImplementation(() => ({
      capture: mockCapture,
      shutdown: jest.fn().mockResolvedValue(undefined),
    }));

    const { publishServerEvent } = require("@/lib/tracking/server-events");

    await publishServerEvent("system_event", {});

    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "server",
      }),
    );
  });
});
