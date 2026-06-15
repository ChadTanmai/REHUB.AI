import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Link href="/">
            <RehubWordmark size="large" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-navy">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-center text-sm text-slate/70">{subtitle}</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-muted bg-white p-8 shadow-panel">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate/50">
          Rehub is a communication and workflow platform. Not a medical device.
        </p>
      </div>
    </div>
  );
}
