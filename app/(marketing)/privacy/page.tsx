import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — FundRoom AI",
  description: "FundRoom AI Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: February 26, 2026</p>

      <div className="prose prose-gray mt-8 max-w-none text-sm leading-relaxed">
        <h2 className="text-lg font-semibold text-gray-900 mt-8">1. Information We Collect</h2>
        <p className="text-gray-600 mt-2">
          We collect information you provide directly: name, email, phone number, organization
          details, and financial information necessary for fund operations. We also collect usage
          data (pages visited, features used, session duration) and device information (browser
          type, IP address, operating system).
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">2. Sensitive Financial Data</h2>
        <p className="text-gray-600 mt-2">
          Social Security Numbers (SSN), Employer Identification Numbers (EIN), wire transfer
          details (account numbers, routing numbers), and signature images are encrypted using
          AES-256-GCM before storage. These values are never logged, cached in plaintext, or
          exposed in API responses. Access is restricted to the data owner and authorized
          administrators with a valid audit trail.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">3. How We Use Your Information</h2>
        <p className="text-gray-600 mt-2">
          We use your information to: (a) provide and maintain the Service; (b) process
          investor onboarding and fund operations; (c) send transactional emails (verification,
          wire confirmations, document notifications); (d) comply with legal obligations including
          SEC regulations; (e) improve and optimize the Service; (f) prevent fraud and abuse.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">4. Multi-Tenant Data Isolation</h2>
        <p className="text-gray-600 mt-2">
          Every database query is scoped by organization ID (org_id). Your data is never
          accessible to users outside your organization. Each tenant&apos;s data is logically
          isolated at the application and database level.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">5. Data Sharing</h2>
        <p className="text-gray-600 mt-2">
          We do not sell your personal information. We share data only with: (a) service providers
          necessary to operate the platform (cloud hosting, email delivery, payment processing);
          (b) as required by law, regulation, or legal process; (c) to protect the rights, safety,
          or property of FundRoom AI, our users, or the public.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">6. Third-Party Services</h2>
        <p className="text-gray-600 mt-2">
          We use the following categories of service providers: cloud infrastructure (Vercel,
          AWS/Cloudflare for storage), database (Supabase/PostgreSQL), email delivery (Resend),
          payment processing (Stripe), error monitoring (Rollbar), and analytics (PostHog —
          opt-in, respects cookie consent).
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">7. Cookies & Tracking</h2>
        <p className="text-gray-600 mt-2">
          We use essential cookies for authentication and session management. Analytics cookies
          (PostHog) are only activated after explicit user consent via our cookie consent banner.
          We respect Do Not Track (DNT) browser signals.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">8. Data Retention</h2>
        <p className="text-gray-600 mt-2">
          We retain your data for as long as your account is active or as needed to provide the
          Service. Audit logs are retained per your organization&apos;s configured retention
          period (default: 7 years for SEC compliance). Upon account deletion, personal data is
          removed within 30 days, except where retention is required by law.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">9. Your Rights</h2>
        <p className="text-gray-600 mt-2">
          You have the right to: (a) access your personal data; (b) correct inaccurate data;
          (c) delete your data (subject to legal retention requirements); (d) export your data
          in machine-readable format; (e) object to data processing; (f) withdraw consent for
          analytics tracking at any time.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">10. Security Measures</h2>
        <p className="text-gray-600 mt-2">
          We implement security measures including: AES-256-GCM encryption at rest, TLS 1.3 in
          transit, RBAC with edge-level JWT enforcement, rate limiting, CSRF protection,
          Content Security Policy headers, and regular security audits.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">11. Children&apos;s Privacy</h2>
        <p className="text-gray-600 mt-2">
          The Service is not intended for use by individuals under 18 years of age. We do not
          knowingly collect personal information from children.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">12. Changes to This Policy</h2>
        <p className="text-gray-600 mt-2">
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by email or through the Service at least 30 days before they take effect.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">13. Contact</h2>
        <p className="text-gray-600 mt-2">
          For privacy-related inquiries, contact our Data Protection Officer at{" "}
          <a href="mailto:privacy@fundroom.ai" className="text-[#0066FF] hover:underline">
            privacy@fundroom.ai
          </a>.
        </p>
      </div>
    </div>
  );
}
