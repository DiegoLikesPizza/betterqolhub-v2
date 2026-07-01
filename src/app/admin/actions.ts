'use server';

import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCategoryKey } from '@/lib/categories';

export type AddListingState = {
  ok?: boolean;
  message?: string;
} | undefined;

export async function addListing(
  _prevState: AddListingState,
  formData: FormData
): Promise<AddListingState> {
  const session = await auth();
  if (!session) {
    return { ok: false, message: 'Not authenticated.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const developer = String(formData.get('developer') ?? '').trim();
  const secondaryUrl = String(formData.get('secondaryUrl') ?? '').trim();
  const isTrusted = formData.get('isTrusted') === 'on';

  if (!name || !description || !url) {
    return { ok: false, message: 'Name, description and primary link are required.' };
  }
  if (!isCategoryKey(category)) {
    return { ok: false, message: 'Please choose a valid category.' };
  }

  try {
    await prisma.listing.create({
      data: {
        name,
        category,
        description,
        url,
        developer: developer || null,
        secondaryUrl: secondaryUrl || null,
        isTrusted,
      },
    });
    return { ok: true, message: `Added "${name}" successfully.` };
  } catch {
    return { ok: false, message: 'Failed to create listing.' };
  }
}

export async function logout() {
  await signOut({ redirectTo: '/admin/login' });
}
