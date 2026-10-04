// Backend <-> bentuk state prototipe v3.
import { wibISO } from './dates';

export const RPf = (n: number) => 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const numOrUndef = (v: string) => (String(v ?? '').trim() === '' ? undefined : Number(v));

// ---- income streams -------------------------------------------------------------------------
export function mapStream(s: any) {
  const n = (v: unknown) => (v === null || v === undefined ? '' : String(Math.round(Number(v) * 10) / 10));
  return {
    id: s.id, name: s.name, kind: s.kind, cadence: s.cadence, source: s.source,
    payDOW: str(s.payDayOfWeek), payDOM: str(s.payDayOfMonth), amount: n(s.amount), rate: n(s.sessionRate), extra: n(s.sessionExtra),
    maxU: n(s.maxUnits), ded: n(s.deductionPerUnit), typical: n(s.typicalUnits), keywords: (s.matchKeywords ?? []).join(', '), active: !!s.isActive,
  };
}

/** Form state prototipe -> payload backend (mengikuti aturan lama: field hanya dikirim bila relevan untuk jenisnya). */
export function streamPayload(f: any) {
  return {
    name: String(f.name).trim(),
    kind: f.kind,
    cadence: f.cadence,
    source: f.source === 'JAGO' ? 'JAGO' : 'BCA',
    payDayOfWeek: f.cadence === 'WEEKLY' ? numOrUndef(f.payDOW) : undefined,
    payDayOfMonth: f.cadence === 'MONTHLY' ? numOrUndef(f.payDOM) : undefined,
    amount: ['FIXED', 'DEDUCTION', 'VARIABLE'].includes(f.kind) ? numOrUndef(f.amount) : undefined,
    sessionRate: f.kind === 'SESSION' ? numOrUndef(f.rate) : undefined,
    sessionExtra: f.kind === 'SESSION' ? numOrUndef(f.extra) : undefined,
    maxUnits: ['SESSION', 'DEDUCTION'].includes(f.kind) ? numOrUndef(f.maxU) : undefined,
    deductionPerUnit: f.kind === 'DEDUCTION' ? numOrUndef(f.ded) : undefined,
    typicalUnits: ['SESSION', 'DEDUCTION'].includes(f.kind) ? numOrUndef(f.typical) : undefined,
    matchKeywords: String(f.keywords || '').split(',').map((x) => x.trim()).filter(Boolean),
    isActive: !!f.active,
  };
}

// ---- incomes ----------------------------------------------------------------------------------
export const mapIncome = (i: any) => ({
  id: i.id, amt: Number(i.amount), desc: i.description, src: i.source, date: wibISO(new Date(i.receivedAt).getTime()),
  stream: i.stream?.name ?? null, status: i.status ?? 'CONFIRMED',
});

// ---- subscriptions ------------------------------------------------------------------------------
export const mapSub = (x: any) => ({
  id: x.id, name: x.name, amount: Number(x.amount), cycle: x.cycle, due: String(x.nextDueDate).slice(0, 10), source: x.source ?? '',
  notes: x.notes ?? '', remind: x.reminderDaysBefore ?? 0, active: !!x.isActive, cal: !!x.googleCalendarEventId,
});

// ---- goals --------------------------------------------------------------------------------------
export const mapGoal = (g: any) => ({
  id: g.id, name: g.name, target: Number(g.targetAmount), date: g.targetDate ? String(g.targetDate).slice(0, 10) : null,
  current: Number(g.currentAmount ?? g.saved ?? g.current ?? 0),
});
