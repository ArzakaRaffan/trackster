const { TopBar, SectionHeader, Card, Button, Switch, Select, Input, Icon, Badge, SourceTag } = window.TracksterDesignSystem_4b3ed2;

function SettingsScreen({ onLogout }) {
  const [telegram, setTelegram] = React.useState(true);
  const [daily, setDaily] = React.useState(true);
  const [weekly, setWeekly] = React.useState(false);
  const [threshold, setThreshold] = React.useState("100");
  return (
    <>
      <TopBar subtitle="Akun & alert" title="Setting" />
      <Screen>
        <Card padding={16} style={{ display: "flex", alignItems: "center", gap: "var(--space-14)" }}>
          <span style={{ width: 48, height: 48, borderRadius: "var(--radius-circle)", background: "var(--green)", color: "var(--pure-black)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-title)", fontWeight: 900, fontSize: 20 }}>R</span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--text-body)", fontWeight: 700 }}>rizky@gmail.com</span>
            <span style={{ fontSize: "var(--text-small)", color: "var(--text-muted)" }}>Masuk lewat cookie session</span>
          </div>
        </Card>

        <Card padding={16} style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          <SectionHeader title="Email yang dibaca" meta="2 sumber" />
          {[{ s: "BCA", e: "notifikasi@bca.co.id", ok: true }, { s: "JAGO", e: "no-reply@jago.com", ok: true }].map((r) => (
            <div key={r.s} style={{ display: "flex", alignItems: "center", gap: "var(--space-12)", minHeight: 44 }}>
              <SourceTag source={r.s} />
              <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-small)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.e}</span>
              <Badge tone="under">Aktif</Badge>
            </div>
          ))}
        </Card>

        <Card padding={16} style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
          <SectionHeader title="Alert Telegram" />
          <Switch label="Aktifkan alert" description="Kirim pesan Telegram kalau pengeluaran lewat budget harian." checked={telegram} onChange={setTelegram} />
          <Switch label="Ringkasan harian 21:00" description="Total pengeluaran dan sisa budget hari itu." checked={daily} onChange={setDaily} />
          <Switch label="Ringkasan mingguan" description="Setiap Senin pagi." checked={weekly} onChange={setWeekly} />
          <Select
            label="Kirim alert saat"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            options={[{ value: "80", label: "80% budget terpakai" }, { value: "100", label: "Lewat budget" }, { value: "both", label: "Dua-duanya" }]}
          />
          <Input label="Chat ID" prefix={<Icon name="send" size={16} />} value="482913756" hint="Ambil dari @userinfobot di Telegram." />
        </Card>

        <Button variant="danger" size="md" fullWidth icon={<Icon name="log-out" size={16} />} onClick={onLogout}>
          Keluar
        </Button>
        <span style={{ fontSize: "var(--text-micro)", color: "var(--text-subtle)", textAlign: "center" }}>Trackster · v1.4.2</span>
      </Screen>
    </>
  );
}

Object.assign(window, { SettingsScreen });
