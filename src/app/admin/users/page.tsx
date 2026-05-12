import { getAllUsers } from "@/lib/actions/super-admin";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

export default async function AdminUsersPage() {
  const { users, total } = await getAllUsers({ page: 1, limit: 20 });

  return <AdminUsersClient initialUsers={users} initialTotal={total} />;
}