import { NextResponse } from "next/server";
import { COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const pw = String(form.get("password") || "");
  const next = String(form.get("next") || "/");
  const expected = process.env.SITE_PASSWORD;
  if (!expected || pw !== expected) {
    const url = new URL("/login", req.url);
    url.searchParams.set("fejl", "1");
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.url), 303);
  res.cookies.set(COOKIE, await sessionToken(expected), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
