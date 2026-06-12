import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/utils/validation';
import {
  isEmailAllowed,
  addToPending,
  getAccessControl,
} from '@/lib/auth/access-control';
import { matchEmailPattern } from '@/utils/helpers';
import { generateOTP, storeOTP } from '@/lib/auth/otp';
import {
  sendOTPEmail,
  sendPendingRequestNotificationToAdmins,
} from '@/lib/email/resend';
import { getUsers, getUserByEmail } from '@/lib/db/users';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = loginSchema.parse(body);

    const allowed = await isEmailAllowed(email);
    if (!allowed) {
      const { blacklist } = await getAccessControl();
      const isBlacklisted = blacklist.some(
        (r) => r.isActive && matchEmailPattern(email, r.pattern)
      );
      if (isBlacklisted) {
        return NextResponse.json(
          {
            success: false,
            message: 'Ten adres email nie ma dostępu do systemu',
          },
          { status: 403 }
        );
      }
      // Nie na whitelist, nie na blacklist = poczekalnia
      await addToPending(email);
      // Powiadom adminów mailem
      const users = await getUsers();
      const adminEmails = users.flatMap((u) =>
        u.role === 'admin' && u.isActive ? [u.email] : []
      );
      await sendPendingRequestNotificationToAdmins(adminEmails, email);
      return NextResponse.json({
        success: true,
        waitingApproval: true,
        message:
          'Zgłoszenie przyjęte. Czekasz na zatwierdzenie przez administratora. Otrzymasz maila z kodem po zatwierdzeniu.',
      });
    }

    // Generate 6-digit OTP code
    const code = generateOTP();
    await storeOTP(email, code);

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log('[LOGIN OTP]', email, '→ kod:', code);
    }

    // Send email with code (tytuł z [Admin] gdy odbiorca ma rolę admin)
    const user = await getUserByEmail(email);
    const result = await sendOTPEmail(email, code, {
      isAdmin: user?.role === 'admin',
    });

    if (!result.success) {
      const fallback =
        isDev || process.env.OTP_ACCEPT_ON_SEND_FAILURE === 'true';
      if (fallback) {
        console.log('[LOGIN OTP]', email, '→ kod:', code);
        console.warn(
          '[LOGIN] Wysyłka maila nie powiodła się – kod w konsoli powyżej. Użyj go do logowania.'
        );
        return NextResponse.json({
          success: true,
          message: 'Kod weryfikacyjny został wysłany na podany adres email',
        });
      }
      console.error('Failed to send OTP:', result.error);
      return NextResponse.json(
        {
          success: false,
          message:
            result.error || 'Nie udało się wysłać emaila. Spróbuj ponownie.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Kod weryfikacyjny został wysłany na podany adres email',
    });
  } catch (error) {
    console.error('Login error:', error);
    const isDev = process.env.NODE_ENV === 'development';
    const message =
      isDev && error instanceof Error ? error.message : 'Nieprawidłowe dane';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
