const { NavBar, IconButton, Icon } = window.TracksterDesignSystem_4b3ed2;

function App() {
  const [authed, setAuthed] = React.useState(true);
  const [route, setRoute] = React.useState("/");
  const [budget, setBudget] = React.useState(TODAY.budget);
  const today = { ...TODAY, budget, remaining: budget - TODAY.totalSpent, isOverBudget: TODAY.totalSpent > budget };

  return (
    <PhoneFrame>
      {!authed ? (
        <LoginScreen onLogin={() => setAuthed(true)} />
      ) : (
        <>
          {route === "/" ? <TodayScreen data={today} onOpenBudget={() => setRoute("/budget")} /> : null}
          {route === "/weekly" ? <WeeklyScreen week={WEEK} /> : null}
          {route === "/budget" ? <BudgetScreen initial={budget} spent={TODAY.totalSpent} onSaved={setBudget} /> : null}
          {route === "/settings" ? <SettingsScreen onLogout={() => { setAuthed(false); setRoute("/"); }} /> : null}
          {route === "/" ? (
            <div style={{ position: "absolute", right: 16, bottom: 88 }}>
              <IconButton variant="accent" size={56} label="Tambah transaksi manual"><Icon name="plus" size={26} /></IconButton>
            </div>
          ) : null}
          <NavBar active={route} onNavigate={setRoute} />
        </>
      )}
    </PhoneFrame>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
