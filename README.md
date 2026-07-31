# Better QOLHub

The community-vetted hub for Hypixel Skyblock cheat clients, macros, legit mods, and shops — a web front-end for the [Discord](https://discord.gg/E56QxrW9Jt). Every listing is checked before it lands, then piped through to the Discord bot.

Listings are rendered as Minecraft item tooltips: each category maps to a Skyblock rarity and an authentic `§`-code chat colour, so the palette reads as native to players.

## Stack

- **Next.js 16** (App Router) + **React 19**, with the React Compiler enabled
- **Prisma 5** over PostgreSQL
- **NextAuth v5** (credentials + bcrypt) for the admin area
- Plain CSS in `src/app/globals.css` — no UI framework

## Getting started

You need a PostgreSQL database — a local server, or a free hosted one from [Neon](https://neon.tech) or [Supabase](https://supabase.com).

```bash
npm install
# point DATABASE_URL / DIRECT_DATABASE_URL in .env at your database
npx prisma migrate deploy          # or `migrate dev` while changing the schema
npm run seed                       # first admin + any listings.seed.json rows
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

`.env` holds the Prisma datasource; everything else belongs in `.env.local` (both are gitignored). Don't set `DATABASE_URL` in `.env.local` — it silently overrides `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string used at runtime. On a pooled host, the **pooled** string |
| `DIRECT_DATABASE_URL` | Unpooled string, used by `prisma migrate` only. Same as above for a plain local server |
| `AUTH_SECRET` | NextAuth signing secret — generate with `npx auth secret` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Read only by `npm run seed` to create the first admin; safe to remove afterwards |
| `API_KEY` | Bearer token for programmatic writes to `/api/listings` (used by the Discord bot) |

## Layout

```
src/
  app/
    page.tsx              Landing page
    listings/             Public catalog — server fetch + client-side category tabs
    listings/[id]/        Listing detail page and its review form/list
    (account)/            Public sign-in, registration, and the logout action
    admin/                Admin dashboard: stats, moderation, listing + member management
    api/listings/         REST API: public GET, Bearer-authed POST/PUT/DELETE
  lib/categories.ts       Authoritative category list (key → label → rarity → colour)
  lib/reviews.ts          Rating validation and aggregation
  lib/authz.ts            currentUser / requireUser / requireAdmin
  auth.ts                 NextAuth configuration (role baked into the JWT)
  proxy.ts                Optimistic session gate over /admin/*
prisma/
  schema.prisma           User + Listing + Review models
  seed.mjs                Admin bootstrap + optional listing import
```

## Accounts and reviews

Anyone can register at `/register`. New accounts get the `USER` role; `ADMIN` is
granted by the seed (for the bootstrap account) or from the Members table on the
dashboard. An admin cannot revoke their own admin access — that is the one change
that could lock everyone out.

Members can leave one review per listing, rated 1-5 with a body. Posting again
edits the existing review rather than adding a second (enforced by a composite
unique on `(userId, listingId)`, upserted in the server action). A member can
delete their own review; an admin can delete any.

### A note on where authorization actually happens

`src/proxy.ts` runs on every request and can only check that *a* session cookie
exists — the JWT is encrypted and Proxy must not hit the database. Since any
member has a session cookie, **Proxy does not keep members out of `/admin`**. The
real checks are `currentUser()` in `src/app/admin/page.tsx` and `requireAdmin()`
inside every admin server action. Server actions are POST endpoints that can be
invoked directly, so each one re-checks rather than trusting the page it renders in.

## API

`GET /api/listings` is public and accepts an optional `?category=` filter, validated against `CATEGORY_KEYS`.

`POST /api/listings`, `PUT /api/listings/:id`, and `DELETE /api/listings/:id` require an `Authorization: Bearer $API_KEY` header. Writes accept only `name`, `description`, `category`, `developer`, `url`, `secondaryUrl`, and `isTrusted` — any other field in the body is ignored.

```bash
curl -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Example","description":"...","category":"LEGIT_MOD","url":"https://discord.gg/..."}'
```

## Adding a category

Edit `src/lib/categories.ts` — the site, API validation, admin form, and bot all read from that one list. No migration is needed; `category` is stored as a validated string because SQLite has no native enums.

## Deploying

Set `DATABASE_URL`, `DIRECT_DATABASE_URL`, `AUTH_SECRET`, and `API_KEY` in the host's environment, then run `npx prisma migrate deploy` as part of the release step.

On a pooled host, `DATABASE_URL` must be the pooled connection string — serverless functions open a connection per instance and will exhaust a direct Postgres connection limit under any real traffic. `DIRECT_DATABASE_URL` is only read by `prisma migrate`, which needs to bypass the pooler to run DDL.

The project previously used SQLite; the migration history was squashed into a single Postgres init migration when it moved. The pre-Postgres SQLite migrations are in git history at commit `23160ed` if you ever need them.
