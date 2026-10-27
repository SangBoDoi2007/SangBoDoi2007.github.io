/* Cryo — trang chủ.
   Chuyển động chạy bằng đúng các lò xo trong ui/theme/Motion.kt của app (hệ số tắt / độ cứng), giải bằng tích phân
   bước nhỏ nên đổi đích giữa chừng vẫn giữ vận tốc, như Compose. Mọi mô phỏng chỉ chạy trong trang, không gọi mạng. */
(() => {
  'use strict';
  const d = document, root = d.documentElement;
  const $ = (s, el = d) => el.querySelector(s);
  const $$ = (s, el = d) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lang = () => (root.lang === 'en' ? 'en' : 'vi');
  const num = (n, dp) => { const s = n.toFixed(dp); return lang() === 'vi' ? s.replace('.', ',') : s; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('no-motion');
  if (reduced) root.classList.add('no-motion');
  const refreshers = [];

  /* ---------- Lò xo ---------- */
  const SPEC = {
    spatial: { z: 0.6, k: 420 }, quick: { z: 0.45, k: 1400 }, effects: { z: 1, k: 1600 }, sheet: { z: 0.72, k: 300 },
    fraction: { z: 0.55, k: 400 }, exit: { z: 1, k: 700 }, fade: { z: 1, k: 260 }, gentle: { z: 0.85, k: 90 }, smooth: { z: 1, k: 140 },
    /* Nhịp của cả một màn bay vào (cấp trang, không phải cấp thành phần): chậm và êm hơn spatial một chút. */
    stage: { z: 0.7, k: 210 },
    /* Lò xo chuẩn của M3 Expressive (MotionScheme.expressive): dùng cho thành phần cấp trang và con trỏ. */
    m3FastSpatial: { z: 0.6, k: 800 }, m3Spatial: { z: 0.8, k: 380 }, m3SlowSpatial: { z: 0.8, k: 200 },
    m3FastEffects: { z: 1, k: 3800 }, m3Effects: { z: 1, k: 1600 }, m3SlowEffects: { z: 1, k: 800 },
  };
  const live = new Set(), dirty = new Set();
  let raf = 0, last = 0;
  class Spring {
    constructor(v, eps, owner) { this.x = v; this.v = 0; this.t = v; this.z = 1; this.k = 1600; this.eps = eps || 0.001; this.owner = owner || null; }
    to(t, s) {
      s = s || SPEC.effects; this.t = t; this.z = s.z; this.k = s.k;
      if (reduced) { this.x = t; this.v = 0; this.touch(); return this; }
      live.add(this); kick(); return this;
    }
    set(v) { this.x = this.t = v; this.v = 0; live.delete(this); this.touch(); return this; }
    touch() { if (this.owner) { dirty.add(this.owner); if (!raf) flush(); } }
  }
  function flush() { dirty.forEach((o) => o.apply()); dirty.clear(); }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    live.forEach((s) => {
      const c = 2 * s.z * Math.sqrt(s.k);
      let r = dt;
      while (r > 1e-6) { const h = Math.min(1 / 240, r); const a = -s.k * (s.x - s.t) - c * s.v; s.v += a * h; s.x += s.v * h; r -= h; }
      if (Math.abs(s.x - s.t) < s.eps && Math.abs(s.v) < s.eps * 20) { s.x = s.t; s.v = 0; live.delete(s); }
      if (s.owner) dirty.add(s.owner);
    });
    flush();
    raf = live.size ? requestAnimationFrame(loop) : 0;
  }
  function owner(fn) { return { apply: fn }; }

  /* Biến đổi của một phần tử: x, y (px), s (tỉ lệ), r (độ), o (độ mờ). */
  const MO = new WeakMap();
  function mo(el) {
    let m = MO.get(el);
    if (!m) {
      m = { apply() {
        el.style.transform = 'translate3d(' + m.x.x.toFixed(2) + 'px,' + m.y.x.toFixed(2) + 'px,0) scale(' + m.s.x.toFixed(4) + ') rotate(' + m.r.x.toFixed(2) + 'deg)';
        el.style.opacity = clamp(m.o.x, 0, 1).toFixed(3);
      } };
      m.x = new Spring(0, 0.2, m); m.y = new Spring(0, 0.2, m); m.s = new Spring(1, 0.0005, m);
      m.r = new Spring(0, 0.02, m); m.o = new Spring(1, 0.002, m);
      MO.set(el, m);
    }
    return m;
  }
  function go(el, p, s, os) { const m = mo(el); for (const k in p) m[k].to(p[k], k === 'o' ? (os || SPEC.fade) : (s || SPEC.spatial)); }
  function put(el, p) { const m = mo(el); for (const k in p) m[k].set(p[k]); }

  /* ---------- Hình khối M3 Expressive ----------
     Xấp xỉ bằng hàm bán kính: siêu elip bậc p (2 = tròn, 4 = vuông bo) × gợn n cánh biên độ a, kéo dãn ngang sx.
     Mọi hình lấy mẫu ở cùng các góc nên nội suy điểm-với-điểm là ra phép biến hình liền mạch. */
  const SHAPES = {
    circle: { n: 0, a: 0, p: 2, sx: 1 }, oval: { n: 0, a: 0, p: 2, sx: 1.34 },
    squircle: { n: 0, a: 0, p: 4.2, sx: 1 }, pill: { n: 0, a: 0, p: 3.4, sx: 1.6 },
    cookie4: { n: 4, a: 0.11, p: 2, sx: 1 }, cookie9: { n: 9, a: 0.075, p: 2, sx: 1 },
    clover: { n: 4, a: 0.2, p: 2, sx: 1 }, flower: { n: 8, a: 0.13, p: 2, sx: 1 },
    sunny: { n: 8, a: 0.055, p: 2, sx: 1 }, burst: { n: 10, a: 0.09, p: 2, sx: 1 }, pentagon: { n: 5, a: 0.075, p: 2, sx: 1 },
  };
  /* Trả [x0, y0, x1, y1, …] trong khung đơn vị (điểm xa tâm nhất có bán kính 1). */
  function shapePts(def, P) {
    const out = new Float32Array(P * 2);
    let max = 0;
    for (let i = 0; i < P; i++) {
      const t = (i / P) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), p = def.p || 2;
      const r = Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), -1 / p) * (1 + def.a * Math.cos(def.n * t));
      const x = r * c * (def.sx || 1), y = r * s;
      out[i * 2] = x; out[i * 2 + 1] = y;
      max = Math.max(max, Math.hypot(x, y));
    }
    for (let i = 0; i < out.length; i++) out[i] /= max;
    return out;
  }
  /* Nội suy hai hình (t có thể vượt 1 khi lò xo nảy) thành chuỗi d của SVG, tâm (cx, cy), bán kính R. */
  function morphPath(A, B, t, cx, cy, R) {
    let p = '';
    for (let i = 0; i < A.length; i += 2) p += (i ? 'L' : 'M') + (cx + lerp(A[i], B[i], t) * R).toFixed(2) + ' ' + (cy + lerp(A[i + 1], B[i + 1], t) * R).toFixed(2);
    return p + 'Z';
  }

  /* Chỉ báo đang tải M3 Expressive: một khối đổi dáng liên tục qua bảy hình, vừa đổi vừa xoay. */
  const LOAD_SEQ = ['burst', 'cookie9', 'pentagon', 'pill', 'sunny', 'cookie4', 'oval'].map((k) => shapePts(SHAPES[k], 96));
  function loader(host) {
    const path = host && $('path', host);
    if (!path) return { show() {}, hide() {} };
    let i = 0, timer = 0, on = false;
    const o = owner(() => {
      const A = LOAD_SEQ[i % LOAD_SEQ.length], B = LOAD_SEQ[(i + 1) % LOAD_SEQ.length];
      path.setAttribute('d', morphPath(A, B, u.x, 0, 0, 1));
      host.style.transform = 'rotate(' + rot.x.toFixed(1) + 'deg) scale(' + Math.max(0, vis.x).toFixed(3) + ')';
    });
    const u = new Spring(0, 0.001, o), rot = new Spring(0, 0.05, o), vis = new Spring(0, 0.001, o);
    function step() {
      i++; u.set(0); u.to(1, SPEC.m3FastSpatial); rot.to(rot.t + 140, SPEC.m3Spatial);
      timer = setTimeout(step, 650);
    }
    return {
      show() { if (on) return; on = true; host.classList.add('on'); vis.to(1, SPEC.m3FastSpatial); if (!reduced) step(); else u.set(0); },
      hide() { on = false; clearTimeout(timer); vis.to(0, SPEC.m3FastEffects); setTimeout(() => { if (!on) host.classList.remove('on'); }, 260); },
    };
  }

  /* ---------- Ngôn ngữ ---------- */
  const TITLES = { vi: 'Cryo: Chế độ game & đo FPS — ASTVN Studios', en: 'Cryo: Game Mode & FPS Meter — ASTVN Studios' };
  function setLang(l) {
    root.lang = l;
    try { localStorage.setItem('cryo-lang', l); } catch (e) { /* trình duyệt chặn lưu: bỏ qua */ }
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    d.title = TITLES[l];
    refreshers.forEach((f) => f());
  }
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang())));
  d.title = TITLES[lang()];

  /* ---------- Màu theo hình nền ---------- */
  const themeMeta = $('meta[name="theme-color"]');
  function applyScheme(s) {
    if (s === 'ice') root.removeAttribute('data-scheme'); else root.setAttribute('data-scheme', s);
    $$('.swatches button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.scheme === s)));
    if (themeMeta) themeMeta.content = getComputedStyle(root).getPropertyValue('--surface').trim() || '#121318';
  }
  $$('.swatches button').forEach((b) => b.addEventListener('click', () => {
    const s = b.dataset.scheme;
    try { localStorage.setItem('cryo-scheme', s); } catch (e) { /* bỏ qua */ }
    if (!d.startViewTransition || reduced) { applyScheme(s); return; }
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    root.style.setProperty('--vt-x', x + 'px');
    root.style.setProperty('--vt-y', y + 'px');
    root.style.setProperty('--vt-r', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 'px');
    d.startViewTransition(() => applyScheme(s));
  }));
  applyScheme(root.getAttribute('data-scheme') || 'ice');

  /* ---------- Đầu trang & cuộn ---------- */
  const top = $('.top');
  /* Vị trí cuộn đọc MỘT lần mỗi sự kiện ở đây (bộ nghe đăng ký đầu tiên); fx.js dùng lại view.y. Mỗi lần đọc scrollY
     sau khi vừa ghi kiểu đều ép trình duyệt tính lại kiểu + bố cục — nhiều bộ nghe đọc xen kẽ là ép nhiều lần mỗi khung. */
  const view = { y: scrollY };
  const onScroll = () => { view.y = scrollY; top.classList.toggle('scrolled', view.y > 24); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  let lenis = null, wakeLenis = () => {};
  if (!reduced && window.Lenis && matchMedia('(pointer: fine)').matches) {
    lenis = new window.Lenis({ lerp: 0.12, wheelMultiplier: 0.95 });
    /* Nhịp rAF của Lenis chỉ chạy khi đang cuộn: chạy mãi thì trang đứng yên vẫn đòi 60 khung/giây (đo: ~8% một nhân).
       Đánh thức thì xoá mốc thời gian cũ (lenis.time) để khung đầu không coi cả quãng nghỉ là một bước. */
    let lr = 0, still = 0;
    const tick = (t) => { lenis.raf(t); still = lenis.isScrolling ? 0 : still + 1; lr = still > 30 ? 0 : requestAnimationFrame(tick); };
    wakeLenis = () => { still = 0; if (!lr) { lenis.time = 0; lr = requestAnimationFrame(tick); } };
    ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'].forEach((ev) => addEventListener(ev, wakeLenis, { passive: true }));
    wakeLenis();
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#main' || id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    if (lenis) { lenis.scrollTo(t, { offset: -84 }); wakeLenis(); } else t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
  }));

  /* ---------- Thành phần dùng chung ---------- */
  function setSwitch(sw, on, silent) {
    sw.setAttribute('aria-checked', String(on));
    const row = sw.closest('.a-row'); const ic = row && $('.a-ic', row);
    if (ic) ic.classList.toggle('on', on);
    if (!silent) sw.dispatchEvent(new CustomEvent('sw', { detail: on }));
  }
  $$('.a-sw').forEach((sw) => sw.addEventListener('click', () => setSwitch(sw, sw.getAttribute('aria-checked') !== 'true')));

  function segInit(seg, attr, onPick) {
    const btns = $$('button', seg);
    seg.style.setProperty('--n', btns.length);
    const pick = (b, silent) => {
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      seg.style.setProperty('--i', btns.indexOf(b));
      if (!silent) onPick(b.dataset[attr]);
    };
    btns.forEach((b) => b.addEventListener('click', () => pick(b)));
    const cur = btns.find((b) => b.getAttribute('aria-pressed') === 'true') || btns[0];
    pick(cur, true);
  }

  /* ---------- Mô phỏng 1: độ phân giải kết xuất ---------- */
  const polar = new Image();
  polar.decoding = 'async';
  polar.src = 'assets/polar.webp';

  function resDemo(sc) {
    const scr = $('.scr', sc), cv = $('.game-cv', sc), ctx = cv.getContext('2d');
    const lc = $('.loupe canvas', sc), lctx = lc.getContext('2d'), pillT = $('.g-pill-t', sc), pill = $('.g-pill', sc);
    const input = $('input[type="range"]', sc), slider = $('.a-slider', sc), card = $('.res-card', sc);
    const numEl = $('.res-num', sc), dimEl = $('.res-dim', sc), presets = $('.res-presets', sc), bubble = $('.sl-val b', sc);
    const pBtns = $$('button', presets), sw = $('[data-sw="res-on"]', sc);
    const off = d.createElement('canvas'), octx = off.getContext('2d');
    let val = 70, on = true, mode = 'buffer', shown = false, touched = false;

    /* Thanh trượt M3 Expressive: rãnh trước/sau tay cầm tính từ --p trong CSS, chấm dừng ẩn khi tay cầm chạm cuối. */
    const thumb = new Spring(0.571, 0.0005, owner(() => {
      slider.style.setProperty('--p', thumb.x.toFixed(4));
      slider.classList.toggle('at-end', thumb.x > 0.985);
    }));
    const eff = new Spring(0.7, 0.0008, owner(draw));
    const dims = (v) => Math.round(1260 * v / 100) + ' × ' + Math.round(2800 * v / 100);
    const pillText = () => (mode === 'buffer'
      ? (lang() === 'vi' ? 'Bộ đệm game: ' : 'Game buffer: ') + val + '%'
      : (lang() === 'vi' ? 'Toàn màn hình (ADB): ' : 'Fullscreen (ADB): ') + val + '%');

    function sizeCanvas() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const lw = Math.max(1, Math.round(lc.clientWidth * dpr));
      if (lc.width !== lw) { lc.width = lc.height = lw; }
    }
    function drawPill(c, lw, cssW) {
      /* Ở Toàn màn hình, cả cửa sổ nổi cũng bị vẽ ở độ phân giải thấp, nên vẽ nó vào cùng khung thấp. */
      const k = lw / cssW, fs = (cssW / 52) * 1.05 * k, padX = fs, txt = pill.dataset.t || '';
      c.font = '560 ' + fs + 'px "Google Sans Flex", Roboto, sans-serif';
      /* Đặt đúng chỗ cửa sổ thật đang nằm (vẫn đo được dù đang ẩn). */
      const x = pill.offsetLeft * k, y = pill.offsetTop * k, w = pill.offsetWidth * k, h = pill.offsetHeight * k;
      c.fillStyle = 'rgba(18,19,24,.86)';
      c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, h / 2) : c.rect(x, y, w, h); c.fill();
      c.fillStyle = '#3fd08f'; c.beginPath(); c.arc(x + padX + fs * 0.3, y + h / 2, fs * 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e3e1e9'; c.textBaseline = 'middle'; c.fillText(txt, x + padX + fs * 1.15, y + h / 2 + fs * 0.04);
    }
    function draw() {
      if (!polar.complete || !polar.naturalWidth || !cv.clientWidth) return;
      sizeCanvas();
      const W = cv.width, H = cv.height, s = clamp(eff.x, 0.2, 1);
      const lw = Math.max(16, Math.round(W * s)), lh = Math.max(8, Math.round(H * s));
      if (off.width !== lw || off.height !== lh) { off.width = lw; off.height = lh; }
      octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
      octx.drawImage(polar, 0, 0, lw, lh);
      if (mode === 'full' && on) drawPill(octx, lw, cv.clientWidth);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(off, 0, 0, W, H);
      /* Kính lúp: phóng 2,6 lần vùng ngay dưới nó, không làm mịn, để thấy từng điểm ảnh thật. */
      const lp = lc.parentNode, sw0 = scr.clientWidth || 1, sh0 = scr.clientHeight || 1;
      const L = lc.width, cx = (lp.offsetLeft + lp.offsetWidth / 2) / sw0, cy = (lp.offsetTop + lp.offsetHeight / 2) / sh0;
      const half = lp.offsetWidth / 2 / sw0 / 2.6;
      const sx = (cx - half) * lw, sy = (cy - half * (W / H)) * lh, sw = half * 2 * lw, sh = half * 2 * (W / H) * lh;
      lctx.imageSmoothingEnabled = false;
      lctx.clearRect(0, 0, L, L);
      lctx.drawImage(off, sx, sy, sw, sh, 0, 0, L, L);
    }
    function setVal(v, fromInput) {
      val = clamp(Math.round(v / 5) * 5, 30, 100);
      if (!fromInput) input.value = val;
      numEl.textContent = val;
      if (bubble) bubble.textContent = val;
      dimEl.textContent = dims(val);
      pill.dataset.t = pillText(); pillT.textContent = pill.dataset.t;
      pill.style.display = on ? '' : 'none';
      thumb.to((val - 30) / 70, SPEC.fraction);
      eff.to(on ? val / 100 : 1, SPEC.smooth);
      const i = pBtns.findIndex((b) => +b.dataset.v === val);
      pBtns.forEach((b, j) => b.classList.toggle('sel', j === i));
      presets.classList.toggle('none', i < 0);
      if (i >= 0) presets.style.setProperty('--i', i);
    }
    input.addEventListener('input', () => { touched = true; setVal(+input.value, true); });
    input.addEventListener('pointerdown', () => slider.classList.add('drag'));
    const lift = () => slider.classList.remove('drag');
    addEventListener('pointerup', lift); addEventListener('pointercancel', lift);
    pBtns.forEach((b) => b.addEventListener('click', () => { touched = true; setVal(+b.dataset.v); }));
    sw.addEventListener('sw', (e) => { on = e.detail; card.classList.toggle('off', !on); setVal(val); });
    segInit($('.seg-demo', sc), 'mode', (m) => { mode = m; scr.classList.toggle('full', m === 'full'); setVal(val); draw(); });
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(cv);
    polar.addEventListener('load', draw);
    refreshers.push(() => setVal(val));
    setVal(70);
    return {
      start() {
        draw();
        if (shown || reduced) return;
        shown = true;
        /* Lần đầu: từ 100% hạ xuống 70% để thấy điểm ảnh thưa đi. */
        eff.set(1); thumb.set(1); numEl.textContent = '100'; dimEl.textContent = dims(100);
        pBtns.forEach((b, j) => b.classList.toggle('sel', j === 4)); presets.style.setProperty('--i', 4);
        setTimeout(() => { if (!touched) setVal(70); }, 700);
      },
      stop() {},
    };
  }

  /* ---------- Mô phỏng 2: đóng băng & Focus Mode ---------- */
  function fzDemo(sc) {
    const grid = $('.home-grid', sc);
    const apps = $$('.app', sc).filter((a) => !a.classList.contains('pin') && !a.dataset.app);
    const game = $('.app.game', sc), btn = $('.fz-go', sc), note = $('.fz-note', sc), lvs = $$('.fz-lv', sc);
    let lv = 2, frozen = false, auto = true, gone = false, timers = [];
    $$('.app', sc).forEach((a) => {
      if (a.dataset.app) return;
      const b = d.createElement('span'); b.className = 'badge';
      b.innerHTML = '<span class="ms">' + (a.classList.contains('pin') ? 'keep' : 'ac_unit') + '</span>';
      a.appendChild(b);
    });
    const texts = {
      vi: { frozen: (n, l) => 'Đã đóng băng ' + n + ' app ở mức L' + l + '. 3 app có ghim được chừa ra.', thawed: (n) => 'Đã rã đông ' + n + ' app.', bf: 'Đang đóng băng app nền…', bt: 'Đang rã đông…' },
      en: { frozen: (n, l) => n + ' apps frozen at L' + l + '. The 3 pinned apps are skipped.', thawed: (n) => n + ' apps unfrozen.', bf: 'Freezing background apps…', bt: 'Unfreezing…' },
    };
    const load = loader($('.m3-load', sc));
    let noteState = null;
    const renderNote = () => {
      const t = texts[lang()];
      note.textContent = !noteState ? '' : noteState === 'f' ? t.frozen(apps.length, lv) : noteState === 't' ? t.thawed(apps.length) : t[noteState];
    };
    refreshers.push(renderNote);

    function rects(list) { return new Map(list.map((a) => [a, a.getBoundingClientRect()])); }
    function scaleOf() { const r = grid.getBoundingClientRect(); return r.width / (grid.offsetWidth || r.width) || 1; }
    function flip(before) {
      const s = scaleOf();
      before.forEach((r0, a) => {
        if (a.hidden) return;
        const r1 = a.getBoundingClientRect(), m = mo(a);
        const dx = (r0.left - r1.left) / s + m.x.x, dy = (r0.top - r1.top) / s + m.y.x;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        put(a, { x: dx, y: dy }); go(a, { x: 0, y: 0 }, SPEC.spatial);
      });
    }
    function setGone(g) {
      /* Không dựa vào cờ: timer ẩn có thể đã bị apply() huỷ giữa chừng, nên xét trạng thái thật của biểu tượng. */
      const settled = g ? apps.every((a) => a.hidden) : apps.every((a) => !a.hidden && mo(a).o.t === 1);
      gone = g;
      if (settled) return;
      const all = $$('.app', grid);
      if (g) {
        apps.forEach((a, i) => timers.push(setTimeout(() => go(a, { s: 0.2, o: 0 }, SPEC.exit, SPEC.effects), i * 30)));
        timers.push(setTimeout(() => {
          const before = rects(all.filter((a) => !apps.includes(a)));
          apps.forEach((a) => { a.hidden = true; });
          flip(before);
        }, apps.length * 30 + 220));
      } else {
        const keep = all.filter((a) => !apps.includes(a));
        const before = rects(keep);
        apps.forEach((a) => { a.hidden = false; put(a, { s: 0.3, o: 0, x: 0, y: 0 }); });
        flip(before);
        apps.forEach((a, i) => timers.push(setTimeout(() => go(a, { s: 1, o: 1 }, SPEC.spatial), 80 + i * 35)));
      }
    }
    function apply(busy) {
      timers.forEach(clearTimeout); timers = [];
      btn.setAttribute('aria-pressed', String(frozen));
      game.classList.toggle('live', frozen);
      const icon = lv === 3 ? 'lock' : 'ac_unit';
      apps.forEach((a, i) => {
        const delay = frozen ? i * 45 : (apps.length - i) * 25;
        timers.push(setTimeout(() => {
          a.classList.remove('f1', 'f2', 'f3');
          if (frozen && lv < 4) a.classList.add('f' + lv);
          const ms = $('.badge .ms', a); if (ms) ms.textContent = icon;
        }, delay));
      });
      setGone(frozen && lv === 4);
      const fin = frozen ? 'f' : (noteState ? 't' : null);
      if (busy && fin) {
        /* Trong lúc các biểu tượng lần lượt đổi trạng thái: chỉ báo đang tải M3, xong mới báo kết quả. */
        noteState = frozen ? 'bf' : 'bt'; renderNote(); load.show();
        timers.push(setTimeout(() => { load.hide(); noteState = fin; renderNote(); }, reduced ? 0 : apps.length * 45 + 420));
      } else { load.hide(); noteState = fin; renderNote(); }
    }
    lvs.forEach((b) => b.addEventListener('click', () => {
      lv = +b.dataset.lv;
      lvs.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      if (frozen) apply(false); else renderNote();
    }));
    btn.addEventListener('click', () => { auto = false; frozen = !frozen; apply(true); });
    let autoT = 0;
    return {
      start() { if (auto && !frozen) autoT = setTimeout(() => { if (auto && !frozen) { frozen = true; apply(true); } }, reduced ? 0 : 1100); },
      stop() { clearTimeout(autoT); },
    };
  }

  /* ---------- Mô phỏng 3: cửa sổ theo dõi ---------- */
  function monDemo(sc) {
    const scr = $('.scr', sc), ov = $('.ov', sc), card = $('.mon-card', sc);
    const cells = { cpu: $('[data-m="cpu"] b', ov), gpu: $('[data-m="gpu"] b', ov), ram: $('[data-m="ram"] b', ov), bat: $('[data-m="bat"] b', ov) };
    const mRam = $('.m-ram', card), mUsed = $('.m-used', card), mCpu = $('.m-cpu', card), mBat = $('.m-bat', card);
    const ringFg = $('.ring-fg', card), ringBg = $('.ring-bg', card);
    const N = 40;
    /* Vòng tiến độ dạng sóng M3 Expressive: phần đã dùng là sóng chạy, phần còn lại là rãnh phẳng, cách nhau một khe. */
    let wave = 0;
    /* Khi vòng lặp khung đang chạy thì nó tự vẽ vòng mỗi khung; lò xo chỉ vẽ lúc vòng lặp đứng (tránh vẽ hai lần). */
    const ringP = new Spring(0.51, 0.0005, owner(() => { if (!running || reduced) drawRing(); }));
    function drawRing() {
      const p = clamp(ringP.x, 0, 1), R = 46, A = 2.2, K = 14, gap = 15 / R, a0 = -Math.PI / 2, a1 = a0 + p * Math.PI * 2;
      const n = Math.max(2, Math.ceil(p * 180));
      let fg = '';
      for (let i = 0; i <= n; i++) {
        const t = a0 + (a1 - a0) * (i / n);
        /* Biên độ thu về 0 sát hai đầu để đầu tròn của nét không lệch khỏi rãnh. */
        const taper = Math.min(1, (t - a0) / 0.35, (a1 - t) / 0.35);
        const r = R + A * Math.max(0, taper) * Math.sin(K * (t - a0) - wave);
        fg += (i ? 'L' : 'M') + (60 + r * Math.cos(t)).toFixed(2) + ' ' + (60 + r * Math.sin(t)).toFixed(2);
      }
      ringFg.setAttribute('d', fg);
      const b0 = a1 + gap, b1 = a0 + Math.PI * 2 - gap;
      ringBg.setAttribute('d', b1 - b0 < 0.02 ? '' : 'M' + (60 + R * Math.cos(b0)).toFixed(2) + ' ' + (60 + R * Math.sin(b0)).toFixed(2) +
        'A' + R + ' ' + R + ' 0 ' + (b1 - b0 > Math.PI ? 1 : 0) + ' 1 ' + (60 + R * Math.cos(b1)).toFixed(2) + ' ' + (60 + R * Math.sin(b1)).toFixed(2));
    }
    const st = { cpu: 18, gpu: 41, ram: 5.6, bat: 35.9 };
    const mk = (tile, v0, lo, hi, jit) => {
      const el = $('[data-tile="' + tile + '"]', card);
      const hist = []; let v = v0;
      for (let i = 0; i < N; i++) { v = clamp(v + (Math.random() - 0.5) * jit, lo, hi); hist.push(v); }
      const head = new Spring(v0, 0.001, null);
      return { el, line: $('.ch-line', el), area: $('.ch-area', el), dot: $('.ch-dot', el), min: +$('.chart', el).dataset.min, max: +$('.chart', el).dataset.max, hist, head };
    };
    const charts = { cpu: mk('cpu', 18, 8, 42, 9), bat: mk('bat', 35.9, 35.3, 36.4, 0.12) };
    let phase = 0, lastT = 0, loopId = 0, tickId = 0, running = false;
    const dx = 100 / (N - 1);

    function render() {
      cells.cpu.textContent = Math.round(st.cpu) + '%';
      cells.gpu.textContent = Math.round(st.gpu) + '%';
      cells.ram.textContent = num(st.ram, 1) + ' GB';
      cells.bat.textContent = num(st.bat, 1) + '°';
      mRam.textContent = num(st.ram, 1);
      mUsed.textContent = num(11 - st.ram, 1) + ' / ' + num(11, 1) + ' GB';
      mCpu.textContent = Math.round(st.cpu);
      mBat.textContent = num(st.bat, 1);
      ringP.to(st.ram / 11, SPEC.m3Spatial);
    }
    function drawChart(c) {
      const y = (v) => 40 - ((v - c.min) / (c.max - c.min)) * 40;
      let p = '';
      for (let i = 0; i < N; i++) p += (i ? 'L' : 'M') + (i * dx - phase * dx).toFixed(2) + ' ' + y(c.hist[i]).toFixed(2);
      const hy = y(c.head.x);
      p += 'L100 ' + hy.toFixed(2);
      c.line.setAttribute('d', p);
      c.area.setAttribute('d', p + 'L100 40L' + (-phase * dx).toFixed(2) + ' 40Z');
      c.dot.style.top = ((hy / 40) * 100).toFixed(2) + '%';
    }
    function frame(t) {
      if (!running) return;
      const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
      phase = Math.min(1, phase + dt);
      /* Đầu biểu đồ trượt dần về giá trị mới: đường chạy liền, không trượt-rồi-đứng. */
      for (const k in charts) { const c = charts[k]; c.head.x += (c.head.t - c.head.x) * Math.min(1, dt * 6); drawChart(c); }
      wave = (wave + dt * 2.6) % (Math.PI * 2);
      drawRing();
      loopId = requestAnimationFrame(frame);
    }
    function tick() {
      st.cpu = clamp(st.cpu + (Math.random() - 0.5) * 10, 9, 41);
      st.gpu = clamp(st.gpu + (Math.random() - 0.5) * 12, 26, 66);
      st.ram = clamp(st.ram + (Math.random() - 0.5) * 0.16, 5.3, 5.9);
      st.bat = clamp(st.bat + (Math.random() - 0.35) * 0.12, 35.4, 36.4);
      for (const k in charts) { const c = charts[k]; c.hist.shift(); c.hist.push(c.head.x); c.head.t = st[k]; }
      phase = 0;
      render();
    }
    /* Kéo cửa sổ: thả ra thì bám vào mép trái hoặc phải gần nhất (app nhớ vị trí theo mép). */
    const pos = owner(() => { ov.style.left = (px.x * 100).toFixed(3) + '%'; ov.style.top = (py.x * 100).toFixed(3) + '%'; });
    const px = new Spring(0.03, 0.0005, pos), py = new Spring(0.26, 0.0005, pos);
    let drag = null;
    ov.addEventListener('dragstart', (e) => e.preventDefault());
    ov.addEventListener('pointerdown', (e) => {
      /* Không chặn mặc định thì Chrome coi là kéo-thả gốc và huỷ con trỏ ngay nhịp di chuyển đầu. */
      e.preventDefault();
      const r = scr.getBoundingClientRect(), o = ov.getBoundingClientRect();
      drag = { id: e.pointerId, ox: (e.clientX - o.left) / r.width, oy: (e.clientY - o.top) / r.height, w: o.width / r.width, h: o.height / r.height };
      ov.setPointerCapture(e.pointerId); ov.classList.add('drag');
    });
    ov.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const r = scr.getBoundingClientRect();
      px.set(clamp((e.clientX - r.left) / r.width - drag.ox, 0.01, Math.max(0.01, 0.99 - drag.w)));
      py.set(clamp((e.clientY - r.top) / r.height - drag.oy, 0.02, Math.max(0.02, 0.98 - drag.h)));
    });
    const end = () => {
      if (!drag) return;
      const w = drag.w; drag = null; ov.classList.remove('drag');
      px.to(px.x + w / 2 < 0.5 ? 0.03 : 0.97 - w, SPEC.spatial);
    };
    ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', end);
    segInit($('.seg-demo', sc), 'shz', (v) => { const no = v === '0'; ov.classList.toggle('noshz', no); card.classList.toggle('noshz', no); });
    refreshers.push(render);
    render();
    for (const k in charts) drawChart(charts[k]);
    return {
      start() {
        if (running) return;
        running = true; lastT = 0;
        if (!reduced) loopId = requestAnimationFrame(frame);
        tickId = setInterval(() => { tick(); if (reduced) for (const k in charts) { charts[k].head.x = charts[k].head.t; drawChart(charts[k]); } }, 1000);
      },
      stop() { running = false; cancelAnimationFrame(loopId); clearInterval(tickId); },
    };
  }

  /* ---------- Mô phỏng 4: trong lúc chơi ---------- */
  function playDemo(sc) {
    const scr = $('.play-scr', sc), afkSw = $('[data-sw="afk"]', sc), layer = $('.afk', sc);
    afkSw.addEventListener('sw', (e) => scr.classList.toggle('afk-on', e.detail));
    let lastTap = 0;
    const wake = () => setSwitch(afkSw, false);
    layer.addEventListener('dblclick', wake);
    layer.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') return;
      const t = performance.now(); if (t - lastTap < 320) wake(); lastTap = t;
    });
    return { start() {}, stop() {} };
  }

  /* ---------- Mô phỏng 5: báo cáo ---------- */
  function repDemo(sc) {
    const scr = $('.comp-rep', sc), sheet = $('.sheet', sc);
    let t = 0;
    const open = () => scr.classList.add('open');
    const closeNow = () => { sheet.style.transition = 'none'; scr.classList.remove('open'); void sheet.offsetHeight; sheet.style.transition = ''; };
    $('.rp-close', sc).addEventListener('click', () => scr.classList.remove('open'));
    $('.rp-again', sc).addEventListener('click', () => {
      if (scr.classList.contains('open')) { scr.classList.remove('open'); clearTimeout(t); t = setTimeout(open, 380); } else open();
    });
    return {
      start() { if (reduced) { open(); return; } closeNow(); clearTimeout(t); t = setTimeout(open, 420); },
      stop() { clearTimeout(t); },
    };
  }

  /* ---------- Câu chuyện: sân khấu dính (máy tính) hoặc từng màn ngay dưới chữ (điện thoại) ---------- */
  const DEMOS = { res: resDemo, freeze: fzDemo, mon: monDemo, play: playDemo, rep: repDemo };
  const stage = $('.stage'), deskMQ = matchMedia('(min-width: 1024px)');
  const screens = {};
  $$('.chap').forEach((c) => {
    const el = $('.screen', c), key = c.dataset.screen;
    const fit = d.createElement('div'); fit.className = 'fit';
    while (el.firstChild) fit.appendChild(el.firstChild);
    el.appendChild(fit);
    screens[key] = { key, el, fit, chap: c, slot: $('.slot', c), blocks: $$('[data-b]', fit), timers: [], demo: DEMOS[key](el), seen: false };
  });
  /* Hướng bay vào của từng khối; khi rời đi khối bay tiếp theo hướng ngược lại (OUT). */
  const FROM = { up: { y: 70, s: 0.94 }, left: { x: -150, r: -5, s: 0.96 }, right: { x: 160, r: 4, s: 0.94 }, zoom: { s: 0.84, y: 30 }, fade: { y: 16 } };
  const OUT = { up: { y: -50, s: 0.95 }, left: { x: -110, r: -3, s: 0.96 }, right: { x: 120, r: 3, s: 0.95 }, zoom: { s: 1.05, y: -20 }, fade: { y: -12 } };

  function fitScreen(sc) {
    if (!deskMQ.matches) { sc.fit.style.transform = ''; return; }
    sc.fit.style.transform = '';
    const H = stage.clientHeight, W = stage.clientWidth, h = sc.fit.offsetHeight, w = sc.fit.offsetWidth;
    const s = Math.min(1, H / Math.max(1, h), W / Math.max(1, w));
    if (s < 0.999) sc.fit.style.transform = 'scale(' + s.toFixed(4) + ')';
  }
  function enter(sc, delay) {
    sc.timers.forEach(clearTimeout); sc.timers = [];
    sc.el.classList.add('on');
    fitScreen(sc);
    sc.blocks.forEach((b, i) => {
      const f = FROM[b.dataset.b] || FROM.up;
      if (reduced) { put(b, { x: 0, y: 0, s: 1, r: 0, o: 1 }); return; }
      put(b, Object.assign({ x: 0, y: 0, s: 1, r: 0 }, f, { o: 0 }));
      sc.timers.push(setTimeout(() => go(b, { x: 0, y: 0, s: 1, r: 0, o: 1 }, SPEC.stage), delay + i * 90));
    });
    sc.timers.push(setTimeout(() => sc.demo.start(), reduced ? 0 : delay + 260));
  }
  function exit(sc) {
    sc.timers.forEach(clearTimeout); sc.timers = [];
    sc.demo.stop();
    if (reduced) { sc.el.classList.remove('on'); return; }
    sc.blocks.slice().reverse().forEach((b, i) => sc.timers.push(setTimeout(() => {
      go(b, Object.assign({ x: 0, y: 0, s: 1, r: 0 }, OUT[b.dataset.b] || OUT.up, { o: 0 }), SPEC.exit, SPEC.effects);
    }, i * 35)));
    sc.timers.push(setTimeout(() => { if (active !== sc.key) sc.el.classList.remove('on'); }, 420));
  }
  let active = null;
  function activate(key) {
    if (active === key || !deskMQ.matches) return;
    const prev = active && screens[active];
    active = key;
    /* Chương đang xem sáng lên, các chương khác lùi lại; ánh nền sau sân khấu đổi tông theo chương. */
    Object.values(screens).forEach((sc) => sc.chap.classList.toggle('chap-on', sc.key === key));
    stage.dataset.tone = key;
    if (prev) exit(prev);
    enter(screens[key], prev ? 230 : 0);
  }

  let bandIO = null, stageIO = null, slotIO = null;
  function place() {
    const desk = deskMQ.matches;
    [bandIO, stageIO, slotIO].forEach((o) => o && o.disconnect());
    Object.values(screens).forEach((sc) => {
      sc.timers.forEach(clearTimeout); sc.timers = []; sc.demo.stop();
      sc.el.classList.remove('on'); sc.chap.classList.remove('chap-on');
      const target = desk ? stage : sc.slot;
      if (sc.el.parentNode !== target) target.appendChild(sc.el);
      sc.fit.style.transform = '';
      sc.blocks.forEach((b) => put(b, { x: 0, y: 0, s: 1, r: 0, o: desk ? 1 : (sc.seen || reduced ? 1 : 0) }));
    });
    active = null;
    if (desk) {
      bandIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) activate(e.target.dataset.screen); }), { rootMargin: '-45% 0px -45% 0px' });
      Object.values(screens).forEach((sc) => bandIO.observe(sc.chap));
      stageIO = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting && !active) {
          /* Chưa chương nào qua giữa màn hình: hiện chương gần nhất theo vị trí cuộn. */
          const first = Object.values(screens).find((sc) => sc.chap.getBoundingClientRect().bottom > innerHeight * 0.5) || screens.res;
          activate(first.key);
        }
      }), { threshold: 0.15 });
      stageIO.observe($('.story-stage'));
    } else {
      slotIO = new IntersectionObserver((es) => es.forEach((e) => {
        const sc = screens[e.target.dataset.key];
        if (e.isIntersecting) {
          if (!sc.seen) { sc.seen = true; enter(sc, 0); } else sc.demo.start();
        } else sc.demo.stop();
      }), { threshold: 0.22 });
      Object.values(screens).forEach((sc) => { sc.el.dataset.key = sc.key; slotIO.observe(sc.el); });
    }
  }
  place();
  deskMQ.addEventListener('change', place);
  let rT = 0;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (active) fitScreen(screens[active]); }, 120); });
  refreshers.push(() => { if (active) fitScreen(screens[active]); });

  /* ---------- Hoàn tác ---------- */
  (function ledger() {
    const lg = $('.ledger'); if (!lg) return;
    const rows = { res: $('[data-k="res"] .lg-v', lg), hz: $('[data-k="hz"] .lg-v', lg), fz: $('[data-k="fz"] .lg-v', lg) };
    const mk = (fn) => { const s = new Spring(0, 0.001, null); s.owner = owner(() => fn(s.x)); return s; };
    const sp = {
      res: mk((u) => { rows.res.textContent = Math.round(lerp(882, 1260, u)) + ' × ' + Math.round(lerp(1960, 2800, u)); }),
      hz: mk((u) => { rows.hz.textContent = Math.round(lerp(60, 120, u)) + ' Hz'; }),
      fz: mk((u) => { rows.fz.textContent = String(Math.round(lerp(10, 0, u))); }),
    };
    $$('.lg-ok', lg).forEach((c, i) => { c.style.transitionDelay = (i * 110) + 'ms'; });
    let state = 'in', auto = true;
    const set = (s) => {
      state = s; lg.dataset.state = s;
      const u = s === 'out' ? 1 : 0;
      ['res', 'hz', 'fz'].forEach((k, i) => setTimeout(() => sp[k].to(u, SPEC.smooth), reduced ? 0 : i * 110));
    };
    $('.lg-btn', lg).addEventListener('click', () => { auto = false; set(state === 'in' ? 'out' : 'in'); });
    new IntersectionObserver((es, o) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      setTimeout(() => { if (auto) set('out'); }, reduced ? 0 : 900);
    }), { threshold: 0.5 }).observe(lg);
  })();

  /* ---------- Hình khối M3 Expressive (số bước Shizuku, huy hiệu PRO): đổi dáng khi rê/chạm ---------- */
  (function shapes() {
    const DEF = [[4, 0.14, 8, 0.07, 45], [6, 0.1, 12, 0.05, 30], [9, 0.075, 4, 0.13, 40], [12, 0.055, 8, 0.085, 22]];
    const P = 120;
    const radii = (n, a) => { const r = []; const R = 48 / (1 + a); for (let i = 0; i < P; i++) r.push(R * (1 + a * Math.cos(n * (i / P) * Math.PI * 2))); return r; };
    $$('.shape').forEach((el) => {
      const def = DEF[+el.dataset.shape] || DEF[0];
      const A = radii(def[0], def[1]), B = radii(def[2], def[3]), path = $('path', el), svg = $('svg', el);
      const u = new Spring(0, 0.001, null);
      u.owner = owner(() => {
        let p = '';
        for (let i = 0; i < P; i++) {
          const t = (i / P) * Math.PI * 2, r = lerp(A[i], B[i], u.x);
          p += (i ? 'L' : 'M') + (50 + r * Math.cos(t)).toFixed(2) + ' ' + (50 + r * Math.sin(t)).toFixed(2);
        }
        path.setAttribute('d', p + 'Z');
        svg.style.transform = 'rotate(' + (u.x * def[4]).toFixed(2) + 'deg)';
      });
      u.set(0);
      const host = el.closest('.step, .plan') || el;
      host.addEventListener('pointerenter', () => u.to(1, SPEC.spatial));
      host.addEventListener('pointerleave', () => u.to(0, SPEC.spatial));
      /* fx.js gọi khi đường tiến độ chạm tới bước này: đổi dáng một nhịp rồi về. */
      el.cryoPulse = () => { u.to(1, SPEC.m3FastSpatial); setTimeout(() => { if (!host.matches(':hover')) u.to(0, SPEC.spatial); }, 520); };
    });
  })();

  /* Lớp hiệu ứng fx.js dùng chung lò xo, hình khối và trạng thái ngôn ngữ với trang. */
  window.CryoMotion = { Spring, SPEC, owner, mo, go, put, reduced, lang, refreshers, clamp, lerp, SHAPES, shapePts, morphPath, view, $, $$ };

  /* ---------- Mở đầu: một nhịp duy nhất khi tải trang ---------- */
  function intro() {
    const lines = $$('.hero-h .hl');
    const ins = $$('.hero-in'), blocks = $$('.hero-phone [data-b]');
    /* fx.js (nếu có) tách tiêu đề thành từng chữ cái và cho chúng "nở" theo trục biến thiên ngay trong sự kiện này,
       trước khi dòng chữ hiện ra; không có fx.js thì cả dòng hiện luôn. */
    d.dispatchEvent(new CustomEvent('cryo:intro'));
    lines.forEach((l) => { l.style.opacity = 1; });
    if (reduced) return;
    ins.forEach((el, j) => { put(el, { y: 16, o: 0 }); setTimeout(() => go(el, { y: 0, o: 1 }, SPEC.spatial, SPEC.fade), 380 + j * 70); });
    blocks.forEach((b, j) => {
      const f = FROM[b.dataset.b] || FROM.up;
      put(b, Object.assign({ x: 0, y: 0, s: 1, r: 0 }, f, { o: 0 }));
      setTimeout(() => go(b, { x: 0, y: 0, s: 1, r: 0, o: 1 }, SPEC.stage), 300 + j * 85);
    });
  }
  /* Điện thoại ở đầu trang nghiêng nhẹ theo chuột. */
  (function tilt() {
    const hero = $('.hero'), el = $('.hero-tilt');
    if (!hero || !el || reduced || !matchMedia('(pointer: fine)').matches) return;
    const o = owner(() => { el.style.transform = 'rotateX(' + rx.x.toFixed(2) + 'deg) rotateY(' + ry.x.toFixed(2) + 'deg)'; });
    const rx = new Spring(0, 0.01, o), ry = new Spring(0, 0.01, o);
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      ry.to(((e.clientX - r.left) / r.width - 0.5) * 9, SPEC.gentle);
      rx.to(-((e.clientY - r.top) / r.height - 0.5) * 6, SPEC.gentle);
    });
    hero.addEventListener('pointerleave', () => { rx.to(0, SPEC.gentle); ry.to(0, SPEC.gentle); });
  })();

  const fontsReady = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 900))]).then(() => {
    intro();
    root.classList.add('booted');
  });
})();
