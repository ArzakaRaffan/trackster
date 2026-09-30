# trackster — Decisions (ADR ringkas)

> Terbaru di atas. Tanggal absolut (YYYY-MM-DD). Jangan hapus yang lama.

---

## 2026-09-27 — E04-S5: Persona konsultan + mode cepat, eval 10/10 dengan AI ASLI + fix bug tanggal memory
**Konteks:** Lanjutan sesi E04-S4 (masih di VPS produksi, jadi masih bisa akses AI asli). Ganti system
prompt "financial buddy" generik (E04-S1..S4) jadi persona konsultan dengan alur 7 langkah eksplisit
(pahami→cek data→diagnosis→opsi+trade-off→rekomendasi tegas→langkah konkret→tawaran lanjutan), plus 6 chip
mode cepat di `/app/chat`.
**Keputusan:** (1) Chip mode cepat mengisi input field (bukan auto-send seperti `QUICK_PROMPTS` versi lama)
karena beberapa butuh detail spesifik dari Arzaka ("Mau beli sesuatu", "Simulasi rencana nabung") — auto-send
generik bakal menghasilkan jawaban nggak berguna tanpa nominal/barang. (2) Telegram TIDAK perlu perubahan
kode — `telegram-webhook.controller.ts` sudah lewat `AiChatService.handleMessage()` yang sama persis dengan
web sejak E04-S1, jadi persona+memory+snapshot otomatis ikut. (3) Eval manual dijalankan dengan AI ASLI
(dev DB sintetis, `AI_MODEL` default, bukan `AI_MODEL_ADVISOR` — sudah lulus 10/10 jadi belum ada alasan
ganti model) — detail lengkap di `docs/revamp/eval/advisor-2026-09-27.md`. "Sebelum" formal (persona lama)
tidak dijalankan ulang berpasangan, pertimbangan waktu sesi. (4) Eval nemuin bug NYATA di luar scope S5:
`extractMemory()` (E04-S2) manggil `AI_MODEL_FAST` buat nulis `validUntil` tanpa dikasih tau tahun berjalan
— model nebak pakai tahun training-nya (2024) buat kalimat kayak "sebelum Desember", padahal tahun berjalan
2026. `AiMemoryService.listActive()` (yang otomatis ngarsipin `validUntil < now`) langsung ngarsipin memory
itu beberapa detik setelah dibuat, sebelum sempat kepake. Fix: suntik `Hari ini: ${wibDateKey(new Date())}`
ke prompt ekstraksi (satu baris di `ai-chat.service.ts`). Diverifikasi ulang dengan AI asli: memory baru
soal tanggal sekarang nulis tahun yang benar.
**Alasan:** Alur 7 langkah eksplisit dipilih supaya model konsisten "berpendapat" (rekomendasi tegas)
alih-alih cuma nyerahin data mentah + pilihan ke user — itu beda paling jelas dibanding persona lama pas
dites informal di E04-S4. Bug tanggal memory ditemukan justru KARENA eval ini pakai AI asli — sesi-sesi
sebelumnya (S1-S3) nggak pernah bisa nangkep ini karena proxy 401 dari sandbox.
**Konsekuensi:** `tsc --noEmit` (backend+frontend) lulus bersih. 10/10 kriteria eval lulus (angka benar,
pakai memory kontekstual, rekomendasi tegas, tidak mengarang, jujur soal data yang nggak ada — lihat Q5 &
Q8 di file eval). **Belum diverifikasi**: tampilan visual 6 chip mode cepat di browser sungguhan (sesi ini
tanpa Playwright/browser). Belum di-push — nunggu konfirmasi Arzaka.

---

## 2026-09-27 — Insiden: push E04-S4 bikin CD gagal karena kontensi RAM dari dev-testing sesi sendiri
**Konteks:** Habis push commit `2d15ee3` (E04-S4), Arzaka dapat email notifikasi "deploy failed" dari
GitHub Actions. Sesi ini kebetulan jalan LANGSUNG di VPS produksi (bukan sandbox cloud) — begitu push,
sesi langsung lanjut jalanin dev-testing lokal (dev Postgres + `node dist/main.js` buat verifikasi E04-S4)
di VPS yang SAMA yang lagi diproses CD lewat SSH.
**Keputusan:** (1) Diagnosis: RAM 2GB VPS ini kena kontensi antara `docker compose build` yang dijalanin CD
dan proses dev-testing sesi ini, bikin job `deploy.yml` gagal — TAPI docker layer cache dari attempt itu
sempat kebentuk lengkap sampai image `trackster-backend:latest` (dikonfirmasi berisi kode E04-S4 lewat
`docker run --rm ... grep`), cuma langkah `docker compose up -d` yang nggak sempat/gagal jalan buat swap
container yang lagi hidup. (2) Sebelum redeploy manual, `git stash` dulu semua perubahan lokal yang belum
di-commit (WIP E04-S5) — karena `deploy.yml` beneran `git reset --hard origin/main` di checkout `~/trackster`
yang SAMA dengan yang dipakai sesi interaktif ini, bukan checkout terpisah. (3) Matiin dev Postgres + proses
lokal buat bebasin RAM, lalu manual ulangi 3 langkah terakhir `deploy.yml` (`build backend` — ternyata semua
CACHED dari attempt yang gagal, `build frontend`, `up -d`) setelah izin eksplisit dari Arzaka (aksi
"Production Deploy" di-block otomatis oleh classifier, wajib approval manual). (4) `git stash pop` buat
lanjut kerjaan setelah prod stabil.
**Alasan:** Root cause asli (kontensi RAM), bukan bug di kode E04-S4 — dikonfirmasi karena image yang sama
persis, dibangun dari commit yang sama, jalan normal begitu di-swap in.
**Konsekuensi:** Dicatat di Gotchas.md: JANGAN mulai dev-testing lokal di VPS ini segera setelah push ke
`main` tanpa jeda/cek CD dulu. Prod balik sehat (`trackster-backend-1`/`trackster-frontend-1` recreated,
dikonfirmasi `simulatePlan` ada di dist, HTTP 200/404-normal, `nginx`/`certbot`/`postgres` prod tidak
disentuh sama sekali). Tidak ada data prod yang hilang atau rusak.

---

## 2026-09-27 — E04-S4: Tools advisor + engine simulasi + kartu, diverifikasi dengan AI ASLI
**Konteks:** Lanjutan roadmap setelah fix bug crash financial-snapshot (E04-S2) di-push ke prod pagi ini.
Sesi ini ternyata berjalan LANGSUNG di VPS produksi (bukan sandbox cloud seperti sesi-sesi E04 sebelumnya)
— artinya proxy AI self-hosted 9router (`localhost:20128`) beneran bisa diakses, sesuatu yang sejak E04-S1
selalu ditandai "belum bisa dites, proxy 401 dari sandbox".
**Keputusan:** (1) Engine simulasi murni di `plan-simulator.ts` (`simulatePlan`, `whatIfPurchase`) — goal
punya "pocket" tabungan terpisah dari saldo (cuma bergerak lewat `savePerWeek` eksplisit, BUKAN otomatis
dari surplus income−spend); `spendChanges` tanpa `category` berlaku ke total (bukan diulang per kategori,
biar tidak double-count); cicilan (`whatIfPurchase` method=installment) dimodelkan sebagai deretan `oneOffs`
mingguan (berhenti begitu lunas), bukan `spendChange` permanen. (2) `PlanSimulatorService` (baru, di modul
`ai`, bukan `transaction` — biar tidak nambah beban `transaction.service.ts` yang sudah besar) ngerakit
baseline nyata: forecast pemasukan E03 (`IncomeForecastService.getHorizon(1)`) + median pengeluaran rutin
per kategori 8 minggu terakhir (buang pembelian besar ≥Rp500rb, threshold sama dengan
`financial-snapshot.service.ts`). (3) Mekanisme kartu: tool yang return `{card:{...}}` dikumpulkan
(`extractCards`) dan ditempel HANYA ke `ChatMessage.attachments` pesan assistant final (`findLastAssistantWithContentIndex`),
bukan ke tiap stub tool_calls — biar frontend cuma perlu baca satu pesan per giliran. (4) Tools baru:
`searchTransactions`, `getPeriodStats` (dispatch week/month/range — `range` pakai method baru
`TransactionService.getRangeSummary()`, sengaja bukan modul `PeriodStats` E06-S1 yang belum ada), `getIncomeForecast`,
`getGoals` (+ `weeklyContributionNeeded` dihitung inline dari `targetDate`), `simulatePlan`, `whatIfPurchase`,
`proposeGoal` (TIDAK bikin goal, cuma kartu konfirmasi), `logIncome` (minimal, TIDAK link ke stream — beda
dari niat awal epic "mengarah ke stream", ditunda karena alur link-ke-stream yang benar itu jalur check-in
E03-S3, bukan create manual polos).
**Alasan:** Baseline dari data nyata (bukan angka konstan) biar simulasi actually reflect kondisi Arzaka;
kartu ditempel ke pesan final biar frontend sederhana; `logIncome` minimal daripada membangun ulang logika
stream-matching yang sudah ada di `income-checkin` (YAGNI — kalau butuh linking penuh, itu perluasan terpisah).
**Konsekuensi:** **Pertama kalinya di seluruh rantai E04-S1..S4, tes end-to-end dengan AI sungguhan berhasil**
(dev DB `trackster-dev`, data SINTETIS 8 minggu + 1 goal — BUKAN salinan prod, classifier sesi ini menolak
baca DB prod langsung, jadi tidak seperti biasanya di `02-conventions.md`). 4 giliran chat nyata dicek: (1)
"nabung 100rb/minggu, goal 2jt" → "minggu ke-20" tepat + kartu simulasi valid, dan model **secara mandiri**
menyadari baseline income Rp0 bikin saldo defisit (bukan cuma echo tool result); (2) `proposeGoal` → kartu
`goal-proposal` dengan `weeklyContribution` benar; (3) `whatIfPurchase` cash → `weeksDelay=0` (benar sesuai
desain "goal pocket terpisah dari saldo") dan model **menjelaskan nuansa itu dengan tepat**; (4) pertanyaan
gabungan memicu `getWeeklySummary`+`getGoals` natural. Ketemu gotcha baru: `AI_BASE_URL=host.docker.internal`
(nilai container) tidak resolve di luar Docker — `localhost:20128` yang benar buat run lokal di VPS ini
(dicatat di Gotchas.md). **Belum diverifikasi**: tampilan visual `SimulationCard`/`GoalProposalCard` di
browser sungguhan (sesi ini tanpa Playwright/browser terpasang) — cuma `tsc --noEmit` bersih + shape data
API dicek cocok dengan prop types komponen. `npm run build` (backend) lulus bersih. Belum di-push ke `main`
(nunggu konfirmasi Arzaka per aturan 02-conventions.md §1).

---

## 2026-09-27 — E04-S2: Financial Snapshot + Memory jangka panjang
**Konteks:** System prompt chat (E04-S1) masih statis — nggak ada kondisi keuangan real-time atau fakta tahan lama tentang Arzaka yang disuntik. Epic minta arsitektur berlapis: persona + snapshot deterministik + memory + retrieval (E04-S3, belum) + summary thread (E04-S1).
**Keputusan:** (1) `FinancialSnapshotService` & `AiMemoryService` jadi provider tambahan di `AiModule` yang sudah ada (pola sama `ai-caption`/`ai-anomaly` — bukan modul NestJS terpisah, karena domainnya emang bagian dari fitur AI, bukan domain data baru). `AiModule` nambah import `BalanceModule` & `IncomeForecastModule` buat data snapshot. (2) Snapshot teks (bukan JSON) di-cache 5 menit in-memory (single-user, nggak perlu Redis) — dipanggil tiap `sendMessage()`, jadi harus murah. Threshold "pembelian besar" Rp500rb, heuristik sederhana sama semangatnya kayak `ai-anomaly.service.ts` (didokumentasikan di kode, bukan angka ajaib diam-diam). (3) Migration `add_ai_memory` dibuat manual (`prisma migrate diff` lalu `migrate deploy`) — `npx prisma migrate dev` selalu gagal non-interactive di sesi Claude Code (gotcha lama). (4) `parseMemoryOps` (validasi output JSON model ekstraksi) fungsi murni diekspor dari `ai-memory.service.ts`, dites `ai-memory.check.ts` (13 assertion) tanpa DB/AI call — output model itu untrusted input, jadi entry invalid di-skip diam-diam (bukan gagal semua array). (5) Ekstraksi memory dipanggil fire-and-forget (`.catch()`, nggak di-`await` sebelum return reply) setelah `sendMessage()` sukses dapat balasan — TIDAK boleh nambah latensi ke user ataupun bikin chat gagal kalau ekstraksi error. (6) Tool `remember`/`forget` ditambah ke `ai-finance-tools.service.ts` yang sudah ada (bukan tools terpisah) — `AiFinanceToolsService` sekarang juga inject `AiMemoryService`. (7) Halaman `/app/chat/memory`: hapus dari UI = hard delete (`DELETE /ai/memory/:id`), beda dari "arsip" (soft, bisa dipulihkan) — dua aksi terpisah di UI (ikon Archive vs Trash2) karena beda makna: arsip = "sudah nggak relevan tapi riwayatnya masih valid", hapus = "salah input/nggak pernah relevan".
**Alasan:** Snapshot deterministik (bukan model yang "mengarang" ringkasan keuangan) konsisten sama prinsip 02-conventions.md §3 (LLM nggak boleh menghitung angka yang ditampilkan). Memory di-cache di prompt (bukan RAG vector) karena untuk satu user, fakta yang penting itu kecil & selalu relevan — sesuai desain arsitektur berlapis di epic.
**Konsekuensi:** Sesi ini nggak bisa nguji ekstraksi memory dari chat ASLI atau follow-up "chat baru besok nanya progres" — proxy AI self-hosted (9router) balas 401 kalau diakses dari sandbox cloud ini (kemungkinan IP-restricted ke VPS, sama kejadiannya kayak pas verifikasi E04-S1). Semua yang bisa dites deterministik (snapshot text generation, CRUD memory, assembly system prompt tanpa crash pas AI call gagal) sudah diverifikasi lewat curl + Playwright ke dev DB lokal nyata (bukan mock). Verifikasi ekstraksi otomatis beneran & kualitas jawaban follow-up cuma bisa dikonfirmasi Arzaka langsung di prod.

---

## 2026-09-27 — E04-S1 verifikasi: bug refresh + status roadmap ketinggalan dari kode
**Konteks:** Sesi sebelumnya (`07efc8f` dkk) implementasi E04-S1 (persistensi chat) lengkap di kode tapi lupa update `README.md`/checklist epic — status masih ⬜ padahal kode sudah live di `main`. Diminta verifikasi sebelum lanjut E04-S2 (dependency-nya).
**Keputusan:** (1) Verifikasi build+tsc+`next build` lulus, 99 self-check assertion lintas modul (ai-chat, income-forecast, income-checkin, budget-allocation, parsers) semua lulus. (2) Verifikasi browser (Playwright headless, dev server lokal): ketahuan bug nyata — `/app/chat` nyimpen `activeThreadId` cuma di `useState`, refresh halaman selalu balik ke welcome screen meski thread & pesan aman di DB (dicek langsung: `GET /ai/threads` tetap nunjukin thread yang baru dibuat). Ini persis melanggar acceptance test yang ditulis sendiri di epic ("refresh halaman → chat masih ada"). (3) Fix: `localStorage` key `trackster_chat_active_thread`, di-restore sekali via `useEffect` begitu daftar thread pertama kali kebaca dari SWR, divalidasi masih ada & belum di-archive. "Chat baru" & hapus thread aktif membersihkan entry-nya. (4) Update status README E04-S1 dari ⬜ ke ✅ berdasar bukti kode + verifikasi baru ini (bukan tebakan) — dan catat di README bahwa commit `bc1b697` (daily recap, anomaly watchdog, dll) itu kerjaan ad-hoc di luar roadmap resmi, biar nggak disangka E06/E04-S4/E05 selesai.
**Alasan:** "Kode ada di main" beda dari "sudah diverifikasi" — dua sesi sebelumnya sama-sama nulis "belum diverifikasi browser" di Decisions.md tapi lanjut push ke prod; kali ini ketauan ada bug nyata pas akhirnya dicek, jadi kebiasaan ini terbukti berisiko.
**Konsekuensi:** AI completion (`/ai/chat`, `/ai/threads/:id/messages`) balas 401 dari proxy AI self-hosted (9router) kalau dites dari sandbox sesi cloud ini — kemungkinan proxy itu IP-restricted ke VPS. Bukan bug kode (fallback deterministik jalan benar, pesan user & fallback assistant tetap tersimpan), tapi berarti "pertanyaan lanjutan dijawab nyambung" di acceptance test belum bisa dites end-to-end dari sini — cuma bisa dikonfirmasi kalau dites langsung di prod/VPS. Verifikasi juga sempat nyaris keliru: `NEXT_PUBLIC_API_URL` di environment cloud session ini adalah env var asli level-container yang nunjuk ke prod (`https://api.track.trackster.my.id`) — override lewat `.env.local` doang TIDAK cukup (Next.js nggak nimpa env var yang sudah ke-set di process), harus di-export eksplisit pas start `next dev`. Satu request login (password tebakan, gagal) sempat kekirim ke API prod asli sebelum ketauan — dicatat di sini biar sesi lain nggak ngulang.

---

## 2026-09-25 — E03-S4: Alokasi 50/30/20 mingguan — overwrite DailyBudget dari check-in, tabungan cuma rekomendasi Telegram
**Konteks:** Arzaka minta prinsip 50% kebutuhan/30% keinginan/20% tabungan diterapkan otomatis dari pemasukan mingguan (E03-S3), dengan catch: pemasukan yang di-checkin Minggu malam membiayai minggu **depan**, bukan minggu berjalan (uang baru "ada" pas checkin, tapi nutup minggu depan). Ditanya ke Arzaka dulu sebelum desain (AskUserQuestion) karena beberapa keputusan nggak bisa diasumsikan: basis income mana yang dihitung, `DailyBudget` (statis per hari-dalam-minggu, sudah ada dari awal) di-overwrite atau butuh model histori baru, kebutuhan+keinginan digabung atau dipisah per kategori, tabungan ke Jago itu rekomendasi doang atau ada mekanisme lain, dan kapan tepatnya alokasi dihitung ulang.
**Keputusan:** (1) Modul baru `budget-allocation/` (pola sama `income-forecast/` — domain beda dari CRUD `budget`). Tanpa migration baru — reuse `Income.periodStart`, `IncomeStream.kind`, `DailyBudget.dayOfWeek/amount`, `Transaction.amount/occurredAt` apa adanya. (2) Basis pemasukan = semua `Income` dengan `periodStart` minggu itu, **exclude stream `IRREGULAR`** (konsisten dengan aturan forecast E03-S2). (3) `calcWeeklyAllocation()` fungsi murni: `needs=round(50%)`, `wants=round(30%)`, `savings=total-needs-wants` (sisa pembulatan masuk savings, bukan pool harian, biar total selalu pas); pool kebutuhan+keinginan dibagi rata 7 hari, sisa pembagian masuk hari terakhir (Sabtu) — dites `budget-allocation.check.ts` termasuk assert eksplisit dari contoh Arzaka (900rb → 450rb/270rb/180rb, 7 hari jumlahnya persis 720rb). (4) `DailyBudget` (model lama, statis per `dayOfWeek`, dipakai `/app/budget` & `/app/today`) **di-overwrite langsung** tiap minggu lewat `BudgetService.updateAll()` yang sudah ada — bukan model histori baru; nilai baru otomatis berlaku mulai besok (Senin) karena `dayOfWeek` bukan tanggal spesifik. (5) Cron tetap `Minggu 21:00 WIB` (setelah prompt check-in 19:00 & weekly insight report 20:00) — pakai data yang ada saat itu, **tidak** recompute ulang kalau ada jawaban check-in telat masuk Senin (trade-off yang disadari, bukan bug). (6) "Sisa" = total 7 `DailyBudget` yang berlaku minggu yang baru berakhir (dibaca **sebelum** overwrite) dikurangi total `Transaction` aktual minggu itu; kalau overspend, sisa dianggap 0 (bukan negatif) dan pesan Telegram bilang overspend, bukan rekomendasi nabung. (7) Tabungan (20% + sisa) **cuma rekomendasi teks lewat `TelegramService.sendMessage()`** — tidak menyentuh `BankBalance`/`BalanceAdjustment` sama sekali, karena app nggak transfer uang beneran; keluar-masuk tetap lewat myBCA, user pindah manual ke Jago. (8) Tidak ada perubahan frontend — `/app/budget` & `/app/today` sudah `useSWR` ke `GET /budget` yang baca `DailyBudget` live, jadi otomatis ikut update setelah cron jalan.
**Alasan:** `DailyBudget` yang sudah ada persis cocok jadi target overwrite (dayOfWeek generik = otomatis berlaku minggu depan tanpa perlu tanggal spesifik); histori/BankBalance ditolak karena nambah kompleksitas yang nggak diminta (YAGNI) — kalau nanti butuh histori alokasi, itu perubahan terpisah.
**Konsekuensi:** `nest build`/`tsc --noEmit` di VPS ini (host produksi juga, bukan cuma dev sandbox — lihat Gotchas.md soal RAM) OOM tanpa `NODE_OPTIONS=--max-old-space-size=1536`; dengan itu `tsc --noEmit` lolos bersih. Deploy ke prod sukses (route `/budget-allocation/trigger-weekly` ter-mount, log Nest bersih). **Trigger manual (`POST /budget-allocation/trigger-weekly`) sengaja TIDAK dijalankan** — dicek dulu lewat SQL langsung ke Postgres prod: belum ada `Income` dengan `periodStart` minggu berjalan (cron check-in baru jalan Minggu 19:00, hari itu masih hari kerja), jadi kalau di-trigger, `totalIncome` kehitung Rp0 dan bakal nimpa `DailyBudget` real (waktu itu berisi 50rb/35rb/50rb/35rb/45rb/0/0) jadi semua Rp0 — ditanya ke Arzaka dulu (AskUserQuestion), dipilih SKIP trigger live. Verifikasi jadi: self-check pure function lulus, `tsc --noEmit` lolos, route ter-mount & Nest boot bersih di prod, `curl` ke `/app/budget` & `/budget` balas 307/401 (redirect login/unauthorized, bukan 500 — server sehat). **Belum diverifikasi**: alokasi beneran jalan pakai income asli (nunggu cron Minggu 21:00 pertama pakai kode ini) dan tampilan `/app/budget` di browser (Claude in Chrome nggak konek di sesi ini, bukan cuma masalah RAM VPS kali ini).

---

## 2026-09-25 — E03-S3: Check-in mingguan — modul baru tanpa migration, "filled" berbasis eksistensi row
**Konteks:** Jaring pengaman utama biar pemasukan tercatat tanpa Arzaka buka app: cron Telegram Minggu 19:00 (tombol inline keyboard buat FIXED/DEDUCTION) + reminder Senin 12:00, plus halaman web `/app/income/checkin` buat SESSION/VARIABLE/IRREGULAR.
**Keputusan:** (1) Modul baru `income-checkin/` (pola sama seperti `income-forecast/` — domain beda dari CRUD stream). Reuse skema `IncomeStream`/`Income` dari E03-S1 apa adanya (`origin: CHECKIN`, `periodStart`, `units`, `extraUnits` sudah ada) — **tidak ada migration baru** sama sekali di sesi ini. (2) "Sudah diisi minggu ini" dicek dari **eksistensi** row `Income` (streamId+periodStart), bukan `received > 0` — penting buat DEDUCTION minggu absen penuh (nominal 0 tapi tetap "sudah dijawab", supaya tidak terus-terusan diingatkan). (3) Fungsi murni `calcCheckinAmount` (hitung nominal dari units/extraUnits per `IncomeKind`) & `buildCheckinMessage`/`parseCheckinCallback` (teks+keyboard Telegram) di-export langsung dari service/util file, dites di `income-checkin.check.ts` (15 assertion) tanpa DB — pola sama `calcStreamForecast`. (4) `TelegramModule` ↔ `IncomeCheckinModule` circular via `forwardRef` di kedua sisi (pola sama persis `AiModule`↔`TelegramModule` yang sudah jalan di prod) — webhook butuh `IncomeCheckinReminderService` buat `callback_query`, cron butuh `TelegramService` buat kirim. (5) Callback Telegram cuma tombol FIXED ("sudah masuk") & DEDUCTION (`[0][1][2][3+]`) — SESSION/VARIABLE diarahkan ke link web karena butuh lebih dari satu angka. IRREGULAR sengaja tidak muncul di pesan Telegram sama sekali (opsional, cuma ada di halaman web) karena "tidak masuk forecast dasar". (6) Submit (baik dari web maupun callback) skip diam-diam kalau row buat stream+minggu itu sudah ada — idempotent kalau tombol Telegram ke-tap dua kali atau reminder Senin nyusul padahal user udah isi dari web. (7) `receivedAt` buat Income hasil checkin di-set ke hari Minggu (akhir minggu yang di-checkin), bukan `now()` — biar akurat temporal walau user ngisi telat pas reminder Senin. (8) Baseline saldo (`shouldAdjustBalance`) diterapkan penuh di jalur checkin (beda dari `income.service.ts` manual create/update yang sampai sekarang belum pakai baseline — gap lama, di luar scope sesi ini).
**Alasan:** Reuse skema penuh dari E03-S1/S2 lebih murah daripada bikin model check-in state terpisah; existence-check lebih benar daripada threshold nominal buat kasus "absen penuh tapi tetap dijawab".
**Konsekuensi:** Endpoint `GET`/`POST /income/checkin` + 2 endpoint manual-trigger (`trigger-prompt`/`trigger-reminder`, pola sama `ai/reports/trigger-weekly`) diverifikasi lewat curl ke dev DB (FIXED/DEDUCTION/SESSION dihitung benar, idempotent, saldo BCA bergerak sesuai — lihat detail di file epic). **Belum** diverifikasi: kirim pesan Telegram sungguhan (perlu bot/chat test yang tidak tersedia sesi ini) dan cek visual halaman `/app/income/checkin` di browser — VPS kehabisan memori berulang kali pas sesi ini (lihat Gotchas.md), jadi dev server backend cuma sempat naik sekali buat konfirmasi routing & DI beres sebelum harus dimatikan lagi.

---

## 2026-09-25 — E03-S2: Forecast pemasukan + Pemasukan v2 — modul terpisah, forecast gantikan rata-rata historis
**Konteks:** `IncomeService.getAllocationRecommendation()`/`getSmoothedDailyAllowance()` lama pakai rata-rata historis mentah (rusak kalau Arzaka berhenti nyatet manual — persis masalah yang bikin E03 diprioritaskan). E03-S1 sudah punya model `IncomeStream`; S2 butuh mesin forecast deterministik di atasnya.
**Keputusan:** (1) Modul baru `income-forecast/` (bukan ditambah ke `income/` atau `income-stream/`) — domain forecast beda dari CRUD stream/entry, dan `IncomeModule` import `IncomeForecastModule` (searah, tidak circular). (2) Fungsi kalkulasi murni (`calcStreamForecast`, `deriveStreamStatus`, `isScheduledInWeek`) di-export langsung dari service file (pola sama seperti `shouldAdjustBalance` di `balance.service.ts`) supaya bisa dites tanpa DB — self-check `income-forecast.check.ts` (21 assertion) verifikasi tabel formula di epic persis, termasuk assert eksplisit dari epic: maks minggu biasa (Les Privat+Magang+Mingguan) = 1.350.000. (3) `DEDUCTION.typicalUnits` (0 di seed Gaji Magang) dipakai sebagai fallback "rata-rata hari absen" sebelum ada histori check-in — field ini sebelumnya tidak dipakai formula manapun di desain S1, sekarang jadi konsisten dengan `SESSION.typicalUnits`. (4) `getAllocationRecommendation()` kehilangan parameter `windowDays` (dulu 28, dipakai buat window rata-rata historis) — sekarang selalu forecast minggu berjalan; `isFallback` artinya berubah dari "belum ada income X hari terakhir" jadi "belum ada stream aktif sama sekali" (expected=0). Shape response TIDAK berubah, jadi `ai-finance-tools.service.ts` & `ai-mascot.service.ts` tidak perlu disentuh. (5) UI kartu "Perkiraan bulanan" = jumlah `getHorizon(4)` (~4 minggu ke depan), BUKAN kalender bulan berjalan — lebih murah (reuse computeWeek yang sudah ada) dan cukup akurat buat asumsi produk; dilabeli eksplisit "~4 minggu ke depan" di UI biar tidak menyesatkan. (6) Section "Tak terduga" (IRREGULAR/upside) digabung ke kartu Perkiraan sebagai catatan satu paragraf, bukan section terpisah seperti draft awal epic — saat ini cuma ada 1 stream IRREGULAR ("Project/Lainnya"), section sendiri kepanjangan buat satu angka.
**Alasan:** Forecast per stream selalu punya angka bahkan sebelum ada histori check-in (`typicalUnits`/`amount` sebagai fallback) — makanya lebih robust dibanding rata-rata historis yang jadi Rp0 kalau user berhenti nyatet.
**Konsekuensi:** Verifikasi sesi ini pakai Postgres 16 native + dev server lokal di cloud session (bukan Docker — sandbox ini tidak punya Docker daemon; bukan data salinan prod — sesi cloud ini tidak punya akses SSH ke VPS). Migration `add_income_streams` (E03-S1) sudah di `main` tapi seed `prisma/seed-income-streams.js` di prod masih manual (belum dikonfirmasi sudah dijalankan Arzaka). Link income lama (`streamId` null) ke stream tetap ditunda — UI riwayat sekarang nge-tag stream kalau ada tapi belum ada cara assign dari UI (masih manual lewat Prisma Studio/SQL kalau perlu, atau ditunda total ke E03-S3 check-in yang otomatis set `streamId`+`periodStart` buat entry baru).

---

## 2026-09-24 — E01-S1: VA parser BCA — cabang terpisah & guard false-positive e-wallet
**Konteks:** VA BCA (GoPay, ShopeePay, OVO, dll) tidak ter-parse karena parser lama hanya kenal `Transfer Amount` + `Beneficiary Name`. Format VA pakai `Pay Amount`/`Total Payment` + `Company/Product Name`. Tiga varian email nyata dikonfirmasi: GoPay (Name = kode VA `GP-xxx`), ShopeePay (Name = nama user ter-mask), OVO (Name = nama owner penuh `ARZAKA RAFFAN MAWARDI`).
**Keputusan:** (1) `parseVirtualAccount()` cabang terpisah, dispatch via `/virtual account/i.test(transferType)`. (2) `isInternalDestination` untuk VA hanya cek `BCA Virtual Account No.` — tidak cek `Name` vs `OWNER_FULL_NAME` karena e-wallet isi dengan nama registrasi user (OVO = false-positive). (3) `extractField` + opsi `exact: true` untuk label pendek. (4) `htmlToText` di-export dari `parser.interface.ts`, `GmailSyncService` delegate ke sana. (5) `categoryHint` di `ParseResult` sementara `LAINNYA` sampai E00-S3 perluas enum.
**Alasan:** Cabang terpisah aman; guard false-positive kritis — tanpa ini OVO top-up selalu excluded.
**Konsekuensi:** Backfill VA di E01-S3. Fixture `__fixtures__/` harus di-update kalau format email BCA berubah.

---

## 2026-09-24 — E01-S2: Flip parser — receipt vs instruksi, guard deskripsi
**Konteks:** Email Flip ada 2 bentuk: "Transaction information..." (instruksi bayar ke rekening Flip, belum expense final — uangnya baru keluar saat SoF BCA kepotong, sudah di-exclude dari sisi BCA lewat FLIPTECH) dan "Successful transfer to \<Nama\>..." (receipt = expense final, label `Destination Name`/`Destination Bank`/`Destination Account Number`/`Time`). Parser lama pakai label tebakan (`Beneficiary Name`, dll) yang tidak pernah cocok dengan email Flip asli — 3 varian dicek by ID (`ST...`/`CS...`/`FT...`, subject "BUKTI TRANSFER"/"TRANSFER RECEIPT") semua pakai label yang sama.
**Keputusan:** (1) `parse()` return `null` kalau subject match `/transaction information/i`. (2) Ganti seluruh field ke label asli dengan `exact: true`. (3) `source` selalu `BCA` (SoF cuma ada di email instruksi yang di-skip, bukan di receipt). (4) Guard deskripsi >80 char atau mengandung `{`/`}` → `null` (lebih baik UNPARSED daripada sampah). (5) `categoryHint` untuk transfer ke orang lain: enum `Category` belum punya `TRANSFER` — dipakai `LAINNYA` sementara (sama pola dengan VA GoPay di E01-S1), enum baru ditunda ke E00-S3 biar sekalian.
**Alasan:** Label tebakan tidak pernah match email nyata → semua transfer Flip selama ini UNPARSED (atau jatuh ke path lain). Ambil dari email production langsung lebih murah daripada terus nebak.
**Konsekuensi:** Fixture `flip-receipt.txt`, `flip-instruction.txt`, `flip-receipt-internal.txt` diambil dari email Gmail asli (id `1a0bf2c74c1d60d7`, `1a0bf2bbf135bd29`, `1a0783de07ac4214`). Backfill live + dedupe data lama ditunda ke E01-S3 (satu putaran bareng BCA).

---

## 2026-09-24 — Revamp v2: rencana 10 permintaan, data benar dulu
**Konteks:** Arzaka minta 10 perubahan besar (VA GoPay, pemasukan otomatis, AI advisor + RAG, model pemasukan, fitur publik, analisis, laporan, Tanya Track, saran budget, mascot). Audit menemukan data belum bisa dipercaya: VA tidak ter-parse, Flip dobel, container UTC, 39% `LAINNYA`, pemasukan tidak dicatat sejak 24 Agu.
**Keputusan:** Rencana lengkap di `docs/revamp/` (README = index + status). Urutan: Fase 0 data benar (E00, E01) → Fase 1 pemasukan (E03, E02) → Fase 2 AI core (E04) → Fase 3 insight (E06, E07, E05) → Fase 4 mascot & publik (paralel). Angka selalu dari kode deterministik; LLM hanya memilih/menjelaskan. RAG = snapshot + memory terstruktur + Postgres FTS `indonesian` (proxy tidak punya embeddings). Pemasukan otomatis via email Jago + check-in mingguan + eksperimen iOS 27 Notification automation; Moota ditolak (biaya).
**Alasan:** Fitur pintar di atas data salah menghasilkan jawaban pintar-tapi-salah; satu user → konteks penting kecil dan selalu relevan, jadi disuntik langsung, bukan vector search.
**Konsekuensi:** Tiap sesi baca `docs/revamp/README.md` + `02-conventions.md` + satu file epic. Status di-update di README tiap sesi selesai.

---

## 2026-09-24 — E00-S3: kategori final + MOBI = investasi/crypto
**Konteks:** Audit nemu `MOBI` (Rp2,62jt, 7 transaksi) nyasar ke `LAINNYA`, nggak jelas itu apa. Kategori enum sekarang cuma MAKANAN/TRANSPORT/BELANJA/TAGIHAN/HIBURAN/KESEHATAN/LAINNYA — nggak ada tempat buat transfer, top-up, atau pengeluaran sekali-jalan yang gede.
**Keputusan:** `MOBI` = investasi/crypto (dikonfirmasi Arzaka). Kategori baru yang ditambah ke enum `Category` di E00-S3: `TRANSFER`, `TOPUP` (sudah direncanakan sejak E01), `PENDIDIKAN`, `PERAWATAN`, `INVESTASI`, `ROKOK` (vape/rokok, sebelumnya default ke `HIBURAN` di draf epic — Arzaka minta kategori sendiri).
**Alasan:** Vape & investasi punya pola belanja beda (rutin kecil vs sekali gede) dari hiburan/lainnya biasa — nyampur bikin analisis pengeluaran salah baca kebiasaan.
**Konsekuensi:** `merchant-alias.category` dipakai buat rule MOBI → INVESTASI, Sigma Vape/Animo Vape → ROKOK. Semua tempat frontend yang nge-hardcode daftar kategori (label, warna, filter) perlu diupdate ikut 6 kategori baru ini.

---

## 2026-09-24 — E03-S1: IncomeStream — 5 stream aktif, Annotator/Asdos tidak dibuatkan model
**Konteks:** `Income` lama cuma entry manual datar tanpa konsep sumber/jadwal, jadi rusak begitu Arzaka berhenti rutin mencatat. Di DB lama ada entry "Annotator", "Asdos", "Kenyu" selain 5 sumber utama yang disebut Arzaka (les privat, magang, uang mingguan, Ruangguru, project). Tanya Arzaka langsung (AskUserQuestion) sebelum desain data final.
**Keputusan:** (1) 5 `IncomeStream` di-seed: Les Privat (SESSION, rate 300rb + extra 50rb offline, maks 2 sesi/minggu, `matchKeywords: ["KENYU"]` karena Kenyu = murid les aktif), Gaji Magang (DEDUCTION, maks 250rb, potong 50rb/hari absen, 5 hari kerja), Uang Mingguan Keluarga (FIXED 400rb), Ruangguru (VARIABLE, cadence MONTHLY, `payDayOfMonth=25`, estimasi awal 150rb dari rentang jawaban Arzaka 100-200rb), Project/Lainnya (IRREGULAR, cadence NONE). Semua `source: BCA`. (2) Annotator & Asdos **tidak** dibuatkan `IncomeStream` — Arzaka konfirmasi sudah tidak aktif; entry `Income` historisnya dibiarkan tanpa `streamId` (tidak di-backfill link). (3) Migration `add_income_streams` dibuat manual via `prisma migrate diff` + `migrate deploy` (bukan `migrate dev`) karena shell non-interactive tidak didukung `migrate dev`. (4) Seed pakai script sekali-jalan `prisma/seed-income-streams.js` (idempotent by name), bukan `prisma/seed.js` (itu khusus user admin).
**Alasan:** Kolom eksplisit per `IncomeKind` (bukan JSON generik) biar UI check-in (E03-S3) & validasi DTO gampang per jenis. Stream tidak aktif tidak usah dimodelkan — cuma nambah noise di UI kelola sumber tanpa manfaat.
**Konsekuensi:** Link income lama → stream (mis. entry "Mingguan" lama → Uang Mingguan Keluarga) ditunda ke E03-S2 pas ada UI edit income yang expose `streamId`. `nest build` sempat OOM di VPS (RAM 2GB, swap penuh) — dipakai `npx tsc -p tsconfig.json` langsung buat verifikasi compile (lihat Gotchas), bukan indikasi bug kode.

---

## 2026-09-26 — E02-S1: parser Jago income + saldo balance-only buat transfer internal
**Konteks:** Transfer BCA→Flip→rekening sendiri (top-up Jago via Flip, atau transfer langsung BCA/Jago ke rekening sendiri) selama ini di-exclude total (`parsed.excluded=true`) tanpa gerakin saldo sama sekali — padahal uangnya beneran keluar dari SoF. Ini bikin saldo per rekening drift dan Arzaka sering koreksi manual. Cuma ada 2 email Jago "menerima sejumlah uang" nyata di inbox, keduanya dari FLIPTECH.
**Keputusan:** (1) `ParseResult` dapat `kind?: 'EXPENSE'|'INCOME'` (Jago "menerima uang" → INCOME, dulu ke `IncomeService.createFromParsed()`, bukan `TransactionService`) dan `balanceOnly?: boolean` (transfer exclude yang uangnya beneran keluar → tetap debit saldo lewat `GmailSyncService.applyBalanceOnlyDebit()`, dedup by `EmailParseLog.status=EXCLUDED`). (2) Klasifikasi Income: pengirim = `OWNER_FULL_NAME` → INTERNAL; cocok `IncomeStream.matchKeywords` → CONFIRMED; pengirim FLIPTECH berkorelasi `EmailParseLog` EXCLUDED nominal sama ±3 jam → INTERNAL; selain itu → PENDING ("Perlu dicek" di halaman Pemasukan, resolve lewat `PATCH /income/:id/resolve`). (3) Saldo JAGO **selalu** gerak dari email Jago "menerima uang", apapun status klasifikasinya — klasifikasi cuma metadata, bukan syarat gerak saldo. (4) Fixture: 1 nyata (FLIPTECH, dari Gmail MCP) + 2 sintetis (owner-sender, unknown-sender) buat nutup 3 skenario klasifikasi yang datanya belum ada di inbox asli.
**Alasan:** Prinsip "uang yang beneran keluar/masuk selalu gerakin saldo, klasifikasi itu urusan terpisah" — motivasi utama biar saldo BCA/JAGO akurat tanpa nunggu Arzaka koreksi manual tiap kali ada transfer internal.
**Konsekuensi:** Tabel saldo lengkap ditulis ke `CLAUDE.md` bagian Saldo Bank. Backfill 60 hari & verifikasi browser live (dev server) belum jalan sesi ini — backfill butuh Gmail sync nyata (di luar scope tanpa approval eksplisit nyentuh inbox/DB prod), browser dev nggak bisa dites karena browser Arzaka di laptop sedangkan dev server di VPS tanpa tunnel SSH aktif. Endpoint diverifikasi end-to-end via curl (resolve CONFIRMED & INTERNAL, PENDING list kosong setelahnya) dan compile bersih (`npm run build` + `tsc --noEmit` + self-check 53/53).

## 2026-09-28 — E06-S1: PeriodStatsService, satu sumber angka buat Analisis/Laporan/Budget/AI
**Konteks:** `TransactionService.getInsights()` lama tidak ikut `range` buat trend & budget adherence (30d selalu sama dengan all-time karena data baru mulai 10 Agu), tanpa periode pembanding, dan campur pembelian besar sekali-jalan (Monitor, MOBI) dengan pengeluaran rutin di semua rata-rata harian.
**Keputusan:** Modul baru `apps/backend/src/modules/analytics/` (`AnalyticsService.getPeriodStats(start, end, compare?)`) jadi satu-satunya sumber statistik periode, dipakai `GET /analytics/stats` (`?range=7d|30d|90d|all` atau `?from=&to=`) dan tool AI `getPeriodStats({period:'range'})`. Definisi: **pembelian besar** = `amount >= max(Rp300.000, 5x median 90 hari)`, override manual lewat `Transaction.isBig` (migration `20260927163500_add_transaction_is_big`); **rutin** = bukan besar; **anomali** = rutin >3x median kategorinya (90 hari) atau merchant baru dengan nominal >p90 semua transaksi; **habit** = merchantKey ≥3 kunjungan & ≥1x/minggu dalam periode. Periode pembanding = panjang sama tepat sebelum `start`, `null` (bukan angka palsu) kalau sebagian jatuh sebelum `dataStartsAt` (transaksi pertama di DB). `TransactionService.getInsights()` lama jadi wrapper tipis di atas `getPeriodStats` (field lama dipertahankan persis: `trend`, `topMerchants`, `categoryBreakdown`, `spendByDayOfWeek`, `budgetAdherence`) — dipertahankan karena masih dipakai `AiMascotService`, `AiReportsService` (weekly/health score), dan tool AI `getInsights`. `TransactionService.getRangeSummary()` (stopgap sebelum E06-S1) dihapus, penggunanya (tool AI `getPeriodStats` period="range") pindah ke `AnalyticsService` langsung.
**Alasan:** Dua implementasi statistik yang bisa beda angka lebih berbahaya daripada satu implementasi dengan wrapper — Analisis (E06-S2), Laporan (E07), dan Saran Budget (E05) semua akan baca `PeriodStats` yang sama nantinya. Wrapper (bukan migrasi semua caller sekaligus) dipilih supaya persona AI yang sudah dievaluasi manual 10/10 (E04-S5) tidak ikut berubah perilakunya di sesi ini.
**Konsekuensi:** Diverifikasi live lewat `curl` ke prod (`/analytics/stats?range=7d|30d|90d|all` beda angka nyata; `previous: null` yang benar buat 90d/all karena data cuma 50 hari; `/transactions/insights` dicek tetap sama bentuknya). Self-check `period-stats.check.ts` 21/21 (fungsi murni: `isBigPurchase`, `isAnomaly`, `computeBudgetAdherence`, `previousPeriod`, dll — DB query di service tidak dites unit, cuma live). Belum ada verifikasi visual browser karena halaman Analisis v2 (E06-S2) belum dikerjakan sesi ini.

## 2026-09-28 — Gotcha: `prisma migrate dev` gagal di shadow DB gara-gara kolom generated (tsvector)
**Konteks:** `npx prisma migrate dev --name add_transaction_is_big` di DB dev gagal dengan `ERROR: column "search" of relation "ChatMessage" is a generated column` — Prisma shadow-DB diff coba `ALTER COLUMN ... SET DEFAULT`/drop index pada kolom `search tsvector GENERATED ALWAYS AS (...) STORED` (dari migration `add_chat_search_fts`, tipe `Unsupported("tsvector")` di schema) meskipun perubahan sebenarnya cuma nambah satu kolom `Boolean?` di tabel lain. Juga: `prisma migrate dev` (bahkan `--create-only`) menolak jalan sama sekali di shell non-interactive ("environment is non-interactive").
**Keputusan:** Kalau ada kolom `Unsupported(...)` (generated column) di schema, JANGAN pakai `prisma migrate dev` buat migration baru — resolve migration yang gagal (`prisma migrate resolve --rolled-back <nama>`), tulis `migration.sql` manual isinya cuma DDL yang benar-benar dibutuhkan (`ALTER TABLE ... ADD COLUMN ...`, bukan noise dari shadow-db diff), lalu `prisma migrate deploy` (jalan di shell non-interactive, tidak generate diff baru).
**Alasan:** Shadow-DB Prisma tidak tahu cara diff kolom generated (`Unsupported` type memang sengaja tidak direpresentasikan penuh oleh Prisma) — setiap migration baru lewat `migrate dev` akan terus mencoba "memperbaiki" kolom itu dan gagal, padahal skema sebenarnya sudah benar.
**Konsekuensi:** Pola ini akan berulang tiap kali butuh migration baru selama `ChatMessage.search` (atau kolom `Unsupported` lain) ada di schema — pakai langkah manual di atas, jangan coba `migrate dev` berulang kali (baca juga [`CAUTION.md`](../../CAUTION.md) soal insiden RAM yang terjadi bersamaan waktu debugging ini).

## 2026-09-28 — E06-S2: Halaman Analisis v2 di atas PeriodStats, drill-down di-skip
**Konteks:** Lanjutan langsung E06-S1 (`PeriodStatsService`). Halaman `/app/insights` lama masih baca
`/transactions/insights` (wrapper lama), bukan `/analytics/stats` — jadi walau E06-S1 sudah live, belum ada
satupun bagian frontend yang benar-benar konsumsi `PeriodStats` atau kelihatan bedanya 7H/30H/90H/Semua.
**Keputusan:** (1) `AnalyticsService` dapat method baru `resolvePeriod(range?, from?, to?)` — logika parsing
`?range=7d|30d|90d|all` vs `?from&to` yang tadinya di `AnalyticsController` dipindah ke sini biar bisa dipakai
ulang tanpa duplikasi (dipakai controller & fitur kartu AI baru). (2) Kartu AI "3 hal yang perlu kamu tahu"
(`GET /ai/insight-card?range=`) di-cache per `(rangeKey, wibDateKey(now))` di tabel baru `AiInsightCard` (kolom
`points Json`, unique `[rangeKey, dayKey]`) — pola upsert-by-key sama seperti `HealthScoreLog`, tapi generik
per-hari-per-range bukan per-minggu. Migration ditulis manual (`CREATE TABLE`) + `prisma migrate deploy`, bukan
`migrate dev`, karena `ChatMessage.search` (tsvector generated column) bikin shadow-DB diff Prisma selalu gagal
(gotcha lama, lihat Gotchas.md). (3) `AiReportsService.computeAndSaveHealthScore()` diganti total sumber datanya:
dulu `TransactionService.getInsights('30d')` (dua query terpisah buat savings rate), sekarang langsung
`AnalyticsService.getPeriodStats()` 30 hari terakhir — `budgetAdherencePct` & `savingsRatePct` tinggal baca
`stats.budget.adherencePct`/`stats.totals.savingsRate` (`?? 50`/`?? 0` kalau null), metode lebih pendek & satu
sumber angka sesuai prinsip E06-S1. (4) Endpoint baru `PATCH /transactions/:id/big` (`TransactionService.setBig`)
buat tombol "Tandai rutin" di kartu Pembelian Besar — belum ada endpoint ini sebelumnya walau kolom `isBig` sudah
ada sejak E06-S1. (5) **Scope cut dari draft epic:** "tap kategori/habit → daftar transaksinya" di-skip total —
tidak ada halaman daftar transaksi yang bisa difilter di frontend sama sekali (dicek, `apps/frontend/src/app/app/`
tidak punya route transactions list), dan `PeriodStats` tidak menyimpan daftar transaksi per kategori/merchant
(cuma agregat). Bikin halaman baru + endpoint filter itu di luar scope sesi ini (YAGNI — epic minta drill-down
sebagai nice-to-have, bukan acceptance criteria eksplisit). Section "Tren mingguan" (90H/Semua) juga disederhanakan
jadi rutin-vs-besar per minggu (bukan bertumpuk per kategori) karena `PeriodStats.byDay` tidak pecah per kategori
per hari — pecah per kategori butuh query tambahan yang tidak ada di scope E06-S1.
**Alasan:** Satu sumber angka (prinsip E06-S1) diterapkan penuh sampai ke health score, bukan cuma endpoint baru
yang berdiri sendiri di samping yang lama. Scope cut drill-down dipilih daripada membangun halaman transaksi baru
tanpa diminta eksplisit di acceptance criteria — kalau dibutuhkan, itu perluasan terpisah dengan keputusan UX sendiri
(filter apa, URL param apa) yang belum ada preseden di codebase ini.
**Konsekuensi:** `npm run build` (backend) + `tsc --noEmit` (frontend) lulus bersih. `/analytics/stats` &
`/ai/insight-card` diverifikasi lewat `curl` ke dev DB (salinan prod, 207 transaksi) — 7d/30d/90d/all
menghasilkan `totals`/`budget`/`habits`/`bigPurchases` yang benar-benar beda (bukan basically-30d==all lagi),
`previous` `null` ketika periode pembanding jatuh sebelum `dataStartsAt` (persis kasus 30d/90d/all di data ini).
`POST /ai/reports/trigger-health-score` dites live, hasil `budgetAdherencePct=60` cocok dengan `/analytics/stats?range=30d`
punya `budget.adherencePct=60`. `PATCH /transactions/:id/big` dites set+revert di transaksi nyata. **Belum
diverifikasi**: tampilan visual browser sungguhan — Claude in Chrome extension nggak konek di sesi ini, dan
Playwright headless gagal jalan (`chrome-headless-shell: error while loading shared libraries: libatk-1.0.so.0`)
karena `npx playwright install --with-deps` butuh `sudo apt install` yang nggak tersedia (no password, no
passwordless sudo) di VPS ini. AI insight card & AI commentary health score kembali fallback kosong/null di
verifikasi ini karena `AI_API_KEY` memang belum di-set di `.env` dev (bukan bug) — behaviour "never throw"-nya
sendiri sudah kekonfirmasi jalan (endpoint tetap 200 dengan array kosong, bukan 500).

## 2026-09-28 — E07-S1: Laporan Mingguan & Bulanan v2 (`PeriodReport` snapshot) + jadwal Telegram Senin 07:00
**Konteks:** `/app/reports` lama cuma tab bulanan/all-time tanpa pemasukan/net/narasi tersimpan; laporan
Telegram mingguan (Minggu 20:00) & bulanan (cek hari terakhir bulan jam 20:00) pakai `TransactionService.getInsights`/
`getMonthly` langsung, dihitung ulang tiap kirim, tidak konsisten kalau data berubah setelahnya, dan tidak ada
cara balik lihat laporan minggu/bulan lama dari halaman web.
**Keputusan:** (1) Model `PeriodReport` (`period` WEEK/MONTH, `periodStart`, `stats` Json snapshot dari
`PeriodStatsService`, `narrative`) — periode yang sudah tutup (`end <= now`) dibaca dari snapshot ini, generate
on-demand kalau belum ada (lazy, bukan backfill cron terpisah — cukup buat kebutuhan sekarang). Periode yang masih
berjalan selalu live dari `PeriodStats`, tidak pernah disimpan. (2) Modul baru `report/` (bukan digabung ke
`analytics/` seperti disaran epic) karena `ReportService` butuh `AiService` buat narasi, dan `AiModule` sudah
import `AnalyticsModule` — kalau `ReportService` ditaruh di situ jadi `AnalyticsModule → AiModule → AnalyticsModule`.
Solusinya: `ReportModule` berdiri sendiri, `forwardRef` dua arah dengan `AiModule` (pola yang sama seperti
`TelegramModule`↔`AiModule` yang sudah ada). (3) Cron tutup periode terpisah dari cron kirim: `close-weekly-report`
Senin 06:00 WIB & `close-monthly-report` tanggal 1 06:30 WIB menghitung+simpan snapshot duluan, baru
`weekly-insight-report` (Senin 07:00) & `monthly-report-card` (tanggal 1 07:00) kirim narasi yang sudah tersimpan.
Jadwal mingguan **pindah dari Minggu 20:00 (pratinjau minggu berjalan) ke Senin 07:00 (minggu Senin–Minggu yang
baru betul-betul tutup)** — dikonfirmasi eksplisit ke Arzaka, bukan asumsi. `weekly-goal-nudge` ikut digeser ke
Senin 07:10 (dari Minggu 20:10) biar tetap jalan setelah laporan mingguan. (4) Frontend `/app/reports` di-rebuild
total: switcher Minggu/Bulan/Semua transaksi (bukan Bulanan/All Time lama), nav ‹ ›, hero net+savings rate, narasi
Track, delta vs periode lalu, kategori dgn ghost-bar periode lalu (pola sama dgn `/app/insights`), top merchant,
budget over/under, langganan. Tab "Semua transaksi" = `AllTimeTab` lama dipindah utuh (masih dukung search/filter/
detail hari) supaya nggak hilang fungsi lama.
**Alasan:** Snapshot dibekukan di waktu tutup (bukan dihitung ulang tiap load) sesuai prinsip epic — laporan
minggu lalu harus konsisten walau kategori/koreksi berubah belakangan. Lazy-generate dipilih daripada backfill
cron eksplisit karena efeknya sama (baca pertama kali = generate & cache) dengan kode jauh lebih sedikit — YAGNI
kalau ternyata butuh generate semua sekaligus tanpa nunggu dibuka, itu penambahan kecil nanti. "Pemasukan per
sumber vs perkiraan" (E03) dan "Goal: progres" di-skip dari layout karena datanya belum ada di `PeriodStats` —
dipaksain sekarang cuma bikin section kosong/palsu.
**Konsekuensi:** `tsc --noEmit` (backend+frontend) & `nest build`/`next build` lolos bersih. Diverifikasi lewat
curl langsung ke dev DB: minggu berjalan & bulan berjalan live (angka beda tiap query, `narrative:null`); minggu
20–27 Sep dan bulan Agustus (`closed:true`) generate snapshot sekali (`generatedAt` muncul) lalu re-request kedua
`generatedAt` **sama persis** (idempotent, tidak regenerate). Narasi AI konsisten `null` di semua uji lokal karena
`AI_API_KEY` memang belum di-set di `.env` dev (bukan bug — try/catch di `ReportService.closePeriod` sengaja tidak
menggagalkan simpan snapshot kalau cuma narasinya yang gagal). **Belum diverifikasi:** tampilan visual di browser
— Claude in Chrome extension nggak connect di sesi ini (sama seperti sesi E06-S2 sebelumnya, lihat entri di atas).
Halaman lolos render tanpa error server (curl shell HTML 200, dev log bersih, tab label ketemu di HTML) tapi bagian
yang butuh JS (hero/chart/narasi via `useSWR`) belum dikonfirmasi visual — cek manual sebelum push.

## 2026-10-01 — E08-S3 (Hub /tools, PayLater, SEO) + E08-S4 (Patungan Trip)
**Konteks:** Sesi lanjutan mengerjakan sisa E08. Classifier Bash (auto safety) down hampir sepanjang sesi,
jadi self-check (`settle.check.ts`, `installment-math.check.ts`), `prisma generate`, dan build belum bisa dijalankan.
**Keputusan:**
- E08-S4: model terpisah `Trip`/`TripMember`/`TripExpense`/`TripExpenseShare` (pola `publicSlug` + `ownerToken`
  sama seperti SplitBill, tidak tersambung ke `Transaction`/`BankBalance`). Settle-up greedy terbesar-ke-terbesar
  (maks n−1 transfer) di `settle.ts`, dan `ownerToken` **tidak** dikembalikan endpoint publik (anti-bocor secret).
  "Anggota boleh tambah pengeluaran" sengaja tidak dibangun (sesuai spec, default owner-only).
- E08-S3: bunga efektif = IRR bulanan Newton-Raphson **dengan fallback bisection** (Newton saja divergen untuk
  kasus bunga 0%). Perbandingan "nabung dulu" mengabaikan bunga tabungan (YAGNI, cukup bandingan kasar).
- SEO: `app/sitemap.ts` + `app/robots.ts` + `public/robots.txt` statis (yang statis tetap menang di Next, isinya
  sudah menunjuk sitemap). `NEXT_PUBLIC_SITE_URL` dipakai buat URL absolut (default `https://trackster.dev`),
  ditambahkan ke `.env.example` + `.env.production.example` + Dockerfile frontend.
- Bookkeeping: checkbox E02-S2 (E02-income-auto-capture.md), E05-S1 "hapus allowance-suggestion", dan E03-S1
  "link income lama ke stream" dicentang (endpoint allowance-suggestion ternyata sudah tidak ada di kode —
  sudah dihapus di commit `6f7f3ee`).
**Alasan:** URL publik baru `/tools`, `/installment-calculator`, `/trip/new`, `/t/`, `/trip/manage/` didaftarkan
di `middleware.ts` + NavBar supaya visitor tanpa login tidak kena redirect (konvensi public tools).
**Konsekuensi:** Wajib `npx prisma generate` sebelum `tsc`/build backend (client belum punya model Trip).
Self-check & build belum dijalankan sesi ini (classifier down) — jalankan sebelum deploy.
