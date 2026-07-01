import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCategoryKey } from '@/lib/categories';

const API_KEY = process.env.API_KEY;

function isAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!API_KEY) return false;
  if (authHeader === `Bearer ${API_KEY}`) return true;
  return false;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const body = await request.json();

    if (body.category !== undefined && !isCategoryKey(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const updatedListing = await prisma.listing.update({
      where: { id: resolvedParams.id },
      data: body,
    });
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
    return NextResponse.json({ message: 'Listing deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}
