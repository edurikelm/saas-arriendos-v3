import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { getDefaultPathForRole } from "@/lib/auth/role-routes";
import { LandingPage } from "@/components/landing/landing-page";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect(getDefaultPathForRole(session.role));
  }

  return <LandingPage />;
}
