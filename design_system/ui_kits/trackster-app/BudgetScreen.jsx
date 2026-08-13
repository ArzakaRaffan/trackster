const { TopBar, SectionHeader, Card, Button, Input, Icon, Badge, Alert, BudgetProgress, AmountDisplay } = window.TracksterDesignSystem_4b3ed2;

const PRESETS = [100000, 150000, 200000, 250000];

function BudgetScreen({ initial = 150000, spent = 169700, onSaved }) {
  const [budget, setBudget] = React.useState(initial);
  const [saved, setSaved] = React.useState(false);
  const setVal = (v) => { setBudget(v); setSaved(false); };
  return (
    <>
      <TopBar subtitle="Budget harian" title="Budget" />
      <Screen>
        <Card padding={20} radius="medium" style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          <AmountDisplay label="Budget harian" value={budget} size="large" />
          <BudgetProgress spent={spent} budget={budget} height={12} />
          <Input
            label="Ubah nominal"
            prefix="Rp"
            value={Number(budget).toLocaleString("id-ID")}
            onChange={(e) => setVal(Number(String(e.target.value).replace(/\D/g, "")) || 0)}
            hint="Berlaku mulai hari ini. Riwayat hari sebelumnya nggak berubah."
          />
          <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <Button key={p} size="sm" variant={p === budget ? "primary" : "dark"} onClick={() => setVal(p)}>
                {"Rp" + (p / 1000) + "rb"}
              </Button>
            ))}
          </div>
        </Card>

        {saved ? (
          <Alert tone="under" title="Budget tersimpan" icon={<Icon name="check" size={18} />}>
            Budget harian sekarang Rp{Number(budget).toLocaleString("id-ID")}.
          </Alert>
        ) : null}

        <Card padding={16} style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
          <SectionHeader title="Riwayat budget" />
          {[{ d: "12 Agu — sekarang", v: 150000, on: true }, { d: "1 – 11 Agu", v: 120000 }, { d: "Juli", v: 100000 }].map((r) => (
            <div key={r.d} style={{ display: "flex", alignItems: "center", gap: "var(--space-12)", minHeight: 44 }}>
              <span style={{ flex: 1, fontSize: "var(--text-label)", color: "var(--text-muted)" }}>{r.d}</span>
              {r.on ? <Badge tone="under">Aktif</Badge> : null}
              <span style={{ fontSize: "var(--text-label)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                Rp{r.v.toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </Card>

        <Button variant="primary" size="lg" fullWidth caps onClick={() => { setSaved(true); if (onSaved) onSaved(budget); }}>
          Simpan budget
        </Button>
      </Screen>
    </>
  );
}

Object.assign(window, { BudgetScreen });
