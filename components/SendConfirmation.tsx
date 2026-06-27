"use client";

/**
 * Single, continuous "message sent" confirmation for the patient screen.
 *
 * Sequence (Material-motion inspired): the listening rings collapse inward → a
 * paper airplane lifts and flies forward → it lands as a checkmark whose stroke
 * draws naturally → a soft ring expands → "Message sent" fades. Then onComplete
 * returns the screen to the idle Talk state. No buttons, no decisions.
 *
 * Accessibility: animation is never the ONLY signal — the parent also plays a
 * sound and speaks aloud. With prefers-reduced-motion we show a simple, instant
 * checkmark instead of the flight, preserving all meaning.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const TEAL = "#2c9c97";
const GREEN = "#16a34a";

export default function SendConfirmation({
  failed = false,
  onComplete,
}: {
  failed?: boolean;
  onComplete: () => void;
}) {
  const reduce = useReducedMotion();
  // step: 0 collapse · 1 airplane flight · 2 checkmark + ring
  const [step, setStep] = useState(reduce ? 2 : 0);

  useEffect(() => {
    if (failed) return; // failure state holds until parent resolves it
    if (reduce) {
      const t = setTimeout(onComplete, 1600);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setStep(1), 480);
    const t2 = setTimeout(() => setStep(2), 1180);
    const t3 = setTimeout(onComplete, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [reduce, failed, onComplete]);

  // Subtle haptic + chime exactly when the checkmark lands.
  useEffect(() => {
    if (failed || step !== 2) return;
    try { navigator.vibrate?.(reduce ? 30 : [18, 40, 22]); } catch { /* ignore */ }
    playChime();
  }, [step, failed, reduce]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <motion.span className="absolute rounded-full" style={{ width: 150, height: 150, background: "rgba(240,180,41,0.16)" }}
            animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#b8860b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 20h20L12 2z" /><path d="M12 9v5M12 17.5v.5" />
          </svg>
        </div>
        <div>
          <p className="text-3xl font-bold text-navy">Still sending…</p>
          <p className="mt-2 text-lg text-slate/60">I&apos;m having trouble reaching your care team — I&apos;ll keep trying automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-7 text-center">
      <div className="relative flex h-56 w-56 items-center justify-center">
        {/* Phase 0 — listening rings collapse inward */}
        <AnimatePresence>
          {step === 0 && [0, 1, 2].map((i) => (
            <motion.span key={i} className="absolute rounded-full border-2"
              style={{ borderColor: "rgba(56,178,172,0.4)" }}
              initial={{ width: 210 - i * 30, height: 210 - i * 30, opacity: 0.7 }}
              animate={{ width: 60, height: 60, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
            />
          ))}
        </AnimatePresence>

        {/* Phase 1 — paper airplane lifts and flies forward */}
        <AnimatePresence>
          {step === 1 && (
            <motion.div className="absolute"
              initial={{ x: 0, y: 16, rotate: -8, opacity: 0, scale: 0.7 }}
              animate={{ x: [0, 14, 78], y: [16, -6, -52], rotate: [-8, 6, 14], opacity: [0, 1, 0], scale: [0.7, 1, 0.85] }}
              transition={{ duration: 0.85, ease: [0.45, 0, 0.2, 1], times: [0, 0.45, 1] }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 2 — checkmark lands + confirmation ring expands */}
        <AnimatePresence>
          {step === 2 && (
            <>
              <motion.span className="absolute rounded-full border-2"
                style={{ borderColor: GREEN }}
                initial={{ width: 96, height: 96, opacity: 0.55 }}
                animate={{ width: 196, height: 196, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
              <motion.div className="flex items-center justify-center rounded-full"
                style={{ width: 132, height: 132, background: "rgba(34,197,94,0.15)" }}
                initial={{ scale: reduce ? 1 : 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}>
                <svg width="68" height="68" viewBox="0 0 24 24" fill="none">
                  <motion.path d="M20 6L9 17l-5-5" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, ease: "easeInOut", delay: reduce ? 0 : 0.12 }} />
                </svg>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {step === 2 && (
          <motion.p className="text-3xl font-bold text-navy"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}>
            Message sent
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Soft two-note confirmation chime via Web Audio — no asset, very subtle. */
function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    [[660, 0], [990, 0.12]].forEach(([freq, t]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.12, now + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch { /* ignore */ }
}
