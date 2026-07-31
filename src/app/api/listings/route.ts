import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCategoryKey } from '@/lib/categories';
import {
  isPricingKey,
  pricingForCategory,
  priceForPricing,
  MAX_PRICE_LENGTH,
} from '@/lib/pricing';
import { notifyListing } from '@/lib/discord-bot';

const API_KEY = process.env.API_KEY;

function isAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!API_KEY) return false;
  if (authHeader === `Bearer ${API_KEY}`) return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const category = new URL(request.url).searchParams.get('category');
    if (category !== null && !isCategoryKey(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const listings = await prisma.listing.findMany({
      where: category ? { category } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(listings, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.name || !body.description || !body.url) {
      return NextResponse.json(
        { error: 'name, description and url are required' },
        { status: 400 }
      );
    }
    if (!isCategoryKey(body.category)) {
      return NextResponse.json({ error: 'Invalid or missing category' }, { status: 400 });
    }
    if (
      body.pricing !== undefined &&
      body.pricing !== null &&
      !isPricingKey(body.pricing)
    ) {
      return NextResponse.json(
        { error: 'pricing must be FREE, PAID, FREEMIUM or null' },
        { status: 400 }
      );
    }
    if (body.price !== undefined && body.price !== null) {
      if (typeof body.price !== 'string') {
        return NextResponse.json({ error: 'price must be a string or null' }, { status: 400 });
      }
      if (body.price.length > MAX_PRICE_LENGTH) {
        return NextResponse.json(
          { error: `price must be ${MAX_PRICE_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
    }

    const pricing = pricingForCategory(body.category, body.pricing ?? null);

    const newListing = await prisma.listing.create({
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        developer: body.developer ?? null,
        url: body.url,
        secondaryUrl: body.secondaryUrl ?? null,
        isTrusted: body.isTrusted ?? true,
        // Shops and Other carry no meaningful pricing, so it is dropped rather
        // than stored and then hidden. A price only survives on top of a paid
        // or freemium listing, for the same reason.
        pricing,
        price: priceForPricing(pricing, body.price ?? null),
      },
    });

    await notifyListing('created', newListing);

    return NextResponse.json(newListing, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
  }
}
