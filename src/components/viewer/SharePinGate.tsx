'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface SharePinGateProps {
  token: string;
  projectName: string;
}

export function SharePinGate({ token, projectName }: SharePinGateProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/p/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      window.location.reload();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-white/15 bg-white/5 p-6 backdrop-blur"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-light text-white">{projectName}</h1>
          <p className="text-sm text-white/60">
            Ta prezentacja jest chroniona kodem PIN.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin" className="text-white/80">
            PIN
          </Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-400" role="alert" aria-live="polite">
            Nieprawidłowy PIN.
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading || !pin}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            'Otwórz prezentację'
          )}
        </Button>
      </form>
    </div>
  );
}
