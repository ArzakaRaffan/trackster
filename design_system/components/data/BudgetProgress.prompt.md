The budget bar — Trackster's single most important status object.

```jsx
<BudgetProgress spent={data.totalSpent} budget={data.budget} isOverBudget={data.isOverBudget} height={16} />
<BudgetProgress spent={d.spent} budget={d.budget} height={6} showLegend={false} />
```

Never hardcode the colour: the component derives it. When over budget the track fills red and an extra translucent segment shows the overspend, separated by a 2px background-coloured gap.
