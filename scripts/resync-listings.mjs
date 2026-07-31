// Re-sends every listing to the Discord bot so its forum post is re-rendered.
//
// Use this after changing how listing embeds look — the bot only redraws a post
// when the listing itself changes, so an embed change alone leaves existing
// posts on the old format.
//
// Safe to run repeatedly. `updated` makes the bot edit the existing post in
// place: same thread, same starter message, replies untouched. A listing the
// bot has no mapping for would be published as a *new* thread instead, so check
// the mapping count before running this against a fresh bot database.
//
//   cd /srv/websites/newqolhub.xyz/app && node scripts/resync-listings.mjs
//
//   --dry-run          list what would be sent, send nothing
//   --ids=a,b,c        only these listing ids, rather than all of them
//
// Note: the bot renames a thread only when the listing's name or trust badge
// changed. Discord allows just two thread renames per ten minutes, so a resync
// that also renames would need a much slower pace than the one used here.

import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');

const idsArg = process.argv.find((a) => a.startsWith('--ids='));
const ONLY_IDS = idsArg
  ? idsArg.slice('--ids='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const BOT_URL = process.env.DISCORD_BOT_URL;
const BOT_SECRET = process.env.DISCORD_BOT_SECRET;

if (!BOT_URL || !BOT_SECRET) {
  console.error('DISCORD_BOT_URL and DISCORD_BOT_SECRET must be set.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const listings = await prisma.listing.findMany({
    where: ONLY_IDS ? { id: { in: ONLY_IDS } } : undefined,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      developer: true,
      url: true,
      secondaryUrl: true,
      isTrusted: true,
      pricing: true,
      price: true,
    },
  });

  if (ONLY_IDS) {
    console.log(`${listings.length} of ${ONLY_IDS.length} requested id(s) found.`);
    const missing = ONLY_IDS.filter((id) => !listings.some((l) => l.id === id));
    if (missing.length) console.warn(`  not in the database: ${missing.join(', ')}`);
  } else {
    console.log(`${listings.length} listing(s) in the database.`);
  }

  if (DRY_RUN) {
    for (const l of listings) {
      console.log(`  would send ${l.id} — ${l.name} (${l.category})`);
    }
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const listing of listings) {
    try {
      const res = await fetch(`${BOT_URL.replace(/\/$/, '')}/events/listing`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${BOT_SECRET}`,
        },
        body: JSON.stringify({ action: 'updated', listing }),
      });

      if (res.ok) {
        ok += 1;
        console.log(`  ok   ${listing.name}`);
      } else {
        failed += 1;
        console.error(`  FAIL ${listing.id} (${res.status})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${listing.id}:`, error.message);
    }

    // Discord's edit limits are per channel and not generous; a gap here keeps
    // a full resync from tripping a 429 halfway through.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  console.log(`\ndone: ${ok} sent, ${failed} failed`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
