import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create SUPER_ADMIN user (you)
  const superAdmin = await prisma.userProfile.upsert({
    where: { email: "eduardo@example.com" }, // Change this to your email
    update: {},
    create: {
      email: "eduardo@example.com",
      password: "hashed_password_here", // In real app, hash this!
      role: "SUPER_ADMIN",
      plan: null,
    },
  });

  console.log("Super Admin created:", superAdmin.email);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());