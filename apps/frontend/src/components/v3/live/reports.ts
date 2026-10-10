// Laporan (tab Minggu / Bulan / 6 bln / Semua): bentuk objek `v` yang dipakai markup prototipe,
// diisi dari /reports, /reports/aggregate, /reports/records.
import { DAYN } from './dates';
import { RPf } from './map';

const CAT_L: Record<string, string> = { MAKANAN: 'Makanan', TRANSPORT: 'Transport', BELANJA: 'Belanja', TAGIHAN: 'Tagihan', HIBURAN: 'Hiburan', KESEHATAN: 'Kesehatan', LAINNYA: 'Lainnya', TRANSFER: 'Transfer', TOPUP: 'Top-up', PENDIDIKAN: 'Pendidikan', PERAWATAN: 'Perawatan', INVESTASI: 'Investasi', ROKOK: 'Rokok/Vape' };
const CC: Record<string, string> = { MAKANAN: '#fb7185', TRANSPORT: '#2dd4bf', BELANJA: '#c084fc', TAGIHAN: '#fbbf24', HIBURAN: '#f472b6', KESEHATAN: '#22d3ee', LAINNYA: '#94a3b8', TRANSFER: '#818cf8', TOPUP: '#38bdf8', PENDIDIKAN: '#facc15', PERAWATAN: '#f9a8d4', INVESTASI: '#4ade80', ROKOK: '#a8a29e' };
const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MON_L = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_S = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const RP = (n: number) => (n < 0 ? '−' : '') + RPf(n);
const cmp = (n: number) => { const a = Math.abs(n); return (n < 0 ? '−' : '') + 'Rp' + (a >= 1e6 ? (a / 1e6).toFixed(1).replace('.', ',') + 'jt' : a >= 1000 ? Math.round(a / 1000) + 'rb' : Math.round(a)); };
const parts = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return { y, m, d }; };
const dowOf = (iso: string) => { const { y, m, d } = parts(iso); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const dayLabelOf = (iso: string) => { const { m, d } = parts(iso); return `${DAYN[dowOf(iso)]}, ${d} ${MON_S[m - 1]}`; };
/** instant UTC (ISO) -> tanggal WIB 'YYYY-MM-DD' */
const wibDay = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

const catList = (cats: any[], hasPrev: boolean) => {
  const arr = [...cats].sort((a, b) => b.total - a.total);
  const mx = Math.max(1, ...arr.map((x) => Math.max(x.total, x.prevTotal ?? 0)));
  return arr.map((x) => ({
    name: CAT_L[x.category] ?? x.category, value: RP(x.total), valColor: 'var(--text)', hasSub: false, sub: '', hasBar: true,
    pct: (x.total / mx * 100) + '%', color: CC[x.category] ?? '#94a3b8', hasPrev: hasPrev, prevPct: ((x.prevTotal ?? 0) / mx * 100) + '%',
  }));
};
const merchList = (ms: any[]) => ms.slice(0, 5).map((m) => ({ name: m.displayName, value: RP(m.total), valColor: 'var(--text)', hasSub: true, sub: `${m.count}× transaksi`, hasBar: false }));

export const EMPTY_REPORT = {
  label: '', heroLabel: '', hero: '', heroColor: 'var(--text)', heroSub: '', stats: [] as any[], hasNarr: false, narr: '', hasNote: false, note: '',
  chartTitle: '', chartHint: '', barGap: '8px', hasLegend: false, bars: [] as any[], cat: [] as any[], merch: [] as any[], months: [] as any[], records: [] as any[], spend: 0, inc: 0, net: 0,
};

/** Laporan minggu/bulan dari ReportResult. */
export function buildPeriodReport(tab: 0 | 1, res: any) {
  const st = res.stats, t = st.totals, prev = st.previous;
  const spend = t.spend, inc = t.income, net = t.net;
  const startISO = wibDay(res.start), endISO = wibDay(new Date(new Date(res.end).getTime() - 1).toISOString());
  const a = parts(startISO), b = parts(endISO);
  const label = tab === 1 ? `${MON_L[a.m - 1]} ${a.y}` : a.m === b.m ? `${a.d}–${b.d} ${MON_L[b.m - 1]} ${b.y}` : `${a.d} ${MON_S[a.m - 1]} – ${b.d} ${MON_S[b.m - 1]} ${b.y}`;
  const routineDelta = prev && prev.spendRoutine > 0 ? Math.round((1 - t.spendRoutine / prev.spendRoutine) * 100) : null;
  const bud = st.budget;
  const days: any[] = st.byDay ?? [];
  const mx = Math.max(1, ...days.map((d) => Math.max(d.spend, tab === 0 ? d.budget : 0)));
  const bars = days.map((d, i) => {
    const over = tab === 0 && d.budget > 0 && d.spend > d.budget;
    const full = tab === 0 ? dayLabelOf(d.date) : `${parts(d.date).d} ${MON_S[parts(d.date).m - 1]} ${parts(d.date).y}`;
    return {
      label: tab === 0 ? DAY_S[dowOf(d.date)] : (i + 1) % 4 === 1 ? String(i + 1) : '', h: (d.spend / mx * 124) + 'px', color: over ? 'var(--danger-bold)' : 'var(--brand)', hasB: false, h2: '0',
      tip: `${full}: ${RP(d.spend)}`, cursor: 'pointer', iso: d.date, total: d.spend, full,
    };
  });
  return {
    ...EMPTY_REPORT,
    label, heroLabel: tab === 0 ? 'Net minggu ini' : 'Net bulan ini', hero: (net >= 0 ? '+' : '−') + RPf(net), heroColor: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)', heroSub: `Masuk ${cmp(inc)} · Keluar ${cmp(spend)}`,
    stats: [
      { l: 'Savings rate', v: inc > 0 ? Math.round(net / inc * 100) + '%' : '—', c: 'var(--text)', hasSub: false },
      routineDelta === null ? { l: 'Keluar rutin', v: '—', c: 'var(--text-subtle)', hasSub: true, sub: tab === 0 ? 'vs minggu lalu' : 'vs bulan lalu' }
        : { l: 'Keluar rutin', v: (routineDelta >= 0 ? '↓' : '↑') + Math.abs(routineDelta) + '%', c: routineDelta >= 0 ? 'var(--success-text)' : 'var(--warning-text)', hasSub: true, sub: tab === 0 ? 'vs minggu lalu' : 'vs bulan lalu' },
      { l: 'Kepatuhan budget', v: `${bud.daysOver} dari ${bud.daysWithBudget || days.length} hari over`, c: bud.daysOver ? 'var(--danger-text)' : 'var(--success-text)', hasSub: false },
    ],
    hasNarr: !!res.closed && !!res.narrative, narr: res.narrative ?? '', hasNote: !res.closed, note: 'Periode masih berjalan. Narasi dan snapshot muncul setelah periode ini tutup.',
    chartTitle: 'Tren harian', chartHint: 'Klik batang untuk lihat detail', barGap: tab === 0 ? '10px' : '3px', hasLegend: false, bars,
    cat: catList(st.byCategory ?? [], !!prev), merch: merchList(st.byMerchant ?? []), spend, inc, net,
    rangeFrom: startISO, rangeTo: endISO,
  };
}

const monthShort = (key: string, nowYear: number) => { const [y, m] = key.split('-').map(Number); return y === nowYear ? MON_S[m - 1] : `${MON_S[m - 1]} ${String(y).slice(2)}`; };

/** 6 bln / Semua dari AggregateReport (+ RecordsResult untuk Semua). */
export function buildAggregateReport(tab: 2 | 3, agg: any, records: any, nowYear: number) {
  const months: any[] = agg.months ?? [];
  const spend = agg.totals.spend, inc = agg.totals.income, net = agg.totals.net;
  const mx = Math.max(1, ...months.map((m) => Math.max(m.spend, m.income)));
  const best = agg.bestMonth, worst = agg.worstMonth;
  const [dy, dm, dd] = agg.dataStartsAt ? agg.dataStartsAt.split('-').map(Number) : [0, 0, 0];
  const since = agg.dataStartsAt ? `${dd} ${MON_S[dm - 1]} ${dy}` : '';
  const list = months.slice().reverse().map((m, i) => {
    const sr = m.income > 0 ? Math.round((m.income - m.spend) / m.income * 100) : 0;
    return { name: monthShort(m.month, nowYear) + (i === 0 ? ' (berjalan)' : ''), value: cmp(m.spend), valColor: 'var(--text)', hasSub: true, sub: `Savings rate ${sr}%`, hasBar: false };
  });
  const stats = [
    { l: 'Bulan terendah', v: best ? cmp(best.spend) : '—', c: 'var(--success-text)', hasSub: true, sub: best ? monthShort(best.month, nowYear) : '' },
    { l: 'Bulan terboros', v: worst ? cmp(worst.spend) : '—', c: 'var(--danger-text)', hasSub: true, sub: worst ? monthShort(worst.month, nowYear) : '' },
  ];
  const bars = months.map((m) => ({ label: monthShort(m.month, nowYear), h: (m.spend / mx * 124) + 'px', color: 'var(--brand)', hasB: tab === 2, h2: (m.income / mx * 124) + 'px', tip: `${monthShort(m.month, nowYear)}: keluar ${RPf(m.spend)}, masuk ${RPf(m.income)}`, cursor: 'default' }));
  const base = { ...EMPTY_REPORT, label: '', stats, hasNarr: false, hasNote: tab === 2, note: since ? `Data mulai ${since}` : '', chartTitle: 'Tren bulanan', chartHint: tab === 2 ? 'Keluar vs masuk' : 'Pengeluaran per bulan', barGap: '8px', hasLegend: tab === 2, bars, months: list, spend, inc, net };
  if (tab === 2) {
    return { ...base, heroLabel: 'Net 6 bulan', hero: (net >= 0 ? '+' : '−') + RPf(net), heroColor: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)', heroSub: `Masuk ${cmp(inc)} · Keluar ${cmp(spend)} · rata-rata ${cmp(agg.totals.avgMonthlySpend)}/bln` };
  }
  const r = records;
  const rec = r ? [
    { name: 'Transaksi terbesar', sub: r.biggestTransaction ? `${r.biggestTransaction.description} · ${(() => { const p = parts(r.biggestTransaction.date); return `${p.d} ${MON_S[p.m - 1]} ${p.y}`; })()}` : '—', value: r.biggestTransaction ? RPf(r.biggestTransaction.amount) : '—' },
    { name: 'Merchant paling sering', sub: r.mostVisitedMerchant?.displayName ?? '—', value: r.mostVisitedMerchant ? `${r.mostVisitedMerchant.count}×` : '—' },
    { name: 'Savings rate terbaik', sub: r.bestSavingsRateMonth ? (() => { const [y, m] = r.bestSavingsRateMonth.month.split('-').map(Number); return `${MON_L[m - 1]} ${y}`; })() : '—', value: r.bestSavingsRateMonth ? `${Math.round(r.bestSavingsRateMonth.savingsRate)}%` : '—' },
    { name: 'Streak di bawah budget', sub: 'hari berturut-turut', value: `${r.longestUnderBudgetStreak} hari` },
    { name: 'Total transaksi', sub: since ? `sejak ${MON_S[dm - 1]} ${dy}` : '', value: Number(r.totalTransactions).toLocaleString('id-ID') },
  ].map((x) => ({ ...x, valColor: 'var(--text)', hasSub: true, hasBar: false })) : [];
  return { ...base, heroLabel: 'Total pengeluaran sepanjang waktu', hero: RPf(spend), heroColor: 'var(--text)', heroSub: `Masuk ${cmp(inc)} · Net ${cmp(net)} · data mulai ${since || '—'}`, records: rec };
}
