Loading placeholder — mirror the real layout's shape, never a spinner.

```jsx
if (isLoading) return (
  <>
    <Skeleton width={220} height={56} radius="comfortable" />
    <Skeleton height={16} radius="pill" />
    {[0,1,2].map(i => <Skeleton key={i} height={56} radius="standard" />)}
  </>
);
```

SWR revalidation should keep showing stale data instead — only use Skeleton on the first load.
