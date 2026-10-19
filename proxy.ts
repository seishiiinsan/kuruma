import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const SIGNED_IN_HOME = "/boosters";
const SIGNED_OUT_ONLY = new Set(["/", "/connexion"]);
// Profiles (/joueur), cards (/cartes) and the leaderboard stay public.
const SIGNED_IN_PREFIXES = ["/parametres", "/collection", "/boosters", "/echanges", "/admin", "/bienvenue"];

const isSignedInOnly = (pathname: string) =>
  SIGNED_IN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

function redirectKeepingSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  sessionResponse.cookies
    .getAll()
    .forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { response, isSignedIn } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isSignedIn && SIGNED_OUT_ONLY.has(pathname)) {
    return redirectKeepingSession(request, response, SIGNED_IN_HOME);
  }
  if (!isSignedIn && isSignedInOnly(pathname)) {
    return redirectKeepingSession(request, response, "/connexion");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
