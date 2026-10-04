'use client';

import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import { addDaysISO, buildDates, wibHHMM, wibISO } from './dates';
import { RPf, mapGoal, mapIncome, mapStream, mapSub, streamPayload } from './map';

const fetcher = (u: string) => api.get<any>(u);
const useGet = (key: string | null, opts: Record<string, unknown> = {}) => useSWR<any>(key, fetcher, opts);

const OPT_META: Record<string, { label: string; desc: string }> = {
  hemat: { label: 'Hemat', desc: 'Kejar goal, dana cadangan 15%' },
  seimbang: { label: 'Seimbang', desc: 'Default — cadangan 10%' },
  longgar: { label: 'Longgar', desc: 'Ada acara — cadangan 5%' },
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dm = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]}`; };
const STATUS_ROW: Record<string, [string, string, string]> = {
  RECEIVED: ['Sudah masuk', 'var(--success-text)', 'var(--success-bold)'],
  PARTIAL: ['Sebagian', 'var(--warning-text)', 'var(--warning-bold)'],
  PENDING: ['Menunggu', 'var(--text-subtle)', 'var(--border-bold)'],
  MISSED: ['Terlewat', 'var(--danger-text)', 'var(--danger-bold)'],
};

/**
 * Data asli untuk prototipe v3. `flat` = potongan state prototipe (bentuk yang sama dengan data contohnya),
 * disalin ke state komponen tiap kali referensinya berubah. `actions` = aksi tulis ke backend.
 */
export function useLive(enabled: boolean, path: string): Record<string, any> {
  const { mutate } = useSWRConfig();
  const todayISO = wibISO();
  const from = addDaysISO(todayISO, -6);
  const k = (key: string) => (enabled ? key : null);

  const budgets = useGet(k('/budget'));
  const today = useGet(k('/budget/today'), { refreshInterval: 60_000 });
  const runway = useGet(k('/budget/runway'), { refreshInterval: 60_000 });
  const txRes = useGet(k(`/transactions?startDate=${from}&endDate=${todayISO}&limit=500`));
  const incRes = useGet(k('/income'));
  const streamsRes = useGet(k('/income-streams'));
  const pendRes = useGet(k('/income?status=PENDING'));
  const weekF = useGet(k('/income/forecast/week'));
  const horizonF = useGet(k('/income/forecast/horizon?weeks=4'));
  const draftRes = useGet(k('/income/checkin'));
  const subsRes = useGet(k('/subscriptions'));
  const goalsRes = useGet(k('/goal'));
  const sugRes = useGet(enabled && path.startsWith('/app/budget') ? '/ai/budget-suggestions' : null);

  const manual = useMemo(() => {
    const m = [0, 0, 0, 0, 0, 0, 0];
    for (const b of budgets.data ?? []) m[b.dayOfWeek] = Number(b.amount);
    return m;
  }, [budgets.data]);

  const dates = useMemo(() => buildDates(manual), [manual, todayISO]);

  const txs = useMemo(() => {
    const out: any[] = [];
    for (const t of txRes.data?.data ?? []) {
      const d = dates.dateIdx[wibISO(new Date(t.occurredAt).getTime())];
      if (d === undefined) continue;
      const alias = t.displayDescription && t.displayDescription !== t.description ? t.displayDescription : null;
      out.push({ id: t.id, d, raw: t.description, alias, cap: t.aiCaption || null, src: t.source, time: wibHHMM(t.occurredAt), cat: t.category, amt: Number(t.amount) - Number(t.reimbursedAmount || 0), note: t.note || '' });
    }
    return out.sort((a, b) => a.d - b.d || a.time.localeCompare(b.time));
  }, [txRes.data, dates]);

  const runwayInfo = useMemo(() => {
    const r = runway.data;
    if (!r) return null;
    const v = Number(r.projectedEndOfMonthBalance);
    return {
      value: (v < 0 ? '−' : '') + RPf(v), short: !!r.isProjectedShortfall,
      burn: RPf(r.burnRatePerDay) + '/hari', days: `${r.remainingDays} hari`, balance: RPf(r.currentBalance),
    };
  }, [runway.data]);

  // ---- pemasukan ----
  const incomes = useMemo(() => (incRes.data ?? []).map(mapIncome), [incRes.data]);
  const streams = useMemo(() => (streamsRes.data ?? []).map(mapStream), [streamsRes.data]);
  const pendingList = useMemo(() => (pendRes.data ?? []).map(mapIncome), [pendRes.data]);

  const weekInfo = useMemo(() => {
    const w = weekF.data;
    if (!w) return null;
    const rows = w.streams.map((s: any) => {
      const st = s.status === 'PENDING' && s.received > 0 ? 'PARTIAL' : s.status;
      const [label, color, dot] = STATUS_ROW[st] ?? STATUS_ROW.PENDING;
      return { name: s.name, amounts: st === 'RECEIVED' ? RPf(s.received) : `${RPf(s.received)} / ${RPf(s.expected)}`, status: label, color, dot };
    });
    const hz: any[] = horizonF.data ?? [];
    const sum = (k: string) => hz.reduce((a, x) => a + (x.totals?.[k] ?? 0), 0);
    return {
      weekLabel: `Masuk minggu ini (${dm(w.weekStart)})`, received: RPf(w.totals.received), expected: `dari perkiraan ${RPf(w.totals.expected)}`, rows,
      fc: [[w.totals.conservative, w.totals.expected, w.totals.max], [sum('conservative'), sum('expected'), sum('max')]],
      upside: RPf(w.upsideMonthly ?? 0), irregular: w.streams.find((s: any) => s.kind === 'IRREGULAR')?.name ?? 'Project desain',
    };
  }, [weekF.data, horizonF.data]);

  const allocIncome = weekF.data ? Number(weekF.data.totals.expected) : undefined;

  const checkin = useMemo(() => {
    const d = draftRes.data;
    if (!d) return null;
    const byId: Record<number, any> = {};
    for (const s of d.streams) byId[s.id] = s;
    return { weekStart: d.weekStart, label: `Minggu ${dm(d.weekStart)} – ${dm(d.weekEndLabel)}`, byId, totalExpected: d.totalExpected, totalRecorded: d.totalRecorded };
  }, [draftRes.data]);

  // ---- langganan & target ----
  const subs = useMemo(() => (subsRes.data ?? []).map(mapSub), [subsRes.data]);
  const goals = useMemo(() => (goalsRes.data ?? []).map(mapGoal), [goalsRes.data]);

  // ---- budget advisor ----
  const budget = useMemo(() => {
    const s = sugRes.data;
    if (!s) return null;
    return {
      opts: s.options.map((o: any) => ({ k: o.option, label: OPT_META[o.option].label, desc: OPT_META[o.option].desc, total: o.totalWeekly, save: o.weeklySavings, days: o.dailyAmounts, flag: o.realismFlag })),
      rec: s.advice?.recommended ?? 'seimbang', reason: s.advice?.reason ?? null, weekStart: s.weekStart,
      basis: [
        ['Pemasukan ekspektasi', RPf(s.input.expectedIncome)],
        ['Pemasukan konservatif', RPf(s.input.conservativeIncome)],
        ['Komitmen (langganan jatuh tempo)', RPf(s.input.commitments)],
        ['Rata-rata rutin harian (8 minggu)', RPf(s.input.avgRoutinePerDay) + '/hari'],
      ],
    };
  }, [sugRes.data]);

  // ---- notifikasi (bel) ----
  const notifs = useMemo(() => {
    const out: any[] = [];
    if (pendingList.length) out.push({ title: `${pendingList.length} transfer perlu dicek`, body: `+${RPf(pendingList[0].amt)} dari ${pendingList[0].desc}`, icon: 'triangle', color: 'var(--warning-text)', target: 'income' });
    const soon = subs.filter((x: any) => x.active).map((x: any) => ({ x, dl: Math.round((new Date(x.due).getTime() - new Date(todayISO).getTime()) / 86400000) })).filter(({ x, dl }: any) => dl >= 0 && dl <= x.remind).sort((a: any, b: any) => a.dl - b.dl)[0];
    if (soon) out.push({ title: 'Langganan jatuh tempo', body: `${soon.x.name}, ${soon.dl === 0 ? 'hari ini' : soon.dl + ' hari lagi'}`, icon: 'repeat', color: 'var(--text-subtle)', target: 'subs' });
    return out;
  }, [pendingList, subs, todayISO]);

  const ready = !enabled || (!!budgets.data && !!today.data && !!txRes.data && !!incRes.data && !!streamsRes.data);
  const refresh = () => mutate(() => true);

  const actions = useMemo(
    () => ({
      updTx: async (id: number, patch: { cat?: string; alias?: string; note?: string }) => {
        if (patch.cat !== undefined) await api.patch(`/transactions/${id}/category`, { category: patch.cat });
        if (patch.alias !== undefined) await api.patch(`/transactions/${id}/alias`, { displayName: patch.alias });
        if (patch.note !== undefined) await api.patch(`/transactions/${id}/note`, { note: patch.note });
      },
      catAll: (id: number, cat: string) => api.patch(`/transactions/${id}/category`, { category: cat, applyToAll: true }),
      delTx: (id: number) => api.delete(`/transactions/${id}`),
      addTx: (x: { amount: number; desc: string; cat: string; src: string; dateISO: string }) =>
        api.post('/transactions', {
          amount: x.amount, description: x.desc, category: x.cat, source: x.src,
          occurredAt: x.dateISO === wibISO() ? new Date().toISOString() : new Date(`${x.dateISO}T12:00:00+07:00`).toISOString(),
        }),
      saveBudget: (m: number[]) => api.put('/budget', { budgets: m.map((amount, dayOfWeek) => ({ dayOfWeek, amount })) }),
      applyBudget: (option: string, week: string) => api.post('/budget/apply', { option, week }),
      sync: () => api.post<any>('/sync/trigger'),
      // pemasukan
      saveIncome: (id: number | null, x: { amount: number; desc: string; src: string; dateISO: string }) => {
        const body = { amount: x.amount, description: x.desc, source: x.src, receivedAt: new Date(`${x.dateISO}T12:00:00+07:00`).toISOString() };
        return id ? api.put(`/income/${id}`, body) : api.post('/income', body);
      },
      delIncome: (id: number) => api.delete(`/income/${id}`),
      resolveIncome: (id: number, body: { streamId?: number; notIncome?: boolean }) => api.patch(`/income/${id}/resolve`, body),
      saveStream: (id: number | null, f: any) => (id ? api.put(`/income-streams/${id}`, streamPayload(f)) : api.post('/income-streams', streamPayload(f))),
      delStream: (id: number) => api.delete(`/income-streams/${id}`),
      submitCheckin: (week: string, entries: any[]) => api.post('/income/checkin', { week, entries }),
      // langganan & target
      saveSub: (id: number | null, b: any) => (id ? api.put(`/subscriptions/${id}`, b) : api.post('/subscriptions', b)),
      delSub: (id: number) => api.delete(`/subscriptions/${id}`),
      addGoal: (b: { name: string; targetAmount: number; targetDate?: string }) => api.post('/goal', b),
      contribute: (id: number, b: { amount: number; note?: string }) => api.post(`/goal/${id}/contribute`, b),
      archiveGoal: (id: number) => api.patch(`/goal/${id}/archive`, {}),
      simulateGoal: (id: number, cutPercent: number) => api.post<any>(`/goal/${id}/simulate`, { cutPercent }),
    }),
    [],
  );

  return {
    ready,
    refresh,
    actions,
    todayISO,
    flat: {
      txs, manual, incomes, streams, subs, goals, notifs,
      todayBudget: today.data ? Number(today.data.budget) : undefined,
      todayIncome: today.data ? Number(today.data.totalIncome) : undefined,
      runwayInfo, weekInfo, allocIncome, checkin, budget,
      pendingList, pending: pendingList.length > 0,
    },
  };
}
