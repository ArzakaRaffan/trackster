Text/number field. Never expose a raw gray border — the recessed look comes from the inset border-shadow.

```jsx
<Input label="Budget harian" prefix="Rp" value={budget} onChange={e => setBudget(e.target.value)} />
<Input pill placeholder="Cari merchant" prefix={<Icon name="search" size={18} />} />
<Input label="Email" type="email" invalid hint="Email tidak dikenali" />
```

Numbers render tabular by default so amounts line up in a column.
