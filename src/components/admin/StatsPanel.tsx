'use client';

// oxlint-disable react-doctor/prefer-useReducer

import { useState, useEffect, useCallback, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UserStatsDay, StatsEvent } from '@/types/stats';

function eventLabel(e: StatsEvent): string {
  switch (e.type) {
    case 'login':
      return 'Logowanie';
    case 'view_start':
      return `Start: ${e.projectName ?? e.projectId}`;
    case 'view_end':
      return `Koniec: ${e.projectId} (${e.durationSeconds}s)`;
    case 'screenshot':
      return `Screenshot: ${e.projectName ?? e.projectId}`;
    default:
      return (e as StatsEvent).type;
  }
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pl-PL', {
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
    fetchList();
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
    } else {
      setExpandedUserId(userId);
      setSelectedDay(null);
      setDayEvents(null);
      fetchUserDetails(userId);
    }
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
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Nie udało się usunąć historii'
      );
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extralight">Statystyki</h1>
          <p className="text-muted-foreground mt-1">
            Logowania, ruch na stronie, oglądane projekty, screenshoty
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="cleanup-older-than-days"
            className="text-sm text-muted-foreground"
          >
            Usuń historię starszą niż:
          </label>
          <input
            id="cleanup-older-than-days"
            type="number"
            min={1}
            max={365}
            value={cleanupOlderThanDays}
            onChange={(e) =>
              setCleanupOlderThanDays(parseInt(e.target.value, 10) || 7)
            }
            className="w-14 rounded border bg-background px-2 py-1 text-sm"
          />
          <span className="text-sm text-muted-foreground">dni</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanup}
            disabled={cleaning}
          >
            {cleaning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            <span className="ml-2">Usuń starą historię</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Użytkownicy ze statystykami</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kliknij wiersz, aby zobaczyć dni i zdarzenia. Jeden dzień = jeden
            plik.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Brak zapisanych statystyk.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Email</TableHead>
                  <TableHead>Dni</TableHead>
                  <TableHead className="text-right">Zdarzenia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <Fragment key={u.userId}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(u.userId)}
                    >
                      <TableCell>
                        {expandedUserId === u.userId ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </TableCell>
                      <TableCell>{u.email ?? u.userId}</TableCell>
                      <TableCell>{u.days.length}</TableCell>
                      <TableCell className="text-right">
                        {u.totalEvents}
                      </TableCell>
                    </TableRow>
                    {expandedUserId === u.userId && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/30 p-4">
                          {loadingDetails ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="size-6 animate-spin" />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-sm font-medium">
                                Dni ze statystykami
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {userDays.map((d) => (
                                  <Button
                                    key={d.date}
                                    variant={
                                      selectedDay?.date === d.date &&
                                      selectedDay?.userId === u.userId
                                        ? 'secondary'
                                        : 'outline'
                                    }
                                    size="sm"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      fetchDayEvents(u.userId, d.date);
                                    }}
                                  >
                                    {d.date} ({d.eventCount})
                                  </Button>
                                ))}
                              </div>
                              {dayEvents &&
                                selectedDay?.userId === u.userId && (
                                  <div className="mt-4 rounded-lg border bg-background p-3 text-sm">
                                    <p className="font-medium mb-2">
                                      Zdarzenia z dnia {dayEvents.date}
                                    </p>
                                    <ul className="space-y-1">
                                      {dayEvents.events.map((e) => (
                                        <li
                                          key={`${e.type}-${e.at}`}
                                          className="flex gap-2 flex-wrap"
                                        >
                                          <Badge
                                            variant="outline"
                                            className="text-xs"
                                          >
                                            {e.type}
                                          </Badge>
                                          <span>{eventLabel(e)}</span>
                                          <span className="text-muted-foreground">
                                            {formatTime(e.at)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
