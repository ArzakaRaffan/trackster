Circular icon control — the Spotify play-button geometry reused for add / back / close / settings.

```jsx
<IconButton variant="accent" size={56} label="Tambah transaksi"><Icon name="plus" size={24} /></IconButton>
<IconButton variant="ghost" label="Kembali"><Icon name="chevron-left" /></IconButton>
```

Hover scales to 1.05, press to 0.94 — the tactile "audio device" feel. `accent` is reserved for the one primary action (usually the add-transaction FAB).
