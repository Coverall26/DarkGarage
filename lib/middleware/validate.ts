import { NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";

/**
 * Validate request body against a Zod schema (App Router).
 *
 * Usage:
 *   const parsed = await validateBody(req, MySchema);
 *   if (parsed.error) return parsed.error;
 *   const data = parsed.data; // Fully typed
 *
 * Returns either:
 *   - { data: T, error: null } on success
 *   - { data: null, error: NextResponse } on validation failure (400)
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        data: null,
        error: NextResponse.json(
          {
            error: "Validation failed",
            issues: formatZodErrors(result.error),
          },
          { status: 400 }
        ),
      };
    }

    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse } {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: formatZodErrors(result.error),
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}

/**
 * Validate request body against a Zod schema (Pages Router).
 *
 * Usage:
 *   const parsed = validateBodyPagesRouter(req.body, MySchema);
 *   if (!parsed.success) {
 *     return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
 *   }
 *   const data = parsed.data; // Fully typed
 */
export function validateBodyPagesRouter<T>(
  body: unknown,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; issues: Array<{ path: string; message: string }> } {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      issues: formatZodErrors(result.error),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Format Zod errors into a clean array of { path, message } objects.
 */
function formatZodErrors(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
