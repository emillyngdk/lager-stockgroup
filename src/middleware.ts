import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, validToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login") || pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/icon") || /\.(png|svg|ico|jpg|webp)$/.test(pathname)) {
    return NextResponse.next();
  }
  // ETL-token: den daglige opdatering henter /api/state uden session
  const etl = process.env.ETL_TOKEN;
  if (etl && pathname.startsWith("/api/state") && (req.nextUrl.searchParams.get("token") === etl || req.headers.get("x-etl-token") === etl)) return NextResponse.next();
  const ok = await validToken(req.cookies.get(COOKIE)?.value, process.env.SITE_PASSWORD);
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
