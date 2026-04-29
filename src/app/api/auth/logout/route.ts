import { NextResponse } from "next/server";
import { logoutAction } from "@/lib/actions/auth";

export async function POST() {
  await logoutAction();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}