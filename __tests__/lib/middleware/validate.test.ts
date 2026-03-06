/**
 * Validation Middleware Tests
 *
 * Tests for lib/middleware/validate.ts — Zod-based request validation
 * for both App Router and Pages Router.
 *
 * Validates:
 * - validateBody: App Router request body parsing + Zod validation
 * - validateQuery: URLSearchParams → object conversion + Zod validation
 * - validateBodyPagesRouter: Pages Router body validation
 * - formatZodErrors: Internal helper for clean error formatting
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import {
  validateBody,
  validateQuery,
  validateBodyPagesRouter,
} from "@/lib/middleware/validate";

// ---------------------------------------------------------------------------
// Shared Zod schemas for tests
// ---------------------------------------------------------------------------

const TestSchema = z.object({
  name: z.string(),
  age: z.number().min(0),
});

const NestedSchema = z.object({
  user: z.object({
    email: z.string().email(),
    profile: z.object({
      bio: z.string().min(1),
    }),
  }),
});

const OptionalFieldsSchema = z.object({
  required: z.string(),
  optional: z.string().optional(),
  defaulted: z.number().default(42),
});

const StrictSchema = z
  .object({
    allowed: z.string(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonRequest(body: unknown): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonRequest(): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    body: "not json",
  });
}

async function extractResponseBody(response: NextResponse): Promise<unknown> {
  return response.json();
}

// ---------------------------------------------------------------------------
// validateBody (App Router)
// ---------------------------------------------------------------------------

describe("validateBody (App Router)", () => {
  it("returns parsed data on valid input", async () => {
    const req = makeJsonRequest({ name: "test", age: 25 });
    const result = await validateBody(req, TestSchema);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ name: "test", age: 25 });
  });

  it("returns 400 NextResponse with issues on invalid input", async () => {
    const req = makeJsonRequest({ name: 123, age: "not a number" });
    const result = await validateBody(req, TestSchema);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
    expect(result.error!.status).toBe(400);

    const body = (await extractResponseBody(result.error!)) as {
      error: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = makeInvalidJsonRequest();
    const result = await validateBody(req, TestSchema);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
    expect(result.error!.status).toBe(400);

    const body = (await extractResponseBody(result.error!)) as {
      error: string;
    };
    expect(body.error).toBe("Invalid JSON body");
  });

  it("handles nested Zod errors with path", async () => {
    const req = makeJsonRequest({
      user: {
        email: "not-an-email",
        profile: {
          bio: "",
        },
      },
    });
    const result = await validateBody(req, NestedSchema);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
    expect(result.error!.status).toBe(400);

    const body = (await extractResponseBody(result.error!)) as {
      error: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(body.error).toBe("Validation failed");
    expect(body.issues.length).toBe(2);

    const paths = body.issues.map((i) => i.path);
    expect(paths).toContain("user.email");
    expect(paths).toContain("user.profile.bio");
  });

  it("returns correct formatted Zod issues with path and message", async () => {
    const req = makeJsonRequest({ name: "test", age: -5 });
    const result = await validateBody(req, TestSchema);

    expect(result.data).toBeNull();

    const body = (await extractResponseBody(result.error!)) as {
      issues: Array<{ path: string; message: string }>;
    };
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].path).toBe("age");
    expect(typeof body.issues[0].message).toBe("string");
    expect(body.issues[0].message.length).toBeGreaterThan(0);
  });

  it("handles missing required fields", async () => {
    const req = makeJsonRequest({});
    const result = await validateBody(req, TestSchema);

    expect(result.data).toBeNull();
    expect(result.error!.status).toBe(400);

    const body = (await extractResponseBody(result.error!)) as {
      issues: Array<{ path: string; message: string }>;
    };
    expect(body.issues.length).toBe(2);

    const paths = body.issues.map((i) => i.path);
    expect(paths).toContain("name");
    expect(paths).toContain("age");
  });

  it("applies Zod defaults and optional fields", async () => {
    const req = makeJsonRequest({ required: "hello" });
    const result = await validateBody(req, OptionalFieldsSchema);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      required: "hello",
      defaulted: 42,
    });
  });

  it("handles empty JSON object body", async () => {
    const req = makeJsonRequest({});
    const result = await validateBody(req, TestSchema);

    expect(result.data).toBeNull();
    expect(result.error!.status).toBe(400);
  });

  it("handles array body when object expected", async () => {
    const req = makeJsonRequest([1, 2, 3]);
    const result = await validateBody(req, TestSchema);

    expect(result.data).toBeNull();
    expect(result.error!.status).toBe(400);
  });

  it("strips unknown keys with default Zod object parsing", async () => {
    const schema = z.object({ name: z.string() });
    const req = makeJsonRequest({ name: "test", extra: "field" });
    const result = await validateBody(req, schema);

    // Default Zod behavior: strips unknown keys
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ name: "test" });
  });

  it("rejects unknown keys with strict schema", async () => {
    const req = makeJsonRequest({ allowed: "yes", extra: "no" });
    const result = await validateBody(req, StrictSchema);

    expect(result.data).toBeNull();
    expect(result.error!.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// validateQuery (App Router)
// ---------------------------------------------------------------------------

describe("validateQuery", () => {
  const QuerySchema = z.object({
    page: z.string(),
    limit: z.string(),
  });

  it("returns parsed data on valid params", () => {
    const params = new URLSearchParams({ page: "1", limit: "10" });
    const result = validateQuery(params, QuerySchema);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ page: "1", limit: "10" });
  });

  it("returns 400 NextResponse with issues on invalid params", async () => {
    const params = new URLSearchParams({ page: "1" }); // missing limit
    const result = validateQuery(params, QuerySchema);

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
    expect(result.error!.status).toBe(400);

    const body = (await extractResponseBody(result.error!)) as {
      error: string;
      issues: Array<{ path: string; message: string }>;
    };
    expect(body.error).toBe("Invalid query parameters");
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.issues[0].path).toBe("limit");
  });

  it("converts URLSearchParams to object correctly", () => {
    const params = new URLSearchParams();
    params.set("foo", "bar");
    params.set("baz", "qux");

    const schema = z.object({ foo: z.string(), baz: z.string() });
    const result = validateQuery(params, schema);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ foo: "bar", baz: "qux" });
  });

  it("handles empty URLSearchParams", async () => {
    const params = new URLSearchParams();
    const result = validateQuery(params, QuerySchema);

    expect(result.data).toBeNull();
    expect(result.error!.status).toBe(400);

    const body = (await extractResponseBody(result.error!)) as {
      issues: Array<{ path: string; message: string }>;
    };
    // Both page and limit should be missing
    expect(body.issues.length).toBe(2);
  });

  it("handles optional query parameters", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });
    const params = new URLSearchParams({ required: "yes" });
    const result = validateQuery(params, schema);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ required: "yes" });
  });

  it("uses last value for duplicate query params", () => {
    // URLSearchParams.forEach with set behavior: last write wins
    const params = new URLSearchParams("key=first&key=second");
    const schema = z.object({ key: z.string() });
    const result = validateQuery(params, schema);

    expect(result.error).toBeNull();
    // forEach iterates all entries; the implementation overwrites, so last value wins
    expect(result.data).toEqual({ key: "second" });
  });

  it("returns formatted issues with correct paths for nested query schemas", async () => {
    const schema = z.object({
      teamId: z.string().uuid(),
    });
    const params = new URLSearchParams({ teamId: "not-a-uuid" });
    const result = validateQuery(params, schema);

    expect(result.data).toBeNull();
    expect(result.error!.status).toBe(400);

    const body = (await extractResponseBody(result.error!)) as {
      issues: Array<{ path: string; message: string }>;
    };
    expect(body.issues[0].path).toBe("teamId");
    expect(body.issues[0].message).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validateBodyPagesRouter (Pages Router)
// ---------------------------------------------------------------------------

describe("validateBodyPagesRouter", () => {
  it("returns { success: true, data } on valid input", () => {
    const result = validateBodyPagesRouter(
      { name: "Alice", age: 30 },
      TestSchema
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns { success: false, issues } on invalid input", () => {
    const result = validateBodyPagesRouter(
      { name: 123, age: "bad" },
      TestSchema
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("issues have correct path and message format", () => {
    const result = validateBodyPagesRouter({ name: "test", age: -1 }, TestSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toHaveProperty("path");
      expect(result.issues[0]).toHaveProperty("message");
      expect(typeof result.issues[0].path).toBe("string");
      expect(typeof result.issues[0].message).toBe("string");
      expect(result.issues[0].path).toBe("age");
    }
  });

  it("handles nested object validation errors", () => {
    const result = validateBodyPagesRouter(
      { user: { email: "bad", profile: { bio: "" } } },
      NestedSchema
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain("user.email");
      expect(paths).toContain("user.profile.bio");
    }
  });

  it("handles missing body (undefined)", () => {
    const result = validateBodyPagesRouter(undefined, TestSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("handles null body", () => {
    const result = validateBodyPagesRouter(null, TestSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("applies Zod transforms and defaults", () => {
    const schema = z.object({
      count: z.number().default(10),
      label: z.string().transform((s) => s.toUpperCase()),
    });
    const result = validateBodyPagesRouter({ label: "hello" }, schema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ count: 10, label: "HELLO" });
    }
  });

  it("returns empty path for root-level type mismatch", () => {
    const schema = z.string();
    const result = validateBodyPagesRouter(12345, schema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toHaveLength(1);
      // Root-level errors have an empty path array, so joined path is ""
      expect(result.issues[0].path).toBe("");
    }
  });

  it("returns multiple issues for multiple validation failures", () => {
    const schema = z.object({
      a: z.string(),
      b: z.number(),
      c: z.boolean(),
    });
    const result = validateBodyPagesRouter({}, schema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toHaveLength(3);
      const paths = result.issues.map((i) => i.path).sort();
      expect(paths).toEqual(["a", "b", "c"]);
    }
  });
});

// ---------------------------------------------------------------------------
// formatZodErrors (tested indirectly through public APIs)
// ---------------------------------------------------------------------------

describe("formatZodErrors (indirect)", () => {
  it("joins nested paths with dots", () => {
    const result = validateBodyPagesRouter(
      { user: { profile: { bio: 123 } } },
      z.object({
        user: z.object({
          profile: z.object({
            bio: z.string(),
          }),
        }),
      })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].path).toBe("user.profile.bio");
    }
  });

  it("uses array index in path for array validation errors", () => {
    const schema = z.object({
      items: z.array(z.string()),
    });
    const result = validateBodyPagesRouter(
      { items: ["ok", 123, "also ok", false] },
      schema
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain("items.1");
      expect(paths).toContain("items.3");
    }
  });

  it("returns human-readable messages from Zod", () => {
    const schema = z.object({
      email: z.string().email("Must be a valid email"),
    });
    const result = validateBodyPagesRouter({ email: "nope" }, schema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toBe("Must be a valid email");
    }
  });
});
