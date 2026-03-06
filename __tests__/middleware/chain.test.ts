/**
 * Tests for middleware chain utility — lib/middleware/chain.ts
 *
 * Validates chaining behavior, early termination, and path prefix filtering.
 */

import { NextRequest, NextResponse } from "next/server";
import { chain, withPathPrefix, MiddlewareFn } from "@/lib/middleware/chain";

function makeRequest(path: string): NextRequest {
  return new NextRequest(`https://app.fundroom.ai${path}`);
}

describe("chain", () => {
  it("returns NextResponse.next() when all middlewares return null", async () => {
    const mw1: MiddlewareFn = () => null;
    const mw2: MiddlewareFn = () => null;

    const result = await chain(makeRequest("/api/test"), [mw1, mw2]);
    // NextResponse.next() returns a response that continues to the origin
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("returns the response from the first middleware that returns non-null", async () => {
    const earlyResponse = NextResponse.json({ early: true }, { status: 429 });
    const mw1: MiddlewareFn = () => null;
    const mw2: MiddlewareFn = () => earlyResponse;
    const mw3: MiddlewareFn = jest.fn(() => null);

    const result = await chain(makeRequest("/api/test"), [mw1, mw2, mw3]);
    expect(result).toBe(earlyResponse);
    expect(mw3).not.toHaveBeenCalled(); // chain stops after mw2
  });

  it("executes middlewares in order", async () => {
    const order: number[] = [];
    const mw1: MiddlewareFn = () => { order.push(1); return null; };
    const mw2: MiddlewareFn = () => { order.push(2); return null; };
    const mw3: MiddlewareFn = () => { order.push(3); return null; };

    await chain(makeRequest("/api/test"), [mw1, mw2, mw3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("handles async middlewares", async () => {
    const asyncMw: MiddlewareFn = async () => {
      await new Promise((r) => setTimeout(r, 1));
      return NextResponse.json({ async: true }, { status: 200 });
    };

    const result = await chain(makeRequest("/api/test"), [asyncMw]);
    expect(result.status).toBe(200);
  });

  it("handles an empty middleware array", async () => {
    const result = await chain(makeRequest("/api/test"), []);
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("passes the same request to each middleware", async () => {
    const capturedReqs: NextRequest[] = [];
    const mw1: MiddlewareFn = (req) => { capturedReqs.push(req); return null; };
    const mw2: MiddlewareFn = (req) => { capturedReqs.push(req); return null; };

    const req = makeRequest("/api/test");
    await chain(req, [mw1, mw2]);
    expect(capturedReqs[0]).toBe(req);
    expect(capturedReqs[1]).toBe(req);
  });
});

describe("withPathPrefix", () => {
  it("runs middleware for matching single prefix", async () => {
    const inner = jest.fn(() => NextResponse.json({ hit: true }));
    const guarded = withPathPrefix("/api/admin/", inner);

    const result = await guarded(makeRequest("/api/admin/settings"));
    expect(inner).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it("skips middleware for non-matching prefix", async () => {
    const inner = jest.fn(() => NextResponse.json({ hit: true }));
    const guarded = withPathPrefix("/api/admin/", inner);

    const result = await guarded(makeRequest("/api/lp/fund-context"));
    expect(inner).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("supports array of prefixes", async () => {
    const inner = jest.fn(() => NextResponse.json({ hit: true }));
    const guarded = withPathPrefix(["/api/admin/", "/api/cron/"], inner);

    const result1 = await guarded(makeRequest("/api/admin/settings"));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(result1).not.toBeNull();

    const result2 = await guarded(makeRequest("/api/cron/domains"));
    expect(inner).toHaveBeenCalledTimes(2);
    expect(result2).not.toBeNull();

    const result3 = await guarded(makeRequest("/api/lp/register"));
    expect(inner).toHaveBeenCalledTimes(2); // not called again
    expect(result3).toBeNull();
  });

  it("matches prefix exactly at start of path", async () => {
    const inner = jest.fn(() => NextResponse.json({ hit: true }));
    const guarded = withPathPrefix("/api/admin", inner);

    // Should match both with and without trailing slash
    const result1 = await guarded(makeRequest("/api/admin/settings"));
    expect(inner).toHaveBeenCalled();

    const result2 = await guarded(makeRequest("/api/admins/other"));
    expect(inner).toHaveBeenCalledTimes(2); // "admins" starts with "admin"
  });
});
