const { TopBar, SectionHeader, Card, Button, IconButton, Icon, StatTile, DayBarChart, BudgetProgress, AmountDisplay } = window.TracksterDesignSystem_4b3ed2;

function WeeklyScreen({ week }) {
  const [selected, setSelected] = React.useState("Min");
  const day = week.days.find((d) => d.label === selected) || week.days[0];
  return (
    <>
      <TopBar
        subtitle="1 – 7 Agustus"
        title="Mingguan"
        actions={<IconButton variant="dark" label="Pilih minggu"><Icon name="calendar" size={18} /></IconButton>}
      />
      <Screen>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-10)" }}>
          <StatTile label="Total" value={week.total} size="heading" delta={12} />
          <StatTile label="Rata-rata" value={week.average} size="heading" tone="muted" />
          <StatTile label="Over" value={week.overDays + " / 7"} size="heading" format="raw" tone="over" />
        </div>

        <Card padding={16} radius="medium" style={{ display: "flex", flexDirection: "column", gap: "var(--space-14)" }}>
          <SectionHeader title="Per hari" meta="budget Rp150.000" />
          <DayBarChart days={week.days} selected={selected} onSelect={(d) => setSelected(d.label)} height={130} />
        </Card>

        <Card padding={16} style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
          <SectionHeader title={"Detail " + day.label} />
          <AmountDisplay value={day.spent} size="large" tone={day.isOverBudget ? "over" : "base"} caption={day.isOverBudget ? "lewat budget harian" : "di bawah budget"} />
          <BudgetProgress spent={day.spent} budget={day.budget} isOverBudget={day.isOverBudget} />
        </Card>

        <Card padding={16} style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
          <SectionHeader title="Sumber" meta="minggu ini" />
          {[{ n: "BCA", v: 612400, p: 62 }, { n: "Jago", v: 375300, p: 38 }].map((s) => (
            <div key={s.n} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-label)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                <span>{s.n}</span><span>{s.p}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 500, background: "var(--surface-track)", overflow: "hidden" }}>
                <div style={{ width: s.p + "%", height: "100%", borderRadius: 500, background: s.n === "BCA" ? "var(--source-bca)" : "var(--source-jago)" }} />
              </div>
            </div>
          ))}
        </Card>
      </Screen>
    </>
  );
}

Object.assign(window, { WeeklyScreen });
