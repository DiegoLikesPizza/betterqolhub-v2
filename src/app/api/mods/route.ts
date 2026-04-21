import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const API_KEY = process.env.API_KEY;

function isAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!API_KEY) return false;
  if (authHeader === `Bearer ${API_KEY}`) return true;
  return false;
}

export async function GET() {
  try {
    const mods = await prisma.mod.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(mods, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch mods' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const newMod = await prisma.mod.create({
      data: {
        name: body.name,
        description: body.description,
        developer: body.developer,
        downloadUrl: body.downloadUrl,
        sourceUrl: body.sourceUrl,
        isTrusted: body.isTrusted ?? true,
      }
    });
    return NextResponse.json(newMod, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create mod' }, { status: 500 });
  }
}
