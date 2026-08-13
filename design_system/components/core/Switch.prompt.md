Settings toggle. The whole row is the hit target (≥44px tall with label + description).

```jsx
<Switch label="Alert Telegram" description="Kirim pesan kalau pengeluaran lewat budget harian" checked={on} onChange={setOn} />
```

Use inside a `Card` with `gap: 20px` between rows; don't add dividers.
