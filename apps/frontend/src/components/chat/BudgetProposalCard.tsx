'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
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
    <div className="mt-2 flex items-start gap-3 rounded-panel bg-surface p-4 shadow-hairline">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-interactive text-brand">
        <Wallet size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-title text-small font-bold text-ink">
          Budget {OPTION_LABEL[card.option]} · {formatRupiah(card.totalWeekly)}/minggu
        </p>
        {card.note && <p className="text-micro text-ink-muted">{card.note}</p>}
        <div className="mt-1.5 flex gap-2 overflow-x-auto text-micro">
          {card.dailyAmounts.map((a, i) => (
            <span key={i} className="whitespace-nowrap text-ink-muted">
              {DAY_SHORT[i]} <span className="font-bold text-ink">{formatRupiah(a)}</span>
            </span>
          ))}
        </div>
        {card.realismFlag && <p className="mt-1 text-micro text-[#ff6b35]">{card.realismFlag}</p>}
        <button
          type="button"
          onClick={apply}
          disabled={state !== 'idle'}
          className="mt-2.5 flex items-center gap-1.5 rounded-comfortable bg-brand px-3.5 py-2 text-micro font-bold text-base transition-all hover:brightness-108 active:scale-[.96] disabled:opacity-60"
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
