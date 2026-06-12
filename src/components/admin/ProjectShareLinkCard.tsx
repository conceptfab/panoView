'use client';

// oxlint-disable react-doctor/prefer-useReducer

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ShareState {
  isActive: boolean;
  hasPin: boolean;
  url: string | null;
}

export function ProjectShareLinkCard({ projectId }: { projectId: string }) {
  const [state, setState] = useState<ShareState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`);
      if (!res.ok) throw new Error();
      setState(await res.json());
    } catch {
      toast.error('Nie udało się pobrać linku');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (body: { isActive?: boolean; pin?: string | null }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setState(await res.json());
      return true;
    } catch {
      toast.error('Nie udało się zapisać');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (next: boolean) => {
    const ok = await save({ isActive: next });
    if (ok) toast.success(next ? 'Link włączony' : 'Link wyłączony');
  };

  const onSetPin = async () => {
    if (!pin) return;
    const ok = await save({ pin });
    if (ok) {
      setPin('');
      toast.success('PIN ustawiony');
    }
  };

  const onClearPin = async () => {
    const ok = await save({ pin: null });
    if (ok) toast.success('PIN usunięty');
  };

  const copy = async () => {
    if (!state?.url) return;
    await navigator.clipboard.writeText(state.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Link do prezentacji</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !state ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="space-y-1">
                <Label>Link aktywny</Label>
                <p className="text-sm text-muted-foreground">
                  Działa tylko dla opublikowanego projektu. Wyłączenie blokuje
                  link natychmiast.
                </p>
              </div>
              <Switch
                checked={state.isActive}
                disabled={saving}
                onCheckedChange={onToggle}
              />
            </div>

            {state.url && (
              <div className="space-y-2">
                <Label>Adres linku</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={state.url}
                    className={state.isActive ? '' : 'opacity-60'}
                  />
                  <Button type="button" variant="outline" onClick={copy}>
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
                {!state.isActive && (
                  <p className="text-xs text-muted-foreground">
                    Link jest obecnie nieaktywny.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="share-pin">PIN (opcjonalny)</Label>
              <div className="flex gap-2">
                <Input
                  id="share-pin"
                  type="password"
                  placeholder={state.hasPin ? '•••• (ustawiony)' : 'Bez PIN'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !pin}
                  onClick={onSetPin}
                >
                  Ustaw
                </Button>
                {state.hasPin && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={onClearPin}
                  >
                    Usuń
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
