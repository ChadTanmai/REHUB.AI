import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata = { title: "Terms of Service – Rehub" };

export default function TermsPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal">Legal</p>
          <h1 className="mt-2 text-3xl font-bold text-navy">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate/60">Last updated: June 2026</p>

          <div className="mt-10 space-y-10">
            <Section title="Acceptance of terms">
              <p>By accessing or using the Rehub platform (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you are using the Service on behalf of a facility or organization, you represent that you have authority to bind that organization.</p>
            </Section>

            <Section title="Description of service">
              <p>Rehub provides a digital care communication platform that connects patient room screens to care team dashboards in rehabilitation facilities. The Service is a coordination and communication tool — it is not a medical device, clinical decision support system, or electronic health records (EHR) system.</p>
            </Section>

            <Section title="Not a medical device">
              <p><strong>The Rehub platform is not a medical device and does not provide medical advice, diagnosis, or treatment.</strong> The AI-assisted prioritization features are keyword-based workflow tools designed to help staff triage incoming requests. They do not assess clinical severity and must not be used as a substitute for clinical judgment.</p>
              <p>In any medical emergency, contact emergency services immediately. Rehub is not a replacement for emergency call systems, nurse call systems, or direct clinical assessment.</p>
            </Section>

            <Section title="Facility account responsibilities">
              <p>The facility account holder (typically the Director of Nursing or facility administrator) is responsible for:</p>
              <ul>
                <li>Ensuring all care team members understand the platform is a communication aid, not a clinical system</li>
                <li>Not entering protected health information (PHI) including diagnoses, medications, or insurance data into request fields</li>
                <li>Maintaining the security of facility join codes and staff login credentials</li>
                <li>Ensuring patient room devices are only accessible to the intended patient</li>
                <li>Complying with all applicable healthcare regulations in their jurisdiction</li>
              </ul>
            </Section>

            <Section title="Acceptable use">
              <p>You agree not to use the Service to:</p>
              <ul>
                <li>Store or process actual patient health records or PHI</li>
                <li>Circumvent or disable any security feature</li>
                <li>Transmit malicious code or interfere with the platform&apos;s operation</li>
                <li>Share facility join codes publicly or with unauthorized parties</li>
                <li>Use the Service in any way that violates applicable law</li>
              </ul>
            </Section>

            <Section title="Demo and pilot use">
              <p>Rehub may be used in a free demo or pilot mode without a paid subscription. Demo mode uses fictional data only. No real patient information should be entered in demo mode. Pilot use is subject to the same terms as paid use.</p>
            </Section>

            <Section title="Intellectual property">
              <p>The Rehub platform, including its software, design, and content, is owned by Rehub and protected by applicable intellectual property law. You may not copy, modify, distribute, or reverse engineer any part of the Service.</p>
              <p>Data you enter into the platform (facility information, request data) remains yours. You grant Rehub a limited license to store and process it solely to deliver the Service.</p>
            </Section>

            <Section title="Limitation of liability">
              <p>To the maximum extent permitted by law, Rehub shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to delays in care delivery, miscommunication between care team members, or reliance on AI priority classifications. Your use of the Service is at your own risk.</p>
            </Section>

            <Section title="Indemnification">
              <p>You agree to indemnify and hold harmless Rehub and its officers, directors, employees, and agents from any claims, damages, or expenses (including reasonable attorneys&apos; fees) arising from your use of the Service, violation of these Terms, or violation of any third-party rights.</p>
            </Section>

            <Section title="Service availability">
              <p>We aim for high availability but do not guarantee uninterrupted service. We are not liable for downtime or data loss. We recommend facilities maintain backup communication procedures independent of Rehub.</p>
            </Section>

            <Section title="Termination">
              <p>We reserve the right to suspend or terminate accounts that violate these Terms. You may delete your account at any time. Upon termination, your data will be deleted within 30 days unless retention is required by law.</p>
            </Section>

            <Section title="Changes to terms">
              <p>We may update these Terms. Material changes will be communicated to account holders via email. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
            </Section>

            <Section title="Governing law">
              <p>These Terms are governed by the laws of the United States. Any disputes shall be resolved in the appropriate courts of the United States.</p>
            </Section>

            <Section title="Contact">
              <p>For legal inquiries: <a href="mailto:legal@rehub.ai" className="text-teal hover:underline">legal@rehub.ai</a></p>
            </Section>
          </div>

          <div className="mt-12 border-t border-gray-muted pt-6">
            <Link href="/privacy" className="text-sm font-medium text-teal hover:underline">
              View Privacy Policy →
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
