Every screen starts with one TopBar.

```jsx
<TopBar subtitle="Rabu, 12 Agustus" title="Hari Ini"
  actions={<IconButton variant="ghost" label="Notifikasi"><Icon name="bell" /></IconButton>} />
```

Translucency + blur is the only place Trackster uses glass — it exists so content scrolls under the header without a hard edge.
