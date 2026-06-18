import { requireOwner } from "@/lib/actions/auth";
import { NewTicketForm } from "@/components/support/new-ticket-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewTicketPage() {
  await requireOwner();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo Ticket de Soporte</CardTitle>
      </CardHeader>
      <CardContent>
        <NewTicketForm />
      </CardContent>
    </Card>
  );
}
