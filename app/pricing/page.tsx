"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/marketing/motion";
import SafetyNote from "@/components/SafetyNote";

const TIERS = [
  {
    name: "Pilot",
    price: "Free",
    period: "for 30 days",
    blurb: "Run a single unit and prove the workflow with your team.",
    cta: "Start a pilot",
    href: "/onboarding",
    highlighted: false,
    features: [
      "1 facility, up to 10 rooms",
      "Voice, button & typed requests",
      "Live therapist dashboard",
      "Basic response analytics",
      "Email support",
    ],
  },
  {
    name: "Facility",
    price: "$4",
    period: "per room / month",
    blurb: "Everything a single community needs to run on Rehub every day.",
    cta: "Set up your facility",
    href: "/onboarding",
    highlighted: true,
    features: [
      "Unlimited rooms in one facility",
      "Unlimited therapist devices",
      "Full analytics & CSV export",
      "Priority alert strip & toasts",
      "Role-based staff accounts",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "multi-site",
    blurb: "For groups operating several communities with central oversight.",
    cta: "Talk to sales",
    href: "/contact",
    highlighted: false,
    features: [
      "Multiple facilities & central admin",
      "SSO & audit logging",
      "Custom priority configuration",
      "SMS & push escalation",
      "Onboarding & training",
      "Dedicated success manager",
    ],
  },
];

const FAQ = [
  {
    q: "How long does setup take?",
    a: "Most facilities are live in under five minutes. You create a facility, then pair each room tablet and staff device with a short code — no installation or special hardware.",
  },
  {
    q: "Do residents need to install an app?",
    a: "No. The room screen runs in a browser on any tablet you already have. Residents simply tap a button or speak.",
  },
  {
    q: "Is Rehub a medical or emergency system?",
    a: "No. Rehub is a communication and workflow tool. It does not replace emergency response systems or medical judgment, and it never diagnoses.",
  },
  {
    q: "What about patient data and compliance?",
    a: "The current product is built for demo and pilot use with fictional data. Production deployments with real patient data require our authentication, encryption, audit logging, and a compliance review — talk to us about a pilot.",
  },
];

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-mint px-3 py-1 text-xs font-medium text-teal">
              Simple, room-based pricing
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-navy sm:text-5xl">
              Pricing that scales with your facility.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate">
              Start free, then pay only for the rooms you use. No hardware
              lock-in, no per-seat fees for your care team.
            </p>
          </Reveal>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <StaggerGroup className="grid gap-6 lg:grid-cols-3">
            {TIERS.map((t) => (
              <StaggerItem key={t.name}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  className={`flex h-full flex-col rounded-2xl border p-7 ${
                    t.highlighted
                      ? "border-teal bg-white shadow-panel ring-1 ring-teal/30"
                      : "border-gray-muted bg-white shadow-soft"
                  }`}
                >
                  {t.highlighted && (
                    <span className="mb-3 w-fit rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <h2 className="text-lg font-semibold text-navy">{t.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold text-navy">{t.price}</span>
                    <span className="text-sm text-slate/60">{t.period}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate/80">{t.blurb}</p>

                  <ul className="mt-6 space-y-3">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={t.href}
                    className={`mt-7 rounded-lg px-5 py-3 text-center text-base font-semibold transition-colors ${
                      t.highlighted
                        ? "bg-teal text-white hover:bg-[#2a8d8d]"
                        : "border-2 border-navy bg-white text-navy hover:bg-navy/5"
                    }`}
                  >
                    {t.cta}
                  </Link>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-muted bg-mint/30">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <Reveal>
              <h2 className="text-3xl font-bold text-navy">Frequently asked</h2>
            </Reveal>
            <div className="mt-8 space-y-4">
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={i * 0.05}>
                  <div className="rounded-xl border border-gray-muted bg-white p-5">
                    <h3 className="font-semibold text-navy">{item.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate/80">{item.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-10">
              <SafetyNote variant="compact" />
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
