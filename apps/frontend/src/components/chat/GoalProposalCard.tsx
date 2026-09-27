'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Check, Target } from 'lucide-react';

export interface GoalProposalCardData {
  type: 'goal-proposal';
  name: string;
  target: number;
  deadline?: string;
  weeklyContribution?: number;
}

export function GoalProposalCard({ card }: { card: GoalProposalCardData }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');

  const create = async () => {
    setState('saving');
    try {
      await api.post('/goal', {
        name: card.name,
        targetAmount: card.target,
        ...(card.deadline ? { targetDate: card.deadline } : {}),
      });
      setState('done');
    } catch {
      setState('idle');
    }
  };

  return (
    <div className="mt-2 flex items-start gap-3 rounded-panel bg-surface p-4 shadow-hairline">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-brand">
        <Target size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-title text-small font-bold text-ink">{card.name}</p>
        <p className="text-micro text-ink-muted">
          Target {formatRupiah(card.target)}
          {card.deadline && ` · sebelum ${new Date(card.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          {card.weeklyContribution ? ` · ~${formatRupiah(card.weeklyContribution)}/minggu` : ''}
        </p>
        <button
          type="button"
          onClick={create}
          disabled={state !== 'idle'}
          className="mt-2.5 flex items-center gap-1.5 rounded-comfortable bg-brand px-3.5 py-2 text-micro font-bold text-base transition-all hover:brightness-108 active:scale-[.96] disabled:opacity-60"
        >
          {state === 'done' ? (
            <>
              <Check size={14} /> Goal dibuat
            </>
          ) : state === 'saving' ? (
            'Menyimpan…'
          ) : (
            'Buat goal'
          )}
        </button>
      </div>
    </div>
  );
}
