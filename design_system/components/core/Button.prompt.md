Pill-shaped action button — use `primary` (green) for the single most important action on a screen, `dark`/`outlined` for everything else.

```jsx
<Button variant="primary" size="lg" fullWidth>Simpan budget</Button>
<Button variant="outlined" size="md" caps icon={<Icon name="filter" size={16} />}>Filter</Button>
<Button variant="ghost" size="sm">Batal</Button>
```

- Green is functional, never decorative — max one `primary` per view.
- `caps` adds uppercase + 1.4px tracking; use for compact toolbar/filter labels, not for long sentences.
- `size="lg"` uses the 500px pill radius (marketing/primary CTA); `sm`/`md` use 9999px.
