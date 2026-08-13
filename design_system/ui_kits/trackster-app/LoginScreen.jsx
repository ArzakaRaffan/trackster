const { Button, Input, Icon, Card } = window.TracksterDesignSystem_4b3ed2;

function LoginScreen({ onLogin }) {
  const [email, setEmail] = React.useState("rizky@gmail.com");
  const [pw, setPw] = React.useState("");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px var(--gutter-mobile) 32px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <span style={{ fontFamily: "var(--font-title)", fontSize: 40, fontWeight: 900, letterSpacing: "-1.8px", lineHeight: 1 }}>
          Trackster<span style={{ color: "var(--green)" }}>.</span>
        </span>
        <span style={{ fontSize: "var(--text-body)", color: "var(--text-muted)", lineHeight: 1.4 }}>
          Pengeluaran kamu dicatat otomatis dari email BCA dan Jago.
        </span>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (onLogin) onLogin(); }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-14)" }}
      >
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} prefix={<Icon name="mail" size={16} />} />
        <Input label="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" prefix={<Icon name="lock" size={16} />} />
        <Button type="submit" variant="primary" size="lg" fullWidth caps>Masuk</Button>
        <Button variant="ghost" size="sm" fullWidth>Lupa password</Button>
      </form>

      <span style={{ fontSize: "var(--text-small)", color: "var(--text-subtle)", textAlign: "center", lineHeight: 1.5 }}>
        Session disimpan di cookie. Kamu tetap login di HP ini.
      </span>
    </div>
  );
}

Object.assign(window, { LoginScreen });
