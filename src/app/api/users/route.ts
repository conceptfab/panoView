import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { getUsers, createUser, getUserByEmail } from '@/lib/db/users';
import { addToWhitelist, isEmailAllowed } from '@/lib/auth/access-control';
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email'),
  role: z.enum(['admin', 'user', 'editor']).optional().default('user'),
  groupIds: z.array(z.string()).optional().default([]),
  addToWhitelist: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await getUsers();
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Nieprawidłowe dane' },
        { status: 400 }
      );
    }

    const {
      email,
      role,
      groupIds,
      addToWhitelist: shouldAddToWhitelist,
    } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Sprawdź czy użytkownik już istnieje
    const existingUser = await getUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Użytkownik z tym adresem email już istnieje' },
        { status: 409 }
      );
    }

    // Dodaj do białej listy jeśli nie jest już dozwolony
    let whitelistAdded = false;
    if (shouldAddToWhitelist) {
      const alreadyAllowed = await isEmailAllowed(normalizedEmail);
      if (!alreadyAllowed) {
        await addToWhitelist(normalizedEmail, 'Ręcznie dodany użytkownik');
        whitelistAdded = true;
      }
    }

    // Utwórz użytkownika
    const user = await createUser(normalizedEmail, role, groupIds);

    return NextResponse.json({
      user,
      whitelistAdded,
      message: whitelistAdded
        ? 'Użytkownik utworzony i dodany do białej listy'
        : 'Użytkownik utworzony',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: 'Użytkownik z tym adresem email już istnieje' },
        { status: 409 }
      );
    }
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Nie udało się utworzyć użytkownika' },
      { status: 500 }
    );
  }
}
