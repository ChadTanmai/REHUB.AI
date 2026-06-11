import { SiteNav, SiteFooter } from "@/components/SiteNav";
import SafetyNote from "@/components/SafetyNote";

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h1 className="text-3xl font-bold text-navy">About Rehub</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate">
            Rehub was built to improve communication inside rehab and elder-care
            environments. The goal is simple: make resident needs easier to
            submit, easier to see, and easier to track.
          </p>

          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-teal">
            Our Mission
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-slate">
            Our mission is to make care communication clearer, faster, and more
            accountable for elderly residents, recovering patients, families, and
            care staff.
          </p>

          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-teal">
            How it works
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-slate">
            Rehub connects patient room screens and therapist dashboards through a
            shared facility workspace. Each room device submits requests into the
            facility queue, and every authorized therapist dashboard subscribed to
            that facility receives updates in real time. Requests are classified by
            a transparent, keyword-based system that converts a resident&apos;s
            spoken need into a structured request — it never diagnoses.
          </p>

          <div className="mt-10">
            <SafetyNote />
          </div>
          <p className="mt-4 text-sm text-slate/70">
            Rehub is not a medical device, diagnostic tool, or emergency response
            system. It is a communication and workflow platform.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
