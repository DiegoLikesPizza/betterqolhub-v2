// Whether a listing is free, paid, or both.
//
// Colours are status colours, not a categorical palette: green reads "no cost",
// gold matches the site's money accent, cyan is neutral for the mixed case.
// Every badge ships with its label, so the meaning is never carried by hue alone.

export const PRICING = [
  { key: 'FREE', label: 'Free', color: '#55FF55', short: 'Free' },
  { key: 'PAID', label: 'Paid', color: '#FFAA00', short: 'Paid' },
  { key: 'FREEMIUM', label: 'Free + paid tiers', color: '#55FFFF', short: 'Freemium' },
] as const;

export type PricingKey = (typeof PRICING)[number]['key'];

export const PRICING_KEYS = PRICING.map((p) => p.key) as PricingKey[];

export function isPricingKey(value: unknown): value is PricingKey {
  return typeof value === 'string' && (PRICING_KEYS as string[]).includes(value);
}

/**
 * Categories where a pricing label carries no information.
 *
 * A shop is transactional by definition — tagging one "Paid" tells a reader
 * nothing they did not already know. OTHER is a catch-all, so pricing may not
 * apply at all. Both are excluded rather than left to admin discretion, so the
 * data stays consistent and the badge keeps meaning something where it appears.
 */
const CATEGORIES_WITHOUT_PRICING = new Set(['SHOP', 'OTHER']);

export function categoryHasPricing(category: string): boolean {
  return !CATEGORIES_WITHOUT_PRICING.has(category);
}

/**
 * The value to persist for a category, so pricing can never linger on a listing
 * that was recategorised into a shop after the fact.
 */
export function pricingForCategory(
  category: string,
  pricing: PricingKey | null
): PricingKey | null {
  return categoryHasPricing(category) ? pricing : null;
}

/**
 * Pricing states where a concrete price adds information.
 *
 * FREE is excluded because "Free · 0€" is noise, and unset is excluded because a
 * price without a pricing state would be a badge with no label. FREEMIUM is
 * included: the price there describes what the paid tier costs.
 */
const PRICING_WITH_PRICE = new Set<string>(['PAID', 'FREEMIUM']);

export function pricingHasPrice(pricing: string | null): boolean {
  return pricing !== null && PRICING_WITH_PRICE.has(pricing);
}

/**
 * Long enough for "from 4,99 € / month (premium)", short enough that it cannot
 * be used as a second description field or break a table cell.
 */
export const MAX_PRICE_LENGTH = 48;

/**
 * Collapses whitespace and trims. Prices are typed by hand into a small field,
 * so stray double spaces and trailing tabs are the norm rather than the
 * exception, and they would show up verbatim in a badge.
 */
export function normalisePrice(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * The value to persist, so a price can never linger on a listing that was later
 * marked free or had its pricing cleared — the same guarantee
 * pricingForCategory() gives for pricing itself.
 */
export function priceForPricing(pricing: string | null, price: string | null): string | null {
  if (!pricingHasPrice(pricing)) return null;
  const cleaned = price ? normalisePrice(price) : '';
  return cleaned ? cleaned.slice(0, MAX_PRICE_LENGTH) : null;
}

/**
 * Badge text: the pricing state, plus the concrete price when one is recorded.
 *
 * The state stays in front so the badge still reads as a category of thing
 * ("Paid · 5€/month") rather than a bare number, which would be ambiguous next
 * to a rating. Falls back to the label alone for listings whose price nobody has
 * filled in yet.
 */
export function pricingBadge(
  pricing: string | null,
  price: string | null,
  form: 'short' | 'long' = 'long'
): string | null {
  const label = form === 'short' ? pricingShort(pricing) : pricingLabel(pricing);
  if (!label) return null;
  return price ? `${label} · ${price}` : label;
}

export function pricingLabel(key: string | null): string | null {
  if (!key) return null;
  return PRICING.find((p) => p.key === key)?.label ?? null;
}

/** Compact form for badges and table cells, where the full label is too long. */
export function pricingShort(key: string | null): string | null {
  if (!key) return null;
  return PRICING.find((p) => p.key === key)?.short ?? null;
}

export function pricingColor(key: string | null): string {
  if (!key) return '#9C92B8';
  return PRICING.find((p) => p.key === key)?.color ?? '#9C92B8';
}
