'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Mail, TrendingUp } from 'lucide-react';

const FONT = "'Figtree',system-ui,sans-serif";

const TX = [
  ['Kopi Kenangan', 'BCA', '09:42', 32000],
  ['Transportasi', 'Jago', '18:10', 18000],
  ['Makan siang', 'BCA', '12:30', 24000],
  ['Spotify', 'Jago', '08:00', 49000],
] as const;

const BUDGET = 200000;

const rp = (n: number) =>
  (n < 0 ? '\u2212' : '') + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const IC = {
  mail: 'M4 5h16v14H4zM4 7l8 6 8-6',
  tick: 'M20 6 9 17l-5-5',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  brain:
    'M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 2.8A3 3 0 0 0 6 14v1a3 3 0 0 0 3 3h1V4zM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 2.8A3 3 0 0 1 18 14v1a3 3 0 0 1-3 3h-1V4z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  x: 'M18 6 6 18M6 6l12 12',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 12h.01',
  route:
    'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  percent:
    'M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  chevD: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};

type Mood = 'idle' | 'alert' | 'happy';

function Mascot({ px, mood = 'idle' }: { px: number; mood?: Mood }) {
  const body = mood === 'alert' ? '#FFA42B' : '#1ED760';
  const mouth =
    mood === 'happy'
      ? 'M15.5 25.5c2.4 2.6 6.6 2.6 9 0'
      : mood === 'alert'
        ? 'M16.5 26.5c1.6-1.5 5.4-1.5 7 0'
        : 'M16.5 25.8c2 1.5 5 1.5 7 0';
  return (
    <span
      aria-hidden="true"
      className="ts-mascot"
      style={{ display: 'inline-flex', width: px, height: px, transformOrigin: '50% 70%' }}
    >
      <svg viewBox="0 0 40 40" width={px} height={px} fill="none">
        <path
          d="M20 5c7.2 0 13 5.4 13 12.2 0 7.2-5.4 12.8-13 12.8S7 24.4 7 17.2C7 10.4 12.8 5 20 5Z"
          fill={body}
        />
        <ellipse cx={14.5} cy={12.5} rx={3.6} ry={2} fill="#fff" opacity={0.35} transform="rotate(-26 14.5 12.5)" />
        <g className="ts-mascot-eyes">
          <ellipse cx={14.5} cy={mood === 'happy' ? 18.5 : 18} rx={2.1} ry={2.45} fill="#121212" />
          <ellipse cx={25.5} cy={mood === 'happy' ? 18.5 : 18} rx={2.1} ry={2.45} fill="#121212" />
        </g>
        <path d={mouth} stroke="#121212" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Logo({ px = 30 }: { px?: number }) {
  return (
    <div className="ts-logo">
      <span className="ts-logo-mark" style={{ width: px, height: px }}>
        T
      </span>
      <b>Trackster</b>
    </div>
  );
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Format email belum benar.');
      return;
    }
    setError('');
    setDone(true);
  };

  return (
    <main className="ts-page ts-landing">
      <header className="ts-header">
        <Logo />
        <Link href="/login" className="ts-login-link">
          Sudah punya akses? Masuk
        </Link>
      </header>

      <section className="ts-hero">
        <div className="ts-hero-copy">
          <span className="ts-beta">
            <i />Private beta · akses dibuka bertahap
          </span>
          <h1>
            <span>Pengeluaran</span> <span>tercatat</span> <span>otomatis.</span>{' '}
            <em>
              <span>Sisa</span> <span>budget</span> <span>hari</span> <span>ini</span>{' '}
              <span>selalu</span> <span>jelas.</span>
            </em>
          </h1>
          <p>
            Trackster mencatat transaksi BCA dan Jago dari email notifikasi, jadi kamu cukup melihat
            sisa budget hari ini. Sebelum membeli sesuatu, tanya Track, asisten keuangan AI.
          </p>

          <div className="ts-cta">
            <div className="ts-waitlist-wrap">
              {done ? (
                <div role="status" className="ts-wl-done">
                  <span>
                    <Icon d={IC.tick} />
                  </span>
                  <span>
                    Kamu sudah masuk antrean beta. Kami kabari ke {email.trim()} saat giliranmu tiba.
                  </span>
                </div>
              ) : (
                <>
                  <form className="ts-waitlist" onSubmit={submit} noValidate>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="email@kamu.com"
                      aria-label="Email"
                      aria-invalid={!!error}
                      autoComplete="email"
                    />
                    <button type="submit">
                      Masuk antrean beta <ArrowRight size={18} />
                    </button>
                  </form>
                  <p className="ts-wl-error" role="alert">
                    {error}
                  </p>
                </>
              )}
            </div>
            <ul className="ts-trust">
              <li>
                <Icon d={IC.tick} size={14} /> Hanya butuh email
              </li>
              <li>
                <Icon d={IC.tick} size={14} /> Tanpa kartu kredit
              </li>
              <li>
                <Icon d={IC.tick} size={14} /> Kami kabari saat giliranmu tiba
              </li>
            </ul>
          </div>
        </div>

        <div className="ts-demo-wrap">
          <div className="ts-mail">
            <Icon d={IC.mail} size={16} />
            <span>
              <small>Email BCA · baru saja</small>
              <b>Kopi Kenangan Rp32.000</b>
            </span>
          </div>
          <div className="ts-demo-card">
            <div className="ts-demo-head">
              <Mascot px={44} />
              <span>
                <b>Hari ini</b>
                <small>Rabu, 30 September</small>
              </span>
              <strong>
                <Icon d={IC.tick} size={14} /> Aman
              </strong>
            </div>
            <div className="ts-budget">
              <label>Sisa budget hari ini</label>
              <div>
                <b>Rp168.000</b>
                <small>dari budget Rp200.000</small>
              </div>
              <i>
                <u />
              </i>
            </div>
            <ul className="ts-transactions">
              {TX.map((t) => (
                <li key={t[0]}>
                  <span>{t[0][0]}</span>
                  <div>
                    <b>{t[0]}</b>
                    <small>
                      {t[1]} · {t[2]}
                    </small>
                  </div>
                  <strong>{rp(-t[3])}</strong>
                </li>
              ))}
            </ul>
            <div className="ts-alert">
              <TrendingUp size={16} /> Budget harian masih aman
            </div>
          </div>
        </div>
      </section>

      <section className="ts-benefits">
        <div className="ts-section-head">
          <h2>Cukup lihat satu angka</h2>
          <p>Sisanya dikerjakan Trackster di belakang layar.</p>
        </div>
        <div className="ts-benefit-grid">
          <div className="ts-benefit">
            <span className="ts-benefit-icon">
              <Icon d={IC.mail} size={22} />
            </span>
            <h3>Tidak ada yang perlu diketik</h3>
            <p>Transaksi BCA dan Jago masuk otomatis dari email notifikasi.</p>
            <p className="ts-benefit-note">Saldo tiap rekening ikut berubah setiap ada transaksi baru.</p>
          </div>
          <div className="ts-benefit">
            <span className="ts-benefit-icon">
              <Icon d={IC.send} size={22} />
            </span>
            <h3>Langsung tahu saat lewat budget</h3>
            <p>Satu angka menunjukkan sisa budget hari ini. Saat terlewati, Telegram mengirim pesan.</p>
            <p className="ts-benefit-note">
              Pesan Telegram terkirim: <b>lewat Rp19.700</b>
            </p>
          </div>
          <div className="ts-benefit">
            <span className="ts-benefit-icon">
              <Icon d={IC.spark} size={22} />
            </span>
            <h3>Timbang pembelian sebelum membayar</h3>
            <p>Tanya Track sebelum membeli. Dampaknya ke target tabunganmu dihitung.</p>
            <p className="ts-benefit-note">
              “Beli sepatu Rp1.200.000?” Target Laptop baru <b>mundur ±2 minggu</b>.
            </p>
          </div>
        </div>
      </section>

      <section className="ts-demo-chat">
        <div className="ts-section-head">
          <h2>Tanya Track sebelum membeli</h2>
          <p>
            Track menjawab berdasarkan transaksi, budget, dan target tabunganmu. Coba salah satu.
          </p>
        </div>
        <div className="ts-chat-layout">
          <div className="ts-chat-card">
            <div className="ts-chat-head">
              <Mascot px={32} mood="happy" />
              <span>
                <b>Tanya Track</b>
                <small>Asisten keuangan AI</small>
              </span>
            </div>
            <div className="ts-chat-body">
              <div className="ts-chat-empty">
                <Mascot px={64} mood="happy" />
                <b>Mau tanya apa ke Track?</b>
                <span>Pilih pertanyaan di bawah atau ketik sendiri. Jawabannya memakai data contoh.</span>
              </div>
            </div>
            <div className="ts-chat-foot">
              <div className="ts-chat-chips">
                <button type="button">Beli sepatu lari Rp1,2 jt?</button>
                <button type="button">Simulasi nabung per minggu</button>
                <button type="button">Kenapa minggu ini boros?</button>
                <button type="button">Atur ulang budget harian</button>
              </div>
              <form onSubmit={(e) => e.preventDefault()} className="ts-chat-form">
                <input placeholder="Ketik pertanyaanmu ke Track" aria-label="Pertanyaan untuk Track" autoComplete="off" />
                <button type="submit" aria-label="Kirim">
                  <Icon d={IC.send} />
                </button>
              </form>
            </div>
          </div>
          <div className="ts-chat-points">
            <div>
              <span className="ts-point-icon">
                <Icon d={IC.spark} size={19} />
              </span>
              <span>
                <b>Berdasarkan datamu</b>
                <small>Transaksi, budget, langganan, dan target tabungan dihitung bersama.</small>
              </span>
            </div>
            <div>
              <span className="ts-point-icon">
                <Icon d={IC.brain} size={19} />
              </span>
              <span>
                <b>Mengingat konteksmu</b>
                <small>
                  Tujuan dan rencanamu ikut dipertimbangkan, jadi kamu tidak perlu menjelaskan ulang.
                </small>
              </span>
            </div>
            <div>
              <span className="ts-point-icon">
                <Icon d={IC.alert} size={19} />
              </span>
              <span>
                <b>Keputusan tetap di kamu</b>
                <small>Track memberi hitungan dan pertimbangan. Ini bukan nasihat keuangan berlisensi.</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="ts-cerita">
        <div className="ts-section-head">
          <h2>Kenapa Trackster dibuat</h2>
        </div>
        <div className="ts-cerita-card">
          <p>
            Mencatat pengeluaran secara manual mudah terlewat. Akibatnya, sulit tahu apakah pembelian
            berikutnya masih aman untuk target tabungan. Trackster dibuat untuk menutup dua celah
            itu: transaksi tercatat otomatis dari email bank, dan Track membantu menimbang pembelian
            berdasarkan datamu.
          </p>
          <div>
            <span className="ts-cerita-label">Contoh isi “Yang Track ingat”</span>
            <div className="ts-mem">
              <span className="ts-mem-tag">Tujuan</span>
              <span>Ingin beli laptop ±Rp12jt sebelum Maret 2027.</span>
            </div>
            <div className="ts-mem">
              <span className="ts-mem-tag">Acara</span>
              <span>Nikahan sepupu di Bandung, perlu ongkos dan kado.</span>
            </div>
            <div className="ts-mem">
              <span className="ts-mem-tag">Preferensi</span>
              <span>Lebih suka budget weekend lebih longgar daripada weekday.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ts-why">
        <div className="ts-section-head">
          <h2>Dibanding mencatat manual</h2>
        </div>
        <div className="ts-why-card">
          <div className="ts-why-head">
            <span />
            <span>Mencatat manual</span>
            <span>Trackster</span>
          </div>
          {(
            [
              ['Mencatat transaksi', 'Mengetik sendiri setiap selesai membayar', 'Tercatat otomatis dari email BCA dan Jago'],
              ['Memantau budget', 'Baru sadar di akhir bulan', 'Diberi tahu lewat Telegram saat budget terlewati'],
              ['Meminta saran', 'Membaca tabel dan grafik sendiri', 'Track menjawab berdasarkan data dan tujuanmu'],
              ['Mengenal kebutuhanmu', 'Menjelaskan ulang situasimu setiap kali', 'Track mengingat tujuan dan rencanamu'],
            ] as const
          ).map((row) => (
            <div className="ts-why-row" key={row[0]}>
              <span className="ts-why-feature">{row[0]}</span>
              <span className="ts-why-x">
                <span>
                  <Icon d={IC.x} size={16} />
                </span>
                {row[1]}
              </span>
              <span className="ts-why-v">
                <span>
                  <Icon d={IC.tick} size={16} />
                </span>
                {row[2]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="ts-tools">
        <div className="ts-section-head">
          <h2>Bisa dipakai sekarang, tanpa akun</h2>
          <p>
            Alat bantu keuangan yang terbuka untuk siapa saja. Tidak perlu masuk antrean.
          </p>
        </div>
        <div className="ts-tool-grid">
          <Link className="ts-tool" href="/split-bills">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={IC.receipt} size={20} />
              </span>
              <b>Split bill</b>
            </span>
            <small>Bagi tagihan sesuai pesanan masing-masing.</small>
          </Link>
          <Link className="ts-tool" href="/app/goals">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={IC.target} size={20} />
              </span>
              <b>Target tabungan</b>
            </span>
            <small>Hitung setoran per minggu dan waktu tercapai.</small>
          </Link>
          <Link className="ts-tool" href="/trip/new">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={IC.route} size={20} />
              </span>
              <b>Patungan trip</b>
            </span>
            <small>Atur patungan dengan transfer sesedikit mungkin.</small>
          </Link>
          <Link className="ts-tool" href="/installment-calculator">
            <span className="ts-tool-title">
              <span className="ts-tool-icon">
                <Icon d={IC.percent} size={20} />
              </span>
              <b>PayLater dan cicilan</b>
            </span>
            <small>Hitung bunga efektif per tahun.</small>
          </Link>
        </div>
      </section>

      <section className="ts-cta-final">
        <Mascot px={64} mood="happy" />
        <h2>Jajan tenang. Sisanya urusan Trackster.</h2>
        <p>Akses dibuka bertahap. Masuk antrean beta, kami kabari saat giliranmu tiba.</p>
        <div className="ts-cta-final-form">
          {done ? (
            <div role="status" className="ts-wl-done">
              <span>
                <Icon d={IC.tick} />
              </span>
              <span>
                Kamu sudah masuk antrean beta. Kami kabari ke {email.trim()} saat giliranmu tiba.
              </span>
            </div>
          ) : (
            <>
              <form className="ts-waitlist" onSubmit={submit} noValidate>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="email@kamu.com"
                  aria-label="Email"
                  aria-invalid={!!error}
                  autoComplete="email"
                />
                <button type="submit">
                  Masuk antrean beta <ArrowRight size={18} />
                </button>
              </form>
              <p className="ts-wl-error" role="alert">
                {error}
              </p>
            </>
          )}
        </div>
        <ul className="ts-trust">
          <li>
            <Icon d={IC.tick} size={14} /> Hanya butuh email
          </li>
          <li>
            <Icon d={IC.tick} size={14} /> Tanpa kartu kredit
          </li>
          <li>
            <Icon d={IC.tick} size={14} /> Kami kabari saat giliranmu tiba
          </li>
        </ul>
      </section>

      <section className="ts-faq">
        <h2>Masih ragu?</h2>
        <div className="ts-faq-list">
          <div className="ts-faq-item">
            <button type="button" aria-expanded={false}>
              Kapan Trackster dibuka?
              <span>
                <Icon d={IC.chevD} size={20} />
              </span>
            </button>
            <div className="ts-faq-a">
              <p>Akses dibuka bertahap lewat antrean beta. Saat giliranmu tiba, kami mengirim email berisi cara masuk.</p>
            </div>
          </div>
          <div className="ts-faq-item">
            <button type="button" aria-expanded={false}>
              Apakah aman membaca email bank?
              <span>
                <Icon d={IC.chevD} size={20} />
              </span>
            </button>
            <div className="ts-faq-a">
              <p>
                Trackster membaca email notifikasi transaksi dari bank yang didukung, saat ini BCA dan
                Jago. Koneksi Google dipakai untuk membuat transaksi dan pengingat langganan, dan bisa
                kamu atur di Setting.
              </p>
            </div>
          </div>
          <div className="ts-faq-item">
            <button type="button" aria-expanded={false}>
              Dari mana saran Track?
              <span>
                <Icon d={IC.chevD} size={20} />
              </span>
            </button>
            <div className="ts-faq-a">
              <p>
                Track menjawab berdasarkan transaksi, budget, langganan, dan target tabunganmu, serta
                hal yang kamu ceritakan di chat. Track bukan penasihat keuangan berlisensi. Keputusan
                tetap ada di tanganmu.
              </p>
            </div>
          </div>
          <div className="ts-faq-item">
            <button type="button" aria-expanded={false}>
              Apakah alat gratisnya perlu antre?
              <span>
                <Icon d={IC.chevD} size={20} />
              </span>
            </button>
            <div className="ts-faq-a">
              <p>
                Tidak. Split bill, patungan trip, target tabungan, dan kalkulator cicilan bisa dipakai
                siapa saja tanpa akun.
              </p>
            </div>
          </div>
          <div className="ts-faq-item">
            <button type="button" aria-expanded={false}>
              Sudah punya akses?
              <span>
                <Icon d={IC.chevD} size={20} />
              </span>
            </button>
            <div className="ts-faq-a">
              <p>
                Masuk dengan username dan password-mu.{' '}
                <Link href="/login" className="ts-faq-login">
                  Udah punya akses? Masuk.
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="ts-footer">
        <div>© 2026 Trackster · Private beta, akses dibuka bertahap</div>
      </footer>
    </main>
  );
}
