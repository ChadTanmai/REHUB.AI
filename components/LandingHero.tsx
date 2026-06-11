import Link from "next/link";

export default function LandingHero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-mint px-3 py-1 text-xs font-medium text-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            Care communication &amp; workflow
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-navy sm:text-5xl">
            Care requests, visible instantly.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate">
            A simple communication platform that helps residents request support
            and helps care teams respond with clarity, speed, and accountability.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-lg bg-teal px-6 py-3 text-base font-semibold text-white shadow-soft transition-colors hover:bg-[#2a8d8d]"
            >
              Request Demo
            </Link>
            <Link
              href="/therapist"
              className="rounded-lg border-2 border-navy bg-white px-6 py-3 text-base font-semibold text-navy transition-colors hover:bg-navy/5"
            >
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Calm illustrative panel — flat, not glassy */}
        <div className="rounded-2xl border border-gray-muted bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-navy">Live request queue</span>
            <span className="rounded-md bg-mint px-2 py-0.5 text-xs font-medium text-teal">
              Connected
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <PreviewRow room="204" type="Pain + Mobility" tone="coral" label="Urgent" wait="3 min" />
            <PreviewRow room="118" type="Bathroom" tone="amber" label="Important" wait="1 min" />
            <PreviewRow room="102" type="Water" tone="teal" label="Routine" wait="just now" />
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewRow({
  room,
  type,
  tone,
  label,
  wait,
}: {
  room: string;
  type: string;
  tone: "coral" | "amber" | "teal";
  label: string;
  wait: string;
}) {
  const border = { coral: "border-l-coral", amber: "border-l-amber", teal: "border-l-teal" }[tone];
  const chip = {
    coral: "bg-coral/12 text-coral",
    amber: "bg-amber/15 text-[#9a6b00]",
    teal: "bg-teal/10 text-teal",
  }[tone];
  return (
    <div className={`rounded-lg border border-gray-muted border-l-4 ${border} bg-offwhite px-3 py-2.5`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-navy">Room {room}</span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${chip}`}>{label}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-slate/70">
        <span>{type}</span>
        <span>Waiting {wait}</span>
      </div>
    </div>
  );
}
