import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import {
  getAccessControl,
  approvePending,
  removeFromPending,
} from '@/lib/auth/access-control';
import { z } from 'zod';

const bodySchema = z.object({
  email: z.email(),
  action: z.enum(['approve', 'reject']),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { email, action } = bodySchema.parse(body);

    const data = await getAccessControl();
    const normalized = email.toLowerCase().trim();
    const inPending = data.pending.some(
      (p) => p.email.toLowerCase() === normalized
    );
    if (!inPending) {
      return NextResponse.json(
        { error: 'Ten adres nie jest w poczekalni' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      const { sent } = await approvePending(email);
      return NextResponse.json({
        success: true,
        message: sent
          ? 'Zatwierdzono i wysłano kod na email'
          : 'Zatwierdzono (wysłanie maila nie powiodło się – użytkownik może poprosić o kod ponownie po zalogowaniu)',
      });
    }

    await removeFromPending(email);
    return NextResponse.json({
      success: true,
      message: 'Odrzucono zgłoszenie',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane' },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Wymagane uprawnienia admina' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Operacja nie powiodła się' },
      { status: 500 }
    );
  }
}
