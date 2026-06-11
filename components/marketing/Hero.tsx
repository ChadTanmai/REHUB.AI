"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { EASE } from "./motion";
import AnimatedDashboard from "./AnimatedDashboard";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft ambient background — flat tints, no neon/gradient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-[-10%] h-96 w-96 rounded-full bg-mint/50 blur-3xl" />
        <div className="absolute top-40 left-[-10%] h-80 w-80 rounded-full bg-teal/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.span
              variants={item}
              className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-mint px-3 py-1 text-xs font-medium text-teal"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              Care communication &amp; workflow platform
            </motion.span>

            <motion.h1
              variants={item}
              className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-6xl"
            >
              Care requests,
              <br />
              <span className="text-teal">visible instantly.</span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-6 max-w-xl text-lg leading-relaxed text-slate"
            >
              Rehub connects every patient room to your care team through one live
              dashboard — so requests are seen, prioritized, and resolved before
              they get missed.
            </motion.p>

            <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="group rounded-lg bg-teal px-6 py-3 text-base font-semibold text-white shadow-soft transition-all hover:bg-[#2a8d8d] hover:shadow-panel"
              >
                Set up your facility
                <span className="ml-1.5 inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <Link
                href="/demo"
                className="rounded-lg border-2 border-navy bg-white px-6 py-3 text-base font-semibold text-navy transition-colors hover:bg-navy/5"
              >
                View live demo
              </Link>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate/70"
            >
              <Check>No app for residents to learn</Check>
              <Check>Live in minutes</Check>
              <Check>Works on any tablet</Check>
            </motion.div>
          </motion.div>

          <AnimatedDashboard />
        </div>
      </div>
    </section>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success/15 text-success">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </span>
  );
}
