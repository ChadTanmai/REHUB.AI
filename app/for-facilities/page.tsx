import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/marketing/motion";
import SafetyNote from "@/components/SafetyNote";

const SEGMENTS = [
  {
    title: "Inpatient rehabilitation facilities",
    desc: "Managing dozens of recovering patients across units — Rehub gives every room a voice and every therapist a shared, prioritized queue.",
  },
  {
    title: "Skilled nursing facilities",
    desc: "Residents can't always walk to the nurses' station. A bedside tablet lets them request help the moment they need it.",
  },
  {
    title: "Assisted living communities",
    desc: "Independent-style living doesn't mean unseen needs. Rehub closes the gap between resident requests and staff awareness.",
  },
  {
    title: "Post-acute care units",
    desc: "The critical 72-hour window after discharge demands tight communication. Rehub keeps every care team member synchronized.",
  },
];

const WHAT_YOU_NEED = [
  {
    item: "Tablets or iPads for patient rooms",
    detail: "Any modern tablet with a browser. No app installation. We recommend wall-mounted iPad mini or tablet stands.",
  },
  {
    item: "A device for each therapist or nurse",
    detail: "Any phone, tablet, or desktop. The dashboard runs in any browser on your facility WiFi.",
  },
  {
    item: "Your facility WiFi network",
    detail: "Rehub communicates through your existing network. No new hardware or dedicated connectivity required.",
  },
  {
    item: "15 minutes of your IT team's time",
    detail: "Bookmark the room URL on each tablet, and share the facility code with your care team. That's the full setup.",
  },
];

const TIMELINE = [
  {
    day: "Day 1",
    heading: "Create your facility",
    body: "Search for your facility in the CMS directory — address, phone, and certification data auto-fill. Create your access code and set up your first rooms in under five minutes.",
    cta: null,
  },
  {
    day: "Day 1–2",
    heading: "Pair room tablets",
    body: "Open the room URL on each tablet, enter your facility code and room number. The tablet is now paired to your facility queue. No IT ticket required.",
    cta: null,
  },
  {
    day: "Day 1–2",
    heading: "Onboard your care team",
    body: "Share the therapist login URL and your facility code with staff. They enter their name and role — they're live on the dashboard immediately.",
    cta: null,
  },
  {
    day: "Day 3",
    heading: "Run a pilot unit",
    body: "Start with one unit. Observe how requests flow, how staff respond, and where the queue helps. Gather feedback before rolling out facility-wide.",
    cta: null,
  },
  {
    day: "Week 2+",
    heading: "Facility-wide rollout",
    body: "Add remaining rooms one by one. The admin dashboard shows response times and request volume from day one — you'll have real data to inform the broader rollout.",
    cta: null,
  },
];

const WHY_ITEMS = [
  {
    stat: "< 5 min",
    label: "to create a facility and pair the first room",
  },
  {
    stat: "0",
    label: "apps for residents to install or learn",
  },
  {
    stat: "Real-time",
    label: "queue updates across all staff devices",
  },
  {
    stat: "100%",
    label: "browser-based — no proprietary hardware",
  },
];

const FAQS = [
  {
    q: "Do we need to replace any existing call systems?",
    a: "No. Rehub is a communication supplement, not a replacement. Emergency pull cords and call systems remain in place. Rehub handles everyday requests — water, bathroom, mobility — before they escalate.",
  },
  {
    q: "What devices do we need for resident rooms?",
    a: "Any tablet with a modern browser works — iPad, Android tablet, or a basic Amazon Fire tablet. Rehub runs entirely in the browser. No app installation, no device management, no app store.",
  },
  {
    q: "How does Rehub handle patient privacy?",
    a: "The demo and pilot versions use fictional display names only — no real patient data is ever required. Production deployments with real data use Supabase Postgres with row-level security, Realtime-scoped subscriptions, and a documented path to HIPAA-ready deployment. We will never claim compliance we haven't verified.",
  },
  {
    q: "Can we control which staff see which rooms?",
    a: "Yes. Therapists can be assigned specific rooms or all rooms. The priority queue only shows requests from assigned rooms. This maps naturally to unit-based staffing models.",
  },
  {
    q: "What happens if our WiFi goes down?",
    a: "Submitted requests are stored in the browser's local storage and in Supabase, so data isn't lost. Room screens show the last known status. We recommend a secondary call method for critical requests during outages — and the safety note on every room screen reminds residents of that.",
  },
  {
    q: "Is there a contract or long-term commitment?",
    a: "No. The pilot is free for 30 days. After that, Rehub is billed per room per month. Cancel anytime.",
  },
];

export default function ForFacilitiesPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-gray-muted bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                For facility administrators
              </p>
              <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-navy sm:text-5xl">
                How a rehabilitation center deploys Rehub.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate">
                A practical guide to evaluation, pilot setup, and full deployment
                — written for the director, DON, or administrator making the
                decision.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/onboarding"
                  className="rounded-lg bg-teal px-6 py-3 text-base font-semibold text-white shadow-soft transition-all hover:bg-[#2a8d8d] hover:shadow-panel"
                >
                  Start a free pilot →
                </Link>
                <Link
                  href="/contact"
                  className="rounded-lg border-2 border-navy bg-white px-6 py-3 text-base font-semibold text-navy transition-colors hover:bg-navy/5"
                >
                  Talk to our team
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal">Built for</p>
            <h2 className="mt-3 text-3xl font-bold text-navy">Which facilities is Rehub designed for?</h2>
          </Reveal>
          <StaggerGroup className="mt-8 grid gap-4 sm:grid-cols-2">
            {SEGMENTS.map((s) => (
              <StaggerItem key={s.title}>
                <div className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
                  <h3 className="font-semibold text-navy">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate/80">{s.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>

        {/* What you need */}
        <section className="border-y border-gray-muted bg-mint/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">Prerequisites</p>
              <h2 className="mt-3 text-3xl font-bold text-navy">
                What does your facility need before going live?
              </h2>
              <p className="mt-3 text-slate">
                No proprietary hardware. No enterprise IT project. No vendor
                installation visit.
              </p>
            </Reveal>
            <div className="mt-10 space-y-0">
              {WHAT_YOU_NEED.map((w, i) => (
                <Reveal key={w.item} delay={i * 0.05}>
                  <div className="grid gap-4 border-t border-gray-muted py-6 sm:grid-cols-[2fr_3fr]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal text-white">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <p className="font-semibold text-navy">{w.item}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-slate/80 sm:pl-0">{w.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Deployment timeline */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal">Deployment</p>
            <h2 className="mt-3 text-3xl font-bold text-navy">
              From first visit to fully operational — in under a week.
            </h2>
            <p className="mt-3 max-w-2xl text-slate">
              Most facilities complete the pilot unit setup on day one. The
              facility-wide rollout follows at whatever pace your team is
              comfortable with.
            </p>
          </Reveal>

          <div className="relative mt-12">
            {/* Vertical timeline line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-px bg-gray-muted sm:left-[88px]" />
            <div className="space-y-0">
              {TIMELINE.map((t, i) => (
                <Reveal key={t.day} delay={i * 0.06}>
                  <div className="grid gap-4 pl-12 pb-10 sm:grid-cols-[100px_1fr] sm:pl-0">
                    <div className="relative sm:text-right">
                      {/* Timeline dot */}
                      <span className="absolute -left-12 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-teal bg-white sm:-left-[52px]">
                        <span className="h-2 w-2 rounded-full bg-teal" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-teal">{t.day}</span>
                    </div>
                    <div className="pb-2">
                      <h3 className="text-lg font-semibold text-navy">{t.heading}</h3>
                      <p className="mt-2 leading-relaxed text-slate/80">{t.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y border-gray-muted bg-navy">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <StaggerGroup className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {WHY_ITEMS.map((w) => (
                <StaggerItem key={w.label} className="text-center">
                  <p className="text-3xl font-bold text-white">{w.stat}</p>
                  <p className="mt-1 text-sm text-mint">{w.label}</p>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal">Common questions</p>
            <h2 className="mt-3 text-3xl font-bold text-navy">What administrators ask before deploying.</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 0.04}>
                <div className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
                  <h3 className="font-semibold text-navy">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate/80">{faq.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-gray-muted bg-white">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <Reveal>
              <h2 className="text-3xl font-bold text-navy">
                Ready to run a pilot at your facility?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate">
                Set up a facility in five minutes, or contact us to run a guided
                pilot with your team.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/onboarding"
                  className="rounded-lg bg-teal px-8 py-3.5 text-base font-semibold text-white shadow-soft transition-all hover:bg-[#2a8d8d] hover:shadow-panel"
                >
                  Start free pilot →
                </Link>
                <Link
                  href="/contact"
                  className="rounded-lg border-2 border-navy bg-white px-8 py-3.5 text-base font-semibold text-navy transition-colors hover:bg-navy/5"
                >
                  Talk to our team
                </Link>
              </div>
              <div className="mt-8">
                <SafetyNote variant="compact" />
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
