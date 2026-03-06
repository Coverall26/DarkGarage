/**
 * Dataroom Analytics & Engagement Scoring Integration Tests
 *
 * Tests the investor engagement scoring system at
 * lib/engagement/scoring.ts — covering individual score calculation
 * from viewer sessions, milestone bonuses, tier classification,
 * fund-level aggregate scoring, summary statistics, and badge display.
 */

import prisma from "@/lib/prisma";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvestor(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    ndaSigned: false,
    investments: [] as { commitmentAmount: number; fundedAmount: number; status: string }[],
    lpDocuments: [] as { id: string; documentType: string; status: string }[],
    ...overrides,
  };
}

function makeViewer(
  dataroomId: string,
  views: {
    id: string;
    viewedAt: Date;
    downloadedAt: Date | null;
    pageViews: { duration: number }[];
  }[],
) {
  return {
    id: `viewer-${Math.random().toString(36).slice(2, 8)}`,
    dataroomId,
    createdAt: new Date("2025-01-01"),
    views,
  };
}

function makeView(
  id: string,
  viewedAt: Date,
  opts: { downloaded?: boolean; dwellMs?: number } = {},
) {
  return {
    id,
    viewedAt,
    downloadedAt: opts.downloaded ? viewedAt : null,
    pageViews: opts.dwellMs ? [{ duration: opts.dwellMs }] : [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Static import — no jest.resetModules() needed since scoring is pure functions over Prisma
import {
  calculateEngagementScore,
  calculateFundEngagementScores,
  getFundEngagementSummary,
  getEngagementBadge,
} from "@/lib/engagement/scoring";

describe("Dataroom Analytics & Engagement Scoring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Individual Score Calculation
  // -----------------------------------------------------------------------

  describe("calculateEngagementScore", () => {
    it("should return zero score and NONE tier when investor not found", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("nonexistent");

      expect(result.total).toBe(0);
      expect(result.tier).toBe("NONE");
      expect(result.breakdown.pageViews).toBe(0);
      expect(result.breakdown.ndaSigned).toBe(false);
      expect(result.breakdown.commitmentMade).toBe(false);
      expect(result.breakdown.proofUploaded).toBe(false);
      expect(result.lastActiveAt).toBeNull();
    });

    it("should return zero score when investor has no activity and no user email", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.total).toBe(0);
      expect(result.tier).toBe("NONE");
      expect(result.breakdown.uniquePages).toBe(0);
      expect(result.breakdown.returnVisits).toBe(0);
      expect(result.breakdown.downloads).toBe(0);
      expect(result.breakdown.dwellTimeMinutes).toBe(0);
    });

    it("should count unique page views (1 point each)", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      // 3 views across 2 datarooms, all on the same day (no return visits)
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T10:00:00Z")),
          makeView("v2", new Date("2025-06-01T11:00:00Z")),
        ]),
        makeViewer("dr-2", [
          makeView("v3", new Date("2025-06-01T12:00:00Z")),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      // 3 unique pages: dr-1-v1, dr-1-v2, dr-2-v3 => 3 points
      expect(result.breakdown.uniquePages).toBe(3);
      expect(result.breakdown.pageViews).toBe(3);
      expect(result.total).toBe(3);
      expect(result.tier).toBe("COOL");
    });

    it("should count return visits (3 points each, first visit excluded)", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      // Views across 3 different days => 2 return visits
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T10:00:00Z")),
          makeView("v2", new Date("2025-06-02T10:00:00Z")),
          makeView("v3", new Date("2025-06-03T10:00:00Z")),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      // 3 unique pages (3 pts) + 2 return visits (6 pts) = 9
      expect(result.breakdown.returnVisits).toBe(2);
      expect(result.total).toBe(9);
      expect(result.tier).toBe("WARM");
    });

    it("should count downloads (2 points each)", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T10:00:00Z"), {
            downloaded: true,
          }),
          makeView("v2", new Date("2025-06-01T11:00:00Z"), {
            downloaded: true,
          }),
          makeView("v3", new Date("2025-06-01T12:00:00Z")),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      // 3 unique pages (3 pts) + 2 downloads (4 pts) = 7
      expect(result.breakdown.downloads).toBe(2);
      expect(result.total).toBe(7);
      expect(result.tier).toBe("WARM");
    });

    it("should calculate dwell time score (1 point per 30 seconds)", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      // 1 view with 90 seconds of dwell time (90,000 ms)
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T10:00:00Z"), {
            dwellMs: 90_000,
          }),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      // dwellTimeMinutes = Math.round(90000 / 60000) = 2
      // dwellScore = Math.floor((2 * 60) / 30) * 1 = Math.floor(120/30) = 4
      // 1 unique page (1 pt) + 4 dwell points = 5
      expect(result.breakdown.dwellTimeMinutes).toBe(2);
      expect(result.total).toBe(5);
      expect(result.tier).toBe("WARM");
    });

    it("should award 5 points for NDA signed milestone", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({ ndaSigned: true }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.breakdown.ndaSigned).toBe(true);
      expect(result.total).toBe(5);
      expect(result.tier).toBe("WARM");
    });

    it("should award 10 points for commitment made milestone", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({
          investments: [
            { commitmentAmount: 100_000, fundedAmount: 0, status: "COMMITTED" },
          ],
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.breakdown.commitmentMade).toBe(true);
      expect(result.total).toBe(10);
      expect(result.tier).toBe("WARM");
    });

    it("should award 5 points for wire proof uploaded milestone", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({
          lpDocuments: [
            {
              id: "doc-1",
              documentType: "WIRE_CONFIRMATION",
              status: "APPROVED",
            },
          ],
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.breakdown.proofUploaded).toBe(true);
      // 1 document interaction (1 pt) + proof uploaded (5 pts) = 6
      expect(result.total).toBe(6);
      expect(result.tier).toBe("WARM");
    });

    it("should count document interactions (1 point each)", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({
          lpDocuments: [
            { id: "doc-1", documentType: "NDA", status: "APPROVED" },
            {
              id: "doc-2",
              documentType: "SUBSCRIPTION_AGREEMENT",
              status: "PENDING",
            },
            { id: "doc-3", documentType: "LPA", status: "APPROVED" },
          ],
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.breakdown.documentInteractions).toBe(3);
      expect(result.total).toBe(3);
      expect(result.tier).toBe("COOL");
    });

    it("should track lastActiveAt as the most recent view date", async () => {
      const latestDate = new Date("2025-07-15T14:30:00Z");
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T10:00:00Z")),
          makeView("v2", latestDate),
          makeView("v3", new Date("2025-06-10T10:00:00Z")),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      expect(result.lastActiveAt).toEqual(latestDate);
    });

    it("should combine all scoring components for a fully engaged investor", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({
          ndaSigned: true,
          investments: [
            {
              commitmentAmount: 250_000,
              fundedAmount: 250_000,
              status: "FUNDED",
            },
          ],
          lpDocuments: [
            { id: "doc-1", documentType: "NDA", status: "APPROVED" },
            {
              id: "doc-2",
              documentType: "WIRE_CONFIRMATION",
              status: "APPROVED",
            },
          ],
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      // 4 views across 3 days, 2 downloads, 120 seconds dwell
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T10:00:00Z"), {
            downloaded: true,
            dwellMs: 60_000,
          }),
          makeView("v2", new Date("2025-06-02T10:00:00Z"), {
            downloaded: true,
            dwellMs: 60_000,
          }),
          makeView("v3", new Date("2025-06-03T10:00:00Z")),
          makeView("v4", new Date("2025-06-03T14:00:00Z")),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      // uniquePages: 4 => 4 pts
      // dwellTimeMinutes: Math.round(120000 / 60000) = 2 => Math.floor((2*60)/30) = 4 pts
      // returnVisits: 3 days - 1 = 2 => 6 pts
      // downloads: 2 => 4 pts
      // documentInteractions: 2 => 2 pts
      // ndaSigned: true => 5 pts
      // commitmentMade: true => 10 pts
      // proofUploaded: true (WIRE_CONFIRMATION) => 5 pts
      // Total: 4 + 4 + 6 + 4 + 2 + 5 + 10 + 5 = 40
      expect(result.total).toBe(40);
      expect(result.tier).toBe("HOT");
      expect(result.breakdown.ndaSigned).toBe(true);
      expect(result.breakdown.commitmentMade).toBe(true);
      expect(result.breakdown.proofUploaded).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Tier Classification
  // -----------------------------------------------------------------------

  describe("Tier Classification", () => {
    it("should classify score >= 15 as HOT", async () => {
      // NDA (5) + commitment (10) = 15 => HOT
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({
          ndaSigned: true,
          investments: [
            {
              commitmentAmount: 50_000,
              fundedAmount: 0,
              status: "COMMITTED",
            },
          ],
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.total).toBe(15);
      expect(result.tier).toBe("HOT");
    });

    it("should classify score 5-14 as WARM", async () => {
      // NDA only = 5 => WARM
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({ ndaSigned: true }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.total).toBe(5);
      expect(result.tier).toBe("WARM");
    });

    it("should classify score 1-4 as COOL", async () => {
      // 1 page view, no milestones => 1 pt => COOL
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T10:00:00Z")),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      expect(result.total).toBe(1);
      expect(result.tier).toBe("COOL");
    });

    it("should classify score 0 as NONE", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.total).toBe(0);
      expect(result.tier).toBe("NONE");
    });
  });

  // -----------------------------------------------------------------------
  // Fund-Level Aggregation
  // -----------------------------------------------------------------------

  describe("calculateFundEngagementScores", () => {
    it("should return empty map when fund has no investors", async () => {
      (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([]);

      const scores = await calculateFundEngagementScores("fund-1");

      expect(scores.size).toBe(0);
    });

    it("should calculate scores for all investors in a fund", async () => {
      // Fund has 2 investors
      (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([
        { id: "inv-1" },
        { id: "inv-2" },
      ]);

      // inv-1: NDA signed (5 pts) => WARM
      // inv-2: no activity (0 pts) => NONE
      (mockPrisma.investor.findUnique as jest.Mock)
        .mockResolvedValueOnce(makeInvestor({ ndaSigned: true }))
        .mockResolvedValueOnce(makeInvestor());
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const scores = await calculateFundEngagementScores("fund-1");

      expect(scores.size).toBe(2);
      expect(scores.get("inv-1")!.tier).toBe("WARM");
      expect(scores.get("inv-2")!.tier).toBe("NONE");
    });
  });

  // -----------------------------------------------------------------------
  // Fund Summary Statistics
  // -----------------------------------------------------------------------

  describe("getFundEngagementSummary", () => {
    it("should return zeros when fund has no investors", async () => {
      (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([]);

      const summary = await getFundEngagementSummary("fund-1");

      expect(summary.total).toBe(0);
      expect(summary.hot).toBe(0);
      expect(summary.warm).toBe(0);
      expect(summary.cool).toBe(0);
      expect(summary.none).toBe(0);
      expect(summary.averageScore).toBe(0);
    });

    it("should correctly aggregate tier counts and average score", async () => {
      // 3 investors: HOT, WARM, NONE
      (mockPrisma.investor.findMany as jest.Mock).mockResolvedValue([
        { id: "inv-hot" },
        { id: "inv-warm" },
        { id: "inv-none" },
      ]);

      // HOT: NDA(5) + commitment(10) = 15
      (mockPrisma.investor.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          makeInvestor({
            ndaSigned: true,
            investments: [
              {
                commitmentAmount: 100_000,
                fundedAmount: 0,
                status: "COMMITTED",
              },
            ],
          }),
        )
        // WARM: NDA only = 5
        .mockResolvedValueOnce(makeInvestor({ ndaSigned: true }))
        // NONE: nothing = 0
        .mockResolvedValueOnce(makeInvestor());
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValue(null);

      const summary = await getFundEngagementSummary("fund-1");

      expect(summary.total).toBe(3);
      expect(summary.hot).toBe(1);
      expect(summary.warm).toBe(1);
      expect(summary.none).toBe(1);
      expect(summary.cool).toBe(0);
      // Average: Math.round((15 + 5 + 0) / 3) = Math.round(6.67) = 7
      expect(summary.averageScore).toBe(7);
    });
  });

  // -----------------------------------------------------------------------
  // Badge Display Config
  // -----------------------------------------------------------------------

  describe("getEngagementBadge", () => {
    it("should return red badge for HOT tier", async () => {
      const badge = getEngagementBadge("HOT");

      expect(badge.label).toBe("Hot");
      expect(badge.color).toBe("text-red-600");
      expect(badge.bgColor).toBe("bg-red-100");
    });

    it("should return amber badge for WARM tier", async () => {
      const badge = getEngagementBadge("WARM");

      expect(badge.label).toBe("Warm");
      expect(badge.color).toBe("text-amber-600");
      expect(badge.bgColor).toBe("bg-amber-100");
    });

    it("should return blue badge for COOL tier", async () => {
      const badge = getEngagementBadge("COOL");

      expect(badge.label).toBe("Cool");
      expect(badge.color).toBe("text-blue-600");
      expect(badge.bgColor).toBe("bg-blue-100");
    });

    it("should return gray badge for NONE tier", async () => {
      const badge = getEngagementBadge("NONE");

      expect(badge.label).toBe("No Activity");
      expect(badge.color).toBe("text-gray-400");
      expect(badge.bgColor).toBe("bg-gray-100");
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should not count zero-amount commitments as commitment made", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({
          investments: [
            { commitmentAmount: 0, fundedAmount: 0, status: "COMMITTED" },
          ],
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.breakdown.commitmentMade).toBe(false);
      expect(result.total).toBe(0);
    });

    it("should not count non-WIRE_CONFIRMATION documents as proof uploaded", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor({
          lpDocuments: [
            { id: "doc-1", documentType: "NDA", status: "APPROVED" },
            {
              id: "doc-2",
              documentType: "SUBSCRIPTION_AGREEMENT",
              status: "APPROVED",
            },
          ],
        }),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateEngagementScore("inv-1");

      expect(result.breakdown.proofUploaded).toBe(false);
      // Only 2 document interactions (2 pts)
      expect(result.total).toBe(2);
    });

    it("should handle viewer with no views gracefully", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", []),
      ]);

      const result = await calculateEngagementScore("inv-1");

      expect(result.breakdown.pageViews).toBe(0);
      expect(result.breakdown.uniquePages).toBe(0);
      expect(result.breakdown.returnVisits).toBe(0);
      expect(result.total).toBe(0);
    });

    it("should handle views on the same day as a single session (no return visit bonus)", async () => {
      (mockPrisma.investor.findUnique as jest.Mock).mockResolvedValue(
        makeInvestor(),
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: "lp@example.com",
      });
      (mockPrisma.viewer.findMany as jest.Mock).mockResolvedValue([
        makeViewer("dr-1", [
          makeView("v1", new Date("2025-06-01T09:00:00Z")),
          makeView("v2", new Date("2025-06-01T10:00:00Z")),
          makeView("v3", new Date("2025-06-01T11:00:00Z")),
        ]),
      ]);

      const result = await calculateEngagementScore("inv-1");

      // 3 unique pages (3 pts), 0 return visits (all same day)
      expect(result.breakdown.uniquePages).toBe(3);
      expect(result.breakdown.returnVisits).toBe(0);
      expect(result.total).toBe(3);
    });
  });
});
