import { getAllUsers, getAdminUsersKpis } from "@/lib/actions/super-admin";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

export default async function AdminUsersPage() {
  const [{ users, total }, kpis] = await Promise.all([
    getAllUsers({ page: 1, limit: 20 }),
    getAdminUsersKpis(),
  ]);

  return <AdminUsersClient initialUsers={users} initialTotal={total} kpis={kpis} />;
}
