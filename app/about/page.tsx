import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/marketing/motion";
import SafetyNote from "@/components/SafetyNote";

const PRINCIPLES = [
  {
    title: "Communication before complexity",
    body: "Care environments fail not from lack of technology, but from communication gaps. Rehub solves the gap first — a simple, reliable channel between residents and the people responsible for their care.",
  },
  {
    title: "Transparent by design",
    body: "Every priority score, every urgency classification, every keyword that triggered a decision is visible to staff. Nothing is a black box. Explainability is not a feature — it is the requirement.",
  },
  {
    title: "The tool never replaces judgment",
    body: "Rehub classifies urgency and routes requests. A care professional makes every clinical decision. The system exists to surface needs faster, not to replace the people who respond to them.",
  },
  {
    title: "Honest about what we are",
    body: "Rehub is a communication and workflow platform. It is not a medical device, a diagnostic system, or an emergency response system. We say this clearly, repeatedly, and without exception.",
  },
];

const TECH = [
  {
    name: "Next.js + TypeScript",
    desc: "Server and client rendering, strong typing end-to-end, zero runtime type errors in production.",
  },
  {
    name: "Supabase Postgres",
    desc: "Row-level security, Realtime subscriptions for cross-device sync, immutable event log, documented HIPAA-ready path.",
  },
  {
    name: "Deterministic AI classifier",
    desc: "Keyword-weighted scoring — no LLM API, no hallucinations, no external voice data transmission. Every decision traces to a rule.",
  },
  {
    name: "Web Speech API",
    desc: "Voice recognition runs in the browser. Transcripts never leave the device in the demo. No third-party speech vendor.",
  },
  {
    name: "BroadcastChannel + Realtime",
    desc: "Same-device tab sync via BroadcastChannel, cross-device sync via Supabase Realtime. Both degrade gracefully.",
  },
  {
    name: "CMS facility directory",
    desc: "1,221 US inpatient rehabilitation facilities from the public CMS provider dataset, bundled for offline autocomplete.",
  },
];

export default function AboutPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-gray-muted bg-white">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">About</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight text-navy sm:text-5xl">
                Built to close the communication gap in care.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-slate">
                Rehub was built after a straightforward observation: in rehab
                centers and senior living communities, residents often can&apos;t
                easily communicate what they need, and staff can&apos;t always see
                what&apos;s waiting. That gap — between a need and the staff who
                can meet it — is what Rehub exists to close.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Mission */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal">Mission</p>
            <h2 className="mt-3 text-3xl font-bold text-navy">
              Make every care request visible, trackable, and easier to respond to.
            </h2>
            <p className="mt-5 leading-relaxed text-slate">
              A resident who can&apos;t easily reach staff isn&apos;t a minor
              inconvenience — in a rehab or post-acute setting, delayed responses
              to pain, mobility needs, or bathroom requests affect recovery
              outcomes, resident satisfaction, and staff workload. Rehub gives
              every resident a direct channel and every care team member a shared,
              prioritized view of what&apos;s needed right now.
            </p>
            <p className="mt-4 leading-relaxed text-slate">
              The goal is not to automate care. It is to reduce the time between
              when a resident needs something and when a care team member knows
              about it.
            </p>
          </Reveal>
        </section>

        {/* Principles */}
        <section className="border-y border-gray-muted bg-mint/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">Principles</p>
              <h2 className="mt-3 text-3xl font-bold text-navy">How we build.</h2>
            </Reveal>
            <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <StaggerItem key={p.title}>
                  <div className="rounded-xl border border-gray-muted bg-white p-6 shadow-soft">
                    <h3 className="font-semibold text-navy">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate/80">{p.body}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* The problem we solve */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal">The problem</p>
            <h2 className="mt-3 text-3xl font-bold text-navy">
              Why care communication breaks down.
            </h2>
            <div className="mt-6 space-y-4 leading-relaxed text-slate">
              <p>
                In a typical inpatient rehabilitation facility, a recovering
                patient who needs help at 2pm has limited options: call light,
                phone the nurses&apos; station, or wait. If the call light is
                missed or the line is busy, the request disappears. There&apos;s
                no queue, no priority, no visibility.
              </p>
              <p>
                On the staff side, a physical therapist managing eight rooms has
                no shared view of what&apos;s waiting across all of them. Requests
                arrive by phone, by word of mouth, by a colleague&apos;s note on a
                whiteboard. When a second urgent request comes in while handling
                the first, the third resident&apos;s need may not be seen for
                another 20 minutes.
              </p>
              <p>
                Rehub replaces that fragmented process with a single closed loop:
                a request enters the facility queue the moment a resident confirms
                it, and every subscribed care team member sees it ranked by
                urgency and time waiting within seconds.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Tech */}
        <section className="border-y border-gray-muted bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">Technology</p>
              <h2 className="mt-3 text-3xl font-bold text-navy">Built on a transparent, auditable stack.</h2>
              <p className="mt-3 max-w-2xl text-slate">
                Every component choice was made with care environments in mind:
                offline resilience, explainability, privacy-by-design, and no
                reliance on external AI services that could transmit resident
                data.
              </p>
            </Reveal>
            <StaggerGroup className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TECH.map((t) => (
                <StaggerItem key={t.name}>
                  <div className="rounded-lg border border-gray-muted bg-offwhite p-4">
                    <p className="text-sm font-semibold text-navy">{t.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate/70">{t.desc}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* Safety */}
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal">Safety commitment</p>
            <h2 className="mt-3 text-3xl font-bold text-navy">What Rehub is — and what it isn&apos;t.</h2>
            <p className="mt-5 leading-relaxed text-slate">
              Rehub is a communication and workflow platform. It routes requests,
              prioritizes queues, and surfaces information for care staff. It does
              not diagnose conditions, give medical advice, recommend treatments,
              or replace emergency response systems.
            </p>
            <p className="mt-4 leading-relaxed text-slate">
              The urgency classification system uses keyword scoring to help staff
              prioritize — not to determine clinical severity. An &ldquo;Urgent&rdquo;
              classification means a care team member should review the request
              promptly. It is not a medical judgment.
            </p>
            <p className="mt-4 leading-relaxed text-slate">
              Every resident-facing screen carries a clear reminder that Rehub
              does not replace the facility emergency call system. Residents are
              never told to use Rehub instead of their emergency call button.
            </p>
            <div className="mt-8">
              <SafetyNote />
            </div>
          </Reveal>
        </section>

        {/* CTA */}
        <section className="border-t border-gray-muted bg-offwhite">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
            <Reveal>
              <h2 className="text-2xl font-bold text-navy">Learn how Rehub deploys at your facility.</h2>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/for-facilities"
                  className="rounded-lg bg-teal px-6 py-3 text-sm font-semibold text-white hover:bg-[#2a8d8d]"
                >
                  Facility deployment guide →
                </Link>
                <Link
                  href="/contact"
                  className="rounded-lg border-2 border-navy bg-white px-6 py-3 text-sm font-semibold text-navy hover:bg-navy/5"
                >
                  Talk to our team
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
