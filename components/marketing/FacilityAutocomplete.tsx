"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  searchFacilities,
  type DirectoryFacility,
} from "@/lib/facilityDirectory";
import { EASE } from "./motion";

/**
 * Type-ahead over the national rehab facility directory. When a real facility
 * is chosen, the parent auto-fills address/phone/etc.
 */

export default function FacilityAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing your facility name…",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (f: DirectoryFacility) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<DirectoryFacility[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    setPicked(false);
    const r = searchFacilities(v, 8);
    setResults(r);
    setActive(0);
    setOpen(r.length > 0);
  }

  function choose(f: DirectoryFacility) {
    onSelect(f);
    setOpen(false);
    setPicked(true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => value.length >= 2 && results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="input pr-9"
          autoComplete="off"
        />
        {picked && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-gray-muted bg-white p-1.5 shadow-panel"
          >
            {results.map((f, i) => (
              <li key={f.ccn || `${f.name}-${i}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(f)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    i === active ? "bg-mint" : "hover:bg-offwhite"
                  }`}
                >
                  <p className="text-sm font-semibold text-navy">{f.name}</p>
                  <p className="text-xs text-slate/70">
                    {[f.city, f.state].filter(Boolean).join(", ")}
                    {f.zip ? ` ${f.zip}` : ""}
                  </p>
                </button>
              </li>
            ))}
            <li className="px-3 py-1.5 text-[11px] text-slate/50">
              Real facility data · U.S. CMS public provider directory
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
