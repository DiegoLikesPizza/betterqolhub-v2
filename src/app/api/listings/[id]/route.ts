import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCategoryKey } from '@/lib/categories';
import {
  isPricingKey,
  pricingForCategory,
  priceForPricing,
  normalisePrice,
  MAX_PRICE_LENGTH,
  type PricingKey,
} from '@/lib/pricing';
import { notifyListing } from '@/lib/discord-bot';

const API_KEY = process.env.API_KEY;

function isAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!API_KEY) return false;
  if (authHeader === `Bearer ${API_KEY}`) return true;
  return false;
}

// Only these fields may be written through the API. Everything else in the body
// (id, createdAt, updatedAt, ...) is ignored rather than passed to Prisma.
type ListingUpdate = {
  name?: string;
  description?: string;
  category?: string;
  developer?: string | null;
  url?: string;
  secondaryUrl?: string | null;
  isTrusted?: boolean;
  pricing?: PricingKey | null;
  price?: string | null;
};

function buildUpdate(body: Record<string, unknown>): ListingUpdate | { error: string } {
  const data: ListingUpdate = {};

  for (const field of ['name', 'description', 'url'] as const) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== 'string' || !(body[field] as string).trim()) {
      return { error: `${field} must be a non-empty string` };
    }
    data[field] = body[field] as string;
  }

  for (const field of ['developer', 'secondaryUrl'] as const) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && typeof body[field] !== 'string') {
      return { error: `${field} must be a string or null` };
    }
    data[field] = (body[field] as string | null) || null;
  }

  if (body.category !== undefined) {
    if (!isCategoryKey(body.category)) {
      return { error: 'Invalid category' };
    }
    data.category = body.category;
  }

  if (body.isTrusted !== undefined) {
    if (typeof body.isTrusted !== 'boolean') {
      return { error: 'isTrusted must be a boolean' };
    }
    data.isTrusted = body.isTrusted;
  }

  // Explicit null is meaningful here — it clears the pricing back to unset.
  if (body.pricing !== undefined) {
    if (body.pricing === null) {
      data.pricing = null;
    } else if (isPricingKey(body.pricing)) {
      data.pricing = body.pricing;
    } else {
      return { error: 'pricing must be FREE, PAID, FREEMIUM or null' };
    }
  }

  // Explicit null clears the price. An empty string does too, rather than
  // storing a blank that would render as a stray separator in the badge.
  if (body.price !== undefined) {
    if (body.price === null) {
      data.price = null;
    } else if (typeof body.price !== 'string') {
      return { error: 'price must be a string or null' };
    } else if (body.price.length > MAX_PRICE_LENGTH) {
      return { error: `price must be ${MAX_PRICE_LENGTH} characters or fewer` };
    } else {
      data.price = normalisePrice(body.price) || null;
    }
  }

  return data;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const body = await request.json();

    const result = buildUpdate(body ?? {});
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (Object.keys(result).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    // Category and pricing can each be updated independently, so the effective
    // category has to be resolved against the stored row before deciding
    // whether pricing may survive. Moving a client into Shops clears it even if
    // this request never mentioned pricing.
    const existing = await prisma.listing.findUnique({
      where: { id: resolvedParams.id },
      select: { category: true, pricing: true, price: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const effectiveCategory = result.category ?? existing.category;
    const effectivePricing = result.pricing !== undefined ? result.pricing : existing.pricing;
    result.pricing = pricingForCategory(effectiveCategory, effectivePricing);

    // The price has to be resolved against the *resulting* pricing, not the
    // request: flipping a paid listing to FREE without mentioning price must
    // clear the stored price rather than leave it stranded and invisible.
    const effectivePrice = result.price !== undefined ? result.price : existing.price;
    result.price = priceForPricing(result.pricing, effectivePrice);

    const updatedListing = await prisma.listing.update({
      where: { id: resolvedParams.id },
      data: result,
    });

    await notifyListing('updated', updatedListing);

    return NextResponse.json(updatedListing, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    await prisma.listing.delete({
      where: { id: resolvedParams.id },
    });

    await notifyListing('deleted', { id: resolvedParams.id });

    return NextResponse.json({ message: 'Listing deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}
