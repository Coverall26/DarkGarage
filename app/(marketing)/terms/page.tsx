import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — FundRoom AI",
  description: "FundRoom AI Terms of Service and acceptable use policy.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: February 26, 2026</p>

      <div className="prose prose-gray mt-8 max-w-none text-sm leading-relaxed">
        <h2 className="text-lg font-semibold text-gray-900 mt-8">1. Acceptance of Terms</h2>
        <p className="text-gray-600 mt-2">
          By accessing or using FundRoom AI (&quot;Service&quot;), you agree to be bound by these Terms
          of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not use the
          Service. These Terms apply to all users, including general partners (&quot;GPs&quot;),
          limited partners (&quot;LPs&quot;), and any other visitors or users of the platform.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">2. Description of Service</h2>
        <p className="text-gray-600 mt-2">
          FundRoom AI provides a multi-tenant SaaS platform for fund management, investor onboarding,
          electronic signatures, document sharing, and compliance management. The Service includes
          dataroom functionality, CRM tools, wire transfer tracking, and SEC compliance features.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">3. User Accounts</h2>
        <p className="text-gray-600 mt-2">
          You must provide accurate, complete information when creating an account. You are responsible
          for maintaining the confidentiality of your account credentials. You must notify us
          immediately of any unauthorized use of your account.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">4. Acceptable Use</h2>
        <p className="text-gray-600 mt-2">
          You agree not to: (a) use the Service for any unlawful purpose; (b) attempt to gain
          unauthorized access to any part of the Service; (c) interfere with the Service&apos;s
          operation; (d) upload malicious content; (e) violate applicable securities laws;
          (f) misrepresent your identity or accreditation status.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">5. Electronic Signatures</h2>
        <p className="text-gray-600 mt-2">
          The Service provides electronic signature functionality compliant with the Electronic
          Signatures in Global and National Commerce Act (ESIGN Act) and the Uniform Electronic
          Transactions Act (UETA). By using the e-signature features, you consent to conducting
          transactions electronically and agree that electronic signatures have the same legal
          effect as handwritten signatures.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">6. Data Security</h2>
        <p className="text-gray-600 mt-2">
          We employ industry-standard security measures including AES-256-GCM encryption for
          sensitive data, multi-tenant isolation, and immutable audit trails. However, no method
          of electronic storage is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">7. Intellectual Property</h2>
        <p className="text-gray-600 mt-2">
          The Service, including its design, features, and content, is owned by FundRoom AI, Inc.
          You retain ownership of your data. By uploading content to the Service, you grant us a
          limited license to store, process, and display that content as necessary to provide
          the Service.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">8. Subscription & Billing</h2>
        <p className="text-gray-600 mt-2">
          Paid plans are billed monthly or annually as selected. Prices are subject to change with
          30 days&apos; notice. Downgrades take effect at the end of the current billing period.
          Refunds are handled on a case-by-case basis.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">9. Limitation of Liability</h2>
        <p className="text-gray-600 mt-2">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, FUNDROOM AI SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR TOTAL LIABILITY SHALL NOT
          EXCEED THE AMOUNT PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">10. Disclaimer</h2>
        <p className="text-gray-600 mt-2">
          FundRoom AI is not a registered broker-dealer, investment adviser, or law firm. The
          Service provides tools for fund management but does not constitute legal, tax, or
          investment advice. Users are responsible for ensuring their own compliance with
          applicable securities laws and regulations.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">11. Governing Law</h2>
        <p className="text-gray-600 mt-2">
          These Terms shall be governed by the laws of the State of Delaware, without regard to
          conflict of law principles. Any disputes shall be resolved through binding arbitration
          in accordance with the rules of the American Arbitration Association.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">12. Contact</h2>
        <p className="text-gray-600 mt-2">
          For questions about these Terms, contact us at{" "}
          <a href="mailto:legal@fundroom.ai" className="text-[#0066FF] hover:underline">
            legal@fundroom.ai
          </a>.
        </p>
      </div>
    </div>
  );
}
