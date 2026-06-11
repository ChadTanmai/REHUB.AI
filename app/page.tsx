import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Hero from "@/components/marketing/Hero";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/marketing/motion";
import SafetyNote from "@/components/SafetyNote";

const STEPS = [
  {
    n: "01",
    title: "Residents ask",
    body: "A tap on a large button or a few spoken words on the room tablet. No app to learn, no menus to navigate.",
  },
  {
    n: "02",
    title: "Rehub routes",
    body: "Each request is classified by type and urgency, then placed into your facility's live queue in real time.",
  },
  {
    n: "03",
    title: "Care teams respond",
    body: "Staff acknowledge, take ownership, and resolve — while the resident's screen keeps them reassured at every step.",
  },
];

const FEATURES = [
  {
    title: "Voice or one-tap requests",
    body: "Residents speak naturally or press a large, high-contrast button. Designed to be usable by an elderly person on an iPad.",
  },
  {
    title: "Priority you can trust",
    body: "A transparent, explainable scoring model surfaces urgent needs first — never a black box, never a diagnosis.",
  },
  {
    title: "Live shared queue",
    body: "Every assigned therapist sees the same real-time board: room, request, priority, status, and time waiting.",
  },
  {
    title: "Status that reassures",
    body: "When staff acknowledge or start helping, the resident's room screen updates automatically. No one is left wondering.",
  },
  {
    title: "Response analytics",
    body: "Understand response times, common requests, and workflow bottlenecks across rooms, staff, and shifts.",
  },
  {
    title: "Set up in minutes",
    body: "Create a facility, pair room tablets and staff devices with a code, and you're live. No installation, no hardware lock-in.",
  },
];

const ROLES = [
  { tag: "Room screen", title: "For residents", body: "An always-on tablet in each room. Calm, large, and impossible to get lost in.", href: "/resident" },
  { tag: "Dashboard", title: "For therapists", body: "One shared live queue across every assigned room, sorted by urgency.", href: "/therapist" },
  { tag: "Analytics", title: "For administrators", body: "Response trends and workflow insight across the whole facility.", href: "/admin" },
  { tag: "Setup", title: "For your IT lead", body: "Self-serve facility setup and device pairing — no vendor visit required.", href: "/onboarding" },
];

const STATS = [
  { value: "< 5 min", label: "Typical setup time" },
  { value: "Real-time", label: "Request delivery" },
  { value: "3 inputs", label: "Voice, button, or typed" },
  { value: "0", label: "Apps for residents to install" },
];

export default function Home() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <Hero />

        {/* Stats band */}
        <section className="border-y border-gray-muted bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <StaggerGroup className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {STATS.map((s) => (
                <StaggerItem key={s.label} className="text-center">
                  <p className="text-3xl font-bold text-navy">{s.value}</p>
                  <p className="mt-1 text-sm text-slate/70">{s.label}</p>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal">How it works</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold text-navy sm:text-4xl">
              From a resident&apos;s need to a resolved request — in one connected loop.
            </h2>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <StaggerItem key={s.n}>
                <div className="rounded-2xl border border-gray-muted bg-white p-6 shadow-soft transition-shadow hover:shadow-panel">
                  <span className="text-sm font-bold text-teal">{s.n}</span>
                  <h3 className="mt-2 text-xl font-semibold text-navy">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate/80">{s.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>

        {/* Product / features */}
        <section id="product" className="scroll-mt-20 border-y border-gray-muted bg-mint/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal">The product</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-bold text-navy sm:text-4xl">
                Everything a care team needs to never miss a request.
              </h2>
            </Reveal>

            <StaggerGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <StaggerItem key={f.title}>
                  <div className="h-full rounded-2xl border border-gray-muted bg-white p-6 shadow-soft transition-shadow hover:shadow-panel">
                    <h3 className="text-lg font-semibold text-navy">{f.title}</h3>
                    <p className="mt-2 leading-relaxed text-slate/80">{f.body}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* Roles / architecture */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal">One platform, four views</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold text-navy sm:text-4xl">
              Built around how your facility actually works.
            </h2>
            <p className="mt-4 max-w-2xl text-slate">
              Room screens and dashboards never talk to each other directly — they
              share one facility workspace, so everyone sees the same truth in
              real time.
            </p>
          </Reveal>

          <StaggerGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <StaggerItem key={r.title}>
                <Link
                  href={r.href}
                  className="group block h-full rounded-2xl border border-gray-muted bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel"
                >
                  <span className="inline-block rounded-md bg-navy/8 px-2 py-0.5 text-xs font-semibold text-navy">
                    {r.tag}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-navy">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate/80">{r.body}</p>
                  <span className="mt-4 inline-block text-sm font-semibold text-teal transition-transform group-hover:translate-x-0.5">
                    Explore →
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>

        {/* Why it matters / quote */}
        <section className="border-y border-gray-muted bg-navy">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <Reveal>
              <p className="text-2xl font-semibold leading-snug text-white sm:text-3xl">
                &ldquo;In care environments, small delays can become serious. Rehub
                gives staff a clearer view of resident needs before they get
                missed.&rdquo;
              </p>
              <p className="mt-6 text-sm font-medium text-mint">The Rehub mission</p>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-gray-muted bg-white p-8 shadow-panel sm:p-12">
              <div className="grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
                <div>
                  <h2 className="text-3xl font-bold text-navy sm:text-4xl">
                    Ready to see every request, instantly?
                  </h2>
                  <p className="mt-4 max-w-xl text-lg text-slate">
                    Set up a facility in minutes, or talk to us about a pilot at
                    your community.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link
                    href="/onboarding"
                    className="rounded-lg bg-teal px-6 py-3 text-center text-base font-semibold text-white shadow-soft transition-all hover:bg-[#2a8d8d] hover:shadow-panel"
                  >
                    Set up your facility
                  </Link>
                  <Link
                    href="/contact"
                    className="rounded-lg border-2 border-navy bg-white px-6 py-3 text-center text-base font-semibold text-navy transition-colors hover:bg-navy/5"
                  >
                    Talk to sales
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
