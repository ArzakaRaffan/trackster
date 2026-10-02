'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Mail, TrendingUp } from 'lucide-react';

function Logo() { return <div className="ts-logo"><span>T</span><b>Trackster</b></div>; }

export default function LandingPage() {
  const [email, setEmail] = useState('');
  return <main className="ts-page ts-landing">
    <header className="ts-header"><Logo /><Link href="/login" className="ts-login-link">Sudah punya akses? Masuk</Link></header>
    <section className="ts-hero">
      <div className="ts-hero-copy">
        <span className="ts-beta"><i />Private beta · akses dibuka bertahap</span>
        <h1>Pengeluaran tercatat otomatis. <em>Sisa budget hari ini selalu jelas.</em></h1>
        <p>Trackster mencatat transaksi BCA dan Jago dari email notifikasi, jadi kamu cukup melihat sisa budget hari ini. Sebelum membeli sesuatu, tanya Track, asisten keuangan AI.</p>
        <form className="ts-waitlist" onSubmit={(e) => e.preventDefault()}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@kamu.com" aria-label="Email" />
          <button type="submit">Masuk antrean beta <ArrowRight size={18} /></button>
        </form>
        <ul className="ts-trust"><li><Check size={14} />Hanya butuh email</li><li><Check size={14} />Tanpa kartu kredit</li><li><Check size={14} />Kami kabari saat giliranmu tiba</li></ul>
      </div>
      <div className="ts-demo-wrap">
        <div className="ts-mail"><Mail size={16} /><span><small>Transaksi baru</small><b>Kopi Kenangan Rp32.000</b></span></div>
        <div className="ts-demo-card">
          <div className="ts-demo-head"><div className="ts-mascot">T</div><span><b>Hari ini</b><small>Rabu, 30 September</small></span><strong>● Aman</strong></div>
          <div className="ts-budget"><label>Sisa budget hari ini</label><div><b>Rp168.000</b><small>dari budget Rp200.000</small></div><i><u /></i></div>
          <ul className="ts-transactions"><li><span>K</span><div><b>Kopi Kenangan</b><small>Hari ini · 09:42</small></div><strong>−Rp32.000</strong></li><li><span>T</span><div><b>Transportasi</b><small>Kemarin · 18:10</small></div><strong>−Rp18.000</strong></li><li><span>M</span><div><b>Makan siang</b><small>Kemarin · 12:30</small></div><strong>−Rp24.000</strong></li><li><span>S</span><div><b>Spotify</b><small>30 Sep · 08:00</small></div><strong>−Rp49.000</strong></li></ul>
          <div className="ts-alert"><TrendingUp size={16} /> Budget harian masih aman</div>
        </div>
      </div>
    </section>
    <section className="ts-bottom"><p>PRIVASI DULUAN, SELALU</p><h2>Uangmu tetap milikmu.</h2><span>Data terenkripsi dan hanya kamu yang bisa melihatnya.</span></section>
  </main>;
}
