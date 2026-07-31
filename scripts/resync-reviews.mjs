// Re-sends every review to the Discord bot.
//
// Use this when review messages are missing from the reviews channel — for
// example after the category-change bug that deleted them, or if the bot's
// mapping database was lost.
//
// Safe to run repeatedly: the bot treats a `created` event for a review it
// already knows about as an edit, so existing messages are updated in place
// rather than duplicated. Reviews whose message is gone get reposted.
//
//   cd /srv/websites/newqolhub.xyz/app && node scripts/resync-reviews.mjs
//
//   --dry-run          list what would be sent, send nothing
//   --ids=a,b,c        only these review ids, rather than all of them
//
// Prefer --ids when only a few messages are missing: re-sending a healthy review
// is harmless but still an API call and an edit, and there is no reason to touch
// messages that are fine.

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
  const reviews = await prisma.review.findMany({
    where: ONLY_IDS ? { id: { in: ONLY_IDS } } : undefined,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      rating: true,
      body: true,
      user: { select: { username: true } },
      listing: { select: { id: true, name: true } },
    },
  });

  if (ONLY_IDS) {
    console.log(`${reviews.length} of ${ONLY_IDS.length} requested id(s) found.`);
    const missing = ONLY_IDS.filter((id) => !reviews.some((r) => r.id === id));
    if (missing.length) console.warn(`  not in the database: ${missing.join(', ')}`);
  } else {
    console.log(`${reviews.length} review(s) in the database.`);
  }
  if (DRY_RUN) {
    for (const r of reviews) {
      console.log(`  would send ${r.id} — ${r.listing.name} by ${r.user.username}`);
    }
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const r of reviews) {
    const payload = {
      action: 'created',
      review: {
        id: r.id,
        rating: r.rating,
        body: r.body,
        username: r.user.username,
        listingId: r.listing.id,
        listingName: r.listing.name,
      },
    };

    try {
      const res = await fetch(`${BOT_URL.replace(/\/$/, '')}/events/review`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${BOT_SECRET}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        ok += 1;
        console.log(`  ok   ${r.listing.name} — ${r.user.username}`);
      } else {
        failed += 1;
        console.error(`  FAIL ${r.id} (${res.status})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${r.id}:`, error.message);
    }

    // Discord's message-create limit is generous but not infinite; a small gap
    // keeps a large resync from tripping a 429.
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  console.log(`\ndone: ${ok} sent, ${failed} failed`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
