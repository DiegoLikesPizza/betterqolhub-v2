import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const updatedMod = await prisma.mod.update({
      where: { id: resolvedParams.id },
      data: body,
    });
    return NextResponse.json(updatedMod, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update mod' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    await prisma.mod.delete({
      where: { id: resolvedParams.id },
    });
    return NextResponse.json({ message: 'Mod deleted successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete mod' }, { status: 500 });
  }
}
