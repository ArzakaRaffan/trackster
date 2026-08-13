const { TopBar, SectionHeader, Card, Button, IconButton, Icon, Badge, Alert, AmountDisplay, BudgetProgress, TransactionRow, EmptyState } = window.TracksterDesignSystem_4b3ed2;

function TodayScreen({ data, onOpenBudget }) {
  const [dismissed, setDismissed] = React.useState(false);
  const empty = !data.transactions.length;
  return (
    <>
      <TopBar
        subtitle={window.DATE_LABEL}
        title="Hari Ini"
        actions={<>
          <IconButton variant="ghost" label="Sinkron email"><Icon name="refresh-cw" size={18} /></IconButton>
          <IconButton variant="dark" label="Notifikasi"><Icon name="bell" size={18} /></IconButton>
        </>}
      />
      <Screen>
        <Card padding={20} radius="medium" style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <AmountDisplay
              label="Terpakai hari ini"
              value={data.totalSpent}
              size="hero"
              tone={data.isOverBudget ? "over" : "base"}
            />
            <Badge tone={data.isOverBudget ? "over" : data.totalSpent / data.budget >= 0.8 ? "near" : "under"}>
              {data.isOverBudget ? "Over budget" : "Aman"}
            </Badge>
          </div>
          <BudgetProgress spent={data.totalSpent} budget={data.budget} isOverBudget={data.isOverBudget} height={16} />
          <div style={{ display: "flex", gap: "var(--space-20)" }}>
            <AmountDisplay label="Budget" value={data.budget} size="body" tone="muted" />
            <AmountDisplay
              label={data.isOverBudget ? "Lewat" : "Sisa"}
              value={Math.abs(data.remaining)}
              size="body"
              tone={data.isOverBudget ? "over" : "under"}
            />
          </div>
        </Card>

        {data.isOverBudget && !dismissed ? (
          <Alert
            tone="over"
            title="Lewat budget harian"
            icon={<Icon name="triangle-alert" size={18} />}
            onDismiss={() => setDismissed(true)}
            action={<Button variant="outlined" size="sm" onClick={onOpenBudget}>Atur budget</Button>}
          >
            Kamu Rp19.700 di atas budget. Alert Telegram terkirim 19:05.
          </Alert>
        ) : null}

        <SectionHeader
          title="Transaksi"
          meta={data.transactions.length + " transaksi"}
          action={<Button variant="ghost" size="sm">Semua</Button>}
        />
        {empty ? (
          <EmptyState
            icon={<Icon name="inbox" size={22} />}
            title="Belum ada transaksi"
            description="Begitu ada email notifikasi dari BCA atau Jago, transaksinya muncul di sini otomatis."
          />
        ) : (
          <Card padding={8}>
            {data.transactions.map((t) => (
              <TransactionRow key={t.id} description={t.description} amount={t.amount} source={t.source} occurredAt={t.occurredAt} onClick={() => {}} />
            ))}
          </Card>
        )}

        <Card variant="flat" padding={0} style={{ display: "flex", alignItems: "center", gap: "var(--space-10)", color: "var(--text-subtle)", fontSize: "var(--text-small)" }}>
          <Icon name="mail" size={14} />
          <span>Sinkron terakhir 2 menit lalu · BCA, Jago</span>
        </Card>
      </Screen>
    </>
  );
}

Object.assign(window, { TodayScreen });
