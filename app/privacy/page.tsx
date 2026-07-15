import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata = {
  title: "Privacy Policy – Rehub",
  description: "How Rehub collects, uses, and protects your data.",
};

const UPDATED = "June 21, 2026";
const CONTACT = "privacy@rehub.ai";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal">Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate/60">Last updated: {UPDATED}</p>

          <p className="mt-6 text-sm leading-relaxed text-slate">
            Rehub (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates a care
            communication and workflow platform for rehabilitation facilities. This Privacy Policy
            explains how we collect, use, and protect information about facility administrators,
            care team members, and the devices used in patient rooms.
          </p>

          <Section title="1. What we collect">
            <p><strong>Account information:</strong> When a facility director creates an account we
            collect their name, work email address, and facility name.</p>
            <p><strong>Facility configuration:</strong> Room numbers, display names, team member
            names, and roles set up during onboarding.</p>
            <p><strong>Request data:</strong> Text entered or spoken by residents into room screens,
            including the auto-classified type, priority score, and timestamps. This is operational
            workflow data — not medical records.</p>
            <p><strong>Usage data:</strong> Page views, feature interactions, and error logs used
            to improve the platform. We do not sell this data.</p>
            <p><strong>We do not collect:</strong> Medical diagnoses, treatment plans, insurance
            information, Social Security numbers, financial data, or any data considered Protected
            Health Information (PHI) under HIPAA. Rehub is a communication workflow tool, not a
            medical records system.</p>
          </Section>

          <Section title="2. How we use it">
            <p>To operate the platform — routing requests from room screens to care team dashboards.</p>
            <p>To send email verification and account management messages.</p>
            <p>To analyze aggregate usage patterns (anonymized) for product improvement.</p>
            <p>We never sell, rent, or share individual facility data with third parties for
            marketing purposes.</p>
          </Section>

          <Section title="3. Data isolation">
            <p>Each facility&rsquo;s data is isolated by a unique facility identifier with
            row-level security enforced at the database level. A user from one facility cannot
            access another facility&rsquo;s data through the application or API.</p>
            <p>Demo session data is stored locally in your browser and expires automatically after
            2 hours. It is never transmitted to our servers.</p>
          </Section>

          <Section title="4. Data storage and security">
            <p>Production data is stored in Supabase (PostgreSQL), hosted on AWS infrastructure
            with encryption at rest and in transit (TLS 1.2+).</p>
            <p>We apply security headers (HSTS, CSP, X-Frame-Options) to every response.
            Authentication is handled by Supabase Auth with hashed passwords and optional
            two-factor authentication.</p>
            <p>Audit logs record every status transition on care requests so facility
            administrators can review activity.</p>
          </Section>

          <Section title="5. Data retention">
            <p>Request history is retained for 12 months from the date of creation, then
            automatically deleted unless a longer retention period is required by your
            facility&rsquo;s policies.</p>
            <p>Account data is retained for as long as the account is active. You may request
            deletion at any time.</p>
          </Section>

          <Section title="6. HIPAA notice">
            <p>Rehub is a <strong>care coordination and communication tool, not a medical records
            system.</strong> The platform does not store Protected Health Information (PHI) as
            defined under HIPAA. Residents&rsquo; requests are operational workflow notes, not
            clinical records.</p>
            <p>If your facility requires a Business Associate Agreement (BAA) for HIPAA compliance,
            please contact us. BAAs are available to facilities on our Enterprise plan.</p>
          </Section>

          <Section title="7. Cookies">
            <p>We use session cookies required for authentication (Supabase Auth). We do not use
            advertising, tracking, or cross-site cookies.</p>
          </Section>

          <Section title="8. Your rights">
            <p>You may request a copy of, correction to, or deletion of your account data at any
            time by emailing <a href={`mailto:${CONTACT}`} className="text-teal hover:underline">{CONTACT}</a>.</p>
            <p>Facility administrators can export all request history via the Analytics page as CSV.</p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>We will notify facility administrators by email at least 14 days before any material
            changes to this policy take effect.</p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about this policy: <a href={`mailto:${CONTACT}`} className="text-teal hover:underline">{CONTACT}</a>
            </p>
          </Section>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
