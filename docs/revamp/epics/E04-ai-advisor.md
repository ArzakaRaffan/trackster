# E04 — AI Advisor Core ("Track" jadi konsultan keuangan pribadi)

**Fase 2 · 5 sesi · Permintaan #3 dan #8**

> #3: "Tujuan saya sebenarnya adalah untuk memiliki AI sebagai personal Advisor atau Personal finance
> consultant … Saya ingin RAG lebih baik dan AI difokuskan untuk membantu saya mengatasi berbagai macam
> masalah dan mungkin simulasi rencana."
> #8: "Chat tidak di-save dan setiap saya bertanya, tidak masuk ke RAG AI nya, saya rasa saya ingin AI
> mengetahui apa saja sih yang saya bicarakan dengannya"

## Kondisi sekarang ([findings E](../01-findings.md#e-ai--tanya-track))

- `AiService.runToolLoop({ userMessage })` → satu pesan, tanpa history. Frontend simpan chat di React state.
- 7 tool agregat (`ai-finance-tools.service.ts`). System prompt generik "financial buddy".
- Tidak ada memory, tidak ada retrieval. Proxy tidak punya embeddings; Postgres prod punya FTS config
  `indonesian` (stemming jalan) dan extension `pg_trgm`.

## Arsitektur target

Setiap pesan user → `AiChatService.handleMessage(threadId, text)` merakit konteks berlapis:

```
[1] Persona + aturan konsultan                     (statis, E04-S5)
[2] Financial Snapshot  — angka hari ini, dihitung  (E04-S2, deterministik, ±1.5k token)
[3] Memory jangka panjang — fakta tentang Arzaka     (E04-S2, ≤40 item)
[4] Retrieved — potongan percakapan/laporan lama     (E04-S3, FTS, top 5)
[5] Ringkasan thread lama + 20 pesan terakhir        (E04-S1)
[6] Pesan user
        ↓ tool loop (data presisi + simulasi, E04-S4)
Balasan + kartu (grafik simulasi / usulan goal)  → disimpan → ekstraksi memory async
```

Kenapa berlapis, bukan "RAG vektor semua": untuk satu user, hal yang paling penting (kondisi keuangan
sekarang, rencana & preferensi Arzaka) itu kecil dan **selalu** relevan → disuntik langsung. Retrieval cuma
untuk ekor panjang ("dulu aku pernah nanya soal laptop kan?"). Angka presisi selalu lewat tool.

---

## E04-S1 — Persistensi chat + history

```prisma
enum ChatChannel { WEB TELEGRAM }

model ChatThread {
  id            Int          @id @default(autoincrement())
  title         String?                  // di-generate dari pesan pertama (AI_MODEL_FAST), bisa di-rename
  channel       ChatChannel  @default(WEB)
  summary       String?                  // ringkasan pesan lama yang sudah keluar dari window
  summaryUpToId Int?                     // id ChatMessage terakhir yang sudah masuk summary
  archivedAt    DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  messages      ChatMessage[]
}

model ChatMessage {
  id          Int        @id @default(autoincrement())
  threadId    Int
  thread      ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role        String     // 'user' | 'assistant' | 'tool'
  content     String     @default("")
  toolCalls   Json?      // assistant.tool_calls (format OpenAI)
  toolCallId  String?
  toolName    String?
  attachments Json?      // kartu untuk UI (E04-S4)
  createdAt   DateTime   @default(now())
  @@index([threadId, id])
}
```

- `AiService.runToolLoop` menerima `messages: ChatMessage[]` (history) alih-alih `userMessage`, dan
  mengembalikan **semua** pesan baru (assistant + tool) supaya bisa disimpan.
- Window: 20 pesan user/assistant terakhir + `thread.summary`. Saat pesan di luar window > 10, ringkas
  (`AI_MODEL_FAST`) dan geser `summaryUpToId`. Hasil tool lama dipotong (≤ 1.500 karakter) waktu dikirim ulang.
- Endpoint (JwtAuthGuard, `ai.controller.ts`):
  `GET /ai/threads` · `POST /ai/threads` · `GET /ai/threads/:id/messages` · `POST /ai/threads/:id/messages {text}` ·
  `PATCH /ai/threads/:id {title|archived}` · `DELETE /ai/threads/:id`. `POST /ai/chat` lama tetap jalan
  (bikin/lanjutkan thread "Quick chat") sampai frontend pindah.
- Telegram (`telegram-webhook.controller.ts`): semua pesan masuk ke satu thread `channel TELEGRAM` yang persisten.
- Frontend `/app/chat`: drawer daftar thread (judul + tanggal), "Chat baru", load history via SWR,
  optimistic append, tetap satu layar di mobile.

**Tasks**
- [ ] Migration `add_chat_threads`
- [ ] Refactor `runToolLoop` + simpan pesan (user, assistant, tool) dalam urutan yang benar
- [ ] Summarization window
- [ ] Endpoint + Telegram thread
- [ ] Frontend thread UI
- [ ] Tes: refresh halaman → chat masih ada; pertanyaan lanjutan "kalau yang tadi dibagi 2?" dijawab nyambung

---

## E04-S2 — Financial Snapshot + Memory jangka panjang

### Snapshot (`financial-snapshot.service.ts`, deterministik, cache 5 menit)

Teks ringkas (bukan JSON mentah — lebih hemat token & lebih mudah dibaca model). Contoh **format** — angka
minggu berjalan di bawah ilustrasi, bukan data asli:
```
Hari ini: Kamis, 24 Sep 2026 (WIB). Minggu berjalan: 22–28 Sep.
Saldo: BCA Rp404.302 · Jago Rp18.164 (koreksi manual terakhir 22 Sep).
Minggu ini: keluar Rp312.000 dari budget Rp215.000 (145%). Hari ini Rp38.000 / Rp35.000.
4 minggu terakhir (rutin, tanpa pembelian besar): 180rb · 240rb · 205rb · 312rb*.
Pembelian besar 30 hari: Monitor Rp1,69jt (14 Sep) …
Pemasukan minggu ini: tercatat Rp400rb dari perkiraan Rp1,35jt (konservatif 1,05jt). Belum check-in: les, magang.
Goal: Crypto Rp? / Rp2jt, tanpa deadline.
Langganan 14 hari ke depan: Claude Rp400rb (3 Okt).
Catatan data: 3 pemasukan PENDING belum dikonfirmasi.
```
Sumber: `wib.ts`, BalanceService, BudgetService, E03 forecast, GoalService, SubscriptionService,
PeriodStats (E06-S1) kalau sudah ada (kalau belum, pakai query yang ada & tandai TODO).

### Memory

```prisma
enum MemoryKind { PROFILE GOAL PLAN PREFERENCE CONCERN EVENT DECISION }

model AiMemory {
  id              Int        @id @default(autoincrement())
  kind            MemoryKind
  content         String     // satu kalimat, orang ketiga: "Arzaka ingin beli laptop ±Rp12jt sebelum Juni 2027"
  importance      Int        @default(2)   // 1 rendah … 3 tinggi
  sourceMessageId Int?
  validUntil      DateTime?  // untuk EVENT/PLAN yang ada tanggalnya
  archivedAt      DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}
```

- **Ekstraksi otomatis** setelah tiap balasan (async, jangan blok response; `AI_MODEL_FAST`): input = pesan user
  + balasan + daftar memory aktif; output JSON `[{op:'add'|'update'|'archive', id?, kind, content, importance, validUntil?}]`.
  Aturan di prompt: hanya fakta tahan lama tentang hidup/rencana/preferensi/kekhawatiran Arzaka; **jangan**
  simpan angka yang sudah ada di DB (saldo, total belanja); gabungkan dengan memory yang mirip (update, bukan add);
  maksimal 3 operasi per giliran. Validasi JSON; gagal → abaikan diam-diam (log warn).
- Tool eksplisit: `remember({content, kind})`, `forget({memoryId})` — untuk "ingat ya…" / "lupain yang itu".
- Disuntik ke system prompt: semua memory aktif, urut importance lalu terbaru, maks 40 (sisanya diarsip
  otomatis yang importance 1 & tertua). `validUntil` lewat → arsip otomatis.
- UI "Yang Track ingat tentang kamu" (`/app/chat/memory`, link dari header chat): list per kind, edit inline,
  hapus, tambah manual. Transparansi = rasa percaya.

**Tasks**
- [ ] Snapshot service + endpoint debug `GET /ai/snapshot` (lihat teks yang dikirim ke model)
- [ ] Migration `add_ai_memory` + service + ekstraksi async + tool remember/forget
- [ ] Rakit system prompt berlapis [1]–[3],[5] di `AiChatService`
- [ ] Halaman memory
- [ ] Tes: bilang "aku lagi nabung buat laptop 12 juta, target Juni" → muncul di halaman memory → chat baru
      besoknya "gimana progres laptopku?" dijawab dengan konteks itu

---

## E04-S3 — Retrieval (Postgres full-text search)

- Migration **`--create-only`**, edit SQL manual (Prisma tidak bisa mengekspresikan generated column):
  ```sql
  ALTER TABLE "ChatMessage" ADD COLUMN "search" tsvector
    GENERATED ALWAYS AS (to_tsvector('indonesian', coalesce("content", ''))) STORED;
  CREATE INDEX "ChatMessage_search_idx" ON "ChatMessage" USING GIN ("search");
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX "Transaction_description_trgm_idx" ON "Transaction" USING GIN (description gin_trgm_ops);
  ```
  Di `schema.prisma`: `search Unsupported("tsvector")?`. **Cek** setelahnya bahwa `prisma migrate dev` berikutnya
  tidak mencoba drop/alter kolom ini (catat di Gotchas kalau ada perilaku aneh).
- `RetrievalService.search(query, { excludeThreadId?, excludeAfterId?, limit: 5 })` via `$queryRaw`:
  `websearch_to_tsquery('indonesian', $q)`, skor `ts_rank_cd × recency_decay` (half-life 60 hari), hanya role
  user/assistant, kecualikan pesan yang sudah ada di window thread aktif. Kembalikan snippet
  (`ts_headline`, ≤ 300 karakter) + tanggal + judul thread.
- Sumber tambahan (union di query yang sama, kalau tabelnya sudah ada): narasi laporan tersimpan
  (`PeriodReport.narrative`, E07), `Transaction.note`.
- Otomatis tiap pesan user → blok [4] "Percakapan/laporan lama yang mungkin relevan" (kosong kalau skor < ambang).
  Juga tool `searchPastConversations({query})` untuk dipanggil model secara eksplisit.
- Jalur upgrade (JANGAN dikerjakan sekarang): kalau proxy kelak punya embeddings → `pgvector`. Ganti image ke
  `pgvector/pgvector:pg16` = pindah Alpine (musl) → Debian (glibc): **collation beda, index teks harus di-REINDEX**.

**Tasks**
- [ ] Migration FTS + trigram
- [ ] RetrievalService + check script sederhana (insert beberapa pesan di dev, query stem "nabung"/"menabung" ketemu)
- [ ] Blok [4] di prompt + tool `searchPastConversations`
- [ ] Tes: tanya hal yang pernah dibahas di thread lain minggu lalu → jawaban merujuk ("minggu lalu kamu bilang…")

---

## E04-S4 — Tools advisor + engine simulasi + kartu

### Tools baru (`ai-finance-tools.service.ts`, reuse service yang ada)

| Tool | Guna |
|---|---|
| `searchTransactions({text?, category?, from?, to?, minAmount?, limit≤50})` | Cari transaksi (trigram untuk merchant typo) |
| `getPeriodStats({period:'week'\|'month'\|'range', date?, from?, to?})` | Statistik periode + pembanding (E06-S1; sebelum ada, pakai fungsi lama) |
| `getIncomeForecast({weeks≤26})` | Forecast E03 |
| `getGoals()` | Goal + progres + kontribusi mingguan yang dibutuhkan |
| `simulatePlan(...)` | Lihat di bawah — kartu grafik |
| `whatIfPurchase({amount, label, method:'cash'\|'installment', months?, monthlyRate?})` | Bandingkan dengan/ tanpa pembelian → mundur berapa minggu goal-nya |
| `proposeGoal({name, target, deadline?, weeklyContribution?})` | **Tidak** membuat goal — menghasilkan kartu dengan tombol "Buat goal" (konfirmasi user) |
| `proposeBudget(...)` | Diisi di E05-S2 |
| `remember` / `forget` / `searchPastConversations` | dari S2/S3 |
| `logExpense` (sudah ada) | tetap; tambah `logIncome` yang mengarah ke stream |

### Engine simulasi (`plan-simulator.ts`, fungsi murni + `plan-simulator.check.ts`)

```ts
simulatePlan({
  weeks: number,                                  // ≤ 104
  incomeScenario: 'conservative'|'expected'|'max',
  extraIncomePerWeek?: number,
  spendChanges?: { category?: Category; pct?: number; weeklyAmount?: number }[], // -20% makan, dst
  oneOffs?: { week: number; amount: number; label: string }[],                    // beli HP minggu ke-6
  savePerWeek?: number,
  goal?: { target: number; current?: number },
}) => {
  series: { week: string; income: number; spend: number; saved: number; balance: number; goalProgress?: number }[],
  summary: { weeksToGoal: number | null; finalBalance: number; minBalance: number; firstShortfallWeek: string | null },
  assumptions: string[]   // ditampilkan di kartu: "pengeluaran rutin = median 8 minggu Rp205rb", dst
}
```
- Baseline pemasukan: `IncomeForecast.getHorizon()`. Baseline pengeluaran: median mingguan **rutin** 8 minggu
  (tanpa pembelian besar — definisi di E06-S1), per kategori supaya `spendChanges` per kategori bermakna.
- Kartu: tool yang hasilnya punya `card` → ikut disimpan di `ChatMessage.attachments` pesan assistant terakhir.
  Frontend render `SimulationCard` (recharts line: saldo & progres goal; 3 angka ringkasan; daftar asumsi) dan
  `GoalProposalCard` (tombol Buat → `POST /goals`).

**Tasks**
- [ ] Tools baru + `plan-simulator.ts` + check (kasus: target 2jt, nabung 100rb/minggu → 20 minggu)
- [ ] Mekanisme attachments + render kartu di chat
- [ ] Tes: "kalau aku kurangin jajan kopi setengahnya, kapan bisa beli laptop 12 juta?" → kartu grafik masuk akal

---

## E04-S5 — Persona konsultan + mode cepat

**System prompt baru** (ganti `FINANCIAL_ADVISOR_SYSTEM_PROMPT`), inti:
- Peran: *Track*, konsultan keuangan pribadi Arzaka (mahasiswa, pemasukan mingguan tidak tetap). Bukan
  chatbot generik, bukan penceramah.
- Alur jawaban untuk masalah/keputusan: pahami (maks 1 pertanyaan klarifikasi kalau benar-benar perlu) →
  cek data (snapshot/tool) → diagnosis 1–2 kalimat → 2–3 opsi dengan trade-off **angka** → rekomendasi tegas →
  satu langkah konkret minggu ini → tawarkan simulasi/goal/pengingat.
- Pertanyaan faktual sederhana → jawab langsung singkat, tanpa ritual di atas.
- Jujur soal data: kalau pemasukan belum check-in atau ada PENDING, bilang itu memengaruhi jawaban.
- Angka hanya dari snapshot/tool (tidak menghitung sendiri total/proyeksi — pakai `simulatePlan`).
- Bahasa Indonesia santai, pendek default; "mau versi detail?" kalau topiknya besar.
- Pakai memory secara natural ("kemarin kamu bilang lagi nabung laptop…"), jangan dibacakan semua.

**Mode cepat** (chip di chat kosong & di atas input): "Mau beli sesuatu" · "Simulasi rencana nabung" ·
"Kenapa minggu ini boros?" · "Aku lagi bokek, harus gimana?" · "Review bulan ini" · "Atur ulang budget".
Tiap chip = template prompt yang mengarahkan tool yang tepat.

**Model:** tetap `AI_MODEL`. Kalau kualitas nasihat kurang, coba `ghrocx/opus-5` (tersedia di proxy) lewat env
`AI_MODEL_ADVISOR` khusus chat — ukur dulu dengan eval di bawah sebelum ganti.

**Eval manual** (jalankan sebelum & sesudah S5, simpan jawaban di `docs/revamp/eval/advisor-YYYY-MM-DD.md`):
1. "Aku pengen beli sepatu 800rb, boleh nggak?"
2. "Kenapa minggu ini boros banget?"
3. "Gimana caranya bisa nabung 2 juta sebelum Desember?"
4. "Aku lagi bokek sampai Senin, sisa 50rb, gimana?"
5. "Kalau les privat cuma 1 sesi seminggu selama sebulan, aman nggak?"
6. "Ingat ya, aku nggak mau pakai paylater."  → lalu tanya: "Beli HP 3 juta cicil aja kali ya?"
7. "Bandingin pengeluaran kopi bulan ini sama bulan lalu."
8. "Minggu lalu aku ngomong apa soal laptop?"
9. "Dana darurat aku harusnya berapa?"
10. "Bikinin rencana 3 bulan ke depan."
Kriteria: angka benar (cek manual ke DB), pakai memory/konteks, ada rekomendasi tegas + langkah konkret, tidak mengarang.

**Tasks**
- [ ] Prompt baru + chip mode cepat
- [ ] Telegram pakai `AiChatService` yang sama (thread TELEGRAM, memory sama)
- [ ] Eval sebelum/sesudah + catat hasil
- [ ] (stretch) streaming SSE untuk balasan panjang — hanya kalau latensi terasa mengganggu

## Pertanyaan terbuka

- Boleh AI mencatat pengeluaran/pemasukan langsung dari chat tanpa konfirmasi? → default: **ya untuk
  logExpense** (perilaku sekarang), **konfirmasi (kartu) untuk goal & budget**.
- Retensi chat? → default: simpan selamanya (single user, data kecil); ada tombol hapus thread.
