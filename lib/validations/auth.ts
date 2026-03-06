import { z } from "zod";

/**
 * Auth-Related Validation Schemas
 *
 * Shared Zod schemas for authentication API routes.
 */

/** Normalized email — trimmed, lowercased */
const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .transform((v) => v.toLowerCase().trim());

// ---------------------------------------------------------------------------
// POST /api/auth/admin-login
// ---------------------------------------------------------------------------

export const AdminLoginSchema = z.object({
  email: emailSchema,
  redirectPath: z.string().max(500).optional(),
});

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/check-admin
// ---------------------------------------------------------------------------

export const CheckAdminSchema = z.object({
  email: emailSchema,
});

export type CheckAdminInput = z.infer<typeof CheckAdminSchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/check-visitor
// ---------------------------------------------------------------------------

export const CheckVisitorSchema = z.object({
  email: emailSchema,
});

export type CheckVisitorInput = z.infer<typeof CheckVisitorSchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/lp-token-login
// ---------------------------------------------------------------------------

export const LpTokenLoginSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type LpTokenLoginInput = z.infer<typeof LpTokenLoginSchema>;

// ---------------------------------------------------------------------------
// PUT /api/auth/mfa-setup — verify code & enable
// DELETE /api/auth/mfa-setup — disable MFA
// ---------------------------------------------------------------------------

export const MfaCodeSchema = z.object({
  code: z
    .string()
    .min(1, "Verification code required")
    .max(20),
});

/** PUT specifically requires exactly 6 digits */
export const MfaSetupVerifySchema = z.object({
  code: z
    .string()
    .length(6, "Valid 6-digit code required")
    .regex(/^\d{6}$/, "Valid 6-digit code required"),
});

export type MfaCodeInput = z.infer<typeof MfaCodeSchema>;
export type MfaSetupVerifyInput = z.infer<typeof MfaSetupVerifySchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/mfa-verify
// ---------------------------------------------------------------------------

export const MfaVerifySchema = z.object({
  code: z.string().min(1, "Verification code required").max(20),
  type: z.enum(["totp", "recovery"]).optional().default("totp"),
});

export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/setup-admin
// ---------------------------------------------------------------------------

export const SetupAdminSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  currentPassword: z.string().max(128).optional(),
});

export type SetupAdminInput = z.infer<typeof SetupAdminSchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

export const RegisterSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().min(1, "Name is required").max(255),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
