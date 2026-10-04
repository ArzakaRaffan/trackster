'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { WEEK_ORDER, formatRupiah } from '@/lib/format';
import { Check, Wallet } from 'lucide-react';

const OPTION_LABEL: Record<string, string> = { hemat: 'Hemat', seimbang: 'Seimbang', longgar: 'Longgar' };
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export interface BudgetProposalCardData {
  type: 'budget-proposal';
  option: 'hemat' | 'seimbang' | 'longgar';
  totalWeekly: number;
  dailyAmounts: number[]; // index 0=Minggu..6=Sabtu
  weeklySavings: number;
  realismFlag: string | null;
  note: string | null;
}

export function BudgetProposalCard({ card }: { card: BudgetProposalCardData }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');

  const apply = async () => {
    setState('saving');
    try {
      await api.put('/budget', {
        budgets: card.dailyAmounts.map((amount, dayOfWeek) => ({ dayOfWeek, amount })),
      });
      setState('done');
    } catch {
      setState('idle');
    }
  };

  return (
    <div className="mt-2 flex items-start gap-3 rounded-panel bg-card p-4 shadow-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral text-brand">
        <Wallet size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-title text-small font-bold text-text">
          Budget {OPTION_LABEL[card.option]} · {formatRupiah(card.totalWeekly)}/minggu
        </p>
        {card.note && <p className="text-micro text-text-subtle">{card.note}</p>}
        <div className="mt-1.5 flex gap-2 overflow-x-auto text-micro">
          {WEEK_ORDER.map((i) => [i, card.dailyAmounts[i]] as const).map(([i, a]) => (
            <span key={i} className="whitespace-nowrap text-text-subtle">
              {DAY_SHORT[i]} <span className="font-bold text-text">{formatRupiah(a)}</span>
            </span>
          ))}
        </div>
        {card.realismFlag && <p className="mt-1 text-micro text-warning">{card.realismFlag}</p>}
        <button
          type="button"
          onClick={apply}
          disabled={state !== 'idle'}
          className="mt-2.5 flex items-center gap-1.5 rounded-medium bg-brand px-3.5 py-2 text-micro font-bold text-on-brand transition-all duration-fast ease-standard hover:bg-brand-hover active:scale-[.96] disabled:opacity-60"
        >
          {state === 'done' ? (
            <>
              <Check size={14} /> Diterapkan
            </>
          ) : state === 'saving' ? (
            'Menerapkan…'
          ) : (
            'Terapkan'
          )}
        </button>
      </div>
    </div>
  );
}
