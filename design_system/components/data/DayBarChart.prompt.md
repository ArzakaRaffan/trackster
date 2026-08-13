Weekly spend chart — plain divs, no chart library.

```jsx
<DayBarChart days={week.days} selected={todayLabel} onSelect={d => setDay(d)} />
```

Bars are neutral track grey by default; only over-budget days take colour (red), and the selected day goes green. Keep it to 7 bars — for longer ranges stack `BudgetProgress` rows instead.
