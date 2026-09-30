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
    <div className="mt-2 flex items-start gap-3 rounded-panel bg-card p-4 shadow-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral text-brand">
        <Target size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-title text-small font-bold text-text">{card.name}</p>
        <p className="text-micro text-text-subtle">
          Target {formatRupiah(card.target)}
          {card.deadline && ` · sebelum ${new Date(card.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          {card.weeklyContribution ? ` · ~${formatRupiah(card.weeklyContribution)}/minggu` : ''}
        </p>
        <button
          type="button"
          onClick={create}
          disabled={state !== 'idle'}
          className="mt-2.5 flex items-center gap-1.5 rounded-medium bg-brand px-3.5 py-2 text-micro font-bold text-on-brand transition-all duration-fast ease-standard hover:bg-brand-hover active:scale-[.96] disabled:opacity-60"
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
