import { notFound } from "next/navigation";
import { AdminSupportDetail } from "@/components/admin/support/admin-support-detail";
import { getAdminSupportTicketDetail } from "@/lib/actions/admin-support";
import { markSupportTicketAsRead } from "@/lib/actions/support-unread";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminSupportTicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getAdminSupportTicketDetail(id);

  if (!data) {
    notFound();
  }

  await markSupportTicketAsRead(id);

  return <AdminSupportDetail data={data} />;
}
