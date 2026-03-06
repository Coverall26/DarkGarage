import { Metadata } from "next";
import { Shield, Lock, Eye, Server, FileCheck, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Security — FundRoom AI",
  description: "FundRoom AI security practices: encryption, compliance, and data protection.",
};

const SECURITY_AREAS = [
  {
    icon: Lock,
    title: "Encryption",
    items: [
      "AES-256-GCM encryption for all sensitive data (SSN, EIN, wire details, signatures)",
      "TLS 1.3 for all data in transit",
      "Encryption keys managed via environment variables, never committed to source",
      "Per-organization encryption key derivation using HKDF",
    ],
  },
  {
    icon: Shield,
    title: "Authentication & Authorization",
    items: [
      "NextAuth with email/password (bcrypt, 12 salt rounds) and Google OAuth",
      "Edge-level JWT validation on ALL API routes via proxy middleware",
      "5-layer defense-in-depth: edge auth → admin auth → RBAC → domain middleware → business logic",
      "Rate limiting: blanket 200/min + per-route tiers (auth 10/hr, strict 3/hr, MFA 5/15min)",
    ],
  },
  {
    icon: Eye,
    title: "Multi-Tenant Isolation",
    items: [
      "Every database table includes org_id — every query is scoped by organization",
      "RBAC: Owner, Super Admin, Admin, Manager, Member roles with per-action enforcement",
      "Cross-tenant data access is architecturally impossible via query-level isolation",
      "CRM contacts, documents, funds, and investors are all team-scoped",
    ],
  },
  {
    icon: FileCheck,
    title: "Compliance",
    items: [
      "SEC Rule 506(b) and 506(c) compliance built into investor onboarding",
      "ESIGN Act and UETA compliant native e-signature system",
      "SHA-256 hash-chained immutable audit logs for regulatory examination",
      "Form D data export with all required SEC fields",
      "Accreditation verification tracking with expiration management",
    ],
  },
  {
    icon: Server,
    title: "Infrastructure",
    items: [
      "Deployed on Vercel with automatic DDoS protection",
      "PostgreSQL on Supabase with connection pooling and health monitoring",
      "Content Security Policy, HSTS (2-year preload), X-Frame-Options headers",
      "CSRF protection with origin validation + custom header fallback",
      "Bot protection via Vercel Bot ID",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Incident Response",
    items: [
      "Rollbar error monitoring with PagerDuty alerting for critical failures",
      "Security incident fingerprinting for auth brute force and unusual access",
      "Anomaly detection on login patterns and data access",
      "Structured JSON logging with request tracing for forensic analysis",
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Security at FundRoom AI
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-lg text-gray-600">
            Your fund data deserves enterprise-grade protection. Here&apos;s how we
            keep it safe.
          </p>
        </div>

        {/* Security areas */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SECURITY_AREAS.map((area) => (
            <div
              key={area.title}
              className="rounded-xl border border-gray-200 bg-white p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <area.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {area.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {area.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Reporting */}
        <div className="mt-16 rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Report a Vulnerability
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            If you discover a security vulnerability, please report it responsibly.
          </p>
          <a
            href="mailto:security@fundroom.ai"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            security@fundroom.ai
          </a>
        </div>
      </div>
    </div>
  );
}
