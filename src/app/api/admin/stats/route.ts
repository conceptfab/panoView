import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { getUsers } from '@/lib/db/users';
import {
  getStatsForUser,
  getStatsDay,
  getStatsDaysForUser,
  deleteStatsOlderThan,
} from '@/lib/db/stats';

/** GET: lista użytkowników ze statystykami lub szczegóły jednego użytkownika / jednego dnia. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');
    const full = searchParams.get('full') === 'true';

    // Jedna osoba, jeden dzień – pełna zawartość
    if (userId && date) {
      const day = await getStatsDay(userId, date);
      if (!day) {
        return NextResponse.json(
          { error: 'Brak statystyk dla podanej daty' },
          { status: 404 }
        );
      }
      return NextResponse.json(day);
    }

    // Jedna osoba – lista dni (opcjonalnie z pełną zawartością)
    if (userId) {
      const summary = await getStatsForUser(userId, { full });
      const user = (await getUsers()).find((u) => u.id === userId);
      return NextResponse.json({
        userId,
        email: user?.email ?? null,
        days: summary,
      });
    }

    // Lista wszystkich użytkowników mających statystyki
    const users = await getUsers();
    const result: {
      userId: string;
      email: string;
      days: string[];
      totalEvents: number;
    }[] = [];

    const userStats = await Promise.all(
      users.map(async (user) => {
        const userDates = await getStatsDaysForUser(user.id);
        if (userDates.length === 0) return null;

        const days = await Promise.all(
          userDates.map((date) => getStatsDay(user.id, date))
        );
        const totalEvents = days.reduce(
          (total, day) => total + (day?.events.length ?? 0),
          0
        );

        return {
          userId: user.id,
          email: user.email,
          days: userDates,
          totalEvents,
        };
      })
    );
    result.push(...userStats.flatMap((item) => (item ? [item] : [])));

    // Kubełek anonimowych wejść z linków współdzielenia
    const shareDates = await getStatsDaysForUser('share');
    if (shareDates.length > 0) {
      const shareDays = await Promise.all(
        shareDates.map((date) => getStatsDay('share', date))
      );
      const shareTotal = shareDays.reduce(
        (total, day) => total + (day?.events.length ?? 0),
        0
      );
      result.push({
        userId: 'share',
        email: 'Linki publiczne (anonimowo)',
        days: shareDates,
        totalEvents: shareTotal,
      });
    }

    return NextResponse.json({ users: result });
  } catch (error) {
    console.error('Admin stats GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

/** DELETE: usuń historię starszą niż X dni. Query: olderThanDays=7 (domyślnie 7), opcjonalnie userId. */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const olderThanDays = Math.min(
      365,
      Math.max(1, parseInt(searchParams.get('olderThanDays') ?? '7', 10) || 7)
    );
    const userId = searchParams.get('userId') ?? undefined;

    const { deleted } = await deleteStatsOlderThan(olderThanDays, userId);
    return NextResponse.json({
      ok: true,
      deleted,
      olderThanDays,
      message: `Usunięto ${deleted} plików statystyk starszych niż ${olderThanDays} dni.`,
    });
  } catch (error) {
    console.error('Admin stats DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete old stats' },
      { status: 500 }
    );
  }
}
