'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bug } from 'lucide-react';
import { toast } from 'sonner';

interface BugHunterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugHunterDialog({ open, onOpenChange }: BugHunterDialogProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error('Wpisz treść zgłoszenia');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Nie udało się wysłać');
        return;
      }
      toast.success('Zgłoszenie wysłane do administratora');
      setMessage('');
      onOpenChange(false);
    } catch {
      toast.error('Błąd wysyłki');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="size-5" />
            Bug hunter
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Opisz błąd lub problem. Wiadomość zostanie wysłana mailem do
          administratora.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bug-message">Treść zgłoszenia</Label>
            <Textarea
              id="bug-message"
              placeholder="Opisz co się stało, na której stronie, co kliknąłeś…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none min-h-[12rem]"
              disabled={sending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? 'Wysyłanie…' : 'Wyślij'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
