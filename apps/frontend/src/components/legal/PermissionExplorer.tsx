'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Check, Mail, UserRound, X } from 'lucide-react';

const PERMS = [
  {
    key: 'gmail',
    Icon: Mail,
    label: 'Gmail',
    scope: 'Hanya baca',
    yes: ['Membaca email notifikasi transaksi bank (BCA, Jago, BRImo, Flip)', 'Mengambil nominal, merchant, dan tanggal'],
    no: ['Membaca email pribadi atau email kerja', 'Mengirim, menghapus, atau mengubah email', 'Menyimpan isi email lengkap'],
  },
  {
    key: 'calendar',
    Icon: Calendar,
    label: 'Calendar',
    scope: 'Event',
    yes: ['Membuat event pengingat tagihan atau cicilan', 'Membaca event yang dibuat Trackster'],
    no: ['Membagikan jadwalmu ke orang lain', 'Mengundang orang ke event'],
  },
  {
    key: 'profile',
    Icon: UserRound,
    label: 'Profil',
    scope: 'Email & identitas dasar',
    yes: ['Menampilkan akun Google mana yang terhubung'],
    no: ['Membaca kontak', 'Membaca foto atau dokumen di Drive'],
  },
] as const;

export default function PermissionExplorer() {
  const [sel, setSel] = useState<(typeof PERMS)[number]['key']>('gmail');
  const p = PERMS.find((x) => x.key === sel)!;

  return (
    <section aria-label="Izin Google" className="rounded-panel bg-surface p-5 shadow-hairline md:p-6">
      <h2 className="text-small font-bold uppercase tracking-caps text-text-subtle">Coba ketuk — izin apa yang kami minta?</h2>
      <div role="tablist" className="mt-3 flex flex-wrap gap-2">
        {PERMS.map(({ key, Icon, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={sel === key}
            onClick={() => setSel(key)}
            className={`relative flex items-center gap-2 rounded-pill px-4 py-2 text-label font-semibold transition-colors ${sel === key ? 'text-on-brand' : 'bg-neutral text-text hover:bg-neutral-hover'}`}
          >
            {sel === key && <motion.span layoutId="perm-pill" className="absolute inset-0 rounded-pill bg-brand" />}
            <Icon size={16} className="relative" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={p.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <div className="rounded-card bg-success-subtle p-4">
            <p className="text-small font-bold uppercase tracking-caps text-brand">Dipakai untuk · {p.scope}</p>
            <ul className="mt-3 space-y-2">
              {p.yes.map((t) => (
                <li key={t} className="flex gap-2 text-label leading-snug">
                  <Check size={16} className="mt-0.5 shrink-0 text-brand" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card bg-danger-subtle p-4">
            <p className="text-small font-bold uppercase tracking-caps text-danger">Tidak dilakukan</p>
            <ul className="mt-3 space-y-2">
              {p.no.map((t) => (
                <li key={t} className="flex gap-2 text-label leading-snug">
                  <X size={16} className="mt-0.5 shrink-0 text-danger" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
