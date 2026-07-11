import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getSupportTicketDetail } from "@/lib/actions/support";
import { markSupportTicketAsRead } from "@/lib/actions/support-unread";
import { SupportDetail } from "@/components/support/support-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function SupportTicketDetailPage({ params }: Props) {
  await requireOwner();

  const { id } = await params;
  const ticket = await getSupportTicketDetail(id);

  if (!ticket) notFound();

  await markSupportTicketAsRead(id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ticket.subject}</CardTitle>
      </CardHeader>
      <CardContent>
        <SupportDetail ticket={ticket} />
      </CardContent>
    </Card>
  );
}
