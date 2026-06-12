import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOTP } from '@/lib/auth/otp';
import { createSession } from '@/lib/auth/session';
import {
  getUsers,
  getUserByEmail,
  createUser,
  updateUserLastLogin,
} from '@/lib/db/users';

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/, 'Kod musi składać się z 6 cyfr'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = verifySchema.parse(body);

    // Verify OTP code
    const verification = await verifyOTP(email, code);

    if (!verification.valid) {
      return NextResponse.json(
        { success: false, message: verification.error },
        { status: 400 }
      );
    }

    // Get or create user
    let user = await getUserByEmail(email);

    if (!user) {
      // First user in system gets admin, rest get user
      const existingUsers = await getUsers();
      const role = existingUsers.length === 0 ? 'admin' : 'user';
      user = await createUser(email, role, []);
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, message: 'Konto zostało dezaktywowane' },
        { status: 403 }
      );
    }

    // Update last login
    await updateUserLastLogin(user.id);

    // Create session
    await createSession(user);

    // Return redirect URL
    const redirectUrl =
      user.role === 'admin' || user.role === 'editor'
        ? '/admin/projects'
        : '/gallery';

    return NextResponse.json({
      success: true,
      redirectUrl,
    });
  } catch (error) {
    console.error('Verify error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Nieprawidłowy format kodu' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Weryfikacja nie powiodła się' },
      { status: 500 }
    );
  }
}
