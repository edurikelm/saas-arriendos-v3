import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/properties") || pathname.startsWith("/reservations") || pathname.startsWith("/calendar") || pathname.startsWith("/clients") || pathname.startsWith("/reports") || pathname.startsWith("/settings")) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const accessToken = request.cookies.get("sb-access-token")?.value;
    const refreshToken = request.cookies.get("sb-refresh-token")?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/properties/:path*", "/reservations/:path*", "/calendar/:path*", "/clients/:path*", "/reports/:path*", "/settings/:path*"],
};