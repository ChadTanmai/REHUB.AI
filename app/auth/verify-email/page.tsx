import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Verify your email">
      <div className="py-4 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-teal">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-navy">Check your inbox</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate/70">
            We sent a verification link to your email address. Click the link to
            verify your account and access your facility dashboard.
          </p>
        </div>

        <div className="rounded-lg border border-gray-muted bg-offwhite p-4 text-left text-sm text-slate/70">
          <p className="font-medium text-navy">Didn&apos;t receive it?</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            <li>• Check your spam or junk folder</li>
            <li>• Make sure you used your work email</li>
            <li>• Verification links expire after 24 hours</li>
          </ul>
        </div>

        <Link
          href="/auth/signin"
          className="inline-block text-sm font-medium text-teal hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
