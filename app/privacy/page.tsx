import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata = { title: "Privacy Policy – Rehub" };

export default function PrivacyPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal">Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate/60">Last updated: June 2026</p>

          <div className="prose-rehub mt-10 space-y-10">
            <Section title="Who we are">
              <p>Rehub (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) provides a care communication and workflow platform for rehabilitation facilities. Our platform connects patient room screens to care team dashboards to improve response times and visibility of care requests.</p>
            </Section>

            <Section title="What data we collect">
              <p>We collect only what is necessary to operate the platform:</p>
              <ul>
                <li><strong>Account data:</strong> email address, full name, facility name, and role — provided when you sign up.</li>
                <li><strong>Facility data:</strong> facility name, join code, room numbers, and care team member names entered during setup.</li>
                <li><strong>Request data:</strong> care request text, type, priority, timestamps, and status transitions entered by facility staff or room screens.</li>
                <li><strong>Usage data:</strong> page views, feature interactions, and device type — collected to improve the product.</li>
              </ul>
              <p>We do <strong>not</strong> collect or store actual patient health records, diagnoses, medications, insurance information, or any data considered Protected Health Information (PHI) under HIPAA. Rehub is a communication coordination tool, not a medical records system.</p>
            </Section>

            <Section title="How we use your data">
              <ul>
                <li>To operate the platform and deliver care communication features</li>
                <li>To authenticate users and maintain secure sessions</li>
                <li>To sync request queues across authorized devices in real time</li>
                <li>To provide analytics on response times and request volume within your facility</li>
                <li>To send transactional emails (email verification, password reset)</li>
                <li>To improve the product and fix issues</li>
              </ul>
              <p>We do <strong>not</strong> sell your data. We do not use facility or care request data for advertising.</p>
            </Section>

            <Section title="Data storage and security">
              <p>Data is stored in Supabase (PostgreSQL) hosted on AWS infrastructure in the United States. Data is encrypted at rest and in transit (TLS 1.2+). Access is controlled via row-level security — each facility can only access its own data.</p>
              <p>We implement industry-standard security practices including environment variable isolation, secure session management, and sanitized input handling. All request text is sanitized before storage.</p>
            </Section>

            <Section title="Data sharing">
              <p>We share data only with:</p>
              <ul>
                <li><strong>Supabase:</strong> database and authentication infrastructure provider</li>
                <li><strong>Vercel:</strong> hosting and deployment provider</li>
              </ul>
              <p>We do not share your data with any other third parties. We will disclose data if required by law.</p>
            </Section>

            <Section title="Your rights">
              <p>You may request:</p>
              <ul>
                <li>A copy of the data we hold about you</li>
                <li>Correction of inaccurate data</li>
                <li>Deletion of your account and associated data</li>
              </ul>
              <p>Contact us at <a href="mailto:privacy@rehub.ai" className="text-teal hover:underline">privacy@rehub.ai</a> for any data requests. We respond within 30 days.</p>
            </Section>

            <Section title="Cookies and local storage">
              <p>We use browser localStorage to store device session information (which facility and room a device is paired to). We use cookies only for authentication session management via Supabase Auth. We do not use third-party tracking cookies or advertising cookies.</p>
            </Section>

            <Section title="HIPAA notice">
              <p>Rehub is not a HIPAA-covered entity under its current configuration. The platform is designed to coordinate care communication — not to store or process protected health information. Facilities operating under HIPAA should not enter patient names, diagnoses, or medical details into Rehub request fields. We offer Business Associate Agreements (BAA) for enterprise customers on request.</p>
            </Section>

            <Section title="Changes to this policy">
              <p>We may update this policy as the platform evolves. We will notify registered account holders of material changes via email. The &quot;last updated&quot; date at the top of this page reflects the most recent revision.</p>
            </Section>

            <Section title="Contact">
              <p>Questions about this policy: <a href="mailto:privacy@rehub.ai" className="text-teal hover:underline">privacy@rehub.ai</a></p>
            </Section>
          </div>

          <div className="mt-12 border-t border-gray-muted pt-6">
            <Link href="/terms" className="text-sm font-medium text-teal hover:underline">
              View Terms of Service →
            </Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate/80">{children}</div>
    </div>
  );
}
