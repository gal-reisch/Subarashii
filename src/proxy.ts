import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionCookieValue } from "@/lib/session";

// Public routes that do not require the shared PIN.
function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/api/ingest");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionCookieValue(cookie)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Run on all routes except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
