const TK = window.TracksterDesignSystem_4b3ed2;

const TODAY = {
  date: "2026-08-12",
  budget: 150000,
  totalSpent: 169700,
  remaining: -19700,
  isOverBudget: true,
  transactions: [
    { id: "t1", amount: 87200, description: "Indomaret Tebet", source: "BCA", occurredAt: "2026-08-12T19:05:00" },
    { id: "t2", amount: 58500, description: "GoFood — Nasi Padang", source: "JAGO", occurredAt: "2026-08-12T12:40:00" },
    { id: "t3", amount: 24000, description: "Kopi Kenangan", source: "BCA", occurredAt: "2026-08-12T08:12:00" },
  ],
};

const WEEK = {
  total: 987700,
  average: 141100,
  overDays: 3,
  days: [
    { label: "Sen", spent: 120000, budget: 150000 },
    { label: "Sel", spent: 168000, budget: 150000, isOverBudget: true },
    { label: "Rab", spent: 96000, budget: 150000 },
    { label: "Kam", spent: 141000, budget: 150000 },
    { label: "Jum", spent: 205000, budget: 150000, isOverBudget: true },
    { label: "Sab", spent: 88000, budget: 150000 },
    { label: "Min", spent: 169700, budget: 150000, isOverBudget: true },
  ],
};

const DATE_LABEL = "Rabu, 12 Agustus";

function PhoneFrame({ children }) {
  return (
    <div style={{
      width: 390, height: 780, borderRadius: 34, overflow: "hidden", position: "relative",
      background: "var(--surface-base)", boxShadow: "var(--shadow-heavy), inset 0 0 0 1px var(--border-subtle)",
      display: "flex", flexDirection: "column",
    }}>
      {children}
    </div>
  );
}

function Screen({ children, scroll = true }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: scroll ? "auto" : "hidden",
      display: "flex", flexDirection: "column", gap: "var(--space-16)",
      padding: "0 var(--gutter-mobile) 24px",
    }}>
      {children}
    </div>
  );
}

Object.assign(window, { TK, TODAY, WEEK, DATE_LABEL, PhoneFrame, Screen });
