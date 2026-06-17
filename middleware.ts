import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth + role middleware.
 *
 * Route protection rules:
 *   /auth/*          → redirect to /facility if already signed in
 *   /therapist       → requires auth (care team only)
 *   /admin           → requires auth (director/admin only)
 *   /facility        → requires auth
 *   /onboarding      → requires auth
 *   /room/*          → public (patient room devices don't have accounts)
 *   /join            → public (invite link landing page)
 *   /demo            → public
 *   /privacy /terms  → public
 *
 * In demo mode (no Supabase env vars), all routes are open so the product
 * can be evaluated without creating an account.
 */

const STAFF_ROUTES   = ["/therapist", "/admin", "/facility", "/onboarding"];
const AUTH_PAGES     = ["/auth/signin", "/auth/signup", "/auth/verify-email", "/auth/reset-password"];

const SUPABASE_ENABLED =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function middleware(request: NextRequest) {
  if (!SUPABASE_ENABLED) return NextResponse.next();

  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Signed-in users don't need to see auth pages
  if (user && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/facility", request.url));
  }

  // Staff/director routes require authentication
  const needsAuth = STAFF_ROUTES.some((p) => pathname.startsWith(p));
  if (needsAuth && !user) {
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
