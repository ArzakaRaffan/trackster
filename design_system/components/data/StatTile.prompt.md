Small metric tile. Use in a 2- or 3-column grid with 12px gap — never more than 3 per row on mobile.

```jsx
<StatTile label="Total minggu ini" value={1830000} size="heading" delta={12} />
<StatTile label="Rata-rata / hari" value={261000} tone="muted" />
<StatTile label="Hari over budget" value="2 / 7" format="raw" tone="over" />
```

Delta polarity is inverted from finance dashboards on purpose: spending more is bad, so ▲ is red.

`size` picks the figure's type step: `title` (24px) when the tile stands alone or sits 2-up,
`heading` (18px) in a 3-up row — rupiah figures run 8–10 characters and clip at 24px in a ~113px tile.
