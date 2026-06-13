'use client';

// oxlint-disable react-doctor/prefer-useReducer

import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { StatsEvent, UserStatsDay } from '@/types/stats';
import { cn } from '@/lib/utils';

function eventLabel(event: StatsEvent): string {
  switch (event.type) {
    case 'login':
      return 'Logowanie';
    case 'view_start':
      return `Start: ${event.projectName ?? event.projectId}`;
    case 'view_end':
      return `Koniec: ${event.projectId} (${event.durationSeconds}s)`;
    case 'screenshot':
      return `Screenshot: ${event.projectName ?? event.projectId}`;
    default:
      return 'Zdarzenie';
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

interface UserStatsSummary {
  userId: string;
  email: string | null;
  days: string[];
  totalEvents: number;
}

export function StatsPanel() {
  const [users, setUsers] = useState<UserStatsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userDays, setUserDays] = useState<
    { date: string; eventCount: number; day?: UserStatsDay }[]
  >([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{
    userId: string;
    date: string;
  } | null>(null);
  const [dayEvents, setDayEvents] = useState<UserStatsDay | null>(null);
  const [cleanupOlderThanDays, setCleanupOlderThanDays] = useState(7);
  const [cleaning, setCleaning] = useState(false);

  const totalDays = users.reduce((total, user) => total + user.days.length, 0);
  const totalEvents = users.reduce(
    (total, user) => total + user.totalEvents,
    0
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Błąd pobierania');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      toast.error('Nie udało się pobrać statystyk');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchList();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchList]);

  const fetchUserDetails = useCallback(async (userId: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(
        `/api/admin/stats?userId=${encodeURIComponent(userId)}&full=true`
      );
      if (!res.ok) throw new Error('Błąd pobierania');
      const data = await res.json();
      setUserDays(data.days ?? []);
    } catch {
      toast.error('Nie udało się pobrać szczegółów');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const fetchDayEvents = useCallback(async (userId: string, date: string) => {
    try {
      const res = await fetch(
        `/api/admin/stats?userId=${encodeURIComponent(
          userId
        )}&date=${encodeURIComponent(date)}`
      );
      if (!res.ok) throw new Error('Błąd pobierania');
      const day = await res.json();
      setDayEvents(day);
      setSelectedDay({ userId, date });
    } catch {
      toast.error('Nie udało się pobrać zdarzeń dnia');
    }
  }, []);

  const toggleExpand = (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserDays([]);
      setSelectedDay(null);
      setDayEvents(null);
      return;
    }

    setExpandedUserId(userId);
    setSelectedDay(null);
    setDayEvents(null);
    fetchUserDetails(userId);
  };

  const handleCleanup = async () => {
    const days = Math.max(1, Math.min(365, cleanupOlderThanDays));
    setCleaning(true);
    try {
      const res = await fetch(`/api/admin/stats?olderThanDays=${days}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd usuwania');
      toast.success(data.message ?? `Usunięto ${data.deleted ?? 0} plików.`);
      setExpandedUserId(null);
      setUserDays([]);
      setSelectedDay(null);
      setDayEvents(null);
      fetchList();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Nie udało się usunąć historii'
      );
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#050505]">
      <div className="border-b border-white/10 px-3.5 py-4 sm:px-4 lg:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal text-zinc-100">
              Statystyki
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Logowania, sesje, projekty i screenshoty.
            </p>
          </div>
          <CleanupToolbar
            cleaning={cleaning}
            cleanupOlderThanDays={cleanupOlderThanDays}
            handleCleanup={handleCleanup}
            setCleanupOlderThanDays={setCleanupOlderThanDays}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 border border-white/10">
          <StatCell label="Users" value={users.length} />
          <StatCell label="Days" value={totalDays} />
          <StatCell isLast label="Events" value={totalEvents} />
        </div>
      </div>

      <section aria-label="Użytkownicy ze statystykami" className="border-b border-white/10">
        <div className="hidden grid-cols-[40px_minmax(220px,1fr)_120px_120px] border-b border-white/10 px-5 py-2 text-[11px] font-medium uppercase tracking-normal text-zinc-500 lg:grid">
          <div />
          <div>Email</div>
          <div>Days</div>
          <div className="text-right">Events</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          </div>
        ) : users.length === 0 ? (
          <div className="px-3.5 py-12 text-center text-sm text-zinc-500">
            Brak zapisanych statystyk.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {users.map((user) => (
              <Fragment key={user.userId}>
                <StatsUserRow
                  expanded={expandedUserId === user.userId}
                  onToggle={() => toggleExpand(user.userId)}
                  user={user}
                />
                {expandedUserId === user.userId ? (
                  <StatsDetails
                    dayEvents={dayEvents}
                    fetchDayEvents={fetchDayEvents}
                    loadingDetails={loadingDetails}
                    selectedDay={selectedDay}
                    user={user}
                    userDays={userDays}
                  />
                ) : null}
              </Fragment>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CleanupToolbar({
  cleaning,
  cleanupOlderThanDays,
  handleCleanup,
  setCleanupOlderThanDays,
}: {
  cleaning: boolean;
  cleanupOlderThanDays: number;
  handleCleanup: () => void;
  setCleanupOlderThanDays: (days: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className="text-xs text-zinc-500"
        htmlFor="cleanup-older-than-days"
      >
        Starsze niż
      </label>
      <input
        className="h-8 w-16 rounded border border-white/10 bg-[#050505] px-2 text-sm text-zinc-100"
        id="cleanup-older-than-days"
        max={365}
        min={1}
        onChange={(event) =>
          setCleanupOlderThanDays(parseInt(event.target.value, 10) || 7)
        }
        type="number"
        value={cleanupOlderThanDays}
      />
      <span className="text-xs text-zinc-500">dni</span>
      <button
        className="inline-flex h-8 items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={cleaning}
        onClick={handleCleanup}
        type="button"
      >
        {cleaning ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
        Usuń historię
      </button>
    </div>
  );
}

function StatCell({
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div className={cn('px-3 py-3', !isLast && 'border-r border-white/10')}>
      <div className="text-[11px] font-medium uppercase tracking-normal text-zinc-600">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function StatsUserRow({
  expanded,
  onToggle,
  user,
}: {
  expanded: boolean;
  onToggle: () => void;
  user: UserStatsSummary;
}) {
  const Icon = expanded ? ChevronDown : ChevronRight;

  return (
    <button
      className="grid w-full grid-cols-[28px_minmax(0,1fr)_72px] items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.015] lg:grid-cols-[40px_minmax(220px,1fr)_120px_120px] lg:px-5"
      onClick={onToggle}
      type="button"
    >
      <Icon className="size-4 text-zinc-500" aria-hidden="true" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-zinc-100">
          {user.email ?? user.userId}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500 lg:hidden">
          {user.days.length} dni / {user.totalEvents} zdarzeń
        </div>
      </div>
      <div className="hidden text-xs text-zinc-500 lg:block">
        {user.days.length}
      </div>
      <div className="text-right text-xs text-zinc-300">
        {user.totalEvents}
      </div>
    </button>
  );
}

function StatsDetails({
  dayEvents,
  fetchDayEvents,
  loadingDetails,
  selectedDay,
  user,
  userDays,
}: {
  dayEvents: UserStatsDay | null;
  fetchDayEvents: (userId: string, date: string) => void;
  loadingDetails: boolean;
  selectedDay: { userId: string; date: string } | null;
  user: UserStatsSummary;
  userDays: { date: string; eventCount: number; day?: UserStatsDay }[];
}) {
  return (
    <div className="border-t border-white/10 bg-white/[0.015] px-3.5 py-3 lg:px-5">
      {loadingDetails ? (
        <div className="flex justify-center py-4 text-zinc-500">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {userDays.map((day) => {
              const selected =
                selectedDay?.date === day.date &&
                selectedDay?.userId === user.userId;

              return (
                <button
                  className={cn(
                    'h-8 rounded border border-white/10 px-2 text-xs text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-100',
                    selected && 'bg-white/[0.06] text-zinc-100'
                  )}
                  key={day.date}
                  onClick={() => fetchDayEvents(user.userId, day.date)}
                  type="button"
                >
                  {day.date} ({day.eventCount})
                </button>
              );
            })}
          </div>

          {dayEvents && selectedDay?.userId === user.userId ? (
            <div className="border border-white/10">
              <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-zinc-300">
                Zdarzenia z dnia {dayEvents.date}
              </div>
              <div className="divide-y divide-white/10">
                {dayEvents.events.map((event) => (
                  <div
                    className="grid gap-1 px-3 py-2 text-sm text-zinc-300 sm:grid-cols-[120px_minmax(0,1fr)_160px]"
                    key={`${event.type}-${event.at}`}
                  >
                    <span className="font-mono text-xs text-zinc-500">
                      {event.type}
                    </span>
                    <span className="min-w-0 truncate">{eventLabel(event)}</span>
                    <span className="text-xs text-zinc-500">
                      {formatTime(event.at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
