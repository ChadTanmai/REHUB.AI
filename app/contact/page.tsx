"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Reveal } from "@/components/marketing/motion";
import { EASE } from "@/components/marketing/motion";
import { saveLead } from "@/lib/leads";
import { useMounted } from "@/lib/useRehub";

export default function ContactPage() {
  const mounted = useMounted();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [facility, setFacility] = useState("");
  const [rooms, setRooms] = useState("");
  const [message, setMessage] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    saveLead({ kind: "contact", name, email, facility, rooms, message });
    setSent(true);
  }

  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Left: pitch */}
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-mint px-3 py-1 text-xs font-medium text-teal">
              Talk to our team
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-navy sm:text-5xl">
              Bring Rehub to your community.
            </h1>
            <p className="mt-5 max-w-md text-lg text-slate">
              Tell us about your facility and we&apos;ll set up a tailored
              walkthrough and pilot plan. Most communities are live within a week.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                "A personalized demo with your rooms and workflow",
                "A pilot plan for a single unit",
                "Guidance on devices, rollout, and staff training",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-slate">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-sm text-slate/70">
              Prefer to explore on your own?{" "}
              <Link href="/onboarding" className="font-medium text-teal hover:underline">
                Set up a facility now
              </Link>
              .
            </p>
          </Reveal>

          {/* Right: form / success */}
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-gray-muted bg-white p-6 shadow-panel sm:p-8">
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="py-8 text-center"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <h2 className="mt-4 text-2xl font-bold text-navy">Thanks, {name.split(" ")[0]}!</h2>
                    <p className="mt-2 text-slate">
                      We&apos;ve recorded your request. In a production deployment
                      our team would reach out at{" "}
                      <span className="font-medium text-navy">{email}</span> within
                      one business day.
                    </p>
                    <Link
                      href="/onboarding"
                      className="mt-6 inline-block rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-[#2a8d8d]"
                    >
                      Or set up a facility now →
                    </Link>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={submit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <h2 className="text-xl font-bold text-navy">Request a demo</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name *">
                        <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
                      </Field>
                      <Field label="Work email *">
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Facility name">
                        <input value={facility} onChange={(e) => setFacility(e.target.value)} className="input" />
                      </Field>
                      <Field label="Approx. rooms">
                        <input value={rooms} onChange={(e) => setRooms(e.target.value)} placeholder="e.g. 40" className="input" />
                      </Field>
                    </div>
                    <Field label="Anything we should know?">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="input resize-none"
                        placeholder="Your goals, timeline, or questions…"
                      />
                    </Field>
                    <button
                      type="submit"
                      disabled={!mounted || !name.trim() || !email.trim()}
                      className="w-full rounded-lg bg-navy px-5 py-3 font-semibold text-white transition-colors hover:bg-[#0c2030] disabled:opacity-40"
                    >
                      Request demo
                    </button>
                    <p className="text-center text-xs text-slate/55">
                      Demo only — your details are stored locally in this browser
                      and never transmitted.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate">{label}</span>
      {children}
    </label>
  );
}
