import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth middleware.
 * - Refreshes Supabase session cookies on every request.
 * - Protects /therapist, /admin, /facility, /setup, /onboarding behind auth
 *   when Supabase is configured. In demo mode (no env vars) everything is open.
 * - Redirects unauthenticated users to /auth/signin with a `next` param.
 * - Redirects authenticated users away from /auth/* pages.
 */

const PROTECTED = ["/therapist", "/admin", "/facility", "/setup", "/onboarding"];
const AUTH_PAGES = ["/auth/signin", "/auth/signup", "/auth/verify-email", "/auth/reset-password"];

const SUPABASE_ENABLED =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function middleware(request: NextRequest) {
  // If Supabase is not configured, skip auth entirely (demo mode).
  if (!SUPABASE_ENABLED) return NextResponse.next();

  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
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

  // Redirect logged-in users away from auth pages
  if (user && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/facility", request.url));
  }

  // Protect app routes
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (isProtected && !user) {
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
