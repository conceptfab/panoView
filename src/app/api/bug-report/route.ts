import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getUsers } from '@/lib/db/users';
import { sendBugReportToAdmins } from '@/lib/email/resend';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json(
        { error: 'Musisz być zalogowany' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json(
        { error: 'Wpisz treść zgłoszenia' },
        { status: 400 }
      );
    }

    const users = await getUsers();
    const adminEmails = users.flatMap((u) =>
      u.role === 'admin' && u.isActive ? [u.email] : []
    );

    const result = await sendBugReportToAdmins(
      adminEmails,
      session.email,
      message,
      APP_VERSION
    );

    if (!result.success) {
      console.error('[Bug report] send failed:', result.error);
      return NextResponse.json(
        {
          error:
            'Nie udało się wysłać zgłoszenia. Sprawdź konfigurację poczty (Resend) po stronie serwera.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bug report error:', error);
    return NextResponse.json(
      { error: 'Błąd wysyłki zgłoszenia' },
      { status: 500 }
    );
  }
}
