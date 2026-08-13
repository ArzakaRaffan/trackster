Small status pill. In Trackster it carries the budget verdict, never decoration.

```jsx
<Badge tone="over" icon={<Icon name="triangle-alert" size={12} />}>Over budget</Badge>
<Badge tone="under">Aman</Badge>
<Badge tone="neutral">12 transaksi</Badge>
```

Map `isOverBudget` from `GET /budget/today` straight to `tone`: true → `over`, else `spent/budget >= 0.8` → `near`, else `under`.
