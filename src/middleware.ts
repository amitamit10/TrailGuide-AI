import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/auth");

  const isPublicRoute = request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/share/") ||
    request.nextUrl.pathname === "/explore" ||
    request.nextUrl.pathname === "/offline";

  // These API routes use their own auth (CRON_SECRET / Telegram webhook secret).
  // They are called by external systems (Vercel Cron, Telegram) without a user
  // session, so they must bypass middleware's session-based redirect.
  const isServiceRoute =
    request.nextUrl.pathname.startsWith("/api/cron/") ||
    request.nextUrl.pathname === "/api/telegram/webhook";

  // Public, unauthenticated API routes. These are reached by logged-out
  // visitors on /share/[tripId] pages, so a session-based redirect here would
  // break every image and widget on a shared trip. Each one guards itself with
  // publicRatelimit (30/min per IP) instead of a session check.
  const isPublicApiRoute =
    request.nextUrl.pathname === "/api/places/photo" ||
    request.nextUrl.pathname === "/api/weather" ||
    request.nextUrl.pathname === "/api/visa";

  if (!user && !isAuthRoute && !isPublicRoute && !isServiceRoute && !isPublicApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
