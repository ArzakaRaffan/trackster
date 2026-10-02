/* <track-mascot> — Track AI, versi Struk. Satu sumber kebenaran untuk bentuk & gerak maskot.
   Atribut: size (tinggi px, default 64) · mood: idle|happy|alert|think · speaking · pointer · still
   Method : el.react('receive'|'hop'|'nod'|'shake') */
(() => {
  if (customElements.get('track-mascot')) return;
  const INK = '#121212', PAPER = '#F4F4F2', BAR = [211, 211, 207], G = [30, 215, 96], O = [255, 164, 43];
  const MOODS = {
    idle: { c: 6, w: 6, o: 0, h: 0, a: 0, th: 0, lx: 0, ly: 0, sl: 0 },
    happy: { c: 11, w: 8, o: 1, h: 1, a: 0, th: 0, lx: 0, ly: 0, sl: 0 },
    alert: { c: -5.5, w: 5.5, o: 0, h: 0, a: 1, th: 0, lx: 0, ly: 0, sl: 0 },
    think: { c: .5, w: 4, o: 0, h: 0, a: 0, th: 1, lx: .8, ly: -.9, sl: 0 },
    hide: { c: 5, w: 4.5, o: 0, h: 0, a: 0, th: 0, lx: 0, ly: .6, sl: 1 }
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const f = n => n.toFixed(2);
  class Spring {
    constructor(x, k, c) { this.x = x; this.t = x; this.v = 0; this.k = k; this.c = c; }
    step(dt) { this.v += (this.k * (this.t - this.x) - this.c * this.v) * dt; this.x += this.v * dt; }
    snap() { this.x = this.t; this.v = 0; }
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const live = new Set(); let raf = 0, last = 0; const ptr = { x: 0, y: 0, at: -1e9 };
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.at = performance.now() / 1000; }, { passive: true });
  function loop(ms) {
    const dt = Math.min(.033, (ms - last) / 1000 || .016); last = ms;
    live.forEach(m => { m._step(ms / 1000, dt); m._draw(ms / 1000); });
    raf = live.size ? requestAnimationFrame(loop) : 0;
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const ZIG = 'l-6.4 8 l-6.4 -8 '.repeat(5);

  class TrackMascot extends HTMLElement {
    static get observedAttributes() { return ['mood', 'size', 'speaking', 'pointer', 'still']; }
    connectedCallback() {
      if (!this._built) this._build();
      this._io = new IntersectionObserver(es => { this._vis = es[0].isIntersecting; this._sync(); });
      this._io.observe(this);
    }
    disconnectedCallback() { live.delete(this); this._io && this._io.disconnect(); }
    attributeChangedCallback() { if (this._built) { this._read(); this._applySize(); this._sync(); if (this._still || reduce.matches) { this._step(performance.now() / 1000, .016); this._draw(0); } } }
    _flag(n) { const v = this.getAttribute(n); return v !== null && v !== 'false'; }
    _read() {
      this._mood = MOODS[this.getAttribute('mood')] ? this.getAttribute('mood') : 'idle';
      this._speaking = this._flag('speaking'); this._pointer = this._flag('pointer'); this._still = this._flag('still');
    }
    _applySize() {
      const h = parseFloat(this.getAttribute('size')) || 64, s = this.r.svg;
      s.setAttribute('height', h); s.setAttribute('width', (h * 92 / 112).toFixed(2));
    }
    _sync() { if (this._vis && this.isConnected && !(this._still && this._settled)) { live.add(this); kick(); } else live.delete(this); }
    _build() {
      this._built = true;
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const eye = i => `<g data-r="e${i}"><ellipse data-r="el${i}" fill="${INK}"/><path data-r="ar${i}" stroke="${INK}" stroke-width="2.7" stroke-linecap="round"/><path data-r="br${i}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path data-r="sl${i}" stroke="${INK}" stroke-width="2.7" stroke-linecap="round"/></g>`;
      root.innerHTML = `<style>:host{display:inline-block;line-height:0;vertical-align:middle}</style><svg data-r="svg" viewBox="14 4 92 112" fill="none" aria-hidden="true" style="display:block;overflow:visible">
<ellipse data-r="sh" cx="60" cy="110" rx="24" ry="3.6" fill="rgba(18,18,18,.22)"/>
<g data-r="body">
<path d="M28 20Q28 14 34 14H86Q92 14 92 20V100${ZIG}Z" fill="${PAPER}" stroke="rgba(18,18,18,.14)" stroke-width="1.5" stroke-linejoin="round"/>
<path data-r="strip" d="M28.8 34V20Q28.8 14.8 34 14.8H86Q91.2 14.8 91.2 20V34Z"/>
<rect data-r="lab" x="44" y="21" width="32" height="5" rx="2.5" fill="${INK}" opacity=".85"/>
<g data-r="eyes">${eye(0)}${eye(1)}</g>
<g data-r="mouth"><path data-r="mf" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path data-r="mc" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></g>
<rect data-r="b1" x="42" y="80" width="36" height="4" rx="2"/><rect data-r="b2" x="42" y="90" height="4" rx="2"/>
</g></svg>`;
      this.r = {}; root.querySelectorAll('[data-r]').forEach(n => this.r[n.dataset.r] = n);
      this._read(); this._applySize();
      const M = MOODS[this._mood];
      this.p = { c: new Spring(M.c, 170, 21), w: new Spring(M.w, 170, 21), o: new Spring(M.o, 170, 21), h: new Spring(M.h, 170, 21), a: new Spring(M.a, 170, 21),
        th: new Spring(M.th, 170, 21), sl: new Spring(M.sl, 170, 21), lx: new Spring(M.lx, 170, 21), ly: new Spring(M.ly, 170, 21),
        eye: new Spring(1, 700, 42), y: new Spring(0, 230, 13), tilt: new Spring(0, 320, 7), bar: new Spring(1, 90, 14) };
      this._draw(0);
    }
    _snapAll() { Object.values(this.p).forEach(s => s.snap()); }
    react(n) {
      if (!this._built) return; const t = performance.now() / 1000, p = this.p, move = !(reduce.matches || this._still);
      if (n === 'receive') { this._temp = { mood: 'happy', until: t + 1.5 }; if (move) { p.y.v = -130; p.bar.x = 0; p.bar.v = 0; } }
      else if (n === 'hop') { if (move) p.y.v = -130; }
      else if (n === 'nod') { if (move) { p.y.v = 55; p.ly.v = 10; } }
      else if (n === 'shake') { this._temp = { mood: 'alert', until: t + 1.3 }; if (move) { p.tilt.v = 95; p.y.v = -30; } }
      this._settled = false; this._sync();
    }
    _step(t, dt) {
      const p = this.p, still = this._still || reduce.matches;
      let mood = this._mood; if (this._temp && t < this._temp.until) mood = this._temp.mood; else this._temp = null;
      const M = MOODS[mood]; let { c, w, o, lx, ly } = M;
      if (this._pointer && !still && mood !== 'think' && mood !== 'hide' && t - ptr.at < 2.5) {
        const r = this.getBoundingClientRect();
        lx += clamp((ptr.x - (r.left + r.width / 2)) / 260, -1, 1) * .95; ly += clamp((ptr.y - (r.top + r.height / 2)) / 220, -1, 1) * .8;
      }
      if (this._speaking) { const env = clamp(.6 + .5 * Math.sin(t * 11.3) * Math.sin(t * 4.1 + 1.3), 0, 1); c = 3 + 9 * env; w = 6 + 1.5 * env; o = 1; }
      Object.assign(p.c, { t: c }); p.w.t = w; p.o.t = o; p.h.t = M.h; p.a.t = M.a; p.th.t = M.th; p.sl.t = M.sl; p.lx.t = lx; p.ly.t = ly;
      if (still) p.eye.t = 1;
      else {
        if (this._nb === undefined) this._nb = t + 1.4;
        if (t >= this._nb) { p.eye.t = .05; this._be = t + .11; this._nb = t + 2.6 + Math.random() * 3.6; if (Math.random() < .15) this._nb = t + .28; }
        if (this._be && t >= this._be) { p.eye.t = 1; this._be = 0; }
      }
      const S = Object.values(p); for (let i = 0; i < 2; i++) S.forEach(s => s.step(dt / 2));
      if (still) { S.forEach(s => s.snap()); this._settled = true; }
    }
    _draw(t) {
      const p = this.p, r = this.r, still = this._still || reduce.matches;
      const br = still ? 0 : Math.sin(t * 6.2832 / 3.8), y = p.y.x + br * .9;
      const sy = 1 + clamp(-p.y.v * .0011, -.12, .12) - p.y.x * .012 + br * .012, sx = 1 + (1 - sy) * .7;
      const tilt = p.tilt.x + p.lx.x * 1.4 + p.th.x * 2, lx = p.lx.x, ly = p.ly.x, a = clamp(p.a.x, 0, 1), th = clamp(p.th.x, 0, 1), h = clamp(p.h.x, 0, 1), sl = clamp(p.sl.x, 0, 1);
      r.body.setAttribute('transform', `translate(0 ${f(y)}) translate(60 108) rotate(${f(tilt)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-60 -108)`);
      r.sh.setAttribute('rx', f(24 * clamp(1 + y * .02, .6, 1.1))); r.sh.setAttribute('opacity', f(clamp(1 + y * .05, .3, 1)));
      r.strip.setAttribute('fill', rgb(mix(G, O, a)));
      r.lab.setAttribute('transform', `translate(${f(lx)} ${f(ly * .5)})`);
      r.eyes.setAttribute('transform', `translate(${f(lx * 3.4)} ${f(ly * 2.4)})`);
      const open = clamp(p.eye.x, .05, 1.15);
      for (let i = 0; i < 2; i++) {
        const k = i ? 1 : -1, x = 60 + k * 11, ey = 52, el = r['el' + i];
        el.setAttribute('cx', x); el.setAttribute('cy', f(ey - th * 1.6)); el.setAttribute('rx', f(3.06 * (1 + .2 * a) * (1 - .1 * th)));
        el.setAttribute('ry', f(4.05 * (1 + .3 * a) * (1 - .15 * th) * open)); el.setAttribute('opacity', f((1 - h) * (1 - sl)));
        r['sl' + i].setAttribute('d', `M${f(x - 3.8)} ${ey - .4}Q${x} ${ey + 4.8} ${f(x + 3.8)} ${ey - .4}`); r['sl' + i].setAttribute('opacity', f(sl));
        r['ar' + i].setAttribute('d', `M${f(x - 3.8)} ${ey + 1.8}Q${x} ${ey - 4.7} ${f(x + 3.8)} ${ey + 1.8}`); r['ar' + i].setAttribute('opacity', f(h));
        const yo = (1 - a) * 2.5, yo1 = ey - 7 + yo, yi = ey - 10.5 + yo;
        r['br' + i].setAttribute('d', k < 0 ? `M${f(x - 4.5)} ${f(yo1)}L${f(x + 4.5)} ${f(yi)}` : `M${f(x - 4.5)} ${f(yi)}L${f(x + 4.5)} ${f(yo1)}`); r['br' + i].setAttribute('opacity', f(a));
      }
      r.mouth.setAttribute('transform', `translate(${f(lx * 2.2)} ${f(ly * 1.2)})`);
      const mx = 60 + th * 3, my = 66 + 3 * a, w = p.w.x, c = p.c.x, o = clamp(p.o.x, 0, 1);
      r.mc.setAttribute('d', `M${f(mx - w)} ${f(my)}Q${f(mx)} ${f(my + c)} ${f(mx + w)} ${f(my)}`);
      r.mf.setAttribute('d', `M${f(mx - w)} ${f(my)}Q${f(mx)} ${f(my + c)} ${f(mx + w)} ${f(my)}Z`); r.mf.setAttribute('opacity', f(o));
      const sh = i => (still || th < .01) ? 0 : th * (.5 + .5 * Math.sin(t * 4 - i * 1.3)) * .8;
      r.b1.setAttribute('width', 36); r.b1.setAttribute('fill', rgb(mix(BAR, G, sh(0))));
      r.b2.setAttribute('width', f(Math.max(0, 22 * p.bar.x))); r.b2.setAttribute('fill', rgb(mix(BAR, G, sh(1))));
    }
  }
  customElements.define('track-mascot', TrackMascot);
  window.TrackMascot = TrackMascot;
})();
