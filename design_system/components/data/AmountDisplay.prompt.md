The money figure. One `hero` per screen — the "how much did I spend today" answer.

```jsx
<AmountDisplay label="Terpakai hari ini" value={data.totalSpent} size="hero"
  tone={data.isOverBudget ? "over" : "base"} caption={`dari ${formatIDR(data.budget)} budget`} />
<AmountDisplay value={data.remaining} size="title" tone="under" label="Sisa" />
```

Formats to `Rp1.250.000` (id-ID) — pass the raw API number, never a pre-formatted string.
