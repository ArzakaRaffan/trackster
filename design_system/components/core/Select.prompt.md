Dropdown for short option sets (currency, week, alert threshold).

```jsx
<Select label="Kirim alert saat" value={t} onChange={e => setT(e.target.value)}
  options={[{value:"80",label:"80% budget"},{value:"100",label:"Lewat budget"}]} />
```

Native `<select>` on purpose — mobile gets the OS picker. For 2–3 mutually exclusive choices prefer a row of `Button variant="dark"` pills instead.
