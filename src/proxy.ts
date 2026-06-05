import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

const protectedPaths = [
  "/dashboard",
  "/properties",
  "/reservations",
  "/calendar",
  "/clients",
  "/reports",
  "/settings",
  "/admin",
];

function startsWithAny(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPath = startsWithAny(pathname, protectedPaths);

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);

    if (!payload.userId) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/properties/:path*",
    "/reservations/:path*",
    "/calendar/:path*",
    "/clients/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};