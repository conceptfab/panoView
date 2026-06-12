import { eq, and, lt, sql } from 'drizzle-orm';
import { getDb } from './client';
import { statsEvents } from './schema';
import type { StatsEvent, UserStatsDay } from '@/types/stats';

export function getDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function assertValidDate(dateStr: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Invalid date format, expected YYYY-MM-DD');
  }
}

/** Dopisuje zdarzenie do dnia użytkownika. */
export async function appendEvent(
  userId: string,
  dateStr: string,
  event: StatsEvent
): Promise<void> {
  assertValidDate(dateStr);
  await getDb().insert(statsEvents).values({ userId, date: dateStr, event });
}

/** Zwraca listę dat (YYYY-MM-DD), dla których użytkownik ma statystyki. */
export async function getStatsDaysForUser(userId: string): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ date: statsEvents.date })
    .from(statsEvents)
    .where(eq(statsEvents.userId, userId))
    .orderBy(statsEvents.date);
  return rows.map((r) => r.date);
}

/** Pobiera zawartość jednego dnia. */
export async function getStatsDay(
  userId: string,
  dateStr: string
): Promise<UserStatsDay | null> {
  assertValidDate(dateStr);
  const rows = await getDb()
    .select({ event: statsEvents.event, id: statsEvents.id })
    .from(statsEvents)
    .where(and(eq(statsEvents.userId, userId), eq(statsEvents.date, dateStr)))
    .orderBy(statsEvents.id);
  if (rows.length === 0) return null;
  return {
    date: dateStr,
    userId,
    events: rows.map((r) => r.event),
  };
}

/** Pobiera statystyki użytkownika – wszystkie dni (tylko metadane: data + liczba zdarzeń) lub pełna zawartość. */
export async function getStatsForUser(
  userId: string,
  options?: { full?: boolean }
): Promise<{ date: string; eventCount: number; day?: UserStatsDay }[]> {
  if (options?.full) {
    const rows = await getDb()
      .select({
        date: statsEvents.date,
        event: statsEvents.event,
        id: statsEvents.id,
      })
      .from(statsEvents)
      .where(eq(statsEvents.userId, userId))
      .orderBy(statsEvents.date, statsEvents.id);

    const byDate = new Map<string, StatsEvent[]>();
    for (const row of rows) {
      const list = byDate.get(row.date) ?? [];
      list.push(row.event);
      byDate.set(row.date, list);
    }
    return [...byDate.entries()].map(([date, events]) => ({
      date,
      eventCount: events.length,
      day: { date, userId, events },
    }));
  }

  const rows = await getDb()
    .select({
      date: statsEvents.date,
      eventCount: sql<number>`count(*)::int`,
    })
    .from(statsEvents)
    .where(eq(statsEvents.userId, userId))
    .groupBy(statsEvents.date)
    .orderBy(statsEvents.date);
  return rows.map((r) => ({ date: r.date, eventCount: r.eventCount }));
}

/** Lista ID użytkowników, którzy mają jakiekolwiek statystyki. */
async function listUserIdsWithStats(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ userId: statsEvents.userId })
    .from(statsEvents)
    .orderBy(statsEvents.userId);
  return rows.map((r) => r.userId);
}

/** Usuwa zdarzenia starsze niż podana liczba dni. Jeśli podano userId – tylko ten użytkownik; inaczej wszyscy. */
export async function deleteStatsOlderThan(
  olderThanDays: number,
  userId?: string
): Promise<{ deleted: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffStr = getDateString(cutoff);

  const db = getDb();
  const condition = userId
    ? and(eq(statsEvents.userId, userId), lt(statsEvents.date, cutoffStr))
    : lt(statsEvents.date, cutoffStr);

  // Liczymy usunięte DNI per użytkownik (zachowanie zgodne z poprzednią implementacją plikową).
  const days = await db
    .select({
      count: sql<number>`count(distinct (${statsEvents.userId}, ${statsEvents.date}))::int`,
    })
    .from(statsEvents)
    .where(condition);

  await db.delete(statsEvents).where(condition);
  return { deleted: days[0]?.count ?? 0 };
}
