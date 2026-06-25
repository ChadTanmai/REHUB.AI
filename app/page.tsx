import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Hero from "@/components/marketing/Hero";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/marketing/motion";
import SafetyNote from "@/components/SafetyNote";

/* ─── Data ──────────────────────────────────────────────────────────────── */

const BUILT_FOR = [
  "Inpatient rehabilitation facilities",
  "Skilled nursing facilities",
  "Senior living communities",
  "Assisted living residences",
  "Post-acute care teams",
];

const WORKFLOW = [
  {
    phase: "Request",
    heading: "Residents communicate their needs",
    body: "A dedicated tablet in each room. Residents tap a large button or speak naturally — the system classifies the request by type and urgency, then asks for confirmation before anything is sent. No app to install. No training required.",
    details: ["Voice, button, or typed input", "Deterministic urgency scoring", "Resident confirms before sending"],
  },
  {
    phase: "Route",
    heading: "Requests reach the right staff, instantly",
    body: "Every confirmed request enters a shared facility queue. It's prioritized by clinical urgency and time waiting, then broadcast to every subscribed therapist dashboard over the facility network. Urgent requests surface in a persistent alert strip.",
    details: ["Real-time facility-wide queue", "Priority: Urgent → Important → Routine", "Persistent alert strip for urgent items"],
  },
  {
    phase: "Respond",
    heading: "Staff acknowledge, act, and resolve",
    body: "Therapists see the full context: room, request type, AI summary, transcript, priority score, and how long the resident has been waiting. They acknowledge, assign, mark in-progress, and resolve — every action is timestamped for response-time analytics.",
    details: ["One-click status transitions", "Immutable audit trail", "Resident screen updates in real time"],
  },
  {
    phase: "Analyze",
    heading: "Administrators understand the workflow",
    body: "Response times, request volume, staff coverage, common request types — all visible in the admin dashboard. Identify patterns before they become problems. Export to CSV for compliance and operations reviews.",
    details: ["Response-time trends by shift", "Request volume by type and room", "CSV export for compliance"],
  },
];

const CAPABILITIES = [
  { title: "Facility-wide real-time sync", body: "Patient rooms, therapist dashboards, and admin consoles share one live workspace. Updates propagate across all devices within seconds." },
  { title: "Transparent priority model", body: "Every score traces to a keyword and a weight. Urgent safety phrases are hard-coded to surface immediately. No opaque ML — every decision is auditable." },
  { title: "Self-serve facility setup", body: "Create a facility, pair room tablets and staff devices with a short code. Most communities are fully operational in under ten minutes." },
  { title: "National directory integration", body: "Search 1,200+ CMS-registered rehabilitation facilities during onboarding. Selecting your facility auto-fills address, phone, and certification data." },
  { title: "Designed for accessibility", body: "High-contrast, large tap targets, plain language, voice input with typed fallback. Usable by an elderly resident on an iPad without assistance." },
  { title: "Production-ready data architecture", body: "Supabase Postgres with row-level security, Realtime subscriptions, an immutable event log, and a documented path to HIPAA-ready deployment." },
];

const METRICS = [
  { value: "1,221", label: "US rehab facilities in the directory" },
  { value: "< 5 min", label: "Typical facility setup time" },
  { value: "Real-time", label: "Request delivery to staff" },
  { value: "100%", label: "Offline-capable demo mode" },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <Hero />

        {/* Trust band — who this is for */}
        <section className="border-y border-gray-muted bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-slate/50">
              Purpose-built for
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
              {BUILT_FOR.map((b) => (
                <span key={b} className="whitespace-nowrap text-sm font-medium text-slate/70">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — workflow, not numbered cards */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                System workflow
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
                A closed-loop communication system, from request to resolution.
              </h2>
            </Reveal>

            <div className="mt-14 space-y-0">
              {WORKFLOW.map((w, i) => (
                <Reveal key={w.phase} delay={i * 0.04}>
                  <div className="grid gap-6 border-t border-gray-muted py-10 md:grid-cols-[160px_1fr_280px]">
                    <div>
                      <span className="inline-block rounded-md bg-navy px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                        {w.phase}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-navy">{w.heading}</h3>
                      <p className="mt-3 max-w-xl leading-relaxed text-slate/80">{w.body}</p>
                    </div>
                    <ul className="space-y-2 text-sm text-slate/70">
                      {w.details.map((d) => (
                        <li key={d} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Metrics band */}
        <section className="border-y border-gray-muted bg-navy">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <StaggerGroup className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {METRICS.map((m) => (
                <StaggerItem key={m.label} className="text-center">
                  <p className="text-3xl font-bold text-white">{m.value}</p>
                  <p className="mt-1 text-sm text-mint">{m.label}</p>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* Platform capabilities */}
        <section id="product" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                Platform
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-snug text-navy sm:text-4xl">
                Infrastructure for care communication — not a chatbot.
              </h2>
              <p className="mt-4 max-w-2xl text-slate/80">
                Rehub is a connected facility system. Room screens, therapist
                dashboards, and admin consoles share one real-time workspace.
              </p>
            </Reveal>

            <StaggerGroup className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-gray-muted bg-gray-muted sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((c) => (
                <StaggerItem key={c.title}>
                  <div className="h-full bg-white p-6">
                    <h3 className="text-base font-semibold text-navy">{c.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate/80">{c.body}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* Architecture summary */}
        <section className="border-y border-gray-muted bg-mint/20">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                Architecture
              </p>
              <h2 className="mt-3 text-2xl font-bold text-navy sm:text-3xl">
                How Rehub connects your facility
              </h2>
              <div className="mt-8 rounded-xl border border-gray-muted bg-white p-6 font-mono text-sm leading-loose text-slate shadow-soft">
                <p className="text-navy">
                  <span className="text-teal">Room tablet</span> → submits request →{" "}
                  <span className="text-teal">Rehub backend</span>
                </p>
                <p className="text-navy">
                  <span className="text-teal">Rehub backend</span> → classifies, scores, stores →{" "}
                  <span className="text-teal">Facility queue</span>
                </p>
                <p className="text-navy">
                  <span className="text-teal">Facility queue</span> → broadcasts via Realtime →{" "}
                  <span className="text-teal">Therapist dashboards</span>
                </p>
                <p className="text-navy">
                  <span className="text-teal">Therapist</span> → acknowledge / resolve →{" "}
                  <span className="text-teal">Room screen updates</span>
                </p>
                <p className="mt-4 text-xs text-slate/60">
                  Devices never communicate directly. All data flows through the
                  Rehub backend, scoped to a single facility workspace.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA — enterprise: request demo is primary, self-serve is secondary */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <div className="rounded-2xl border border-gray-muted bg-white p-8 shadow-panel sm:p-12">
              <div className="grid items-center gap-10 lg:grid-cols-[1.5fr_1fr]">
                <div>
                  <h2 className="text-3xl font-bold text-navy sm:text-4xl">
                    See Rehub in your facility.
                  </h2>
                  <p className="mt-4 max-w-xl text-lg text-slate">
                    Schedule a 30-minute walkthrough with our team. We&apos;ll
                    configure a demo with your rooms, your workflow, and your
                    priorities — so you see exactly how it fits.
                  </p>
                  <p className="mt-3 text-sm text-slate/60">
                    Or try the self-serve setup if you want to explore on your own first.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/contact"
                    className="rounded-lg bg-navy px-6 py-3.5 text-center text-base font-semibold text-white shadow-soft transition-all hover:bg-[#0c2030] hover:shadow-panel"
                  >
                    Request a demo
                  </Link>
                  <Link
                    href="/onboarding"
                    className="rounded-lg border border-gray-muted bg-white px-6 py-3.5 text-center text-base font-semibold text-navy transition-colors hover:bg-offwhite"
                  >
                    Self-serve setup
                  </Link>
                  <a
                    href="/ReHub-Executive-Proposal.pdf"
                    download
                    className="flex items-center justify-center gap-2 rounded-lg border border-teal/30 bg-teal/5 px-6 py-3.5 text-center text-base font-semibold text-teal transition-colors hover:bg-teal/10"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Download the proposal (PDF)
                  </a>
                  <Link
                    href="/demo"
                    className="text-center text-sm font-medium text-teal hover:underline"
                  >
                    Or try the live demo →
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-10">
            <SafetyNote />
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
