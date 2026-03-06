/**
 * Resolves the Prisma DocumentStorageType based on the current environment configuration.
 *
 * Maps the runtime STORAGE_PROVIDER / NEXT_PUBLIC_UPLOAD_TRANSPORT env vars
 * to the corresponding DocumentStorageType enum value used in Prisma.
 *
 * Provider → DocumentStorageType mapping:
 *   vercel  → VERCEL_BLOB
 *   s3 / r2 → S3_PATH
 *   replit  → REPLIT
 *   local   → S3_PATH (stored as file paths, same pattern)
 *   dual    → S3_PATH (primary is S3)
 */
export function resolveDocumentStorageType(): "S3_PATH" | "VERCEL_BLOB" | "REPLIT" {
  const provider =
    process.env.STORAGE_PROVIDER ||
    process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT ||
    "s3";

  switch (provider) {
    case "vercel":
      return "VERCEL_BLOB";
    case "replit":
      return "REPLIT";
    case "s3":
    case "r2":
    case "local":
    case "dual":
    default:
      return "S3_PATH";
  }
}
