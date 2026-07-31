// Shared listing categories. The website, API, admin form, and the Discord bot
// should all agree on these identifiers, so keep this list authoritative.
// (SQLite via Prisma has no native enums, so category is stored as a String
// validated against these keys.)

// `color` uses authentic Minecraft chat colour codes (the §-codes Skyblock item
// rarities are drawn in) so the palette reads as native to players, and the hue
// encodes the category: green = safe/legit, red = risky/cheat, gold = economy.
//
// The palette is all that is borrowed. Categories used to also carry a rarity
// *word* ("Mythic", "Legendary") shown next to the label; those were dropped
// because they ranked listings in a way nothing here actually means — a shop is
// not more legendary than a mod.
export const CATEGORIES = [
  { key: 'CHEAT_CLIENT', label: 'Cheat Clients', color: '#FF5555' },
  { key: 'MACRO_CLIENT', label: 'Macro Clients', color: '#FF55FF' },
  { key: 'LEGIT_MOD', label: 'Legit Mods', color: '#55FF55' },
  { key: 'SHOP', label: 'Shops', color: '#FFAA00' },
  { key: 'OTHER', label: 'Other', color: '#55FFFF' },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]['key'];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as CategoryKey[];

export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === 'string' && (CATEGORY_KEYS as string[]).includes(value);
}

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function categoryColor(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.color ?? '#FFFFFF';
}

// Listings link out to a Discord server or website (no direct downloads), so
// the button label adapts to where the link points.
export function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host === 'discord.gg' ||
      host === 'discord.com' ||
      host.endsWith('.discord.gg') ||
      host.endsWith('.discord.com')
    ) {
      return 'Join Discord';
    }
  } catch {
    // Not a parseable absolute URL — fall through to the default label.
  }
  return 'Visit';
}
