Inline banner. Trackster has no floating toasts — alerts live in the flow, right under the budget hero.

```jsx
{data.isOverBudget && (
  <Alert tone="over" title="Lewat budget harian" icon={<Icon name="triangle-alert" size={18} />}
    action={<Button variant="outlined" size="sm">Atur budget</Button>}>
    Kamu Rp84.000 di atas budget. Alert Telegram sudah dikirim.
  </Alert>
)}
```

One alert at a time; tone must match the data (`isOverBudget` → `over`).
