import { Metadata } from "next";
import Link from "next/link";
import {
  FileCheck,
  Shield,
  ScrollText,
  Users,
  Scale,
  ClipboardCheck,
  Building2,
  BookOpen,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Compliance — FundRoom AI",
  description:
    "SEC compliance, regulatory framework, and investor protection standards built into FundRoom AI.",
};

const COMPLIANCE_SECTIONS = [
  {
    icon: Scale,
    title: "Regulation D Exemptions",
    description:
      "FundRoom supports all major SEC Regulation D exemptions for private placements.",
    items: [
      "Rule 506(b): Private offering to up to 35 non-accredited investors (no general solicitation)",
      "Rule 506(c): General solicitation permitted — all investors must be verified accredited",
      "Regulation A+: Tier 1 (up to $20M) and Tier 2 (up to $75M) mini-IPO offerings",
      "Rule 504: Offerings up to $10M in a 12-month period with state-level registration",
    ],
  },
  {
    icon: Users,
    title: "Accreditation Verification",
    description:
      "Built-in accreditation tracking for all seven SEC-recognized entity types.",
    items: [
      "Individual, Joint, Trust/Estate, LLC/Corporation, Partnership, IRA/Retirement, and Charity/Foundation entity support",
      "Income verification ($200K individual / $300K joint), net worth ($1M+), or professional certification (Series 7/65/82)",
      "Self-certification with attestation recording (IP, timestamp, user-agent) for 506(b)",
      "Third-party verification document tracking with expiration management for 506(c)",
      "Entity-specific criteria: $5M assets for trusts/LLCs, all owners accredited for partnerships",
    ],
  },
  {
    icon: ScrollText,
    title: "Form D Filing Support",
    description:
      "Automated data collection for SEC Form D (OMB Control Number 3235-0076).",
    items: [
      "Section 1 (Issuer Identity): Legal name, CIK number, jurisdiction, previous names",
      "Section 2 (Principal Place of Business): Full address with SEC-required formatting",
      "Section 3 (Related Persons): Executive officers, directors, promoters with relationship type",
      "Section 6 (Federal Exemption): Auto-mapped from fund configuration (506(b), 506(c), Reg A+, Rule 504)",
      "Sections 13-14 (Offering Amounts & Investors): Real-time aggregation from investment records",
      "Export to CSV and JSON for direct filing with SEC EDGAR",
    ],
  },
  {
    icon: FileCheck,
    title: "ESIGN Act & UETA Compliance",
    description:
      "Native e-signature system (SignSuite) is fully compliant with federal and state electronic signature laws.",
    items: [
      "ESIGN Act (15 U.S.C. §§ 7001-7006): Affirmative consent recorded before each signing with full disclosure",
      "UETA (Uniform Electronic Transactions Act): Intent-to-sign captured via explicit action (draw, type, or upload)",
      "SHA-256 content hashing on every signed document for tamper detection",
      "Certificate of Completion appended to every signed PDF with signer details, timestamps, and IP addresses",
      "Immutable signing audit trail: signer identity, consent timestamp, IP, user-agent, document hash",
    ],
  },
  {
    icon: Shield,
    title: "Audit Trail & Record Keeping",
    description:
      "SEC-grade immutable audit logging for every material action on the platform.",
    items: [
      "SHA-256 hash-chained immutable audit log — each entry references the previous entry's hash",
      "39 event types tracked: investor onboarding, document signing, wire transfers, approvals, stage changes",
      "Every log entry includes: org_id, actor, action, resource_type, resource_id, IP, user-agent, timestamp",
      "Configurable retention periods (1-10 years) to meet fund-specific regulatory requirements",
      "Export capability for regulatory examination and external auditor access",
    ],
  },
  {
    icon: Building2,
    title: "Investment Company Act",
    description:
      "Support for Investment Company Act exemptions commonly used by private funds.",
    items: [
      "Section 3(c)(1): Funds with fewer than 100 beneficial owners of outstanding securities",
      "Section 3(c)(7): Funds limited to qualified purchasers — investor qualification tracked per entity",
      "Bad Actor Disqualification (Rule 506(d)): GP certification captured during fund setup with signer name, title, and date",
    ],
  },
  {
    icon: ClipboardCheck,
    title: "Investor Representations",
    description:
      "Eight SEC-required investor representations collected and timestamped during commitment.",
    items: [
      "Accredited investor certification under SEC Rule 501(a)",
      "Principal investment confirmation (not acting as agent or nominee)",
      "Offering document acknowledgment (read and understood)",
      "Risk awareness acknowledgment (possibility of total loss of investment)",
      "Restricted securities acknowledgment (no guaranteed liquidity)",
      "Anti-Money Laundering (AML) and OFAC compliance certification",
      "Tax ID consent for K-1 preparation",
      "Independent advice acknowledgment (no reliance on platform for investment decisions)",
    ],
  },
  {
    icon: BookOpen,
    title: "Data Protection & Encryption",
    description:
      "All sensitive investor data is encrypted at rest using AES-256-GCM.",
    items: [
      "SSN and EIN: AES-256-GCM encrypted, masked in UI (last 4 digits only)",
      "Wire transfer details: Account numbers and routing numbers encrypted at rest",
      "Signature images: Encrypted before storage, decrypted only during signing session",
      "Multi-tenant isolation: Every query is org-scoped — cross-tenant data access is architecturally impossible",
      "TLS 1.3 for all data in transit between client, server, and database",
    ],
  },
];

export default function CompliancePage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            SEC Compliance & Regulatory Framework
          </h1>
          <p className="mt-4 mx-auto max-w-3xl text-lg text-gray-600">
            FundRoom AI embeds compliance into every workflow — from investor
            accreditation to Form D filing. Built for fund managers who need
            audit-ready operations from day one.
          </p>
        </div>

        {/* Disclaimer banner */}
        <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
          <strong>Important:</strong> FundRoom AI provides technology tools for
          compliance workflow management. FundRoom AI is not a law firm,
          broker-dealer, or investment adviser and does not provide legal or
          investment advice. Consult qualified legal counsel for
          compliance-specific guidance.
        </div>

        {/* Compliance sections */}
        <div className="mt-16 space-y-12">
          {COMPLIANCE_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <section.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {section.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {section.description}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-sm text-gray-600"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Related links */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <Link
            href="/security"
            className="rounded-xl border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">
              Security Practices
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Encryption standards, authentication, and infrastructure
              security.
            </p>
          </Link>
          <Link
            href="/privacy"
            className="rounded-xl border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">Privacy Policy</h3>
            <p className="mt-1 text-sm text-gray-600">
              Data collection, usage, retention, and your rights.
            </p>
          </Link>
          <Link
            href="/terms"
            className="rounded-xl border border-gray-200 bg-white p-6 hover:border-gray-300 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">
              Terms of Service
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              User obligations, liability, and governing law.
            </p>
          </Link>
        </div>

        {/* Contact */}
        <div className="mt-12 rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Compliance Questions?
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            For regulatory or compliance inquiries, contact our team.
          </p>
          <a
            href="mailto:compliance@fundroom.ai"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            compliance@fundroom.ai
          </a>
        </div>
      </div>
    </div>
  );
}
