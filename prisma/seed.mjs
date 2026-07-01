import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!username || !password) {
    throw new Error(
      'Set ADMIN_USERNAME and ADMIN_PASSWORD in your environment before seeding.'
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log(`Admin user "${user.username}" is ready.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
