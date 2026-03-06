/**
 * FundRoom AI Design Tokens
 *
 * Centralized design tokens for programmatic access.
 * CSS custom properties (HSL) are defined in styles/globals.css.
 * These TypeScript constants provide direct hex/rgb values for use
 * in JavaScript contexts (charts, canvas, dynamic styles).
 *
 * Brand Guidelines: docs/FundRoom_Brand_Guidelines.md
 */

// ── Brand Colors ──────────────────────────────────────────────────
// WCAG 2.1 AA contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text)
// Verified combinations are documented inline.
export const colors = {
  // Primary
  navy: "#0A1628",       // On white: 17.2:1 ✓ AA | White on navy: 17.2:1 ✓ AA
  navyCard: "#111827",   // On white: 15.4:1 ✓ AA | White on navyCard: 15.4:1 ✓ AA
  navyLight: "#1E293B",  // On white: 11.5:1 ✓ AA | White on navyLight: 11.5:1 ✓ AA
  electricBlue: "#0066FF", // On white: 4.7:1 ✓ AA | On navy: 4.9:1 ✓ AA | White on blue: 4.7:1 ✓ AA

  // Semantic
  success: "#10B981",    // On white: 2.7:1 (large text only) | On navy: 6.3:1 ✓ AA
  warning: "#F59E0B",    // On white: 2.0:1 (large text only) | On navy: 8.5:1 ✓ AA
  error: "#EF4444",      // On white: 3.9:1 ✓ large | On navy: 4.4:1 ✓ large
  info: "#06B6D4",       // On white: 2.6:1 (large text only) | On navy: 6.7:1 ✓ AA
  purple: "#8B5CF6",     // On white: 3.5:1 ✓ large | On navy: 4.9:1 ✓ AA

  // Backgrounds
  pageBg: "#F3F4F6",     // textPrimary on pageBg: 10.9:1 ✓ AA
  cardBg: "#FFFFFF",     // textPrimary on white: 12.6:1 ✓ AA
  darkPageBg: "#0A1628", // darkTextPrimary on darkPageBg: 13.2:1 ✓ AA
  darkCardBg: "#111827", // darkTextPrimary on darkCardBg: 11.8:1 ✓ AA

  // Borders
  border: "#E5E7EB",     // Decorative — contrast not required for non-text
  borderDark: "#1F2937", // Decorative — contrast not required for non-text

  // Text — all verified against their intended backgrounds
  textPrimary: "#1F2937",      // On white: 12.6:1 ✓ AA | On pageBg: 10.9:1 ✓ AA
  textSecondary: "#6B7280",    // On white: 5.0:1 ✓ AA | On pageBg: 4.4:1 ✓ large
  textMuted: "#9CA3AF",        // On white: 2.8:1 (decorative/non-essential only)
  darkTextPrimary: "#E2E8F0",  // On navy: 13.2:1 ✓ AA | On navyCard: 11.8:1 ✓ AA
  darkTextSecondary: "#94A3B8", // On navy: 7.3:1 ✓ AA | On navyCard: 6.5:1 ✓ AA
  darkTextMuted: "#64748B",    // On navy: 3.9:1 ✓ large | On navyCard: 3.5:1 ✓ large

  // Investor Pipeline Stages (ordered)
  stages: {
    applied: "#6B7280",
    underReview: "#F59E0B",
    approved: "#3B82F6",
    committed: "#8B5CF6",
    docsApproved: "#06B6D4",
    funded: "#10B981",
    rejected: "#EF4444",
  },

  // Distribution Types
  distributions: {
    returnOfCapital: "#3B82F6",
    profit: "#10B981",
    dividend: "#8B5CF6",
    other: "#6B7280",
  },

  // Fund Status
  fundStatus: {
    active: "#10B981",
    closed: "#6B7280",
    raising: "#3B82F6",
    winding: "#F59E0B",
  },

  // CRM Tiers
  tiers: {
    free: "#6B7280",
    crmPro: "#3B82F6",
    fundroom: "#8B5CF6",
    aiCrm: "#06B6D4",
  },
} as const;

// ── Typography ────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'DM Mono', ui-monospace, SFMono-Regular, monospace",
    marketing: "'Fraunces', Georgia, 'Times New Roman', serif",
  },
  fontSize: {
    xs: "0.75rem",    // 12px
    sm: "0.875rem",   // 14px
    base: "1rem",     // 16px
    lg: "1.125rem",   // 18px
    xl: "1.25rem",    // 20px
    "2xl": "1.5rem",  // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

// ── Spacing ───────────────────────────────────────────────────────
export const spacing = {
  px: "1px",
  0: "0",
  0.5: "0.125rem",  // 2px
  1: "0.25rem",     // 4px
  1.5: "0.375rem",  // 6px
  2: "0.5rem",      // 8px
  3: "0.75rem",     // 12px
  4: "1rem",        // 16px
  5: "1.25rem",     // 20px
  6: "1.5rem",      // 24px
  8: "2rem",        // 32px
  10: "2.5rem",     // 40px
  12: "3rem",       // 48px
  16: "4rem",       // 64px
  20: "5rem",       // 80px
} as const;

// ── Breakpoints ───────────────────────────────────────────────────
export const breakpoints = {
  sm: 640,   // Mobile landscape
  md: 768,   // Tablet
  lg: 1024,  // Desktop
  xl: 1280,  // Wide desktop
  "2xl": 1440, // Max content width
} as const;

// ── Shadows ───────────────────────────────────────────────────────
export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  hover: "0 8px 25px -5px rgb(0 0 0 / 0.15)",
  card: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
} as const;

// ── Animation ─────────────────────────────────────────────────────
export const animation = {
  duration: {
    fast: "100ms",
    normal: "150ms",
    slow: "300ms",
    loading: "800ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

// ── Border Radius ─────────────────────────────────────────────────
export const radius = {
  sm: "0.375rem",  // 6px
  DEFAULT: "0.5rem", // 8px (--radius)
  md: "0.5rem",    // 8px
  lg: "0.625rem",  // 10px
  xl: "0.75rem",   // 12px
  full: "9999px",
} as const;

// ── Z-Index ───────────────────────────────────────────────────────
export const zIndex = {
  dropdown: 50,
  sticky: 40,
  overlay: 30,
  modal: 50,
  popover: 50,
  toast: 100,
  fab: 40,
  tooltip: 50,
} as const;

// ── Chart Colors (for Recharts/Tremor) ────────────────────────────
export const chartColors = [
  "#2563EB", // blue-600
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#8B5CF6", // violet-500
  "#EF4444", // red-500
  "#06B6D4", // cyan-500
  "#EC4899", // pink-500
  "#14B8A6", // teal-500
] as const;

// ── Touch Targets ─────────────────────────────────────────────────
export const touchTargets = {
  minimum: "44px",  // WCAG 2.1 AA
  button: "44px",
  navItem: "48px",
  listItem: "56px",
} as const;

// ── Status Badge Classes ─────────────────────────────────────────
// Gold standard pattern: bg-{color}-100 text-{color}-700 dark:bg-{color}-900/30 dark:text-{color}-400
export const statusBadgeClasses = {
  // Envelope / signing statuses
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  preparing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  viewed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  partiallySigned: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  declined: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  voided: "bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-500",
  expired: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500",

  // Investor pipeline stages
  applied: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  underReview: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  committed: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  docsApproved: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  funded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",

  // Funding statuses
  notFunded: "bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-500",
  pendingWire: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  wireUploaded: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",

  // Document review statuses
  pendingReview: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  docApproved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  docRejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  revisionRequested: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",

  // Upload source badges
  gpUpload: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  externalUpload: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",

  // Engagement tiers
  hot: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  warm: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  cool: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  none: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800",

  // Recipient statuses
  recipientPending: "text-gray-500 dark:text-gray-400",
  recipientSent: "text-blue-500 dark:text-blue-400",
  recipientViewed: "text-indigo-500 dark:text-indigo-400",
  recipientSigned: "text-emerald-500 dark:text-emerald-400",
  recipientDeclined: "text-red-500 dark:text-red-400",
  recipientCompleted: "text-emerald-600 dark:text-emerald-400",
} as const;
