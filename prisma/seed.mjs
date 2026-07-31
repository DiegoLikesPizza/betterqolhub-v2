import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

// Listings exported from the pre-Postgres SQLite database. Optional — delete the
// file once the data lives in Postgres and this step becomes a no-op.
const listingsFile = fileURLToPath(new URL('./listings.seed.json', import.meta.url));

async function seedAdmin() {
  if (!username || !password) {
    throw new Error(
      'Set ADMIN_USERNAME and ADMIN_PASSWORD in your environment before seeding.'
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Explicitly ADMIN: the User default is USER now that anyone can sign up, so
  // the bootstrap account has to be promoted here or nobody can reach /admin.
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role: 'ADMIN' },
    create: { username, passwordHash, role: 'ADMIN' },
  });

  console.log(`Admin user "${user.username}" is ready (role: ${user.role}).`);
}

async function seedListings() {
  if (!existsSync(listingsFile)) return;

  const listings = JSON.parse(readFileSync(listingsFile, 'utf8'));

  // Upsert by id so re-running the seed never duplicates rows and never
  // clobbers edits made through the admin form after the first import.
  for (const listing of listings) {
    await prisma.listing.upsert({
      where: { id: listing.id },
      update: {},
      create: {
        ...listing,
        createdAt: new Date(listing.createdAt),
        updatedAt: new Date(listing.updatedAt),
      },
    });
  }

  console.log(`Imported ${listings.length} listing(s) from listings.seed.json.`);
}

async function main() {
  await seedAdmin();
  await seedListings();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
