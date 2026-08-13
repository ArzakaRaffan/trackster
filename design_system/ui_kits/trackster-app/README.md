# UI kit — Trackster mobile app

`index.html` is a click-through recreation of all five screens inside a 390×780 phone shell. It
composes the design-system components from `_ds_bundle.js`; nothing is re-implemented locally.

| File | Contents |
|---|---|
| `Shell.jsx` | Mock API payloads (`TODAY`, `WEEK`), `PhoneFrame`, `Screen` scroll container |
| `TodayScreen.jsx` | Hari Ini — money hero, budget bar, over-budget alert, transaction list, FAB |
| `WeeklyScreen.jsx` | Mingguan — stat tiles, 7-day bars, selected-day detail, source split |
| `BudgetScreen.jsx` | Budget — editable daily budget, preset pills, history, save CTA |
| `SettingsScreen.jsx` | Setting — account, email sources, Telegram alert switches, logout |
| `LoginScreen.jsx` | Login — wordmark, two fields, cookie note |
| `App.jsx` | Routing between screens, budget state shared with Hari Ini, logout → Login |

**Interactions that work:** bottom-nav routing; changing the budget on the Budget screen
re-derives Hari Ini's status colour, badge, and progress bar; preset pills; alert dismiss; day
selection on the weekly chart; the alert's "Atur budget" jumps to the Budget screen; logout returns
to Login and back in.

Mock data is deliberately an over-budget day (Rp169.700 spent against a Rp150.000 budget) so the
red status path is visible; set the budget to Rp200rb to see the green path.
