/**
 * Lead capture (demo).
 *
 * Stores demo/contact requests in localStorage only — nothing is transmitted.
 * In production this would POST to a CRM or a Supabase `leads` table. Keeping it
 * local means the marketing forms are fully functional in the demo with zero
 * backend and zero data leaving the browser.
 */

"use client";

import { sanitizeField, sanitizeText } from "./security";

const KEY = "rehub:leads";

export interface Lead {
  id: string;
  kind: "contact" | "onboarding";
  name: string;
  email: string;
  facility?: string;
  role?: string;
  rooms?: string;
  message?: string;
  createdAt: string;
}

export function saveLead(input: Omit<Lead, "id" | "createdAt">): Lead {
  const lead: Lead = {
    id: `lead-${Date.now().toString(36)}`,
    kind: input.kind,
    name: sanitizeField(input.name, 80),
    email: sanitizeField(input.email, 120),
    facility: input.facility ? sanitizeField(input.facility, 80) : undefined,
    role: input.role ? sanitizeField(input.role, 60) : undefined,
    rooms: input.rooms ? sanitizeField(input.rooms, 20) : undefined,
    message: input.message ? sanitizeText(input.message) : undefined,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      const existing = JSON.parse(localStorage.getItem(KEY) || "[]") as Lead[];
      existing.push(lead);
      localStorage.setItem(KEY, JSON.stringify(existing));
    } catch {
      /* ignore */
    }
  }
  return lead;
}

export function getLeads(): Lead[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Lead[];
  } catch {
    return [];
  }
}
