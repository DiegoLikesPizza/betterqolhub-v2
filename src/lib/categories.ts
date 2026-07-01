// Shared listing categories. The website, API, admin form, and the Discord bot
// should all agree on these identifiers, so keep this list authoritative.
// (SQLite via Prisma has no native enums, so category is stored as a String
// validated against these keys.)

// `color` uses authentic Minecraft chat colour codes (the §-codes Skyblock item
// rarities are drawn in) so the palette reads as native to players, and the hue
// encodes the category: green = safe/legit, red = risky/cheat, gold = economy.
export const CATEGORIES = [
  { key: 'CHEAT_CLIENT', label: 'Cheat Clients', rarity: 'Special', color: '#FF5555' },
  { key: 'MACRO_CLIENT', label: 'Macro Clients', rarity: 'Mythic', color: '#FF55FF' },
  { key: 'LEGIT_MOD', label: 'Legit Mods', rarity: 'Uncommon', color: '#55FF55' },
  { key: 'SHOP', label: 'Shops', rarity: 'Legendary', color: '#FFAA00' },
  { key: 'OTHER', label: 'Other', rarity: 'Rare', color: '#55FFFF' },
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

export function categoryRarity(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.rarity ?? 'Common';
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
