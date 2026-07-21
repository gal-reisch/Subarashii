"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rateLimit";
import { createSessionCookieValue, isCorrectPin, SESSION_COOKIE } from "@/lib/session";

// ~400 days — long enough that Ella and I effectively never have to re-enter
// the PIN, which is the entire point of dropping magic-link auth.
const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export async function verifyPinAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`login:${ip}`, 10, 60_000)) {
    redirect("/login?error=rate");
  }

  if (!pin || !isCorrectPin(pin)) {
    redirect("/login?error=pin");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/");
}
