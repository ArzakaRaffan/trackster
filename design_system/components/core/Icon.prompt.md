Renders a Lucide glyph. Trackster's icon language: Lucide, 2px stroke, no fills, `currentColor`.

```jsx
<Icon name="wallet" size={20} />
<Icon name="triangle-alert" size={16} color="var(--status-over)" />
```

In HTML pages load `https://unpkg.com/lucide@0.427.0/dist/umd/lucide.min.js`; in the Next.js app prefer `lucide-react` (`import { Wallet } from "lucide-react"`) and pass the element straight into `icon` props.
