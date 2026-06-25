import Link from "next/link";
import type { Metadata } from "next";
import { RehubWordmark } from "@/components/RehubLogo";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "Get started — Rehub",
  description: "Choose how you're joining Rehub: as a patient, a care team member, or a facility administrator.",
};

/**
 * Role chooser. "Get started" used to drop everyone on the signup form, but
 * patients and nurses don't have accounts — they join their facility with a
 * code. This screen routes each person to the right entry point.
 */

function PatientIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.5 0 3-1.5 3-3.5S20.5 7 19 7M5 14c-1.5 0-3-1.5-3-3.5S3.5 7 5 7M12 2v6M9 22v-4a3 3 0 0 1 6 0v4" />
      <circle cx="12" cy="5" r="3" />
    </svg>
  );
}
function CareTeamIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function AdminIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M9 21V7l6-4v18M9 11h6M9 15h6" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const ROLES = [
  {
    key: "patient",
    icon: <PatientIcon />,
    title: "I'm a patient",
    desc: "Join your room to ask for help by voice, button, or text. You'll just need your facility's code.",
    cta: "Join as a patient",
    href: "/join?role=patient",
    accent: "teal",
  },
  {
    key: "nurse",
    icon: <CareTeamIcon />,
    title: "I'm on the care team",
    desc: "Nurses, therapists, and caregivers — open the staff dashboard and command center with your facility code.",
    cta: "Join as care team",
    href: "/join?role=nurse",
    accent: "navy",
  },
  {
    key: "admin",
    icon: <AdminIcon />,
    title: "I run a facility",
    desc: "Set up your facility, create rooms, and invite your team. Creates an administrator account.",
    cta: "Create a facility",
    href: "/auth/signup",
    accent: "slate",
  },
] as const;

const ACCENTS: Record<string, { ring: string; iconBg: string; cta: string }> = {
  teal: { ring: "hover:border-teal/50", iconBg: "bg-teal/10 text-teal", cta: "bg-teal hover:bg-[#2a8d8d]" },
  navy: { ring: "hover:border-navy/40", iconBg: "bg-navy/8 text-navy", cta: "bg-navy hover:bg-[#0c2030]" },
  slate: { ring: "hover:border-slate/40", iconBg: "bg-offwhite text-slate", cta: "bg-slate hover:bg-[#3a4654]" },
};

export default function GetStartedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex justify-center">
          <Link href="/"><RehubWordmark /></Link>
        </div>

        <Reveal>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-navy sm:text-3xl">How are you joining Rehub?</h1>
            <p className="mt-2 text-slate/70">Pick the option that fits you — we&apos;ll take you to the right place.</p>
          </div>
        </Reveal>

        <StaggerGroup className="mt-8 grid gap-4 sm:grid-cols-3">
          {ROLES.map((r) => {
            const a = ACCENTS[r.accent];
            return (
              <StaggerItem key={r.key}>
                <Link
                  href={r.href}
                  className={`group flex h-full flex-col rounded-2xl border border-gray-muted bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel ${a.ring}`}
                >
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${a.iconBg}`}>
                    {r.icon}
                  </div>
                  <h2 className="text-lg font-bold text-navy">{r.title}</h2>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate/70">{r.desc}</p>
                  <span className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${a.cta}`}>
                    {r.cta}
                    <span className="transition-transform group-hover:translate-x-0.5"><ArrowIcon /></span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerGroup>

        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-slate/60">
              Staff with an account already?{" "}
              <Link href="/auth/signin" className="font-semibold text-teal hover:underline">Sign in</Link>
            </p>
            <p className="text-sm text-slate/50">
              Just exploring?{" "}
              <Link href="/demo" className="font-medium text-navy hover:underline">Try the live demo →</Link>
            </p>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
