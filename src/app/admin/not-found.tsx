import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-muted-foreground">
          The admin page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link href="/admin">
        <Button variant="outline">Go to Admin Dashboard</Button>
      </Link>
    </div>
  );
}