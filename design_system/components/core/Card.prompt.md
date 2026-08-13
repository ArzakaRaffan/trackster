Dark surface container. Almost every block on a Trackster screen is a Card.

```jsx
<Card padding={20} radius="medium">
  <SectionHeader title="Pengeluaran hari ini" />
</Card>
<Card variant="alt" interactive elevated>…</Card>
```

No visible borders by default — depth comes from the shade step (#121212 page → #181818 card → #252525 hover). Only use `outlined` for empty/placeholder states.
