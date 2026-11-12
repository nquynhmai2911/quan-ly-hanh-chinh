import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findUnique({ where: { code: "SPECIALIST" } });
  if (!role) {
    console.error("Role SPECIALIST not found");
    return;
  }
  const perms = await prisma.permission.findMany({
    where: {
      code: {
        in: [
          "doc.incoming.register",
          "doc.incoming.forward",
          "doc.incoming.assign",
        ],
      },
    },
  });
  for (const perm of perms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: perm.id,
      },
    });
    console.log(`Granted ${perm.code} to SPECIALIST`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
