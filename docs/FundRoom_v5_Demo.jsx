/**
 * FundRoom AI — v5 Interactive Demo Artifact
 * ============================================
 *
 * A polished single-file React JSX demo showcasing the complete FundRoom AI
 * platform for investor presentations and stakeholder demos.
 *
 * Shows:
 *   - 5 Product Suites (RaiseRoom, SignSuite, RaiseCRM, DataRoom, FundRoom)
 *   - 4-Tier CRM Pricing (Free / CRM Pro / Business / FundRoom)
 *   - AI CRM Add-On ($49/mo with 14-day trial)
 *   - Lara AI Concierge (context-aware, suite-specific quick actions)
 *   - LP Onboarding Wizard (6 visible steps)
 *   - GP Setup Wizard Overview (9 steps)
 *   - Design Token System (colors, typography, spacing)
 *
 * Brand Reference: docs/BRAND_BIBLE.md
 * Pricing Source: lib/stripe/crm-products.ts
 * Design Tokens:  lib/design-tokens.ts
 * Lara AI Source: components/lara/lara-chat.tsx
 *
 * Usage:
 *   Drop into any React playground (CodeSandbox, StackBlitz, Claude Artifact)
 *   or render with: <FundRoomDemo />
 *
 * @version 5.0
 * @date March 2, 2026
 * @license PROPRIETARY — FundRoom AI, Inc.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: DESIGN TOKENS
// Source: lib/design-tokens.ts + docs/BRAND_BIBLE.md
// ═══════════════════════════════════════════════════════════════════════════

const BRAND_COLORS = {
  // Primary
  deepNavy: "#0A1628",
  navyCard: "#111827",
  navyLight: "#1E293B",
  electricBlue: "#0066FF",

  // Semantic
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#06B6D4",
  purple: "#8B5CF6",

  // Backgrounds
  pageBg: "#F3F4F6",
  cardBg: "#FFFFFF",
  darkPageBg: "#0A1628",
  darkCardBg: "#111827",

  // Borders
  border: "#E5E7EB",
  borderDark: "#1F2937",

  // Text
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  darkTextPrimary: "#E2E8F0",
  darkTextSecondary: "#94A3B8",
  darkTextMuted: "#64748B",
};

const TYPOGRAPHY = {
  fontFamily: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'DM Mono', ui-monospace, SFMono-Regular, monospace",
    marketing: "'Fraunces', Georgia, 'Times New Roman', serif",
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: PRODUCT SUITE DEFINITIONS
// Source: docs/BRAND_BIBLE.md (v3 canonical names)
// ═══════════════════════════════════════════════════════════════════════════

const PRODUCT_SUITES = [
  {
    name: "RaiseRoom",
    tagline: "Capital raise vault",
    color: "#06B6D4",
    icon: "TrendingUp",
    description: "Manage your capital raise pipeline, offering pages, fund overview, and investor engagement from one unified dashboard.",
    features: ["Capital raise pipeline", "Offering landing pages", "Fund overview dashboard", "Investor engagement tracking"],
    adminRoute: "/admin/raiseroom",
  },
  {
    name: "SignSuite",
    tagline: "Native e-signatures",
    color: "#10B981",
    icon: "FileSignature",
    description: "Send documents for signature with zero external API cost. Sequential, parallel, or mixed signing modes with SEC-compliant audit trail.",
    features: ["Envelope management", "16 field types", "Bulk send (1-500)", "ESIGN/UETA compliance"],
    adminRoute: "/admin/signsuite",
  },
  {
    name: "RaiseCRM",
    tagline: "Investor CRM pipeline",
    color: "#F59E0B",
    icon: "Users",
    description: "Track investor relationships with Kanban pipeline, engagement scoring, outreach sequences, and AI-powered insights.",
    features: ["Kanban pipeline", "Engagement scoring", "Outreach sequences", "AI email drafts"],
    adminRoute: "/admin/raise-crm",
  },
  {
    name: "DataRoom",
    tagline: "Secure document storage & sharing",
    color: "#2563EB",
    icon: "FolderLock",
    description: "Organize and share documents securely with granular access controls, analytics, watermarking, and email-gated access.",
    features: ["Document filing", "Contact vaults", "Activity log", "Watermark & access controls"],
    adminRoute: "/admin/dataroom",
  },
  {
    name: "FundRoom",
    tagline: "Full fund operations engine",
    color: "#8B5CF6",
    icon: "Home",
    description: "The complete platform — all five suites combined into one integrated fund management system.",
    features: ["All suite features", "Compliance pipeline", "LP onboarding", "Fund analytics & reporting"],
    adminRoute: "/admin/dashboard",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: CRM SUBSCRIPTION TIERS
// Source: lib/stripe/crm-products.ts
// ═══════════════════════════════════════════════════════════════════════════

const CRM_PRICING_TIERS = [
  {
    name: "Free",
    slug: "FREE",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Get started with basic CRM features",
    highlighted: false,
    features: [
      "Up to 20 contacts",
      "10 e-signatures per month",
      "40 signer storage",
      "Table view",
      "2 email templates",
      "Basic pipeline (Lead → Contacted → Interested → Converted)",
    ],
  },
  {
    name: "CRM Pro",
    slug: "CRM_PRO",
    monthlyPrice: 29,
    yearlyPrice: 23,
    description: "Full CRM with Kanban, outreach, and analytics",
    highlighted: false,
    features: [
      "Unlimited contacts",
      "25 e-signatures per month",
      "100 signer storage",
      "Kanban board",
      "5 email templates",
      "Outreach queue",
      "Email tracking & analytics",
      "Advanced pipeline stages",
    ],
  },
  {
    name: "Business",
    slug: "BUSINESS",
    monthlyPrice: 39,
    yearlyPrice: 32,
    description: "Advanced CRM with unlimited contacts, signers, and analytics",
    highlighted: true,
    features: [
      "Everything in CRM Pro",
      "75 e-signatures per month",
      "Unlimited contacts & signers",
      "10 email templates",
      "Kanban board",
      "Outreach queue",
      "Email tracking & analytics",
    ],
  },
  {
    name: "FundRoom",
    slug: "FUNDROOM",
    monthlyPrice: 79,
    yearlyPrice: 63,
    description: "Complete fund operations with compliance pipeline",
    highlighted: false,
    features: [
      "Everything in Business",
      "Unlimited e-signatures",
      "Unlimited signer storage",
      "LP onboarding wizard",
      "Compliance pipeline (Lead → NDA → Accredited → Committed → Funded)",
      "Unlimited email templates",
      "Fund-specific analytics",
    ],
  },
];

const AI_CRM_ADDON = {
  name: "AI CRM",
  slug: "AI_CRM",
  monthlyPrice: 49,
  yearlyPrice: 39,
  trialDays: 14,
  description: "AI-powered drafts, sequences, and investor digest",
  features: [
    "AI email drafts",
    "AI outreach sequences",
    "Weekly investor digest",
    "Contact enrichment",
    "Unlimited email templates",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: LARA AI CONCIERGE CONTEXT
// Source: components/lara/lara-chat.tsx
// ═══════════════════════════════════════════════════════════════════════════

const LARA_SUITE_CONTEXTS = {
  fundroom: {
    greeting: "Hey! I can help you manage your raise, send documents, or check on your pipeline.",
    quickActions: [
      "Summarize my pending actions",
      "Draft a fund update email",
      "Remind me about upcoming deadlines",
    ],
  },
  signsuite: {
    greeting: "Need help with a signature? I can draft documents, set up templates, or check on pending envelopes.",
    quickActions: [
      "Check pending signatures",
      "Help me create a template",
      "Remind me about expiring envelopes",
    ],
  },
  raiseroom: {
    greeting: "I can help you set up your raise room, analyze viewer engagement, or draft investor outreach.",
    quickActions: [
      "Summarize viewer activity",
      "Draft investor outreach",
      "Check raise progress",
    ],
  },
  raisecrm: {
    greeting: "Want me to draft an outreach email, score your pipeline, or summarize investor activity?",
    quickActions: [
      "Draft investor outreach",
      "Score my pipeline",
      "Summarize contact activity",
    ],
  },
  dataroom: {
    greeting: "I can help organize your documents, set up sharing, or find specific files.",
    quickActions: [
      "Find a document",
      "Set up sharing permissions",
      "Summarize viewer activity",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: LP ONBOARDING WIZARD STEPS
// Source: app/lp/onboard/page-client.tsx
// 9 internal steps → 6 visible groups
// ═══════════════════════════════════════════════════════════════════════════

const LP_WIZARD_VISIBLE_STEPS = [
  {
    label: "Account",
    icon: "User",
    internalSteps: ["Personal Info"],
    description: "Name, email, phone — creates your investor account.",
    fields: ["firstName", "lastName", "email", "phone"],
  },
  {
    label: "Entity",
    icon: "Building",
    internalSteps: ["Entity Type", "Address"],
    description: "Select your investor entity type and provide address details.",
    entityTypes: [
      "Individual",
      "Joint",
      "Trust / Estate",
      "LLC / Corporation",
      "Partnership",
      "IRA / Retirement",
      "Charity / Foundation",
    ],
  },
  {
    label: "Accreditation",
    icon: "ShieldCheck",
    internalSteps: ["Accreditation"],
    description: "SEC-compliant investor accreditation verification.",
    categories: [
      "Income >$200K (individual) or >$300K (joint)",
      "Net worth >$1M (excluding primary residence)",
      "Series 7, 65, or 82 license holder",
      "Knowledgeable employee of the fund",
      "Entity with assets >$5M",
    ],
  },
  {
    label: "Commit",
    icon: "DollarSign",
    internalSteps: ["NDA", "Commitment"],
    description: "Review offering terms, sign NDA, and make your commitment.",
    representationsCount: 8,
    representations: [
      "Accredited investor certification (SEC Rule 501(a))",
      "Investing as principal (not agent/nominee)",
      "Read and understood offering documents",
      "Risk awareness (possible total loss)",
      "Restricted securities acknowledgment",
      "AML/OFAC compliance",
      "Tax ID consent (K-1 preparation)",
      "Independent advice acknowledgment",
    ],
  },
  {
    label: "Sign",
    icon: "FileSignature",
    internalSteps: ["Document Signing"],
    description: "Sign required documents via SignSuite split-screen e-signature.",
    signingModes: ["Sequential (NDA first, then Sub Agreement)", "Draw, type, or upload signature"],
  },
  {
    label: "Fund",
    icon: "Landmark",
    internalSteps: ["Funding"],
    description: "View wire instructions, upload proof of payment.",
    paymentMethod: "Manual wire transfer (MVP) — ACH coming in Phase 2",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: GP SETUP WIZARD STEPS
// Source: app/admin/setup/page.tsx (9-step canonical)
// ═══════════════════════════════════════════════════════════════════════════

const GP_WIZARD_STEPS = [
  { step: 1, label: "Company Info", description: "Legal name, entity type, EIN (AES-256 encrypted), Bad Actor 506(d) certification, address, phone" },
  { step: 2, label: "Branding", description: "Logo upload, brand colors, custom domain, email sender, company profile with live preview" },
  { step: 3, label: "Raise Style", description: "GP Fund / Startup / Dataroom Only — Reg D exemption (506b, 506c, Reg A+, Rule 504)" },
  { step: 4, label: "Team Invites", description: "Invite team members by email with role assignment (Owner, Admin, Manager, Member)" },
  { step: 5, label: "Dataroom", description: "Dataroom name, sharing policies, shareable link with ?ref= tracking" },
  { step: 6, label: "Fund Details", description: "GP: economics + wire instructions. Startup: SAFE/Conv Note/Priced/SPV instrument terms" },
  { step: 7, label: "LP Onboarding", description: "Step config with drag-reorder, document templates, accreditation method, notification preferences" },
  { step: 8, label: "Integrations", description: "Active services status, Phase 2 placeholders (Persona KYC, Stripe ACH, QuickBooks)" },
  { step: 9, label: "Launch", description: "Validation gate, 8-9 summary cards, progress checklist, Fix links, activation CTA" },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Badge({ children, variant = "default", color, style = {} }) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: "9999px",
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: 500,
    lineHeight: 1.5,
    ...style,
  };

  const variantStyles = {
    default: { background: "#F3F4F6", color: BRAND_COLORS.textSecondary },
    success: { background: "#D1FAE5", color: "#065F46" },
    warning: { background: "#FEF3C7", color: "#92400E" },
    error: { background: "#FEE2E2", color: "#991B1B" },
    info: { background: "#DBEAFE", color: "#1E40AF" },
    purple: { background: "#EDE9FE", color: "#5B21B6" },
    custom: { background: color ? `${color}20` : "#F3F4F6", color: color || BRAND_COLORS.textSecondary },
  };

  return (
    <span style={{ ...baseStyle, ...variantStyles[variant] }} role="status">
      {children}
    </span>
  );
}

function DemoButton({ children, variant = "primary", onClick, disabled = false, style = {}, ariaLabel }) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: 500,
    fontFamily: TYPOGRAPHY.fontFamily.primary,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: "none",
    transition: "all 150ms ease",
    minHeight: "44px",
    ...style,
  };

  const variantStyles = {
    primary: { background: BRAND_COLORS.electricBlue, color: "#FFFFFF" },
    secondary: { background: BRAND_COLORS.pageBg, color: BRAND_COLORS.textPrimary, border: `1px solid ${BRAND_COLORS.border}` },
    ghost: { background: "transparent", color: BRAND_COLORS.textSecondary },
    destructive: { background: BRAND_COLORS.error, color: "#FFFFFF" },
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variantStyles[variant] }}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
}

function Card({ children, title, subtitle, headerAction, style = {}, ariaLabel }) {
  return (
    <div
      style={{
        background: BRAND_COLORS.cardBg,
        border: `1px solid ${BRAND_COLORS.border}`,
        borderRadius: "12px",
        overflow: "hidden",
        ...style,
      }}
      role="region"
      aria-label={ariaLabel || title}
    >
      {(title || headerAction) && (
        <div style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${BRAND_COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            {title && <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: 600, color: BRAND_COLORS.textPrimary }}>{title}</h3>}
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary }}>{subtitle}</p>}
          </div>
          {headerAction}
        </div>
      )}
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, change, changeDirection, icon }) {
  const changeColor = changeDirection === "up" ? BRAND_COLORS.success : changeDirection === "down" ? BRAND_COLORS.error : BRAND_COLORS.textMuted;
  const changeArrow = changeDirection === "up" ? "+" : changeDirection === "down" ? "-" : "";

  return (
    <div
      style={{
        background: BRAND_COLORS.cardBg,
        border: `1px solid ${BRAND_COLORS.border}`,
        borderRadius: "12px",
        padding: "20px",
        flex: 1,
        minWidth: "180px",
      }}
      role="figure"
      aria-label={`${label}: ${value}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary }}>{label}</p>
        {icon && <span style={{ fontSize: "20px", opacity: 0.6 }}>{icon}</span>}
      </div>
      <p style={{
        margin: "8px 0 0",
        fontSize: TYPOGRAPHY.fontSize["2xl"],
        fontWeight: 700,
        fontFamily: TYPOGRAPHY.fontFamily.mono,
        fontVariantNumeric: "tabular-nums",
        color: BRAND_COLORS.textPrimary,
      }}>
        {value}
      </p>
      {change && (
        <p style={{ margin: "4px 0 0", fontSize: TYPOGRAPHY.fontSize.xs, color: changeColor, fontFamily: TYPOGRAPHY.fontFamily.mono }}>
          {changeArrow}{change} from last month
        </p>
      )}
    </div>
  );
}

function ProgressBar({ value, max, color = BRAND_COLORS.electricBlue, label }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary }}>{label}</span>
        <span style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.mono, color: BRAND_COLORS.textPrimary }}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div style={{ height: "8px", background: BRAND_COLORS.pageBg, borderRadius: "4px", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${percentage}%`,
          background: `linear-gradient(90deg, ${color}, ${color}CC)`,
          borderRadius: "4px",
          transition: "width 300ms ease",
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: SUITE OVERVIEW SECTION
// ═══════════════════════════════════════════════════════════════════════════

function SuiteOverviewSection() {
  return (
    <section aria-labelledby="suites-heading" style={{ marginBottom: "48px" }}>
      <h2 id="suites-heading" style={{ fontSize: TYPOGRAPHY.fontSize["3xl"], fontWeight: 700, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
        Five Suites. One Platform.
      </h2>
      <p style={{ fontSize: TYPOGRAPHY.fontSize.lg, color: BRAND_COLORS.textSecondary, marginBottom: "32px" }}>
        Every module you need for fund operations — from document signing to investor onboarding.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {PRODUCT_SUITES.map((suite) => (
          <div
            key={suite.name}
            style={{
              background: BRAND_COLORS.cardBg,
              border: `1px solid ${BRAND_COLORS.border}`,
              borderTop: `4px solid ${suite.color}`,
              borderRadius: "12px",
              padding: "24px",
              transition: "box-shadow 150ms ease",
            }}
            role="article"
            aria-label={`${suite.name} — ${suite.tagline}`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: `${suite.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: suite.color,
                fontWeight: 700,
                fontSize: TYPOGRAPHY.fontSize.lg,
              }}>
                {suite.name.charAt(0)}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: 600, color: BRAND_COLORS.textPrimary }}>{suite.name}</h3>
                <p style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.xs, color: suite.color, fontWeight: 500 }}>{suite.tagline}</p>
              </div>
            </div>

            <p style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary, marginBottom: "16px", lineHeight: 1.5 }}>
              {suite.description}
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {suite.features.map((feature) => (
                <li key={feature} style={{
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  color: BRAND_COLORS.textPrimary,
                  padding: "4px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                  <span style={{ color: suite.color, fontSize: "14px" }} aria-hidden="true">&#10003;</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: PRICING SECTION
// ═══════════════════════════════════════════════════════════════════════════

function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  return (
    <section aria-labelledby="pricing-heading" style={{ marginBottom: "48px" }}>
      <h2 id="pricing-heading" style={{ fontSize: TYPOGRAPHY.fontSize["3xl"], fontWeight: 700, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
        Simple, Transparent Pricing
      </h2>
      <p style={{ fontSize: TYPOGRAPHY.fontSize.lg, color: BRAND_COLORS.textSecondary, marginBottom: "24px" }}>
        Start free. Upgrade when you need more power.
      </p>

      {/* Billing period toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }} role="radiogroup" aria-label="Billing period">
        <button
          onClick={() => setBillingPeriod("monthly")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: billingPeriod === "monthly" ? BRAND_COLORS.electricBlue : BRAND_COLORS.pageBg,
            color: billingPeriod === "monthly" ? "#FFFFFF" : BRAND_COLORS.textSecondary,
            fontWeight: 500,
            fontSize: TYPOGRAPHY.fontSize.sm,
            cursor: "pointer",
            minHeight: "44px",
          }}
          role="radio"
          aria-checked={billingPeriod === "monthly"}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingPeriod("yearly")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: billingPeriod === "yearly" ? BRAND_COLORS.electricBlue : BRAND_COLORS.pageBg,
            color: billingPeriod === "yearly" ? "#FFFFFF" : BRAND_COLORS.textSecondary,
            fontWeight: 500,
            fontSize: TYPOGRAPHY.fontSize.sm,
            cursor: "pointer",
            minHeight: "44px",
          }}
          role="radio"
          aria-checked={billingPeriod === "yearly"}
        >
          Yearly <Badge variant="success" style={{ marginLeft: "8px" }}>Save ~20%</Badge>
        </button>
      </div>

      {/* Tier cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
        {CRM_PRICING_TIERS.map((tier) => {
          const displayPrice = billingPeriod === "monthly" ? tier.monthlyPrice : tier.yearlyPrice;
          const isHighlighted = tier.highlighted;

          return (
            <div
              key={tier.slug}
              style={{
                background: BRAND_COLORS.cardBg,
                border: isHighlighted ? `2px solid ${BRAND_COLORS.electricBlue}` : `1px solid ${BRAND_COLORS.border}`,
                borderRadius: "12px",
                padding: "28px 24px",
                position: "relative",
                boxShadow: isHighlighted ? `0 4px 20px ${BRAND_COLORS.electricBlue}20` : "none",
              }}
              role="article"
              aria-label={`${tier.name} plan — $${displayPrice} per month`}
            >
              {isHighlighted && (
                <div style={{
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: BRAND_COLORS.electricBlue,
                  color: "#FFFFFF",
                  padding: "4px 16px",
                  borderRadius: "9999px",
                  fontSize: TYPOGRAPHY.fontSize.xs,
                  fontWeight: 600,
                }}>
                  Most Popular
                </div>
              )}

              <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: 600, color: BRAND_COLORS.textPrimary }}>{tier.name}</h3>
              <p style={{ margin: "4px 0 16px", fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary }}>{tier.description}</p>

              <div style={{ marginBottom: "20px" }}>
                <span style={{
                  fontSize: TYPOGRAPHY.fontSize["4xl"],
                  fontWeight: 700,
                  fontFamily: TYPOGRAPHY.fontFamily.mono,
                  fontVariantNumeric: "tabular-nums",
                  color: BRAND_COLORS.textPrimary,
                }}>
                  ${displayPrice}
                </span>
                {displayPrice > 0 && (
                  <span style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textMuted }}>/mo</span>
                )}
              </div>

              <DemoButton
                variant={isHighlighted ? "primary" : "secondary"}
                style={{ width: "100%", marginBottom: "20px" }}
                ariaLabel={tier.monthlyPrice === 0 ? "Start free" : `Subscribe to ${tier.name}`}
              >
                {tier.monthlyPrice === 0 ? "Start Free" : "Get Started"}
              </DemoButton>

              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {tier.features.map((feature) => (
                  <li key={feature} style={{
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    color: BRAND_COLORS.textPrimary,
                    padding: "6px 0",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    lineHeight: 1.4,
                  }}>
                    <span style={{ color: BRAND_COLORS.success, flexShrink: 0, marginTop: "2px" }} aria-hidden="true">&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* AI CRM Add-On */}
      <div style={{
        marginTop: "32px",
        background: `linear-gradient(135deg, ${BRAND_COLORS.deepNavy}, ${BRAND_COLORS.navyLight})`,
        borderRadius: "12px",
        padding: "28px",
        display: "flex",
        flexWrap: "wrap",
        gap: "24px",
        alignItems: "center",
      }}
      role="region"
      aria-label="AI CRM Add-On"
      >
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "24px" }} aria-hidden="true">&#10024;</span>
            <h3 style={{ margin: 0, color: BRAND_COLORS.darkTextPrimary, fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: 600 }}>
              {AI_CRM_ADDON.name} Add-On
            </h3>
            <Badge variant="info">14-day free trial</Badge>
          </div>
          <p style={{ margin: 0, color: BRAND_COLORS.darkTextSecondary, fontSize: TYPOGRAPHY.fontSize.sm }}>
            {AI_CRM_ADDON.description}. Stacks on any paid tier.
          </p>
          <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
            {AI_CRM_ADDON.features.map((feature) => (
              <span key={feature} style={{
                fontSize: TYPOGRAPHY.fontSize.xs,
                color: BRAND_COLORS.darkTextSecondary,
                padding: "4px 10px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: "6px",
              }}>
                {feature}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{
            margin: 0,
            fontSize: TYPOGRAPHY.fontSize["3xl"],
            fontWeight: 700,
            fontFamily: TYPOGRAPHY.fontFamily.mono,
            color: BRAND_COLORS.darkTextPrimary,
          }}>
            +${billingPeriod === "monthly" ? AI_CRM_ADDON.monthlyPrice : AI_CRM_ADDON.yearlyPrice}
            <span style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: 400, color: BRAND_COLORS.darkTextSecondary }}>/mo</span>
          </p>
          <DemoButton variant="primary" style={{ marginTop: "12px" }} ariaLabel="Start AI CRM free trial">
            Start Free Trial
          </DemoButton>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: LARA AI CONCIERGE DEMO
// ═══════════════════════════════════════════════════════════════════════════

function LaraAISection() {
  const [activeSuite, setActiveSuite] = useState("fundroom");
  const [chatMessages, setChatMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const context = LARA_SUITE_CONTEXTS[activeSuite];

  const handleSendMessage = useCallback((message) => {
    const userMessage = { id: Date.now().toString(), role: "user", content: message, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate Lara response
    setTimeout(() => {
      const laraResponse = {
        id: (Date.now() + 1).toString(),
        role: "lara",
        content: `I'll help you with that! Based on your current ${activeSuite} context, here's what I found...`,
        timestamp: new Date(),
        followUps: ["Tell me more", "Show analytics", "Draft an email"],
      };
      setChatMessages((prev) => [...prev, laraResponse]);
      setIsTyping(false);
    }, 1200);
  }, [activeSuite]);

  return (
    <section aria-labelledby="lara-heading" style={{ marginBottom: "48px" }}>
      <h2 id="lara-heading" style={{ fontSize: TYPOGRAPHY.fontSize["3xl"], fontWeight: 700, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
        Meet Lara — Your AI Concierge
      </h2>
      <p style={{ fontSize: TYPOGRAPHY.fontSize.lg, color: BRAND_COLORS.textSecondary, marginBottom: "24px" }}>
        Context-aware AI assistant that adapts to whichever suite you&apos;re working in.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
        {/* Suite selector */}
        <div style={{ minWidth: "200px" }}>
          <p style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: 500, color: BRAND_COLORS.textPrimary, marginBottom: "12px" }}>
            Active Suite:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} role="radiogroup" aria-label="Select suite for Lara context">
            {Object.entries(LARA_SUITE_CONTEXTS).map(([key]) => {
              const suiteInfo = PRODUCT_SUITES.find((s) => s.name.toLowerCase().replace(/\s/g, "") === key) || {};
              const displayName = suiteInfo.name || key;
              const suiteColor = suiteInfo.color || BRAND_COLORS.electricBlue;
              const isActive = activeSuite === key;

              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSuite(key);
                    setChatMessages([]);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: isActive ? `2px solid ${suiteColor}` : `1px solid ${BRAND_COLORS.border}`,
                    background: isActive ? `${suiteColor}10` : BRAND_COLORS.cardBg,
                    color: isActive ? suiteColor : BRAND_COLORS.textPrimary,
                    fontWeight: isActive ? 600 : 400,
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    cursor: "pointer",
                    textAlign: "left",
                    minHeight: "44px",
                    transition: "all 150ms ease",
                  }}
                  role="radio"
                  aria-checked={isActive}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat panel */}
        <div style={{
          flex: 1,
          minWidth: "320px",
          maxWidth: "420px",
          background: BRAND_COLORS.cardBg,
          border: `1px solid ${BRAND_COLORS.border}`,
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "420px",
        }}
        role="log"
        aria-label="Lara AI chat"
        aria-live="polite"
        >
          {/* Chat header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${BRAND_COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: `${BRAND_COLORS.purple}08`,
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "9999px",
              background: BRAND_COLORS.purple,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: "16px",
            }} aria-hidden="true">
              &#10024;
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textPrimary }}>Lara</p>
              <p style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.xs, color: BRAND_COLORS.success }}>Online</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Greeting */}
            <div style={{
              background: `${BRAND_COLORS.purple}10`,
              padding: "12px 14px",
              borderRadius: "12px 12px 12px 4px",
              maxWidth: "85%",
            }}>
              <p style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textPrimary, lineHeight: 1.5 }}>
                {context.greeting}
              </p>
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {context.quickActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSendMessage(action)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "9999px",
                    border: `1px solid ${BRAND_COLORS.electricBlue}40`,
                    background: `${BRAND_COLORS.electricBlue}08`,
                    color: BRAND_COLORS.electricBlue,
                    fontSize: TYPOGRAPHY.fontSize.xs,
                    cursor: "pointer",
                    minHeight: "32px",
                  }}
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Chat messages */}
            {chatMessages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                }}
              >
                <div style={{
                  padding: "10px 14px",
                  borderRadius: message.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background: message.role === "user" ? BRAND_COLORS.electricBlue : `${BRAND_COLORS.purple}10`,
                  color: message.role === "user" ? "#FFFFFF" : BRAND_COLORS.textPrimary,
                }}>
                  <p style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.sm, lineHeight: 1.5 }}>{message.content}</p>
                </div>
                {message.followUps && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                    {message.followUps.map((followUp) => (
                      <button
                        key={followUp}
                        onClick={() => handleSendMessage(followUp)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: `1px solid ${BRAND_COLORS.border}`,
                          background: BRAND_COLORS.cardBg,
                          color: BRAND_COLORS.textSecondary,
                          fontSize: TYPOGRAPHY.fontSize.xs,
                          cursor: "pointer",
                        }}
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div style={{ alignSelf: "flex-start", padding: "10px 14px", background: `${BRAND_COLORS.purple}10`, borderRadius: "12px 12px 12px 4px" }}>
                <p style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textMuted }}>Lara is typing...</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${BRAND_COLORS.border}`, display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && inputValue.trim()) {
                  handleSendMessage(inputValue.trim());
                }
              }}
              placeholder="Ask Lara anything..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: `1px solid ${BRAND_COLORS.border}`,
                fontSize: "16px",
                fontFamily: TYPOGRAPHY.fontFamily.primary,
                outline: "none",
                minHeight: "44px",
              }}
              aria-label="Message Lara"
            />
            <DemoButton
              variant="primary"
              onClick={() => inputValue.trim() && handleSendMessage(inputValue.trim())}
              disabled={!inputValue.trim()}
              ariaLabel="Send message"
              style={{ padding: "10px 14px" }}
            >
              &#9658;
            </DemoButton>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: LP ONBOARDING WIZARD DEMO
// ═══════════════════════════════════════════════════════════════════════════

function LPWizardSection() {
  const [currentStep, setCurrentStep] = useState(0);
  const step = LP_WIZARD_VISIBLE_STEPS[currentStep];

  return (
    <section aria-labelledby="lp-wizard-heading" style={{ marginBottom: "48px" }}>
      <h2 id="lp-wizard-heading" style={{ fontSize: TYPOGRAPHY.fontSize["3xl"], fontWeight: 700, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
        LP Onboarding Wizard
      </h2>
      <p style={{ fontSize: TYPOGRAPHY.fontSize.lg, color: BRAND_COLORS.textSecondary, marginBottom: "24px" }}>
        Six-step investor onboarding with SEC compliance, e-signature, and wire transfer.
      </p>

      <Card ariaLabel="LP Onboarding Wizard preview">
        {/* Step indicator */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", overflowX: "auto" }} role="tablist" aria-label="Wizard steps">
          {LP_WIZARD_VISIBLE_STEPS.map((wizardStep, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <button
                key={wizardStep.label}
                onClick={() => setCurrentStep(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: isActive ? `${BRAND_COLORS.electricBlue}10` : isCompleted ? `${BRAND_COLORS.success}10` : "transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  minHeight: "44px",
                }}
                role="tab"
                aria-selected={isActive}
                aria-label={`Step ${index + 1}: ${wizardStep.label}`}
              >
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "9999px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: TYPOGRAPHY.fontSize.xs,
                  fontWeight: 600,
                  background: isActive ? BRAND_COLORS.electricBlue : isCompleted ? BRAND_COLORS.success : BRAND_COLORS.pageBg,
                  color: isActive || isCompleted ? "#FFFFFF" : BRAND_COLORS.textMuted,
                }}>
                  {isCompleted ? "✓" : index + 1}
                </div>
                <span style={{
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? BRAND_COLORS.electricBlue : isCompleted ? BRAND_COLORS.success : BRAND_COLORS.textSecondary,
                }}>
                  {wizardStep.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div style={{ minHeight: "200px" }} role="tabpanel" aria-label={`Step ${currentStep + 1}: ${step.label}`}>
          <h3 style={{ fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: 600, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
            Step {currentStep + 1}: {step.label}
          </h3>
          <p style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary, marginBottom: "20px" }}>
            {step.description}
          </p>

          {/* Step-specific content */}
          {step.fields && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {step.fields.map((field) => (
                <div key={field}>
                  <label style={{ display: "block", fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: 500, color: BRAND_COLORS.textPrimary, marginBottom: "4px" }}>
                    {field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                  </label>
                  <input
                    type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                    placeholder={`Enter ${field}`}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: `1px solid ${BRAND_COLORS.border}`,
                      fontSize: "16px",
                      fontFamily: TYPOGRAPHY.fontFamily.primary,
                      boxSizing: "border-box",
                      minHeight: "44px",
                    }}
                    aria-label={field.replace(/([A-Z])/g, " $1")}
                  />
                </div>
              ))}
            </div>
          )}

          {step.entityTypes && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
              {step.entityTypes.map((entityType) => (
                <div
                  key={entityType}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: `1px solid ${BRAND_COLORS.border}`,
                    cursor: "pointer",
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    color: BRAND_COLORS.textPrimary,
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  role="radio"
                  aria-checked={false}
                  tabIndex={0}
                >
                  {entityType}
                </div>
              ))}
            </div>
          )}

          {step.categories && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {step.categories.map((category) => (
                <label
                  key={category}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${BRAND_COLORS.border}`,
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    color: BRAND_COLORS.textPrimary,
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                >
                  <input type="radio" name="accreditation" style={{ marginTop: "2px", width: "18px", height: "18px" }} />
                  {category}
                </label>
              ))}
            </div>
          )}

          {step.representations && (
            <div>
              <p style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: 500, color: BRAND_COLORS.textPrimary, marginBottom: "12px" }}>
                Investor Representations ({step.representationsCount} required):
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {step.representations.map((representation) => (
                  <label
                    key={representation}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: TYPOGRAPHY.fontSize.sm,
                      color: BRAND_COLORS.textPrimary,
                      cursor: "pointer",
                      lineHeight: 1.4,
                    }}
                  >
                    <input type="checkbox" style={{ marginTop: "2px", width: "18px", height: "18px", flexShrink: 0 }} />
                    {representation}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step.signingModes && (
            <div style={{
              background: `${BRAND_COLORS.success}08`,
              border: `1px solid ${BRAND_COLORS.success}30`,
              borderRadius: "8px",
              padding: "16px",
            }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.success }}>
                SignSuite E-Signature
              </p>
              {step.signingModes.map((mode) => (
                <p key={mode} style={{ margin: "4px 0", fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary }}>
                  &#8226; {mode}
                </p>
              ))}
            </div>
          )}

          {step.paymentMethod && (
            <div style={{
              background: `${BRAND_COLORS.info}08`,
              border: `1px solid ${BRAND_COLORS.info}30`,
              borderRadius: "8px",
              padding: "16px",
            }}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.info }}>
                Payment Method
              </p>
              <p style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary }}>
                {step.paymentMethod}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "16px", borderTop: `1px solid ${BRAND_COLORS.border}` }}>
          <DemoButton
            variant="secondary"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            ariaLabel="Go to previous step"
          >
            Back
          </DemoButton>
          <DemoButton
            variant="primary"
            onClick={() => setCurrentStep((prev) => Math.min(LP_WIZARD_VISIBLE_STEPS.length - 1, prev + 1))}
            disabled={currentStep === LP_WIZARD_VISIBLE_STEPS.length - 1}
            ariaLabel="Go to next step"
          >
            {currentStep === LP_WIZARD_VISIBLE_STEPS.length - 1 ? "Submit" : "Continue"}
          </DemoButton>
        </div>
      </Card>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: GP WIZARD OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

function GPWizardSection() {
  return (
    <section aria-labelledby="gp-wizard-heading" style={{ marginBottom: "48px" }}>
      <h2 id="gp-wizard-heading" style={{ fontSize: TYPOGRAPHY.fontSize["3xl"], fontWeight: 700, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
        GP Setup Wizard
      </h2>
      <p style={{ fontSize: TYPOGRAPHY.fontSize.lg, color: BRAND_COLORS.textSecondary, marginBottom: "24px" }}>
        Nine-step guided setup — live in 15 minutes. DATAROOM_ONLY mode skips steps 6-7.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {GP_WIZARD_STEPS.map((wizardStep) => (
          <div
            key={wizardStep.step}
            style={{
              background: BRAND_COLORS.cardBg,
              border: `1px solid ${BRAND_COLORS.border}`,
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
            }}
            role="article"
            aria-label={`Step ${wizardStep.step}: ${wizardStep.label}`}
          >
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "9999px",
              background: `${BRAND_COLORS.electricBlue}10`,
              color: BRAND_COLORS.electricBlue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: TYPOGRAPHY.fontSize.sm,
              flexShrink: 0,
            }}>
              {wizardStep.step}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.base, fontWeight: 600, color: BRAND_COLORS.textPrimary }}>
                {wizardStep.label}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary, lineHeight: 1.5 }}>
                {wizardStep.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: GP DASHBOARD PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

function GPDashboardPreview() {
  return (
    <section aria-labelledby="dashboard-heading" style={{ marginBottom: "48px" }}>
      <h2 id="dashboard-heading" style={{ fontSize: TYPOGRAPHY.fontSize["3xl"], fontWeight: 700, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
        GP Dashboard Preview
      </h2>
      <p style={{ fontSize: TYPOGRAPHY.fontSize.lg, color: BRAND_COLORS.textSecondary, marginBottom: "24px" }}>
        At-a-glance fund metrics with JetBrains Mono tabular numbers.
      </p>

      {/* Stat cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <MetricCard label="Total Committed" value="$2.4M" change="18%" changeDirection="up" icon="$" />
        <MetricCard label="Total Funded" value="$1.8M" change="12%" changeDirection="up" icon="&#9650;" />
        <MetricCard label="Active Investors" value="14" change="3" changeDirection="up" icon="&#128101;" />
        <MetricCard label="Pending Actions" value="7" icon="&#9888;" />
      </div>

      {/* Pipeline progress */}
      <Card title="Raise Progress" ariaLabel="Raise progress overview">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <ProgressBar value={2400000} max={5000000} label="Capital Committed" color={BRAND_COLORS.electricBlue} />
          <ProgressBar value={1800000} max={5000000} label="Capital Funded" color={BRAND_COLORS.success} />
        </div>

        {/* Pipeline stages */}
        <div style={{ marginTop: "24px" }}>
          <p style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: 500, color: BRAND_COLORS.textPrimary, marginBottom: "12px" }}>
            Investor Pipeline
          </p>
          <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", height: "32px" }}>
            {[
              { label: "Applied", count: 3, color: "#6B7280", width: "15%" },
              { label: "Under Review", count: 2, color: "#F59E0B", width: "10%" },
              { label: "Approved", count: 4, color: "#3B82F6", width: "20%" },
              { label: "Committed", count: 5, color: "#8B5CF6", width: "25%" },
              { label: "Docs Approved", count: 3, color: "#06B6D4", width: "15%" },
              { label: "Funded", count: 6, color: "#10B981", width: "15%" },
            ].map((stage) => (
              <div
                key={stage.label}
                style={{
                  width: stage.width,
                  background: stage.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
                title={`${stage.label}: ${stage.count}`}
                role="img"
                aria-label={`${stage.label}: ${stage.count} investors`}
              >
                <span style={{
                  fontSize: TYPOGRAPHY.fontSize.xs,
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontFamily: TYPOGRAPHY.fontFamily.mono,
                }}>
                  {stage.count}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
            {[
              { label: "Applied", color: "#6B7280" },
              { label: "Under Review", color: "#F59E0B" },
              { label: "Approved", color: "#3B82F6" },
              { label: "Committed", color: "#8B5CF6" },
              { label: "Docs Approved", color: "#06B6D4" },
              { label: "Funded", color: "#10B981" },
            ].map((stage) => (
              <div key={stage.label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: stage.color }} aria-hidden="true" />
                <span style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: BRAND_COLORS.textSecondary }}>{stage.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 14: SECURITY & COMPLIANCE OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════

function SecuritySection() {
  const securityFeatures = [
    { label: "AES-256-GCM Encryption", description: "SSN, EIN, wire details, and API keys encrypted at rest" },
    { label: "SHA-256 Audit Trail", description: "Hash-chained immutable log for SEC 506(c) compliance" },
    { label: "Multi-Tenant Isolation", description: "Every query filtered by org_id — zero cross-tenant data leakage" },
    { label: "RBAC (5 Roles)", description: "Owner, Super Admin, Admin, Manager, Member — enforced at edge + handler" },
    { label: "ESIGN Act / UETA", description: "Legally binding electronic signatures with consent recording" },
    { label: "CSRF + HSTS + CSP", description: "Full security header suite with custom X-Requested-With enforcement" },
  ];

  return (
    <section aria-labelledby="security-heading" style={{ marginBottom: "48px" }}>
      <h2 id="security-heading" style={{ fontSize: TYPOGRAPHY.fontSize["3xl"], fontWeight: 700, color: BRAND_COLORS.textPrimary, marginBottom: "8px" }}>
        Security & Compliance
      </h2>
      <p style={{ fontSize: TYPOGRAPHY.fontSize.lg, color: BRAND_COLORS.textSecondary, marginBottom: "24px" }}>
        Enterprise-grade security built for SEC-regulated fund operations.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {securityFeatures.map((feature) => (
          <div
            key={feature.label}
            style={{
              background: BRAND_COLORS.cardBg,
              border: `1px solid ${BRAND_COLORS.border}`,
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              gap: "14px",
              alignItems: "flex-start",
            }}
            role="article"
            aria-label={feature.label}
          >
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: `${BRAND_COLORS.success}10`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: BRAND_COLORS.success,
              flexShrink: 0,
              fontSize: "16px",
            }} aria-hidden="true">
              &#128274;
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.base, fontWeight: 600, color: BRAND_COLORS.textPrimary }}>
                {feature.label}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: TYPOGRAPHY.fontSize.sm, color: BRAND_COLORS.textSecondary, lineHeight: 1.5 }}>
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 15: MAIN DEMO COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FundRoomDemo() {
  const [activeView, setActiveView] = useState("overview");

  const navigationItems = [
    { key: "overview", label: "Platform Overview" },
    { key: "pricing", label: "Pricing" },
    { key: "lara", label: "Lara AI" },
    { key: "lp-wizard", label: "LP Wizard" },
    { key: "gp-wizard", label: "GP Wizard" },
    { key: "dashboard", label: "GP Dashboard" },
    { key: "security", label: "Security" },
  ];

  return (
    <div style={{
      fontFamily: TYPOGRAPHY.fontFamily.primary,
      background: BRAND_COLORS.pageBg,
      minHeight: "100vh",
      color: BRAND_COLORS.textPrimary,
    }}>
      {/* Header */}
      <header style={{
        background: BRAND_COLORS.deepNavy,
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
      role="banner"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: BRAND_COLORS.electricBlue,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: TYPOGRAPHY.fontSize.lg,
          }} aria-hidden="true">
            F
          </div>
          <span style={{ color: BRAND_COLORS.darkTextPrimary, fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: 700 }}>
            FundRoom AI
          </span>
          <Badge variant="custom" color={BRAND_COLORS.electricBlue} style={{ marginLeft: "8px" }}>
            Interactive Demo
          </Badge>
        </div>

        <p style={{
          margin: 0,
          color: BRAND_COLORS.darkTextMuted,
          fontSize: TYPOGRAPHY.fontSize.xs,
        }}>
          &copy; 2026 White Label Hosting Solutions
        </p>
      </header>

      {/* Navigation tabs */}
      <nav style={{
        background: BRAND_COLORS.cardBg,
        borderBottom: `1px solid ${BRAND_COLORS.border}`,
        padding: "0 32px",
        display: "flex",
        gap: "4px",
        overflowX: "auto",
      }}
      role="navigation"
      aria-label="Demo sections"
      >
        {navigationItems.map((item) => {
          const isActive = activeView === item.key;

          return (
            <button
              key={item.key}
              onClick={() => setActiveView(item.key)}
              style={{
                padding: "14px 16px",
                border: "none",
                background: "transparent",
                fontSize: TYPOGRAPHY.fontSize.sm,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? BRAND_COLORS.electricBlue : BRAND_COLORS.textSecondary,
                borderBottom: isActive ? `2px solid ${BRAND_COLORS.electricBlue}` : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minHeight: "44px",
                fontFamily: TYPOGRAPHY.fontFamily.primary,
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${item.key}`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <main style={{ maxWidth: "1440px", margin: "0 auto", padding: "32px" }} role="main">
        {activeView === "overview" && <SuiteOverviewSection />}
        {activeView === "pricing" && <PricingSection />}
        {activeView === "lara" && <LaraAISection />}
        {activeView === "lp-wizard" && <LPWizardSection />}
        {activeView === "gp-wizard" && <GPWizardSection />}
        {activeView === "dashboard" && <GPDashboardPreview />}
        {activeView === "security" && <SecuritySection />}
      </main>

      {/* Footer */}
      <footer style={{
        background: BRAND_COLORS.deepNavy,
        padding: "24px 32px",
        textAlign: "center",
      }}
      role="contentinfo"
      >
        <p style={{ margin: 0, color: BRAND_COLORS.darkTextMuted, fontSize: TYPOGRAPHY.fontSize.sm }}>
          FundRoom AI provides technology tools for fund administration and investor management.
        </p>
        <p style={{ margin: "8px 0 0", color: BRAND_COLORS.darkTextMuted, fontSize: TYPOGRAPHY.fontSize.xs }}>
          FundRoom AI is not a broker-dealer, investment adviser, or funding portal, and does not provide investment advice.
          Securities offerings are made solely by the issuing entities. All investments involve risk, including possible loss of principal.
        </p>
        <p style={{
          margin: "12px 0 0",
          color: BRAND_COLORS.darkTextMuted,
          fontSize: TYPOGRAPHY.fontSize.xs,
          fontFamily: TYPOGRAPHY.fontFamily.mono,
        }}>
          v5.0 &middot; March 2026 &middot; docs/FundRoom_v5_Demo.jsx
        </p>
      </footer>
    </div>
  );
}
