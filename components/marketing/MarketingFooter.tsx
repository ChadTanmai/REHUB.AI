import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/demo", label: "Live demo" },
      { href: "/facility", label: "Facility overview" },
    ],
  },
  {
    title: "For your team",
    links: [
      { href: "/onboarding", label: "Set up a facility" },
      { href: "/setup/room", label: "Pair a room" },
      { href: "/setup/therapist", label: "Therapist sign in" },
      { href: "/therapist", label: "Dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact sales" },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-gray-muted bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <RehubWordmark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate/70">
              The communication and workflow platform for rehab centers, senior
              living, and care teams.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-navy">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate/70 transition-colors hover:text-teal"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-gray-muted pt-6">
          <p className="text-sm text-slate/70">
            Rehub is a communication and workflow tool. It does not replace
            emergency response systems or medical judgment. Demo mode uses
            fictional data only — no real patient information.
          </p>
          <p className="mt-3 text-xs text-slate/50">
            © {new Date().getFullYear()} Rehub. Built for rehab centers, senior
            living, and care teams.
          </p>
        </div>
      </div>
    </footer>
  );
}
