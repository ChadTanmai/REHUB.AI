import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import LandingHero from "@/components/LandingHero";
import MissionSection from "@/components/MissionSection";
import SafetyNote from "@/components/SafetyNote";

const FEATURES = [
  {
    title: "Simple Resident Requests",
    body: "Large, accessible buttons and voice input let residents ask for help without navigating complicated menus.",
  },
  {
    title: "Live Staff Queue",
    body: "Requests appear instantly with priority, room, status, and time waiting.",
  },
  {
    title: "Response Analytics",
    body: "Facilities can understand response times, common request types, and workflow bottlenecks.",
  },
];

const BUILT_FOR = [
  "Rehab centers",
  "Senior living facilities",
  "Assisted living communities",
  "Care teams",
  "Residents and families",
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <LandingHero />
        <MissionSection />

        {/* What Rehub Does */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-navy">What Rehub Does</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title}>
                <span className="text-sm font-bold text-teal">0{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold text-navy">{f.title}</h3>
                <p className="mt-2 text-slate/80">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why It Matters */}
        <section className="border-y border-gray-muted bg-mint/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-bold text-navy">Why It Matters</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate">
              In care environments, small delays can become serious. Rehub gives
              staff a clearer view of resident needs before they get missed.
            </p>
          </div>
        </section>

        {/* Built For */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-navy">Built For</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {BUILT_FOR.map((b) => (
              <span
                key={b}
                className="rounded-lg border border-gray-muted bg-white px-4 py-2 text-sm font-medium text-slate shadow-soft"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="rounded-lg bg-navy px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#0c2030]"
            >
              Set up a facility
            </Link>
            <Link
              href="/demo"
              className="rounded-lg border-2 border-navy bg-white px-6 py-3 text-base font-semibold text-navy transition-colors hover:bg-navy/5"
            >
              Try the demo
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <SafetyNote />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
