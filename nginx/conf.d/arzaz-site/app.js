(function () {
  'use strict';

  const NAME = ['Arzaka', 'Zahara'];
  const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const MEDIA_LABELS = {
    'stickers': 'stiker', 'photos': 'foto', 'videos': 'video', 'video': 'video',
    'audio': 'pesan suara', 'contact': 'kontak', 'location': 'lokasi',
    'unsent a message.': 'pesan dihapus', 'unsent.': 'pesan dihapus',
    'message unsent.': 'pesan dihapus', 'gift sent!': 'kiriman hadiah'
  };

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const fmtInt = (n) => n.toLocaleString('id-ID');
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let META, DAYS;

  /* ---------------- theme ---------------- */
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ck-theme', next); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#14140f' : '#f6f5f2');
  }

  /* ---------------- navigation ---------------- */
  let stack = [{ screen: 'home' }];

  function go(screen, params, title) {
    stack.push({ screen, params: params || {}, title });
    render();
  }
  function back() {
    if (stack.length > 1) stack.pop();
    render();
  }
  function replaceTop(screen, params, title) {
    stack[stack.length - 1] = { screen, params: params || {}, title };
    render();
  }

  const RENDERERS = {
    home: renderHome,
    ringkasan: renderRingkasan,
    jelajah: renderJelajahMonths,
    'jelajah-days': (p) => renderJelajahDays(p.ym),
    cari: renderCari,
    day: (p) => renderDay(p.idx)
  };

  function render() {
    const top = stack[stack.length - 1];
    const topbar = $('#topbar');
    if (top.screen === 'home') {
      topbar.classList.remove('show');
    } else {
      topbar.classList.add('show');
      $('#topbar-title').textContent = top.title || '';
    }
    window.scrollTo(0, 0);
    const html = RENDERERS[top.screen](top.params);
    $('#screen').innerHTML = '<div class="screen-in">' + html + '</div>';
    attachHandlers(top.screen, top.params);
  }

  /* ---------------- home ---------------- */
  function renderHome() {
    return `
      <div id="home">
        <div class="home-top">
          <button class="icon-btn" id="home-theme" aria-label="Ganti tema">◐</button>
        </div>
        <p class="eyebrow">arsip obrolan</p>
        <h1>Catatan Kita</h1>
        <p class="lede">Arzaka &amp; Zahara, diambil dari LINE. <b>${fmtInt(META.total)}</b> pesan
          sejak ${META.first_label.replace(/^\w+,\s*/, '')}.</p>

        <div class="stat-strip">
          <div class="cell"><div class="num">${fmtInt(META.total)}</div><div class="cap">pesan</div></div>
          <div class="cell"><div class="num">${META.days_chatted}</div><div class="cap">hari tercatat</div></div>
          <div class="cell"><div class="num">${META.span_days}</div><div class="cap">hari rentang</div></div>
        </div>

        <div class="menu-list">
          ${menuItem('ringkasan', '✦', 'Ringkasan cerita kita', `Angka-angka di balik ${fmtInt(META.total)} pesan`)}
          ${menuItem('jelajah', '❯', 'Jelajah semua obrolan', `${META.days_chatted} hari, ditata per bulan`)}
          ${menuItem('cari', '⌕', 'Cari pesan tertentu', 'Telusuri kata atau tanggal')}
          ${menuItem('random', '↻', 'Kilas balik acak', 'Lempar ke satu hari secara acak')}
        </div>
      </div>`;
  }
  function menuItem(key, icon, title, desc) {
    return `<button class="menu-item" data-go="${key}">
      <span class="mi-icon">${icon}</span>
      <span class="mi-text">
        <span class="mi-title">${title}</span>
        <span class="mi-desc">${desc}</span>
      </span>
      <span class="mi-arrow">›</span>
    </button>`;
  }

  /* ---------------- ringkasan ---------------- */
  function renderRingkasan() {
    const a = META.sender_count[0], z = META.sender_count[1];
    const pctA = Math.round(a / (a + z) * 100);
    const maxHour = Math.max(...META.hourly);
    const peakHour = META.hourly.indexOf(maxHour);
    const maxWord = META.top_words[0][1];
    const monthMax = Math.max(...META.monthly.map((m) => m.count));

    return `<div class="wrap">
      <div class="flap-row">
        <div class="flap-unit"><div class="flap">${META.span_days}</div><div class="flap-label">hari sejak pesan pertama</div></div>
        <div class="flap-unit"><div class="flap">${fmtInt(META.total)}</div><div class="flap-label">pesan terkirim</div></div>
        <div class="flap-unit"><div class="flap">${META.days_chatted}</div><div class="flap-label">hari yang tercatat</div></div>
      </div>
      <p class="range">${META.first_label} &nbsp;→&nbsp; ${META.last_label}</p>

      <p class="section-title">Siapa yang lebih cerewet</p>
      <div class="split-bar">
        <span class="sa" style="width:${pctA}%"></span>
        <span class="sz" style="width:${100 - pctA}%"></span>
      </div>
      <div class="split-legend">
        <span><span class="dot a"></span><b>Arzaka</b> — ${fmtInt(a)} (${pctA}%)</span>
        <span><b>Zahara</b> — ${fmtInt(z)} (${100 - pctA}%)<span class="dot z" style="margin:0 0 0 6px"></span></span>
      </div>

      <p class="section-title">Jam paling ramai</p>
      <div class="hours">
        ${META.hourly.map((v, h) => `<div class="hour-bar ${h === peakHour ? 'peak' : ''}" style="height:${Math.max(3, v / maxHour * 76)}px" title="${String(h).padStart(2, '0')}.00 — ${fmtInt(v)} pesan"></div>`).join('')}
      </div>
      <div class="hours-caption"><span>00.00</span><span>puncak jam <b>${String(peakHour).padStart(2, '0')}.00</b></span><span>23.00</span></div>

      <p class="section-title">Kata yang paling sering muncul</p>
      <div class="word-tags">
        ${META.top_words.slice(0, 26).map(([w, c]) => {
          const size = 12 + (c / maxWord) * 22;
          const op = 0.5 + (c / maxWord) * 0.5;
          return `<span class="word-tag" style="font-size:${size.toFixed(1)}px;opacity:${op.toFixed(2)}">${esc(w)}</span>`;
        }).join('')}
      </div>

      <p class="section-title">Obrolan per bulan</p>
      <div class="months">
        ${META.monthly.map((m) => `<div class="month-col" data-ym="${m.ym}" title="${m.ym} — ${fmtInt(m.count)} pesan"><div class="bar" style="height:${Math.max(3, m.count / monthMax * 100)}%"></div></div>`).join('')}
      </div>
      <div class="month-labels">
        ${META.monthly.map((m) => `<div>${MONTH_SHORT[parseInt(m.ym.slice(5, 7), 10)]}<br>'${m.ym.slice(2, 4)}</div>`).join('')}
      </div>

      <p class="section-title">Hari paling ramai</p>
      <div class="busiest-card">
        <div>
          <p class="bt">${META.busiest.label}</p>
          <p class="bd">${fmtInt(META.busiest.count)} pesan dalam satu hari</p>
        </div>
        <button id="goto-busiest">Buka</button>
      </div>
    </div>`;
  }

  /* ---------------- jelajah ---------------- */
  function renderJelajahMonths() {
    const byYear = {};
    META.monthly.forEach((m) => {
      const y = m.ym.slice(0, 4);
      (byYear[y] = byYear[y] || []).push(m);
    });
    let html = `<div class="wrap"><p class="muted" style="margin:0 0 4px">Pilih bulan untuk melihat obrolan hari per hari.</p>`;
    Object.keys(byYear).sort().forEach((y) => {
      html += `<div class="year-heading">${y}</div><div class="month-grid">`;
      byYear[y].forEach((m) => {
        html += `<button class="month-tile" data-ym="${m.ym}">
          <span class="mt-name">${MONTH_NAMES[parseInt(m.ym.slice(5, 7), 10)]}</span>
          <span class="mt-count">${fmtInt(m.count)} pesan</span>
        </button>`;
      });
      html += `</div>`;
    });
    return html + `</div>`;
  }

  function renderJelajahDays(ym) {
    const monthLabel = MONTH_NAMES[parseInt(ym.slice(5, 7), 10)] + ' ' + ym.slice(0, 4);
    let html = `<div class="wrap"><p class="section-title">${monthLabel}</p><div class="day-list">`;
    DAYS.forEach((d, i) => {
      if (!d.iso.startsWith(ym)) return;
      const dayNum = d.label.split(', ')[1] || d.label;
      html += `<button class="day-row" data-idx="${i}"><span class="dr-day">${dayNum}</span><span class="dr-count">${fmtInt(d.m.length)} pesan</span></button>`;
    });
    return html + `</div></div>`;
  }

  /* ---------------- cari ---------------- */
  function renderCari() {
    return `<div class="wrap">
      <div class="search-box">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="search" type="text" placeholder="Cari kata atau tanggal…" autocomplete="off" autocapitalize="off" spellcheck="false">
      </div>
      <div id="search-results"><p class="sr-hint">Mulai ketik untuk mencari lintas ${fmtInt(META.total)} pesan.</p></div>
    </div>`;
  }

  function runSearch(q) {
    const results = $('#search-results');
    if (!q) {
      results.innerHTML = `<p class="sr-hint">Mulai ketik untuk mencari lintas ${fmtInt(META.total)} pesan.</p>`;
      return;
    }
    const hits = [];
    const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    for (let i = 0; i < DAYS.length && hits.length < 80; i++) {
      const d = DAYS[i];
      if (d.label.toLowerCase().includes(q)) {
        hits.push({ idx: i, label: d.label, snip: d.m.length + ' pesan pada hari ini' });
        continue;
      }
      for (const [sender, , text] of d.m) {
        if (text.toLowerCase().includes(q)) {
          const raw = NAME[sender] + ': ' + text;
          hits.push({ idx: i, label: d.label, snip: esc(raw.slice(0, 100)).replace(rx, '<mark>$1</mark>') });
          if (hits.length >= 80) break;
        }
      }
    }
    if (!hits.length) {
      results.innerHTML = '<p class="sr-empty">Tidak ada yang cocok.</p>';
      return;
    }
    results.innerHTML = hits.map((h) =>
      `<button class="sr-item" data-idx="${h.idx}"><span class="sr-label">${h.label}</span><span class="sr-snip">${h.snip}</span></button>`
    ).join('');
    $$('.sr-item', results).forEach((btn) => {
      const idx = parseInt(btn.dataset.idx, 10);
      btn.addEventListener('click', () => go('day', { idx }, DAYS[idx].label));
    });
  }

  /* ---------------- day ---------------- */
  function renderDay(idx) {
    const d = DAYS[idx];
    const groups = [];
    d.m.forEach(([sender, time, text]) => {
      const last = groups[groups.length - 1];
      if (last && last.sender === sender) last.items.push([time, text]);
      else groups.push({ sender, items: [[time, text]] });
    });

    let html = `<div class="wrap"><span class="day-sub">${fmtInt(d.m.length)} pesan · ${d.label}</span>`;
    groups.forEach((g) => {
      const cls = g.sender === 0 ? 'a' : 'z';
      html += `<div class="msg-group ${cls}"><div class="msg-meta">${NAME[g.sender]} · ${g.items[0][0]}</div>`;
      g.items.forEach(([, text]) => {
        const key = text.trim().toLowerCase();
        if (MEDIA_LABELS[key]) html += `<div class="bubble media">‹ ${MEDIA_LABELS[key]} ›</div>`;
        else html += `<div class="bubble">${esc(text)}</div>`;
      });
      html += `</div>`;
    });
    html += `<div class="day-nav">
      <button id="prev-day" ${idx <= 0 ? 'disabled' : ''}>‹ Hari sebelumnya</button>
      <button id="next-day" ${idx >= DAYS.length - 1 ? 'disabled' : ''}>Hari berikutnya ›</button>
    </div>
    <p class="foot">Catatan Kita</p></div>`;
    return html;
  }

  /* ---------------- handlers ---------------- */
  function attachHandlers(screen, params) {
    if (screen === 'home') {
      $('#home-theme').addEventListener('click', toggleTheme);
      $$('.menu-item[data-go]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.go;
          if (t === 'random') {
            const idx = Math.floor(Math.random() * DAYS.length);
            return go('day', { idx }, DAYS[idx].label);
          }
          const titles = { ringkasan: 'Ringkasan cerita kita', jelajah: 'Jelajah semua obrolan', cari: 'Cari pesan' };
          go(t, {}, titles[t]);
        });
      });
    }
    else if (screen === 'ringkasan') {
      $('#goto-busiest').addEventListener('click', () => {
        const idx = DAYS.findIndex((d) => d.iso === META.busiest.iso);
        if (idx >= 0) go('day', { idx }, DAYS[idx].label);
      });
      $$('.month-col').forEach((c) => {
        c.addEventListener('click', () => {
          const ym = c.dataset.ym;
          go('jelajah-days', { ym }, MONTH_NAMES[parseInt(ym.slice(5, 7), 10)] + ' ' + ym.slice(0, 4));
        });
      });
    }
    else if (screen === 'jelajah') {
      $$('.month-tile').forEach((t) => {
        t.addEventListener('click', () => {
          const ym = t.dataset.ym;
          go('jelajah-days', { ym }, MONTH_NAMES[parseInt(ym.slice(5, 7), 10)] + ' ' + ym.slice(0, 4));
        });
      });
    }
    else if (screen === 'jelajah-days') {
      $$('.day-row').forEach((r) => {
        const idx = parseInt(r.dataset.idx, 10);
        r.addEventListener('click', () => go('day', { idx }, DAYS[idx].label));
      });
    }
    else if (screen === 'cari') {
      const input = $('#search');
      input.focus();
      let t = null;
      input.addEventListener('input', (e) => {
        clearTimeout(t);
        const q = e.target.value.trim().toLowerCase();
        t = setTimeout(() => runSearch(q), 200);
      });
    }
    else if (screen === 'day') {
      const idx = params.idx;
      const prev = $('#prev-day'), next = $('#next-day');
      if (prev) prev.addEventListener('click', () => replaceTop('day', { idx: idx - 1 }, DAYS[idx - 1].label));
      if (next) next.addEventListener('click', () => replaceTop('day', { idx: idx + 1 }, DAYS[idx + 1].label));
    }
  }

  /* ---------------- boot ---------------- */
  $('#back-btn').addEventListener('click', back);
  $('#theme-btn').addEventListener('click', toggleTheme);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length > 1) back();
    if (stack[stack.length - 1].screen === 'day') {
      if (e.key === 'ArrowLeft' && !$('#prev-day').disabled) $('#prev-day').click();
      if (e.key === 'ArrowRight' && !$('#next-day').disabled) $('#next-day').click();
    }
  });

  fetch('chat-data.json')
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then((data) => {
      META = data.meta;
      DAYS = data.days;
      render();
      $('#loading').classList.add('hide');
      $('#app').classList.add('ready');
      setTimeout(() => { $('#loading').style.display = 'none'; }, 400);
    })
    .catch((err) => {
      $('#loading').textContent = 'Gagal memuat data. ' + err.message;
    });
})();
