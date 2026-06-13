'use client';

import { useReducer } from 'react';
import { ClientDate } from '@/components/ui/client-date';
import { Input } from '@/components/ui/input';
import type { AccessControl, AccessRule } from '@/types';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AccessControlPanelProps {
  accessControl: AccessControl;
}

type AccessTab = 'pending' | 'whitelist' | 'blacklist';
type RuleType = 'whitelist' | 'blacklist';

interface AccessControlState {
  accessControl: AccessControl;
  activeTab: AccessTab;
  newWhitelistPattern: string;
  newBlacklistPattern: string;
  pendingAction: string | null;
}

type AccessControlAction =
  | { type: 'set-active-tab'; tab: AccessTab }
  | { type: 'set-whitelist-pattern'; value: string }
  | { type: 'set-blacklist-pattern'; value: string }
  | { type: 'set-pending-action'; email: string | null }
  | { type: 'remove-pending'; email: string }
  | { type: 'add-rule'; ruleType: RuleType; rule: AccessRule }
  | { type: 'delete-rule'; ruleType: RuleType; id: string };

function accessControlReducer(
  state: AccessControlState,
  action: AccessControlAction
): AccessControlState {
  switch (action.type) {
    case 'set-active-tab':
      return { ...state, activeTab: action.tab };
    case 'set-whitelist-pattern':
      return { ...state, newWhitelistPattern: action.value };
    case 'set-blacklist-pattern':
      return { ...state, newBlacklistPattern: action.value };
    case 'set-pending-action':
      return { ...state, pendingAction: action.email };
    case 'remove-pending':
      return {
        ...state,
        accessControl: {
          ...state.accessControl,
          pending: (state.accessControl.pending ?? []).filter(
            (item) => item.email.toLowerCase() !== action.email.toLowerCase()
          ),
        },
      };
    case 'add-rule':
      return {
        ...state,
        accessControl: {
          ...state.accessControl,
          [action.ruleType]: [
            ...state.accessControl[action.ruleType],
            action.rule,
          ],
        },
        newBlacklistPattern:
          action.ruleType === 'blacklist' ? '' : state.newBlacklistPattern,
        newWhitelistPattern:
          action.ruleType === 'whitelist' ? '' : state.newWhitelistPattern,
      };
    case 'delete-rule':
      return {
        ...state,
        accessControl: {
          ...state.accessControl,
          [action.ruleType]: state.accessControl[action.ruleType].filter(
            (rule) => rule.id !== action.id
          ),
        },
      };
  }
}

export function AccessControlPanel({
  accessControl: initialData,
}: AccessControlPanelProps) {
  const [state, dispatch] = useReducer(accessControlReducer, {
    accessControl: initialData,
    activeTab: 'pending',
    newWhitelistPattern: '',
    newBlacklistPattern: '',
    pendingAction: null,
  });
  const {
    accessControl,
    activeTab,
    newBlacklistPattern,
    newWhitelistPattern,
    pendingAction,
  } = state;
  const pending = accessControl.pending ?? [];

  const handlePendingAction = async (
    email: string,
    action: 'approve' | 'reject'
  ) => {
    dispatch({ type: 'set-pending-action', email });
    try {
      const res = await fetch('/api/access-control/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd');

      dispatch({ type: 'remove-pending', email });
      toast.success(data.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nie udało się');
    } finally {
      dispatch({ type: 'set-pending-action', email: null });
    }
  };

  const handleAddRule = async (type: RuleType) => {
    const pattern =
      type === 'whitelist' ? newWhitelistPattern : newBlacklistPattern;
    if (!pattern.trim()) {
      toast.error('Podaj wzorzec');
      return;
    }

    try {
      const res = await fetch('/api/access-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, pattern: pattern.trim() }),
      });
      if (!res.ok) throw new Error('Failed to add rule');
      const data = await res.json();

      dispatch({ type: 'add-rule', ruleType: type, rule: data.rule });
      toast.success('Reguła dodana');
    } catch {
      toast.error('Nie udało się dodać reguły');
    }
  };

  const handleDeleteRule = async (id: string, type: RuleType) => {
    try {
      const res = await fetch(`/api/access-control/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete rule');
      dispatch({ type: 'delete-rule', ruleType: type, id });
      toast.success('Reguła usunięta');
    } catch {
      toast.error('Nie udało się usunąć reguły');
    }
  };

  return (
    <section className="border-b border-white/10" aria-label="Kontrola dostępu">
      <div className="flex flex-col gap-3 border-b border-white/10 px-3.5 py-3 sm:px-4 lg:px-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Kontrola dostępu
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Poczekalnia oraz reguły whitelist/blacklist.
          </p>
        </div>
        <div className="flex w-fit border border-white/10">
          <AccessTabButton
            activeTab={activeTab}
            count={pending.length}
            label="Poczekalnia"
            tab="pending"
            setActiveTab={(tab) => dispatch({ type: 'set-active-tab', tab })}
          />
          <AccessTabButton
            activeTab={activeTab}
            count={accessControl.whitelist.length}
            label="Whitelist"
            tab="whitelist"
            setActiveTab={(tab) => dispatch({ type: 'set-active-tab', tab })}
          />
          <AccessTabButton
            activeTab={activeTab}
            count={accessControl.blacklist.length}
            label="Blacklist"
            tab="blacklist"
            setActiveTab={(tab) => dispatch({ type: 'set-active-tab', tab })}
          />
        </div>
      </div>

      {activeTab === 'pending' ? (
        <PendingList
          onAction={handlePendingAction}
          pending={pending}
          pendingAction={pendingAction}
        />
      ) : null}
      {activeTab === 'whitelist' ? (
        <RuleSection
          inputValue={newWhitelistPattern}
          onAdd={() => handleAddRule('whitelist')}
          onChange={(value) =>
            dispatch({ type: 'set-whitelist-pattern', value })
          }
          onDelete={(id) => handleDeleteRule(id, 'whitelist')}
          placeholder="np. *@firma.com"
          rules={accessControl.whitelist}
          type="whitelist"
        />
      ) : null}
      {activeTab === 'blacklist' ? (
        <RuleSection
          inputValue={newBlacklistPattern}
          onAdd={() => handleAddRule('blacklist')}
          onChange={(value) =>
            dispatch({ type: 'set-blacklist-pattern', value })
          }
          onDelete={(id) => handleDeleteRule(id, 'blacklist')}
          placeholder="np. spam@example.com"
          rules={accessControl.blacklist}
          type="blacklist"
        />
      ) : null}
    </section>
  );
}

function AccessTabButton({
  activeTab,
  count,
  label,
  setActiveTab,
  tab,
}: {
  activeTab: AccessTab;
  count: number;
  label: string;
  setActiveTab: (tab: AccessTab) => void;
  tab: AccessTab;
}) {
  return (
    <button
      className={cn(
        'h-8 border-r border-white/10 px-3 text-sm text-zinc-500 transition-colors last:border-r-0 hover:bg-white/[0.03] hover:text-zinc-100',
        activeTab === tab && 'bg-white/[0.06] text-zinc-100'
      )}
      onClick={() => setActiveTab(tab)}
      type="button"
    >
      {label} ({count})
    </button>
  );
}

function PendingList({
  onAction,
  pending,
  pendingAction,
}: {
  onAction: (email: string, action: 'approve' | 'reject') => void;
  pending: AccessControl['pending'];
  pendingAction: string | null;
}) {
  if (pending.length === 0) {
    return <EmptyLine text="Brak osób w poczekalni" />;
  }

  return (
    <div className="divide-y divide-white/10">
      {pending.map((request) => (
        <article
          className="grid grid-cols-[minmax(0,1fr)_144px] items-center gap-3 px-3.5 py-3.5 lg:px-5"
          key={request.email}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-zinc-100">
              {request.email}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              <ClientDate value={request.requestedAt} format="dateTime" />
            </div>
          </div>
          <div className="flex justify-end gap-1">
            <button
              className="flex size-8 items-center justify-center rounded text-emerald-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200 disabled:opacity-50"
              disabled={pendingAction === request.email}
              onClick={() => onAction(request.email, 'approve')}
              type="button"
              aria-label={`Zatwierdź ${request.email}`}
            >
              <Check className="size-4" aria-hidden="true" />
            </button>
            <button
              className="flex size-8 items-center justify-center rounded text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
              disabled={pendingAction === request.email}
              onClick={() => onAction(request.email, 'reject')}
              type="button"
              aria-label={`Odrzuć ${request.email}`}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function RuleSection({
  inputValue,
  onAdd,
  onChange,
  onDelete,
  placeholder,
  rules,
  type,
}: {
  inputValue: string;
  onAdd: () => void;
  onChange: (value: string) => void;
  onDelete: (id: string) => void;
  placeholder: string;
  rules: AccessRule[];
  type: RuleType;
}) {
  return (
    <>
      <div className="grid gap-2 border-b border-white/10 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_88px] sm:px-4 lg:px-5">
        <Input
          className="h-8 rounded border-white/10 bg-[#050505] text-sm text-zinc-100 placeholder:text-zinc-600"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onAdd();
          }}
          placeholder={placeholder}
          value={inputValue}
        />
        <button
          className="inline-flex h-8 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/[0.06]"
          onClick={onAdd}
          type="button"
        >
          <Plus className="size-4" aria-hidden="true" />
          Dodaj
        </button>
      </div>
      <RuleList rules={rules} type={type} onDelete={onDelete} />
      <p className="border-t border-white/10 px-3.5 py-3 text-xs text-zinc-600 sm:px-4 lg:px-5">
        Użyj * jako wildcard. Przykłady: *@firma.com, jan@*, *.
      </p>
    </>
  );
}

function RuleList({
  onDelete,
  rules,
  type,
}: {
  onDelete: (id: string) => void;
  rules: AccessRule[];
  type: RuleType;
}) {
  if (rules.length === 0) {
    return <EmptyLine text="Brak reguł" />;
  }

  return (
    <div className="divide-y divide-white/10">
      {rules.map((rule) => (
        <article
          className="grid grid-cols-[minmax(0,1fr)_100px_40px] items-center gap-3 px-3.5 py-3.5 lg:px-5"
          key={rule.id}
        >
          <div className="min-w-0">
            <code className="truncate font-mono text-sm text-zinc-100">
              {rule.pattern}
            </code>
            {rule.notes ? (
              <p className="mt-1 truncate text-xs text-zinc-500">
                {rule.notes}
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              'text-xs font-medium',
              rule.isActive ? 'text-emerald-300' : 'text-zinc-500'
            )}
          >
            {rule.isActive ? 'Aktywna' : 'Nieaktywna'}
          </div>
          <button
            className="flex size-8 items-center justify-center rounded text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-200"
            onClick={() => onDelete(rule.id)}
            type="button"
            aria-label={`Usuń regułę ${type} ${rule.pattern}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </article>
      ))}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="px-3.5 py-8 text-center text-sm text-zinc-500">{text}</div>;
}
