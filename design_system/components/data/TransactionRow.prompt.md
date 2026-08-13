The transaction list row — Spotify's track-row rhythm (monogram · title + meta · right-aligned figure).

```jsx
{data.transactions.map(t => (
  <TransactionRow key={t.id} description={t.description} amount={t.amount}
    source={t.source} occurredAt={t.occurredAt} />
))}
```

Rows sit directly on the card with no dividers; 56px min-height keeps them thumb-friendly. Pass `onClick` only if the row actually navigates — hover lightening implies interactivity.
