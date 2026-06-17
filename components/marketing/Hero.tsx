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
      {/* Subtle ambient washes — flat tints, no neon, no gradient orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-[-10%] h-96 w-96 rounded-full bg-mint/40 blur-3xl" />
        <div className="absolute top-40 left-[-8%] h-80 w-80 rounded-full bg-teal/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.h1
              variants={item}
              className="text-4xl font-bold leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-[3.5rem]"
            >
              The care communication
              <br />
              platform for{" "}
              <span className="text-teal">rehabilitation facilities.</span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-6 max-w-xl text-lg leading-relaxed text-slate"
            >
              Rehub connects every patient room to your care team through one
              shared, live dashboard — so requests are seen, prioritized, and
              resolved before they get missed.
            </motion.p>

            <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="rounded-lg bg-navy px-6 py-3 text-base font-semibold text-white shadow-soft transition-all hover:bg-[#0c2030] hover:shadow-panel"
              >
                Try the live demo
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-lg border border-gray-muted bg-white px-6 py-3 text-base font-semibold text-navy transition-colors hover:bg-offwhite"
              >
                Get started
              </Link>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate/60"
            >
              <Stat>Works on any tablet</Stat>
              <Stat>No app for residents</Stat>
              <Stat>Live in under 10 minutes</Stat>
            </motion.div>
          </motion.div>

          <AnimatedDashboard />
        </div>
      </div>
    </section>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1 w-1 rounded-full bg-teal" />
      {children}
    </span>
  );
}
