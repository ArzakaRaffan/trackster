The app's persistent navigation — mirrors `components/NavBar.tsx` in the Next app.

```jsx
<NavBar active={pathname} onNavigate={href => router.push(href)} />
<NavBar orientation="side" active="/budget" />   // ≥1024px
```

Active item = white + bold + a 4px green dot; inactive = #b3b3b3 regular. Fixed to the bottom with `--navbar-safe` reserved as page padding so content never hides behind it.
