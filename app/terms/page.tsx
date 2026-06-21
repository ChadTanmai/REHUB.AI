import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata = {
  title: "Terms of Service – Rehub",
  description: "Terms governing use of the Rehub care communication platform.",
};

const UPDATED = "June 21, 2026";
const CONTACT = "legal@rehub.ai";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal">Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate/60">Last updated: {UPDATED}</p>

          <p className="mt-6 text-sm leading-relaxed text-slate">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Rehub platform
            operated by Rehub AI, Inc. (&ldquo;Rehub&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;).
            By creating an account or using the platform you agree to these Terms.
          </p>

          <Section title="1. The service">
            <p>Rehub is a care communication and workflow platform for rehabilitation facilities.
            It allows residents to submit requests from room devices and enables care teams to
            manage and respond to those requests through a shared dashboard.</p>
            <p><strong>Rehub is not a medical device, clinical decision support system, or
            emergency response system.</strong> It does not replace call lights, emergency
            protocols, or clinical judgment. Do not rely on Rehub for emergency communications.</p>
          </Section>

          <Section title="2. Accounts and access">
            <p>Facility accounts must be created by an authorized representative of the
            rehabilitation facility (a &ldquo;Facility Administrator&rdquo;).</p>
            <p>You are responsible for maintaining the confidentiality of your credentials and
            for all activity under your account.</p>
            <p>You must not share login credentials across staff members. Each care team member
            should have their own session.</p>
            <p>We reserve the right to suspend accounts that violate these Terms or applicable law.</p>
          </Section>

          <Section title="3. Acceptable use">
            <p>You agree not to:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Enter real patient PHI (Protected Health Information) into the platform unless
              you have a signed Business Associate Agreement with Rehub</li>
              <li>Attempt to access another facility&rsquo;s data</li>
              <li>Reverse-engineer, scrape, or resell the platform</li>
              <li>Use the platform to transmit malware, spam, or illegal content</li>
              <li>Attempt to circumvent authentication or authorization controls</li>
            </ul>
          </Section>

          <Section title="4. Data and privacy">
            <p>Our collection and use of data is governed by our{" "}
              <a href="/privacy" className="text-teal hover:underline">Privacy Policy</a>,
              which is incorporated into these Terms by reference.
            </p>
            <p>You retain ownership of all data you enter into the platform. We process it only
            as necessary to provide the service.</p>
          </Section>

          <Section title="5. Uptime and reliability">
            <p>We target 99.5% monthly uptime for the platform, excluding scheduled maintenance.
            We will provide at least 24 hours notice before planned downtime affecting
            operational workflows.</p>
            <p>The platform is provided with commercially reasonable care but without a
            warranty of uninterrupted availability.</p>
          </Section>

          <Section title="6. Limitation of liability">
            <p>Rehub is not liable for any indirect, incidental, or consequential damages
            arising from use of the platform, including but not limited to missed care
            requests, response delays, or data loss.</p>
            <p>Our total liability to you for any claim arising from these Terms shall not
            exceed the fees paid by you in the 12 months preceding the claim.</p>
          </Section>

          <Section title="7. Safety requirement">
            <p>Facilities using Rehub must maintain all existing emergency call systems,
            nursing call lights, and emergency protocols independent of this platform.
            Rehub supplements — it does not replace — existing safety infrastructure.</p>
          </Section>

          <Section title="8. Termination">
            <p>Either party may terminate at any time. Upon termination you may export your
            data for 30 days. After 30 days, data is deleted per our retention policy.</p>
          </Section>

          <Section title="9. Changes">
            <p>We will notify Facility Administrators at least 14 days before material changes
            to these Terms. Continued use after that date constitutes acceptance.</p>
          </Section>

          <Section title="10. Contact">
            <p>
              Legal questions: <a href={`mailto:${CONTACT}`} className="text-teal hover:underline">{CONTACT}</a>
            </p>
          </Section>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
