'use client';

import { useEffect, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { API_URL, api } from '@/lib/api';
import { shrinkDataUrl } from '@/lib/image';
import { addDaysISO, buildDates, dynamicBudgetOf, wibHHMM, wibISO, wibLogDate } from './dates';
import { buildAggregateReport, buildPeriodReport, dayLabelOf } from './reports';
import { RPf, mapBill, mapGoal, mapIncome, mapMem, mapMsg, mapStream, mapSub, streamPayload } from './map';

const fetcher = (u: string) => api.get<any>(u);
// ±20 endpoint dimuat bersamaan: fokus tab ulang paling sering sekali per menit (default SWR 5 dtk = badai request di HP).
const useGet = (key: string | null, opts: Record<string, unknown> = {}) => useSWR<any>(key, fetcher, { focusThrottleInterval: 60_000, ...opts });

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dm = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]}`; };
const STATUS_ROW: Record<string, [string, string, string]> = {
  RECEIVED: ['Sudah masuk', 'var(--success-text)', 'var(--success-bold)'],
  PENDING: ['Belum masuk', 'var(--text-subtle)', 'var(--border-bold)'],
  LATE: ['Lewat jadwal', 'var(--warning-text)', 'var(--warning-bold)'],
  EXTRA: ['Tambahan', 'var(--success-text)', 'var(--brand)'],
};

/**
 * Data asli untuk prototipe v3. `flat` = potongan state prototipe (bentuk yang sama dengan data contohnya),
 * disalin ke state komponen tiap kali referensinya berubah. `actions` = aksi tulis ke backend.
 */
const mapAnyTx = (t: any) => ({
  id: t.id, d: undefined as number | undefined, dl: dayLabelOf(wibISO(new Date(t.occurredAt).getTime())), raw: t.description,
  alias: t.displayDescription && t.displayDescription !== t.description ? t.displayDescription : null, cap: t.aiCaption || null, src: t.source,
  time: wibHHMM(t.occurredAt), cat: t.category, amt: Number(t.amount) - Number(t.reimbursedAmount || 0), gross: Number(t.amount), iso: wibISO(new Date(t.occurredAt).getTime()), note: t.note || '', icon: t.icon || null,
});
const monthAnchor = (off: number) => { const [y, m] = wibISO().split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + off, 15)); return d.toISOString().slice(0, 10); };

export function useLive(enabled: boolean, path: string, chatActive: number | null = null): Record<string, any> {
  const { mutate } = useSWRConfig();
  const todayISO = wibISO();
  const from = addDaysISO(todayISO, -6);
  const k = (key: string) => (enabled ? key : null);
  // Data yang hanya dipakai satu layar dimuat saat layar itu dibuka.
  const on = (prefix: string, key: string) => (enabled && path.startsWith(prefix) ? key : null);

  const budgets = useGet(k('/budget'));
  const today = useGet(k('/budget/today'), { refreshInterval: 60_000 });
  const runway = useGet(k('/budget/runway'), { refreshInterval: 60_000 });
  const bsetRes = useGet(k('/budget/settings'));
  // Mode dinamis: jatah per tanggal (snapshot). `from` = 6 hari lalu juga mencakup Senin minggu berjalan.
  const allowRes = useGet(k(`/budget/allowances?from=${from}&to=${todayISO}`));
  const txRes = useGet(k(`/transactions?startDate=${from}&endDate=${todayISO}&limit=500`));
  const incRes = useGet(on('/app/income', '/income')); // riwayat penuh, hanya daftar di layar Pemasukan
  const streamsRes = useGet(k('/income-streams'));
  const pendRes = useGet(k('/income?status=PENDING'));
  // Kebiasaan minggu ini (Beranda & Tanya Track) — insight dua bahasa dari backend, tanpa AI.
  const habitsRes = useGet(k('/habits'), { refreshInterval: 300_000 });
  const subsRes = useGet(k('/subscriptions'));
  const streamSugRes = useGet(on('/app/income', '/income-streams/suggestions'));
  const sugSubRes = useGet(on('/app/subscriptions', '/subscriptions/suggestions'));
  const icsRes = useGet(on('/app/subscriptions', '/subscriptions/calendar-link'), { revalidateOnFocus: false });
  const goalsRes = useGet(on('/app/goals', '/goal'));
  const gmailRes = useGet(k('/gmail/status'));
  const tgRes = useGet(k('/telegram/status'));
  const tokRes = useGet(on('/app/settings', '/api-tokens'));
  const nextRunRes = useGet(k('/sync/next-run'), { refreshInterval: 30_000 });
  const balRes = useGet(k('/balance'));
  const adjBca = useGet(on('/app/settings', '/balance/BCA/adjustments'));
  const adjJago = useGet(on('/app/settings', '/balance/JAGO/adjustments'));
  // Ringkasan hari ini dipoll tiap menit; kalau ada transaksi/pemasukan baru (mis. dari email bank), daftar transaksi & saldo
  // ikut dimuat ulang supaya "terpakai/sisa" tidak tertinggal dari jatah.
  const todaySig = today.data ? `${today.data.transactions?.length}|${today.data.incomes?.length}|${today.data.totalSpent}|${today.data.totalIncome}` : '';
  useEffect(() => {
    if (!todaySig) return;
    txRes.mutate();
    balRes.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaySig]);
  const aliasRes = useGet(k('/merchant-aliases'));
  const catIconRes = useGet(k('/merchant-aliases/category-icons'));
  const parseLogRes = useGet(k('/sync/parse-log?limit=200'));
  const syncLogRes = useGet(k('/sync/logs'));
  const threadsRes = useGet(on('/app/chat', '/ai/threads'));
  const msgsRes = useGet(enabled && chatActive ? `/ai/threads/${chatActive}/messages` : null);
  const memRes = useGet(on('/app/chat', '/ai/memory'));
  const tipRes = useGet(k('/ai/mascot-tip'), { revalidateOnFocus: false }); // tiap revalidasi = panggilan LLM
  const tidyRes = useGet(on('/app/categorize', '/transactions/uncategorized-merchants'));
  const billsRes = useGet(k('/split-bills'));
  const meRes = useGet(k('/auth/me'));
  // Profil & onboarding (wizard /setup): di wizard di-poll supaya kode Gmail & email pertama muncul sendiri.
  const profileRes = useGet(k('/profile'), { refreshInterval: path === '/setup' ? 4000 : 0 });

  const manual = useMemo(() => {
    const m = [0, 0, 0, 0, 0, 0, 0];
    for (const b of budgets.data ?? []) m[b.dayOfWeek] = Number(b.amount);
    return m;
  }, [budgets.data]);

  const allowMap = useMemo(() => {
    const snap: Record<string, number> = {};
    for (const a of allowRes.data ?? []) snap[a.date] = Number(a.amount);
    return snap;
  }, [allowRes.data]);
  const dates = useMemo(() => buildDates(manual), [manual, todayISO]);

  const txs = useMemo(() => {
    const out: any[] = [];
    for (const t of txRes.data?.data ?? []) {
      const d = dates.dateIdx[wibISO(new Date(t.occurredAt).getTime())];
      if (d === undefined) continue;
      const alias = t.displayDescription && t.displayDescription !== t.description ? t.displayDescription : null;
      out.push({ id: t.id, d, raw: t.description, alias, cap: t.aiCaption || null, src: t.source, time: wibHHMM(t.occurredAt), cat: t.category, amt: Number(t.amount) - Number(t.reimbursedAmount || 0), gross: Number(t.amount), iso: wibISO(new Date(t.occurredAt).getTime()), note: t.note || '', icon: t.icon || null, isBig: t.isBig ?? null });
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

  // Kartu "Masuk periode ini" di Pemasukan: dari budget periode (pasti + tambahan) dan kebiasaan pemasukan.
  const weekInfo = useMemo(() => {
    const c = today.data?.cycle;
    if (!c) return null;
    const received = (c.pasti ?? []).reduce((a: number, p: any) => a + p.received, 0) + c.tambahan;
    const usual = habitsRes.data?.income?.usualTotal ?? null;
    const expected = usual ?? c.income;
    const rows = (c.pasti ?? []).map((p: any) => {
      const [status, color, dot] = STATUS_ROW[p.receivedCount ? 'RECEIVED' : p.lateSince ? 'LATE' : 'PENDING'];
      return { name: p.name, amounts: p.receivedCount ? RPf(p.received) : `${RPf(0)} / ${RPf(p.usual)}`, status, color, dot };
    });
    if (c.tambahan > 0) { const [status, color, dot] = STATUS_ROW.EXTRA; rows.push({ name: 'Pemasukan tambahan', amounts: RPf(c.tambahan), status, color, dot }); }
    return {
      weekLabel: `Masuk ${c.period === 'WEEKLY' ? 'minggu' : 'bulan'} ini (${dm(c.start)})`, received: RPf(received),
      expected: usual != null ? `biasanya ${RPf(usual)}` : `dari perkiraan ${RPf(c.income)}`, rows,
      pct: (expected > 0 ? Math.min(100, received / expected * 100) : 0).toFixed(0) + '%',
    };
  }, [today.data, habitsRes.data]);

  // ---- langganan & target ----
  const subs = useMemo(() => (subsRes.data ?? []).map(mapSub), [subsRes.data]);
  const goals = useMemo(() => (goalsRes.data ?? []).map(mapGoal), [goalsRes.data]);

  // ---- setting ----
  const st = useMemo(() => {
    const bal: Record<string, any> = {};
    const adjOf = (a: any[] | undefined) => (a ?? []).map((x) => ({ delta: Number(x.delta), note: x.note ?? '', at: new Date(x.createdAt).getTime() }));
    // Semua bank milik user (bukan cuma BCA/Jago). Riwayat koreksi dimuat untuk BCA/Jago saja (endpoint per bank).
    for (const b of balRes.data ?? []) bal[b.source] = { balance: Number(b.balance), updated: new Date(b.lastUpdatedAt).getTime(), adj: adjOf(b.source === 'BCA' ? adjBca.data : b.source === 'JAGO' ? adjJago.data : []) };
    const empty = { balance: 0, updated: Date.now(), adj: [] };
    const tg = tgRes.data;
    return {
      gmail: !!gmailRes.data?.connected, gmailEmail: gmailRes.data?.email ?? '',
      tgConfigured: !!tg?.configured, tgPreview: tg?.botTokenPreview ?? '', tgChat: tg?.chatId ?? '', tgEvery: !!tg?.notifyEveryTransaction,
      nextRun: nextRunRes.data?.nextRunAt ? new Date(nextRunRes.data.nextRunAt).getTime() : Date.now(),
      balances: Object.keys(bal).length ? bal : { BCA: empty, JAGO: empty },
      tokens: (tokRes.data ?? []).map((x: any) => ({ id: x.id, label: x.label, prefix: x.prefix, createdAt: new Date(x.createdAt).getTime(), lastUsedAt: x.lastUsedAt ? new Date(x.lastUsedAt).getTime() : null, revokedAt: x.revokedAt ? new Date(x.revokedAt).getTime() : null })),
      aliases: (aliasRes.data ?? []).map((a: any) => ({ id: a.id, name: a.displayName ?? '', raw: a.rawDescription, icon: a.icon || null })),
      logs: (parseLogRes.data ?? []).map((l: any) => ({ id: l.emailId, status: l.status, subject: l.subject, from: l.from, reason: l.reason, date: wibLogDate(l.receivedAt) })),
    };
  }, [gmailRes.data, tgRes.data, tokRes.data, nextRunRes.data, balRes.data, adjBca.data, adjJago.data, aliasRes.data, parseLogRes.data]);
  const catIcons = useMemo(() => Object.fromEntries((catIconRes.data ?? []).map((c: any) => [c.category, c.icon])), [catIconRes.data]);

  const synced = useMemo(() => {
    const last = (syncLogRes.data ?? []).find((x: any) => x.status === 'SUCCESS') ?? (syncLogRes.data ?? [])[0];
    return last ? 'disinkron ' + wibHHMM(last.lastSyncAt) : '';
  }, [syncLogRes.data]);

  // ---- Tanya Track & memory ----
  const chat = useMemo(() => ({
    threads: (threadsRes.data ?? []).filter((t: any) => !t.archivedAt && t.channel !== 'TELEGRAM').map((t: any) => ({
      id: t.id, title: t.title || 'Percakapan baru', updated: dm(wibISO(new Date(t.updatedAt).getTime())),
      msgs: t.id === chatActive ? (msgsRes.data ?? []).map(mapMsg) : [],
    })),
  }), [threadsRes.data, msgsRes.data, chatActive]);
  const mem = useMemo(() => (memRes.data ?? []).map(mapMem), [memRes.data]);
  const tip = useMemo(() => (tipRes.data?.message ? { kind: tipRes.data.kind, msg: tipRes.data.message } : null), [tipRes.data]);

  const tidy = useMemo(() => (tidyRes.data ?? []).map((g: any) => ({ name: g.description, count: g.count, total: Number(g.totalAmount), repId: g.representativeId })), [tidyRes.data]);

  const split = useMemo(() => {
    const bills = (billsRes.data ?? []).map(mapBill);
    const last = bills.find((b: any) => b.acc);
    const me = meRes.data?.user ?? meRes.data; // /auth/me = { user: {...} } (dulu dibaca langsung -> nama peserta pertama kosong -> 400)
    return {
      bills,
      meName: me?.displayName || me?.username || '',
      lastBank: last ? { bank: last.bank, acc: last.acc, accName: last.accName } : { bank: 'BCA', acc: '', accName: '' },
    };
  }, [billsRes.data, meRes.data]);

  // ---- sumber data (status email per bank + log) ----
  const srcInfo = useMemo(() => {
    const logs: any[] = parseLogRes.data ?? [];
    const now = Date.now(), monthStart = wibISO().slice(0, 7);
    const agoMs = (iso: string | null) => (iso ? now - new Date(iso).getTime() : null);
    const short = (ms: number | null) => (ms === null ? 'menunggu' : ms < 90_000 ? 'baru saja' : ms < 3600e3 ? Math.round(ms / 60e3) + ' mnt lalu' : ms < 86400e3 ? Math.round(ms / 3600e3) + ' jam lalu' : Math.round(ms / 86400e3) + ' hari lalu');
    const long = (ms: number | null) => (ms === null ? '' : ms < 90_000 ? 'baru saja' : ms < 3600e3 ? Math.round(ms / 60e3) + ' menit lalu' : ms < 86400e3 ? Math.round(ms / 3600e3) + ' jam lalu' : Math.round(ms / 86400e3) + ' hari lalu');
    const bankOf = (l: any) => { if (l.parser) return String(l.parser).toUpperCase(); const f = String(l.from ?? '').toLowerCase(); return f.includes('flip') ? 'FLIP' : f.includes('jago') ? 'JAGO' : f.includes('bca') ? 'BCA' : null; };
    const connected = !!gmailRes.data?.connected || !!profileRes.data?.inbound?.verified; // Gmail (pemilik) atau penerusan aktif
    const out: Record<string, any> = {};
    for (const b of ['BCA', 'JAGO', 'FLIP', 'MANDIRI', 'BNI', 'BRI', 'RAYA']) {
      const mine = logs.filter((l) => bankOf(l) === b);
      const lastIso = mine.length ? mine.reduce((a, l) => (new Date(l.receivedAt) > new Date(a) ? l.receivedAt : a), mine[0].receivedAt) : null;
      const recorded = mine.filter((l) => l.status === 'RECORDED' && wibISO(new Date(l.receivedAt).getTime()).startsWith(monthStart)).length;
      const unparsed = mine.filter((l) => (l.status === 'UNPARSED' || l.status === 'ERROR') && now - new Date(l.receivedAt).getTime() < 14 * 86400e3).length;
      const ms = agoMs(lastIso);
      const cond = !connected ? 'putus' : lastIso === null ? 'menunggu' : unparsed > 0 ? 'cek' : ms! > 8 * 86400e3 ? 'sepi' : 'aktif';
      out[b] = { cond, short: short(ms), long: long(ms), recorded, unparsed, days: ms === null ? 0 : Math.round(ms / 86400e3) };
    }
    return out;
  }, [parseLogRes.data, gmailRes.data, profileRes.data]);
  const srcLog = useMemo(() => {
    const today = wibISO(), yday = addDaysISO(today, -1);
    return ((parseLogRes.data ?? []) as any[]).slice(0, 12).map((l) => {
      const iso = wibISO(new Date(l.receivedAt).getTime());
      const when = (iso === today ? 'Hari ini' : iso === yday ? 'Kemarin' : wibLogDate(l.receivedAt).split(',')[0]) + ', ' + wibHHMM(l.receivedAt);
      return [l.from, when, l.status === 'RECORDED' ? 'TERCATAT' : l.status === 'EXCLUDED' || l.status === 'DUPLICATE' ? 'DIABAIKAN' : 'PERLU DICEK'];
    });
  }, [parseLogRes.data]);

  // ---- notifikasi (bel) ----
  const notifs = useMemo(() => {
    const out: any[] = [];
    if (pendingList.length) out.push({ title: `${pendingList.length} transfer perlu dicek`, body: `+${RPf(pendingList[0].amt)} dari ${pendingList[0].desc}`, icon: 'triangle', color: 'var(--warning-text)', target: 'income' });
    const soon = subs.filter((x: any) => x.active).map((x: any) => ({ x, dl: Math.round((new Date(x.due).getTime() - new Date(todayISO).getTime()) / 86400000) })).filter(({ x, dl }: any) => dl >= 0 && dl <= x.remind).sort((a: any, b: any) => a.dl - b.dl)[0];
    if (soon) out.push({ title: 'Langganan jatuh tempo', body: `${soon.x.name}, ${soon.dl === 0 ? 'hari ini' : soon.dl + ' hari lagi'}`, icon: 'repeat', color: 'var(--text-subtle)', target: 'subs' });
    return out;
  }, [pendingList, subs, todayISO]);

  const settled = (r: { data?: unknown; error?: unknown }) => r.data !== undefined || r.error !== undefined; // error ≠ blank screen selamanya
  const ready = !enabled || [budgets, today, txRes, streamsRes].every(settled);
  // Data inti gagal dimuat (server mati/offline): jangan gambar layar dengan angka bawaan prototipe.
  const failed = enabled && [budgets, today, txRes].some((r) => r.error !== undefined && r.data === undefined);
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
      rbList: (txId: number) => api.get<any[]>(`/reimbursements?transactionId=${txId}`),
      rbAdd: (txId: number, name: string, amount: number) => api.post('/reimbursements', { transactionId: txId, personName: name, amount }),
      rbReceive: (id: number, source: string) => api.post(`/reimbursements/${id}/received`, { source }),
      rbDel: (id: number) => api.delete(`/reimbursements/${id}`),
      addTx: (x: { amount: number; desc: string; cat: string; src: string; dateISO: string }) =>
        api.post('/transactions', {
          amount: x.amount, description: x.desc, category: x.cat, source: x.src,
          occurredAt: x.dateISO === wibISO() ? new Date().toISOString() : new Date(`${x.dateISO}T12:00:00+07:00`).toISOString(),
        }),
      saveBudget: (m: number[]) => api.put('/budget', { budgets: m.map((amount, dayOfWeek) => ({ dayOfWeek, amount })) }),
      saveBudgetSettings: (body: Record<string, unknown>) => api.put('/budget/settings', body),
      // Gaya langsung diterapkan: backend mengembalikan ringkasan hari ini yang baru → cache diganti tanpa menunggu refetch.
      applyStyle: async (option: string) => {
        const sum = await api.post<any>('/budget/apply', { option });
        await mutate('/budget/today', sum, { revalidate: false });
        return sum;
      },
      // Pola harian langsung berlaku (PUT /budget/weights → ringkasan baru). Cache baru diganti lewat commitWeights setelah
      // logic.tsx memastikan respons ini masih yang terbaru, supaya respons lama tidak menimpa angka yang sedang diketik.
      setWeights: (autoWeights: boolean, amounts?: number[]) => api.put<any>('/budget/weights', { autoWeights, ...(amounts ? { amounts } : {}) }),
      commitWeights: (sum: any, amounts?: number[]) => {
        mutate('/budget/today', sum, { revalidate: false });
        if (amounts) mutate('/budget', amounts.map((amount, dayOfWeek) => ({ dayOfWeek, amount })), { revalidate: false });
        mutate('/budget/settings');
      },
      sync: () => api.post<any>('/sync/trigger'),
      reportData: async (tab: number, off: number) => {
        if (tab <= 1) {
          const date = tab === 0 ? addDaysISO(wibISO(), off * 7) : monthAnchor(off);
          // Laporan mingguan ikut memuat kebiasaan minggu itu (GET /habits?week=).
          const [rep, habits] = await Promise.all([
            api.get<any>(`/reports?period=${tab === 0 ? 'week' : 'month'}&date=${date}`),
            tab === 0 ? api.get<any>(`/habits?week=${date}`).catch(() => null) : null,
          ]);
          return { ...buildPeriodReport(tab as 0 | 1, rep), habits };
        }
        const agg = await api.get<any>(`/reports/aggregate?period=${tab === 2 ? '6m' : 'all'}`);
        const records = tab === 3 ? await api.get<any>('/reports/records') : null;
        return buildAggregateReport(tab as 2 | 3, agg, records, Number(wibISO().slice(0, 4)));
      },
      anaStats: (range: string) => api.get<any>(`/analytics/stats?range=${range}`),
      setBig: (id: number, isBig: boolean | null) => api.patch(`/transactions/${id}/big`, { isBig }),
      dayTxs: async (iso: string) => ((await api.get<any>(`/transactions/day/${iso}`)).transactions ?? []).map(mapAnyTx),
      searchTx: async (q: string, cat: string, src: string) => {
        const p = new URLSearchParams({ limit: '100' });
        if (q) p.set('search', q);
        if (cat !== 'ALL') p.set('category', cat);
        if (src !== 'ALL') p.set('source', src);
        return ((await api.get<any>(`/transactions?${p}`)).data ?? []).map(mapAnyTx);
      },
      exportCsv: async (from: string, to: string) => {
        const res = await fetch(`${API_URL}/reports/export.csv?from=${from}&to=${to}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Gagal mengunduh CSV.');
        return res.blob();
      },
      backfill: (after: string, before: string) => api.post<any>('/sync/backfill', { after, before }),
      gmailAuthUrl: () => api.get<{ url: string }>('/gmail/auth-url'),
      gmailDisconnect: () => api.post('/gmail/disconnect'),
      saveTelegram: (botToken: string, chatId: string) => api.put('/telegram/config', { botToken, chatId }),
      tgNotify: (v: boolean) => api.put('/telegram/config', { notifyEveryTransaction: v }),
      tgTest: () => api.post<{ success: boolean }>('/telegram/test'),
      tgLinkCode: () => api.post<{ code: string; expiresInMinutes: number }>('/telegram/link-code'),
      tokCreate: (label: string) => api.post<{ id: number; token: string }>('/api-tokens', { label }),
      tokRevoke: (id: number) => api.delete(`/api-tokens/${id}`),
      correctBalance: (source: string, newBalance: number, note: string) => api.put(`/balance/${source}`, { newBalance, note: note || undefined }),
      chatSend: async (threadId: number | null, text: string, lang: 'id' | 'en' = 'id') => {
        let id = threadId;
        if (!id) id = (await api.post<{ id: number }>('/ai/threads')).id;
        let failed: string | null = null;
        await api.postStream(`/ai/threads/${id}/messages/stream`, { text, lang }, (e) => { if (e.type === 'error') failed = e.message; });
        if (failed) throw new Error(failed);
        return id as number;
      },
      delThread: (id: number) => api.delete(`/ai/threads/${id}`),
      memCreate: (b: any) => api.post('/ai/memory', b),
      memUpdate: (id: number, b: any) => api.patch(`/ai/memory/${id}`, b),
      memDelete: (id: number) => api.delete(`/ai/memory/${id}`),
      splitCreate: async (body: any) => {
        const created = await api.post<any>('/split-bills', body);
        const payer = created.participants?.[0]; // peserta pertama = yang menalangi, otomatis dianggap lunas
        if (payer) await api.patch(`/split-bills/public/${created.publicSlug}/participants/${payer.id}/mark-paid`, {});
        return created.id as number;
      },
      splitAvatar: (slug: string, pid: number, avatar: string) => api.patch(`/split-bills/public/${slug}/participants/${pid}/avatar`, { avatar }),
      splitPaid: (slug: string, pid: number) => api.patch(`/split-bills/public/${slug}/participants/${pid}/mark-paid`, {}),
      splitAssign: (billId: number, itemId: number, pids: number[]) => api.patch(`/split-bills/${billId}/items/${itemId}/assign`, { shares: pids.map((participantId) => ({ participantId, weight: 1 })) }),
      scanReceipt: async (imageBase64: string) => ({
        ...(await api.post<{ items: { description: string; amount: number; quantity: number }[] }>('/split-bills/scan-receipt', { imageBase64: await shrinkDataUrl(imageBase64) })),
        thumb: await shrinkDataUrl(imageBase64, 900, 0.6), // pratinjau + disimpan bersama bill
      }),
      setMerchantIcon: (rawDescription: string, icon: string | null) => api.put('/merchant-aliases/icon', { rawDescription, icon }),
      setCategoryIcon: (category: string, icon: string | null) => api.put('/merchant-aliases/category-icons', { category, icon }),
      saveAlias: (id: number, displayName: string) => api.put(`/merchant-aliases/${id}`, { displayName }),
      delAlias: (id: number) => api.delete(`/merchant-aliases/${id}`),
      // pemasukan
      // kind: 'auto' = backend mencocokkan ke pemasukan pasti yang mirip, 'extra' = tambahan (streamId null), angka = pemasukan pasti itu.
      saveIncome: (id: number | null, x: { amount: number; desc: string; src: string; dateISO: string; kind?: string }) => {
        // Hari ini = jam sekarang (seperti addTx): jam 12.00 tetap bisa "masa depan" pagi hari → belum ikut budget periode.
        const receivedAt = x.dateISO === wibISO() ? new Date().toISOString() : new Date(`${x.dateISO}T12:00:00+07:00`).toISOString();
        const body = { amount: x.amount, description: x.desc, source: x.src, receivedAt };
        if (id) return api.put(`/income/${id}`, body);
        const streamId = !x.kind || x.kind === 'auto' ? undefined : x.kind === 'extra' ? null : Number(x.kind);
        return api.post('/income', { ...body, ...(streamId !== undefined ? { streamId } : {}) });
      },
      delIncome: (id: number) => api.delete(`/income/${id}`),
      resolveIncome: (id: number, body: { streamId?: number; notIncome?: boolean }) => api.patch(`/income/${id}/resolve`, body),
      saveStream: (id: number | null, f: any) => (id ? api.put(`/income-streams/${id}`, streamPayload(f)) : api.post('/income-streams', streamPayload(f))),
      delStream: (id: number) => api.delete(`/income-streams/${id}`),
      // langganan & target
      saveSub: (id: number | null, b: any) => (id ? api.put(`/subscriptions/${id}`, b) : api.post('/subscriptions', b)),
      delSub: (id: number) => api.delete(`/subscriptions/${id}`),
      addGoal: (b: { name: string; targetAmount: number; targetDate?: string }) => api.post('/goal', b),
      contribute: (id: number, b: { amount: number; note?: string }) => api.post(`/goal/${id}/contribute`, b),
      archiveGoal: (id: number) => api.patch(`/goal/${id}/archive`, {}),
      simulateGoal: (id: number, cutPercent: number) => api.post<any>(`/goal/${id}/simulate`, { cutPercent }),
      // profil & wizard
      saveProfile: (b: { displayName?: string; fullName?: string; forwarding?: boolean }) => api.patch<any>('/profile', b),
      saveAccounts: (accounts: { source?: string; accountNumber: string }[]) => api.put<any>('/profile/accounts', { accounts }),
      addBanks: (sources: string[]) => api.post<any>('/profile/banks', { sources }),
      finishOnboarding: () => api.post<any>('/profile/onboarded'),
    }),
    [],
  );

  return {
    ready,
    failed,
    refresh,
    actions,
    // Hanya ADMIN (pemilik) yang boleh isi chat ID manual; member menautkan lewat kode `/start` (backend menolak chat ID manual).
    isAdmin: (meRes.data?.user ?? meRes.data)?.role === 'ADMIN',
    todayISO,
    profile: profileRes.data ?? null,
    refreshProfile: () => profileRes.mutate(),
    st,
    chat,
    split,
    flat: {
      synced, mem, tip, tidy, srcInfo, srcLog, catIcons, icsUrl: icsRes.data?.path ? API_URL + icsRes.data.path : '', subSug: sugSubRes.data ?? [], streamSug: streamSugRes.data ?? [],
      txs, manual, incomes, streams, subs, goals, notifs,
      todayBudget: today.data ? Number(today.data.budget) : undefined,
      todayIncome: today.data ? Number(today.data.totalIncome) : undefined,
      allowMap, bset: bsetRes.data ?? null, cyc: today.data?.cycle ?? null, todayBig: today.data ? Number(today.data.bigSpent ?? 0) : 0, bigThr: today.data?.bigThreshold ?? null,
      habits: habitsRes.data ?? null, runwayInfo, weekInfo,
      pendingList, pending: pendingList.length > 0,
    },
  };
}
