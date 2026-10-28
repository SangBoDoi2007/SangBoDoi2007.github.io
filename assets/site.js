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
        const o = clamp(m.o.x, 0, 1);
        /* Đứng yên đúng gốc (lò xo đã dừng, hiện hẳn hoặc ẩn hẳn): bỏ transform. translate3d giữ lại sau khi bay vào xong
           biến mỗi khối thành một lớp compositor mãi mãi — đo #303: 80–120 lớp, mỗi khung có gì đổi là xếp lớp + đẩy khung
           tốn theo số lớp. Opacity vẫn ghi inline: CSS ẩn sẵn khối (.js .slot [data-b] { opacity: 0 }). */
        const rest = m.x.x === 0 && m.y.x === 0 && m.s.x === 1 && m.r.x === 0 && (o === 0 || o === 1);
        el.style.transform = rest ? '' : 'translate3d(' + m.x.x.toFixed(2) + 'px,' + m.y.x.toFixed(2) + 'px,0) scale(' + m.s.x.toFixed(4) + ') rotate(' + m.r.x.toFixed(2) + 'deg)';
        el.style.opacity = o.toFixed(3);
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
  const view = { y: scrollY, t: 0 };
  const onScroll = () => { view.y = scrollY; view.t = performance.now(); top.classList.toggle('scrolled', view.y > 24); };

  /* Việc không gấp (#303): chờ màn mở đầu chạy xong (afterIntro), rồi làm từng phần trong lúc rảnh, không chen vào lúc
     người xem đang cuộn (idleEach). Lúc tải trang luồng chính chỉ lo đúng những gì đang ở trên màn hình. */
  let introDone = false;
  const introQ = [];
  function afterIntro(fn) { if (introDone) fn(); else introQ.push(fn); }
  /* Việc đã hoãn chạy từng phần lúc rảnh, không dồn một mạch đúng lúc màn mở đầu vừa xong (đo #303: ~300 ms ở CPU ×4). */
  function finishIntro() { if (introDone) return; introDone = true; idleEach(introQ.splice(0), (f) => f()); }
  /* Không có requestIdleCallback (Safari): hẹn giờ + hạn 12 ms tự đo, để vẫn làm từng phần chứ không dồn một mạch. */
  const idleCb = window.requestIdleCallback
    ? (f) => requestIdleCallback(f, { timeout: 4000 })
    : (f) => setTimeout(() => { const end = performance.now() + 12; f({ timeRemaining: () => Math.max(0, end - performance.now()), didTimeout: false }); }, 120);
  function idleEach(list, fn, max) {
    const q = list.slice();
    const step = (dl) => {
      /* Đang cuộn (hoặc vừa cuộn < 0,4 s) thì LUÔN hoãn, kể cả khi requestIdleCallback hết hạn chờ: việc ở đây chỉ là dựng
         sẵn — phần nào thật sự cần thì đã được dựng lúc tới gần. Máy tính cuộn qua Lenis trên luồng chính nên một việc
         chen vào lúc cuộn là cú cuộn khựng ngay (#303: bản trước cho chạy sau 6 s cuộn liên tục). */
      if (performance.now() - view.t < 400) { idleCb(step); return; }
      let n = 0;
      while (q.length && n < (max || Infinity)) {
        /* Một việc hỏng không được kéo theo cả hàng đợi: báo lỗi ra ngoài rồi làm tiếp. */
        try { fn(q.shift()); } catch (err) { setTimeout(() => { throw err; }); }
        n++; if (!(dl.timeRemaining() > 8)) break;
      }
      if (q.length) idleCb(step);
    };
    if (q.length) idleCb(step);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Lenis (cuộn mượt cho con lăn chuột) nằm ngay trong trang (assets/lenis.min.js, MIT) và chỉ tải khi có chuột: trên màn
     chạm nó không làm gì (Lenis không làm mượt cú vuốt). Trước #303 nó tải từ unpkg bằng thẻ defer ĐỨNG ĐẦU chuỗi script:
     cả trang (site.js, fx.js…) phải chờ một máy chủ bên ngoài trả lời rồi mới chạy — mạng điện thoại chậm là trang đứng
     trơ, quá 3,5 s thì hiện thô không hiệu ứng. */
  let lenis = null, wakeLenis = () => {};
  function startLenis() {
    if (!window.Lenis || lenis) return;
    lenis = new window.Lenis({ lerp: 0.12, wheelMultiplier: 0.95 });
    /* Nhịp rAF của Lenis chỉ chạy khi đang cuộn: chạy mãi thì trang đứng yên vẫn đòi 60 khung/giây (đo: ~8% một nhân).
       Đánh thức thì xoá mốc thời gian cũ (lenis.time) để khung đầu không coi cả quãng nghỉ là một bước. */
    let lr = 0, still = 0;
    const tick = (t) => { lenis.raf(t); still = lenis.isScrolling ? 0 : still + 1; lr = still > 30 ? 0 : requestAnimationFrame(tick); };
    wakeLenis = () => { still = 0; if (!lr) { lenis.time = 0; lr = requestAnimationFrame(tick); } };
    ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'].forEach((ev) => addEventListener(ev, wakeLenis, { passive: true }));
    wakeLenis();
  }
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    if (window.Lenis) startLenis();
    else { const ls = d.createElement('script'); ls.src = 'assets/lenis.min.js'; ls.async = true; ls.onload = startLenis; d.head.appendChild(ls); }
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

  /* ---------- Game chạy thật trên các màn game (Polar Run, assets/polar.js) ----------
     Một nhịp rAF chung cho mọi canvas game đang chạy, tối đa ~60 khung/giây, chỉ chạy khi có màn đang hiện (start/stop của
     từng mô phỏng) — hết màn chạy thì nhịp dừng hẳn. Không có polar.js hoặc bật giảm chuyển động: giữ ảnh tĩnh như cũ. */
  const PR = window.PolarRun;
  const games = new Set();
  let gRaf = 0, gLast = 0;
  function gameTick(now) {
    gRaf = games.size ? requestAnimationFrame(gameTick) : 0;
    if (gLast && now - gLast < 15) return;
    const dt = gLast ? Math.min(0.1, (now - gLast) / 1000) : 0;
    gLast = now;
    games.forEach((g) => g.step(dt));
  }
  /* Đồng hồ của một màn game: chạy theo thời gian thật khi màn đang hiện, dừng thì giữ nguyên chỗ (mở lại chạy tiếp).
     Bắt đầu ở 12,5 s — đúng khung của ảnh chụp trang Play. Chạy = mô phỏng đang bật (run) VÀ canvas đang nằm trong khung
     nhìn: trên máy tính sân khấu dính giữ màn cuối cùng "đang bật" cả khi đã cuộn xuống cuối trang — đo #302: không chặn
     thì cuối trang vẫn vẽ game ~165 khung/giây. */
  const seenGame = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { const c = e.target.cryoClock; if (c) { c.vis = e.isIntersecting; c.sync(); } }))
    : null;
  function gameClock(paint, el) {
    const g = { t: 12.5, step(dt) { g.t += dt; paint(g.t); } };
    const c = { want: false, vis: !seenGame || !el, sync() {
      if (c.want && c.vis) { games.add(g); if (!gRaf) { gLast = 0; gRaf = requestAnimationFrame(gameTick); } } else games.delete(g);
    } };
    if (seenGame && el) { el.cryoClock = c; seenGame.observe(el); }
    return {
      get t() { return g.t; },
      run(on) { if (!PR || reduced) return; c.want = on; c.sync(); },
    };
  }
  /* Canvas game phủ lên ảnh tĩnh của màn; hiện ra từ khung vẽ đầu tiên. live() = có cần vẽ không (màn AFK phủ đen thì
     game vẫn chạy — đồng hồ vẫn tăng — nhưng không tốn công vẽ thứ không ai thấy). */
  function liveCanvas(scr, live) {
    const img = $('.game-img', scr);
    if (!PR || !img) return { run() {}, t: 0 };
    const cv = d.createElement('canvas'); cv.className = 'game-cv game-live'; cv.setAttribute('aria-hidden', 'true');
    img.after(cv);
    const ctx = cv.getContext('2d');
    return gameClock((t) => {
      if (live && !live()) return;
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (!w || !h) return;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (PR.draw(ctx, w, h, t)) cv.classList.add('on');
    }, cv);
  }
  /* Màn hình AFK của app (GameAfkBlackScreenOverlay): đen, độ sáng về 0, dòng nhắc giữa màn; chạm hai lần để mở lại,
     chạm một lần để ẩn/hiện dòng nhắc. Chữ đúng afk_hud_title / afk_hud_content của app. */
  const AFK = {
    vi: ['MÀN HÌNH AFK · GAME VẪN CHẠY', '• Chạm hai lần vào bất kỳ đâu để mở lại màn hình', '• ĐỪNG bấm nút nguồn: máy sẽ ngủ và game bị dừng', '• Chạm một lần để ẩn hoặc hiện dòng này'],
    en: ['AFK SCREEN · GAME STILL RUNNING', '• Double-tap anywhere to bring the screen back', '• Do NOT press the power button: the phone sleeps and the game stops', '• Tap once to show or hide this note'],
  };
  function afkLayer(scr, onWake) {
    let el = $('.afk', scr);
    if (!el) { el = d.createElement('div'); el.className = 'afk'; el.setAttribute('aria-hidden', 'true'); scr.appendChild(el); }
    const fill = () => { const t = AFK[lang()]; el.innerHTML = '<div class="afk-hud"><b>' + t[0] + '</b><span>' + t.slice(1).join('<br>') + '</span></div>'; };
    fill(); refreshers.push(fill);
    let last = 0, one = 0;
    const wake = () => { clearTimeout(one); scr.classList.remove('afk-on'); el.classList.remove('bare'); if (onWake) onWake(); };
    el.addEventListener('pointerup', () => {
      const t = performance.now();
      if (t - last < 320) { last = 0; wake(); return; }
      last = t; clearTimeout(one);
      one = setTimeout(() => el.classList.toggle('bare'), 330);
    });
    return { show() { scr.classList.add('afk-on'); }, hide: wake };
  }

  /* ---------- Mô phỏng 1: độ phân giải kết xuất ---------- */
  /* Ảnh tĩnh của màn game: vẽ khi chưa (hoặc không) có game chạy thật. Trước #303 tạo ngay lúc tải và drawImage bắt luồng
     chính giải mã ảnh 1600×720 giữa lúc trang đang dựng; nay chỉ tạo khi mô phỏng được dựng (tới gần) và giải mã trước
     bằng decode() — cùng địa chỉ với <img class="game-img"> nên không tải thêm. */
  let polar = null;
  const stillImage = (onReady) => {
    if (!polar) { polar = new Image(); polar.decoding = 'async'; polar.src = 'assets/polar.webp'; }
    const go = () => (polar.decode ? polar.decode() : Promise.resolve()).catch(() => {}).then(onReady);
    if (polar.complete && polar.naturalWidth) go(); else polar.addEventListener('load', go, { once: true });
  };

  function resDemo(sc) {
    const scr = $('.scr', sc), cv = $('.game-cv', sc), ctx = cv.getContext('2d');
    const lc = $('.loupe canvas', sc), lctx = lc.getContext('2d'), pillT = $('.g-pill-t', sc), pill = $('.g-pill', sc);
    const input = $('input[type="range"]', sc), slider = $('.a-slider', sc), card = $('.res-card', sc);
    const numEl = $('.res-num', sc), dimEl = $('.res-dim', sc), presets = $('.res-presets', sc), bubble = $('.sl-val b', sc);
    const pBtns = $$('button', presets), sw = $('[data-sw="res-on"]', sc);
    const off = d.createElement('canvas'), octx = off.getContext('2d');
    let val = 70, on = true, mode = 'buffer', shown = false, touched = false;

    /* Thanh trượt M3 Expressive: rãnh sau tay cầm tính từ --p trong CSS, chấm dừng ẩn khi tay cầm chạm cuối.
       Rãnh đã chọn vẽ bằng SVG: đứng yên là dải dày phẳng như M3; ĐANG GIỮ/KÉO thì dải mảnh lại và uốn thành sóng sin đều
       trôi liên tục (kiểu thanh trượt sóng của Google), thả tay thì êm về phẳng. User #302 bỏ bản "con giun" lò xo: "chỉ
       uốn lượn gấp cong như của google khi kéo và giữ". Vòng rAF chỉ chạy lúc đang giữ hoặc sóng chưa tắt hẳn. */
    const NS = 'http://www.w3.org/2000/svg';
    const wsvg = d.createElementNS(NS, 'svg'), wpath = d.createElementNS(NS, 'path'), wcap = d.createElementNS(NS, 'circle');
    wsvg.setAttribute('class', 'sl-wave'); wsvg.setAttribute('aria-hidden', 'true'); wsvg.append(wpath, wcap);
    slider.insertBefore(wsvg, slider.firstChild);
    slider.classList.add('wv');
    let slW = 0, slH = 0, em = 16, phase = 0, waveRaf = 0, waveT = 0, held = false;
    const measureSl = () => {
      slW = slider.clientWidth; slH = slider.clientHeight; em = parseFloat(getComputedStyle(slider).fontSize) || 16;
      wsvg.setAttribute('viewBox', '0 0 ' + slW + ' ' + slH);
    };
    /* Đầu phải của rãnh đã chọn (px), đúng công thức của .sl-act trong CSS. */
    const trackEnd = (p) => { const hw = (slider.classList.contains('drag') ? 0.125 : 0.25) * em; return Math.max(0, p * (slW - hw) - 0.375 * em); };
    function drawTrack() {
      if (!slW) measureSl();
      const L = trackEnd(clamp(thumb.x, 0, 1)), cy = slH / 2, a = clamp(amp.x, 0, 1);
      if (L < 0.5) { wpath.setAttribute('d', ''); wcap.setAttribute('r', '0'); return; }
      /* Sóng: bước sóng 2,4em, biên độ 0,3em, nét từ 1em (phẳng) xuống 0,42em; hai đầu thu biên độ về 0 trong nửa bước sóng
         để đầu dải tròn trịa và chỗ chạm tay cầm nằm đúng giữa. */
      const lam = 2.4 * em, A = 0.3 * em * a, th = lerp(em, 0.42 * em, a);
      const x0 = Math.min(th / 2, L / 2);
      const y = a < 0.001 ? () => 0
        : (x) => A * Math.max(0, Math.min(1, (x - x0) / (0.5 * lam), (L - x) / (0.5 * lam))) * Math.sin((x / lam) * Math.PI * 2 - phase);
      let p = 'M' + x0.toFixed(1) + ' ' + (cy + y(x0)).toFixed(2);
      if (a < 0.001) p += 'L' + L.toFixed(1) + ' ' + cy.toFixed(2);
      else for (let x = x0 + 2; ; x += 2) { const xx = Math.min(x, L); p += 'L' + xx.toFixed(1) + ' ' + (cy + y(xx)).toFixed(2); if (xx >= L) break; }
      wpath.setAttribute('d', p); wpath.setAttribute('stroke-width', th.toFixed(2));
      wcap.setAttribute('cx', x0.toFixed(1)); wcap.setAttribute('cy', (cy + y(x0)).toFixed(2)); wcap.setAttribute('r', (Math.min(th, L) / 2).toFixed(2));
    }
    /* Sóng trôi sang phải một bước sóng mỗi 0,9 s khi đang giữ; lúc tắt dần vẫn trôi cho tới khi phẳng hẳn. */
    const waveLoop = (now) => {
      const dt = waveT ? Math.min(0.05, (now - waveT) / 1000) : 0; waveT = now;
      phase += dt * Math.PI * 2 / 0.9;
      drawTrack();
      waveRaf = held || amp.x > 0.002 ? requestAnimationFrame(waveLoop) : 0;
      if (!waveRaf) { waveT = 0; drawTrack(); }
    };
    const sl = owner(() => {
      /* Lò xo nảy qua hai đầu thì tay cầm cũng không được vọt ra ngoài rãnh. */
      const p = clamp(thumb.x, 0, 1);
      slider.style.setProperty('--p', p.toFixed(4));
      slider.classList.toggle('at-end', p > 0.985);
      if (!waveRaf) drawTrack();
    });
    const thumb = new Spring(0.571, 0.0005, sl);
    const amp = new Spring(0, 0.002, owner(() => { if (!waveRaf) drawTrack(); }));
    const hold = (on) => {
      held = on && !reduced;
      amp.to(held ? 1 : 0, SPEC.m3SlowEffects);
      if (held && !waveRaf) { waveT = 0; waveRaf = requestAnimationFrame(waveLoop); }
    };
    const snap = () => { measureSl(); drawTrack(); };
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (slider.clientWidth && slider.clientWidth !== slW) snap(); }).observe(slider);
    /* Đồng hồ game đang chạy thì nó vẽ mỗi khung rồi — lò xo tỉ lệ không vẽ thêm lần nữa. */
    let clockOn = false;
    const eff = new Spring(0.7, 0.0008, owner(() => { if (!clockOn) draw(); }));
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
    /* Game chạy thật: mỗi khung vẽ Polar Run thẳng vào khung THẤP (lw × lh) rồi phóng lên — đúng cách bộ đệm game được
       hạ: game dựng hình ở ít điểm ảnh hơn, hệ thống phóng lên đầy màn. Chưa có polar.js thì dùng ảnh tĩnh như cũ. */
    const clock = gameClock(() => draw(), cv);
    if (PR) PR.onReady(() => draw());
    function draw() {
      const live = PR && PR.ready() && !reduced;
      if ((!live && (!polar || !polar.complete || !polar.naturalWidth)) || !cv.clientWidth) return;
      sizeCanvas();
      const W = cv.width, H = cv.height, s = clamp(eff.x, 0.2, 1);
      const lw = Math.max(16, Math.round(W * s)), lh = Math.max(8, Math.round(H * s));
      if (off.width !== lw || off.height !== lh) { off.width = lw; off.height = lh; }
      octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
      if (live) PR.draw(octx, lw, lh, clock.t); else octx.drawImage(polar, 0, 0, lw, lh);
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
    input.addEventListener('pointerdown', () => { slider.classList.add('drag'); hold(true); });
    const lift = () => { if (!held && !slider.classList.contains('drag')) return; slider.classList.remove('drag'); hold(false); };
    addEventListener('pointerup', lift); addEventListener('pointercancel', lift);
    pBtns.forEach((b) => b.addEventListener('click', () => { touched = true; setVal(+b.dataset.v); }));
    sw.addEventListener('sw', (e) => { on = e.detail; card.classList.toggle('off', !on); setVal(val); });
    segInit($('.seg-demo', sc), 'mode', (m) => { mode = m; scr.classList.toggle('full', m === 'full'); setVal(val); draw(); });
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(cv);
    /* Ảnh tĩnh vẽ trước trong lúc atlas game chưa sẵn (hoặc tải hỏng); có game thì game thay ngay khung sau. */
    stillImage(draw);
    refreshers.push(() => setVal(val));
    setVal(70);
    return {
      start() {
        clock.run(true); clockOn = !!PR && !reduced;
        draw();
        if (shown || reduced) return;
        shown = true;
        /* Lần đầu: từ 100% hạ xuống 70% để thấy điểm ảnh thưa đi. */
        eff.set(1); thumb.set(1); snap(); numEl.textContent = '100'; dimEl.textContent = dims(100);
        pBtns.forEach((b, j) => b.classList.toggle('sel', j === 4)); presets.style.setProperty('--i', 4);
        setTimeout(() => { if (!touched) setVal(70); }, 700);
      },
      stop() { clock.run(false); clockOn = false; },
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
  /* Cửa sổ nổi dựng lại theo ui/widget/FloatingWidgetOverlay.kt của app (#302, user: "đầy đủ chi tiết như app thật"):
     thu gọn = các chỉ số ghim (số đậm 16sp + đơn vị 10sp màu chủ đề, cách nhau "·"); chạm hàng đầu → mở rộng: trạng thái hạ
     độ phân giải + tên game, biểu đồ 1 phút (chạm tiêu đề để đổi CPU / GPU / nhiệt pin), bảng CPU · GPU · RAM · PIN, nút
     TẮT MH và ⚡ TỐI ƯU. Cửa sổ nhảy thẳng tới cỡ mới, khối chi tiết mờ dần vào 160 ms, biểu đồ chỉ vẽ lại theo nhịp đọc —
     đúng như app. Số định dạng như app: chữ số dấu chấm (Locale.US), nhiệt và phần trăm làm tròn, RAM là phần ĐÃ DÙNG.
     KHÔNG có số FPS (luật trang Play — lần gửi 74–77 bị từ chối vì số FPS trên ảnh): ghim chỉ số không gồm FPS, còn hàng
     đầu lúc mở rộng (app chỉ đặt FPS ở đó) hiện đúng thứ app hiện khi chưa có số FPS: chữ "Cryo"; không Shizuku thì
     "FPS cần Shizuku". */
  const OVT = {
    vi: { col: 'Thu gọn', hint: 'cần Shizuku', focus: '❄ Focus · 10 app L2', buf: 'Bộ đệm game: 70%', nat: 'Gốc (100%)', bat: 'PIN',
      pct: (a, b) => 'TB ' + a + '% · cao nhất ' + b + '%', deg: (a, b) => 'TB ' + a + '° · cao nhất ' + b + '°', start: '1 phút trước', now: 'bây giờ',
      afk: 'TẮT MH', opt: '⚡ TỐI ƯU', done: '✓ XONG', noshz: 'Chưa kích hoạt Shizuku', expand: 'Mở rộng cửa sổ theo dõi', collapse: 'Thu gọn cửa sổ theo dõi' },
    en: { col: 'Collapse', hint: 'needs Shizuku', focus: '❄ Focus · 10 apps L2', buf: 'Game buffer: 70%', nat: 'Full resolution (100%)', bat: 'BAT',
      pct: (a, b) => 'avg ' + a + '% · peak ' + b + '%', deg: (a, b) => 'avg ' + a + '° · peak ' + b + '°', start: '1 min ago', now: 'now',
      afk: 'SCREEN OFF', opt: '⚡ OPTIMIZE', done: '✓ DONE', noshz: 'Shizuku Not Active', expand: 'Expand the floating monitor', collapse: 'Collapse the floating monitor' },
  };
  const SVG = {
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" stroke-width="2.4"/></svg>',
    sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 1-14.64 6.36L3 15M3 12a9 9 0 0 1 14.64-6.36L21 9M21 4v5h-5M3 20v-5h5" stroke-width="2"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM9 9l6 6M15 9l-6 6" stroke-width="2"/></svg>',
    grip: '<svg viewBox="0 0 11 11" aria-hidden="true"><path d="M5.5 10.45L10.45 5.5M1.3 10.45L10.45 1.3" stroke-width="1.5"/></svg>',
  };
  function monDemo(sc) {
    const scr = $('.scr', sc), ov = $('.ov', sc), card = $('.mon-card', sc);
    const mRam = $('.m-ram', card), mUsed = $('.m-used', card), mCpu = $('.m-cpu', card), mBat = $('.m-bat', card);
    const ringFg = $('.ring-fg', card), ringBg = $('.ring-bg', card);
    const N = 40;
    const game = liveCanvas(scr, () => !scr.classList.contains('afk-on'));
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
    /* Số đo giả lập (chạy quanh mức của Polar Run trên máy đo): ghz/mhz/nhiệt chip đi theo tải. */
    const st = { cpu: 18, gpu: 41, ram: 5.6, bat: 35.9, ghz: 1.82, mhz: 443, ct: 46, gt: 43 };
    const mk = (tile, v0, lo, hi, jit) => {
      const el = $('[data-tile="' + tile + '"]', card);
      const hist = []; let v = v0;
      for (let i = 0; i < N; i++) { v = clamp(v + (Math.random() - 0.5) * jit, lo, hi); hist.push(v); }
      const head = new Spring(v0, 0.001, null);
      return { el, line: $('.ch-line', el), area: $('.ch-area', el), dot: $('.ch-dot', el), min: +$('.chart', el).dataset.min, max: +$('.chart', el).dataset.max, hist, head };
    };
    const charts = { cpu: mk('cpu', 18, 8, 42, 9), bat: mk('bat', 35.9, 35.3, 36.4, 0.12),
      gpu: mk('gpu', 41, 26, 66, 12), ct: mk('ct', 46, 42, 52, 0.8), gt: mk('gt', 43, 40, 48, 0.6) };
    ['gpu', 'ct', 'gt'].forEach((k) => { charts[k].more = true; });
    const mGpu = $('.m-gpu', card), mCt = $('.m-ct', card), mGt = $('.m-gt', card);
    /* "Chi tiết" / "Thu gọn" như app: phần xổ ra cao theo lò xo (mở nảy, đóng êm); máy tính co sân khấu cho vừa. */
    const mx = $('.mon-x', card), mxi = $('.mon-xi', card), tog = $('.mon-tog', card);
    let more = false;
    const hx = new Spring(0, 0.3, owner(() => { mx.style.height = Math.max(0, hx.x).toFixed(1) + 'px'; }));
    const TOG = { vi: ['Chi tiết', 'Thu gọn'], en: ['Details', 'Show less'] };
    const togText = () => { tog.innerHTML = '<span lang="vi">' + TOG.vi[+more] + '</span><span lang="en">' + TOG.en[+more] + '</span>'; };
    tog.addEventListener('click', () => {
      more = !more; card.classList.toggle('more', more); tog.setAttribute('aria-expanded', String(more)); togText();
      const H = mxi.offsetHeight, gap = parseFloat(getComputedStyle(mxi).rowGap) || 0;
      hx.to(more ? H : 0, more ? { z: 0.62, k: 380 } : SPEC.exit);
      refit(sc, more ? H + gap - mx.offsetHeight : -mx.offsetHeight - gap);
      if (more) for (const k in charts) drawChart(charts[k]);
    });
    /* Đổi ngôn ngữ / đổi cỡ lúc đang mở: chữ xuống dòng khác → chiều cao theo nội dung mới (khi lò xo đã đứng). */
    if ('ResizeObserver' in window) new ResizeObserver(() => {
      if (more && Math.abs(hx.x - hx.t) < 0.5 && Math.abs(hx.v) < 1 && Math.abs(mxi.offsetHeight - hx.t) > 0.5) hx.set(mxi.offsetHeight);
    }).observe(mxi);
    /* Lịch sử 1 phút cho biểu đồ của cửa sổ nổi (app: TelemetryTrail) — cùng số với thẻ bên cạnh, thêm GPU. */
    const trail = { cpu: charts.cpu.hist.slice(), gpu: [], bat: charts.bat.hist.slice() };
    { let v = 41; for (let i = 0; i < N; i++) { v = clamp(v + (Math.random() - 0.5) * 12, 26, 66); trail.gpu.push(v); } }
    let phase = 0, lastT = 0, loopId = 0, tickId = 0, running = false;
    const dx = 100 / (N - 1);

    /* ---- Cửa sổ nổi ---- */
    let open = false, shz = true, metric = 'cpu', optBusy = 0, toastT = 0;
    const r0 = (v) => Math.round(v);
    function pillHtml(t) {
      const m = (v, u) => '<span class="ov-m"><span class="ov-v">' + v + '</span><span class="ov-u"> ' + u + '</span></span>';
      const used = (11 - st.ram).toFixed(1), out = [];
      if (shz) out.push(m(r0(st.cpu) + '%', 'CPU'), m(r0(st.gpu) + '%', 'GPU'));
      /* Đơn vị nhiệt pin trên pill là chữ "PIN" viết cứng trong app (pillEntry), cả khi app chạy tiếng Anh. */
      out.push(m(used, 'GB'), m(r0(st.bat) + '°', 'PIN'));
      return out.join('<span class="ov-sep" aria-hidden="true">·</span>');
    }
    function renderOv() {
      const t = OVT[lang()];
      head.innerHTML = '<span class="ov-dot"></span>' + (open
        ? (shz ? '<span class="ov-name">Cryo</span>' : '<span class="ov-hint"><span class="ov-u">FPS</span><span> ' + t.hint + '</span></span>') +
          '<i class="ov-fill"></i><span class="ov-col">' + SVG.up + t.col + '</span>'
        : pillHtml(t)) + '<i class="ov-end"></i>';
      head.setAttribute('aria-expanded', String(open));
      head.setAttribute('aria-label', open ? t.collapse : t.expand);
      chip.textContent = shz ? t.focus : '';
      if (!open) return;
      ds.innerHTML = '<span class="ov-sdot" style="background:' + (shz ? '#10b981' : 'var(--on-surface-v)') + '"></span><span style="color:' +
        (shz ? '#10b981' : 'var(--on-surface-v)') + '">' + (shz ? t.buf : t.nat) + '</span>';
      // Bảng: hàng nào có mặt theo khả năng đọc của máy, không theo giá trị.
      const used = 11 - st.ram, rows = [];
      if (shz) {
        rows.push(['CPU', r0(st.cpu) + '%', st.ghz.toFixed(2) + ' GHz', r0(st.ct) + '°']);
        rows.push(['GPU', r0(st.gpu) + '%', st.mhz + ' MHz', r0(st.gt) + '°']);
      }
      rows.push(['RAM', r0(used / 11 * 100) + '%', used.toFixed(1) + ' GB', '']);
      rows.push([t.bat, r0(st.bat) + '°', '', '']);
      const cols = shz ? 4 : 3;
      tb.style.gridTemplateColumns = '1fr' + ' minmax(calc(34 * var(--dp)), max-content)'.repeat(cols - 1);
      tb.innerHTML = rows.map((r, i) => r.slice(0, cols).map((v, k) => '<span class="' + (k ? '' : 'l') + (i ? ' r' : '') + '">' + v + '</span>').join('')).join('');
      afkB.innerHTML = SVG.off + t.afk;
      if (!optBusy) optB.textContent = t.opt;
      drawPlot();
    }
    /* Biểu đồ 1 phút (TrendChart): lưới 0/50/100 (nhiệt pin 20–50), vạch giữa, nhãn "1 phút trước … bây giờ", vùng tô
       nhạt dần, chấm ở đầu mới nhất. Vẽ lại theo nhịp đọc, không chạy theo khung hình. */
    function drawPlot() {
      const t = OVT[lang()], avail = shz ? ['cpu', 'gpu', 'bat'] : ['bat'];
      if (avail.indexOf(metric) < 0) metric = avail[0];
      const s = trail[metric], lo0 = Math.min.apply(null, s), hi0 = Math.max.apply(null, s), avg = r0(s.reduce((a, b) => a + b, 0) / s.length);
      const temp = metric === 'bat';
      const range = temp ? [lo0 - 2 < 20 ? Math.floor((lo0 - 2) / 5) * 5 : 20, hi0 + 2 > 50 ? Math.ceil((hi0 + 2) / 5) * 5 : 50] : [0, 100];
      const ticks = temp ? [range[0], (range[0] + range[1]) / 2, range[1]] : [0, 50, 100];
      cht.innerHTML = '<span>' + (temp ? t.bat + ' °C' : metric.toUpperCase()) + '</span>' + (avail.length > 1 ? SVG.sync : '') +
        '<b class="' + ((temp ? hi0 >= 42 : hi0 >= 90) ? 'warn' : '') + '">' + (temp ? t.deg(avg, r0(hi0)) : t.pct(avg, r0(hi0))) + '</b>';
      cht.disabled = avail.length < 2;
      const dpr = Math.min(2, devicePixelRatio || 1), W = plot.clientWidth, H = plot.clientHeight;
      if (!W || !H) return;
      if (plot.width !== Math.round(W * dpr)) { plot.width = Math.round(W * dpr); plot.height = Math.round(H * dpr); }
      /* Canvas cao đúng 54 dp (40 dp vẽ + trục) → unit = số điểm ảnh CSS của 1 dp. Màu đọc từ biến chủ đề (mã hex). */
      const c = plot.getContext('2d'), cs = getComputedStyle(ov), unit = H / 54;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      const prim = cs.getPropertyValue('--primary').trim(), onv = cs.getPropertyValue('--on-surface-v').trim(), outl = cs.getPropertyValue('--outline').trim();
      const rgba = (hx, a) => { const n = parseInt(hx.replace('#', ''), 16) || 0; return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
      c.font = '700 ' + (8 * unit) + 'px ' + getComputedStyle(d.body).fontFamily;
      c.textBaseline = 'middle';
      const axisH = 12 * unit, plotBottom = H - axisH, bottom = plotBottom - 0.5 * unit;
      const left = Math.max.apply(null, ticks.map((v) => c.measureText(String(v)).width)) + 4 * unit, topY = 5 * unit, width = W - left;
      const y = (v) => bottom - (bottom - topY) * clamp((v - range[0]) / (range[1] - range[0]), 0, 1);
      c.lineWidth = 1 * unit; c.strokeStyle = rgba(outl, 0.22);
      c.fillStyle = rgba(onv, 0.8);
      ticks.forEach((v, k) => {
        const ty = y(v);
        c.setLineDash(k ? [2 * unit, 3 * unit] : []);
        c.beginPath(); c.moveTo(left, ty); c.lineTo(W, ty); c.stroke();
        c.fillText(String(v), 0, ty);
      });
      const mid = W - width / 2;
      c.setLineDash([2 * unit, 3 * unit]); c.beginPath(); c.moveTo(mid, topY); c.lineTo(mid, bottom); c.stroke(); c.setLineDash([]);
      c.textBaseline = 'top';
      if (c.measureText(t.start).width + c.measureText(t.now).width + 6 * unit <= width) {
        c.fillText(t.start, left, bottom + 2 * unit);
        c.fillText(t.now, W - c.measureText(t.now).width, bottom + 2 * unit);
      }
      const px = (i) => left + (i / (N - 1)) * width;
      c.save(); c.beginPath(); c.rect(left, 0, width, H); c.clip();
      const g = c.createLinearGradient(0, 0, 0, plotBottom);
      g.addColorStop(0, rgba(prim, 0.28)); g.addColorStop(1, rgba(prim, 0));
      c.beginPath(); c.moveTo(px(0), bottom); s.forEach((v, i) => c.lineTo(px(i), y(v))); c.lineTo(px(N - 1), bottom); c.closePath();
      c.fillStyle = g; c.fill();
      c.beginPath(); s.forEach((v, i) => (i ? c.lineTo(px(i), y(v)) : c.moveTo(px(i), y(v))));
      c.strokeStyle = prim; c.lineWidth = 1.5 * unit; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
      c.restore();
      c.fillStyle = prim; c.beginPath(); c.arc(W, y(s[N - 1]), 2 * unit, 0, Math.PI * 2); c.fill();
    }
    ov.innerHTML = '<div class="ov-head" role="button" tabindex="0"></div><div class="ov-chip"></div>' +
      '<div class="ov-x"><div class="ov-hr"></div><div class="ov-ds"></div><span class="ov-game">Polar Run</span>' +
      '<div class="ov-ch"><button type="button" class="ov-cht"></button><canvas class="ov-plot" aria-hidden="true"></canvas></div>' +
      '<div class="ov-tb"></div><div class="ov-hr" style="margin-top:calc(8 * var(--dp))"></div>' +
      '<div class="ov-btns"><button type="button" class="ov-afk"></button><button type="button" class="ov-opt"></button></div></div>' +
      '<span class="ov-grip">' + SVG.grip + '</span>';
    const head = $('.ov-head', ov), chip = $('.ov-chip', ov), ds = $('.ov-ds', ov), cht = $('.ov-cht', ov), plot = $('.ov-plot', ov);
    const tb = $('.ov-tb', ov), afkB = $('.ov-afk', ov), optB = $('.ov-opt', ov);
    const toast = d.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); scr.appendChild(toast);
    const say = (msg) => { toast.textContent = msg; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 2000); };
    /* Màn hình AFK của app (GameAfkBlackScreenOverlay): đen, dòng nhắc; chạm hai lần để mở lại, chạm một lần ẩn/hiện nhắc. */
    const afk = afkLayer(scr);
    function toggle() {
      open = !open; ov.classList.toggle('open', open); renderOv();
      /* App: cửa sổ nằm yên chỗ cũ, cỡ mới vượt mép thì dời vào trong màn hình. */
      fitInside();
    }
    function fitInside() {
      const r = scr.getBoundingClientRect(), o = ov.getBoundingClientRect();
      if (!r.width) return;
      /* Chỉ dời khi thật sự vượt mép, theo ĐÍCH của lò xo — không cắt ngang cú trượt bám mép đang chạy. */
      const nx = clamp(px.t, 0.01, Math.max(0.01, 0.99 - o.width / r.width)), ny = clamp(py.t, 0.02, Math.max(0.02, 0.98 - o.height / r.height));
      if (nx !== px.t) px.to(nx, SPEC.spatial);
      if (ny !== py.t) py.to(ny, SPEC.spatial);
    }
    head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    cht.addEventListener('click', () => { const a = shz ? ['cpu', 'gpu', 'bat'] : ['bat']; metric = a[(a.indexOf(metric) + 1) % a.length]; drawPlot(); });
    afkB.addEventListener('click', () => afk.show());
    optB.addEventListener('click', () => {
      const t = OVT[lang()];
      if (!shz) { say(t.noshz); return; }
      if (optBusy) return;
      optBusy = 1; optB.disabled = true; optB.textContent = '⏳ …';
      setTimeout(() => { optB.textContent = OVT[lang()].done; }, 1200);
      setTimeout(() => { optBusy = 0; optB.disabled = false; optB.textContent = OVT[lang()].opt; }, 3200);
    });

    function render() {
      mRam.textContent = num(st.ram, 1);
      mUsed.textContent = num(11 - st.ram, 1) + ' / ' + num(11, 1) + ' GB';
      mCpu.textContent = Math.round(st.cpu);
      mBat.textContent = num(st.bat, 1);
      mGpu.textContent = Math.round(st.gpu);
      mCt.textContent = num(st.ct, 1);
      mGt.textContent = num(st.gt, 1);
      ringP.to(st.ram / 11, SPEC.m3Spatial);
      renderOv();
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
      /* Ô của phần "Chi tiết" chỉ vẽ khi đang mở (đóng thì nằm khuất, vẽ là phí). */
      for (const k in charts) { const c = charts[k]; c.head.x += (c.head.t - c.head.x) * Math.min(1, dt * 6); if (more || !c.more) drawChart(c); }
      wave = (wave + dt * 2.6) % (Math.PI * 2);
      drawRing();
      loopId = requestAnimationFrame(frame);
    }
    function tick() {
      st.cpu = clamp(st.cpu + (Math.random() - 0.5) * 10, 9, 41);
      st.gpu = clamp(st.gpu + (Math.random() - 0.5) * 12, 26, 66);
      st.ram = clamp(st.ram + (Math.random() - 0.5) * 0.16, 5.3, 5.9);
      st.bat = clamp(st.bat + (Math.random() - 0.35) * 0.12, 35.4, 36.4);
      st.ghz = clamp(0.96 + st.cpu / 41 * 1.45 + (Math.random() - 0.5) * 0.2, 0.96, 2.42);
      st.mhz = [315, 443, 545, 660][clamp(Math.round(st.gpu / 22) - 1, 0, 3)];
      st.ct = clamp(st.ct + (st.cpu - 25) * 0.03 + (Math.random() - 0.5) * 0.6, 42, 52);
      st.gt = clamp(st.gt + (st.gpu - 45) * 0.02 + (Math.random() - 0.5) * 0.5, 40, 48);
      for (const k in charts) { const c = charts[k]; c.hist.shift(); c.hist.push(c.head.x); c.head.t = st[k]; }
      for (const k in trail) { trail[k].shift(); trail[k].push(st[k]); }
      phase = 0;
      render();
    }
    /* Kéo cửa sổ: thả ra thì bám vào mép trái hoặc phải gần nhất (app nhớ vị trí theo mép). Chạm (không kéo) vào hàng đầu
       thì thu gọn / mở rộng như app; nút bên trong thì bấm như nút. */
    const pos = owner(() => { ov.style.left = (px.x * 100).toFixed(3) + '%'; ov.style.top = (py.x * 100).toFixed(3) + '%'; });
    const px = new Spring(0.03, 0.0005, pos), py = new Spring(0.26, 0.0005, pos);
    let drag = null;
    ov.addEventListener('dragstart', (e) => e.preventDefault());
    ov.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      /* Không chặn mặc định thì Chrome coi là kéo-thả gốc và huỷ con trỏ ngay nhịp di chuyển đầu. */
      e.preventDefault();
      const r = scr.getBoundingClientRect(), o = ov.getBoundingClientRect();
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, onHead: !!e.target.closest('.ov-head'),
        ox: (e.clientX - o.left) / r.width, oy: (e.clientY - o.top) / r.height, w: o.width / r.width, h: o.height / r.height };
      ov.setPointerCapture(e.pointerId);
    });
    ov.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.moved = true; ov.classList.add('drag');
      const r = scr.getBoundingClientRect();
      px.set(clamp((e.clientX - r.left) / r.width - drag.ox, 0.01, Math.max(0.01, 0.99 - drag.w)));
      py.set(clamp((e.clientY - r.top) / r.height - drag.oy, 0.02, Math.max(0.02, 0.98 - drag.h)));
    });
    const end = (e) => {
      if (!drag) return;
      const g = drag; drag = null; ov.classList.remove('drag');
      if (!g.moved) { if (g.onHead && e.type === 'pointerup') toggle(); return; }
      px.to(px.x + g.w / 2 < 0.5 ? 0.03 : 0.97 - g.w, SPEC.spatial);
    };
    ov.addEventListener('pointerup', end); ov.addEventListener('pointercancel', end);
    segInit($('.seg-demo', sc), 'shz', (v) => { shz = v !== '0'; ov.classList.toggle('noshz', !shz); card.classList.toggle('noshz', !shz); render(); fitInside(); });
    refreshers.push(render);
    render();
    for (const k in charts) drawChart(charts[k]);
    return {
      start() {
        game.run(true);
        if (running) return;
        running = true; lastT = 0;
        if (!reduced) loopId = requestAnimationFrame(frame);
        tickId = setInterval(() => { tick(); if (reduced) for (const k in charts) { charts[k].head.x = charts[k].head.t; drawChart(charts[k]); } }, 1000);
      },
      stop() { game.run(false); running = false; cancelAnimationFrame(loopId); clearInterval(tickId); },
    };
  }

  /* ---------- Mô phỏng 4: trong lúc chơi ---------- */
  /* Mỗi công tắc có phản hồi thấy được trên màn game (#302, user: bấm vào "chẳng thấy hiện tượng gì, như bị gì đó"), đúng
     cơ chế, không hứa hẹn số:
     - ô biểu tượng của hàng nảy lên một nhịp; một dòng báo ngắn trên màn game nói công tắc vừa làm gì;
     - Focus Mode bật: lớp băng giá lướt qua mép màn (app nền bị đóng băng);
     - Không làm phiền TẮT: tin nhắn, email, cuộc gọi rơi xuống đè lên game vài giây một lần — đúng thứ chế độ này chặn;
       BẬT lại: thông báo đang hiện bị thu về và không còn cái nào nữa;
     - Wi-Fi / 60 Hz: biểu tượng trong dòng báo chạy một nhịp (sóng Wi-Fi lan ra, vòng làm mới quay). */
  const PLAY = {
    vi: { focus: ['App nền được đóng băng khi game mở', 'App nền chạy như thường'], hz: ['Màn hình giữ ở 60 Hz', 'Về tần số quét mặc định'],
      dnd: ['Cuộc gọi và thông báo được tắt tiếng', 'Thông báo hiện lại như thường'], wifi: ['Wi-Fi độ trễ thấp đang bật', 'Wi-Fi về chế độ thường'],
      now: 'bây giờ', hu: [['chat', 'Tin nhắn', 'Lan: Tối nay chơi tiếp không?'], ['mail', 'Email', 'Bạn có 3 thư mới'], ['call', 'Điện thoại', 'Cuộc gọi đến · Minh']] },
    en: { focus: ['Background apps freeze while the game is open', 'Background apps run as usual'], hz: ['Display held at 60 Hz', 'Default refresh rate is back'],
      dnd: ['Calls and notifications silenced', 'Notifications show as usual'], wifi: ['Low-latency Wi-Fi on', 'Wi-Fi back to normal mode'],
      now: 'now', hu: [['chat', 'Messages', 'Lan: Another round tonight?'], ['mail', 'Email', 'You have 3 new emails'], ['call', 'Phone', 'Incoming call · Minh']] },
  };
  const PLAY_IC = { focus: ['ac_unit', 'flight'], hz: ['sync', 'sync'], dnd: ['notifications_off', 'notifications_active'], wifi: ['wifi', 'wifi'] };
  /* Nhật ký "Cryo vừa chạy": tiêu đề (h), lệnh shell (c) / lời gọi API hệ thống (a) đúng như mã app, dòng hệ thống trả về
     (o), ghi chú (n), kết luận từ phép ĐỌC LẠI trạng thái (k) — app không tin mã thoát, nó đọc lại OS. Nguồn:
     Focus = AppControlRepository.killCommands/lockdownCommands + bản rã đông; 60 Hz = Gpu3DRenderScaler.applyFpsCapOnDevice
     (+ readPanelFrameRateHz) và SystemStateGuard.restoreSystem; Không làm phiền = CryoZenRule; Wi-Fi = WifiLowLatency
     (LOCK_TAG "cryo-ll-game", WorkSource = uid game); AFK = OverlayMonitorService (một cửa sổ đen, screenBrightness 0).
     uid và tên gói là ví dụ. Cố ý KHÔNG có số ping/FPS: app không đo ping, lợi của Wi-Fi tuỳ chip (memory
     project_wifi_low_latency) — hiện "ping giảm" là hứa một con số không có thật. */
  const PKG = 'com.zing.zalo', UID = 10231;
  const PLAY_LOG = {
    vi: {
      start: [['h', '# Polar Run vừa mở → áp các thiết lập đang bật']],
      focus: [
        [['h', '# Focus Mode · mức L2 · 10 app nền'], ['c', 'am force-stop --user 0 ' + PKG], ['c', 'am set-inactive --user 0 ' + PKG + ' true'],
          ['c', 'am set-standby-bucket ' + PKG + ' restricted'], ['c', 'cmd netpolicy add restrict-background-blacklist ' + UID],
          ['c', 'cmd appops set ' + PKG + ' RUN_ANY_IN_BACKGROUND ignore'], ['n', '… cùng các lệnh đó cho 9 app còn lại'],
          ['k', '✓ Đọc lại từng gói: 10/10 app đã bị giữ, 3 app ghim được chừa']],
        [['h', '# Tắt Focus Mode → rã đông theo bản ghi'], ['c', 'cmd appops set ' + PKG + ' RUN_ANY_IN_BACKGROUND default'],
          ['c', 'cmd netpolicy remove restrict-background-blacklist ' + UID], ['c', 'am set-standby-bucket ' + PKG + ' active'],
          ['c', 'am set-inactive --user 0 ' + PKG + ' false'], ['n', '… 9 app còn lại'], ['k', '✓ Đã trả 10/10 app về như trước']],
      ],
      hz: [
        [['h', '# Khóa tần số 60 Hz'], ['c', 'settings put system min_refresh_rate 60; settings put system peak_refresh_rate 60'],
          ['c', "dumpsys display | grep -m1 -oE 'renderFrameRate [0-9.]+'"], ['o', 'renderFrameRate 60.0'], ['k', '✓ Màn hình đang chạy ở 60 Hz']],
        [['h', '# Bỏ khóa → trả mốc đọc lúc vào game'], ['c', 'settings delete system min_refresh_rate; settings put system peak_refresh_rate 120'],
          ['k', '✓ Về tần số quét như trước']],
      ],
      dnd: [
        [['h', '# Không làm phiền · quy tắc riêng của Cryo'], ['a', 'NotificationManager.setAutomaticZenRuleState(Cryo · đang chơi, bật)'],
          ['c', 'dumpsys notification | grep -m1 mZenMode'], ['o', 'mZenMode=ZEN_MODE_IMPORTANT_INTERRUPTIONS'],
          ['k', '✓ Ẩn thông báo nổi; báo thức và cuộc gọi từ liên hệ gắn sao vẫn qua']],
        [['h', '# Tắt Không làm phiền'], ['a', 'NotificationManager.setAutomaticZenRuleState(Cryo · đang chơi, tắt)'],
          ['o', 'mZenMode=ZEN_MODE_OFF'], ['k', '✓ Thông báo hiện lại như thường']],
      ],
      wifi: [
        [['h', '# Wi-Fi độ trễ thấp'], ['a', 'IWifiManager.acquireWifiLock(LOW_LATENCY, "cryo-ll-game", WorkSource{uid 10342 · Polar Run})'],
          ['c', 'dumpsys wifi | grep -m1 cryo-ll-game'], ['o', 'WifiLock{cryo-ll-game type=4 …}'],
          ['k', '✓ Android bật chế độ độ trễ thấp khi game ở trên màn hình'], ['n', 'Mức khác biệt tuỳ chip Wi-Fi và bộ phát']],
        [['h', '# Tắt Wi-Fi độ trễ thấp'], ['a', 'IWifiManager.releaseWifiLock("cryo-ll-game")'], ['k', '✓ Wi-Fi về chế độ thường']],
      ],
      afk: [
        [['h', '# Màn hình AFK'], ['a', 'WindowManager.addView(TYPE_APPLICATION_OVERLAY · nền đen · screenBrightness = 0)'],
          ['k', '✓ Màn đen, tắt đèn nền; game vẫn chạy. Chạm hai lần để mở lại']],
        [['a', 'WindowManager.removeView(màn hình AFK)'], ['k', '✓ Màn hình sáng lại']],
      ],
    },
    en: {
      start: [['h', '# Polar Run opened → applying the settings that are on']],
      focus: [
        [['h', '# Focus Mode · level L2 · 10 background apps'], ['c', 'am force-stop --user 0 ' + PKG], ['c', 'am set-inactive --user 0 ' + PKG + ' true'],
          ['c', 'am set-standby-bucket ' + PKG + ' restricted'], ['c', 'cmd netpolicy add restrict-background-blacklist ' + UID],
          ['c', 'cmd appops set ' + PKG + ' RUN_ANY_IN_BACKGROUND ignore'], ['n', '… the same commands for the other 9 apps'],
          ['k', '✓ Read back per package: 10/10 apps held, 3 pinned apps skipped']],
        [['h', '# Focus Mode off → unfreeze from the record'], ['c', 'cmd appops set ' + PKG + ' RUN_ANY_IN_BACKGROUND default'],
          ['c', 'cmd netpolicy remove restrict-background-blacklist ' + UID], ['c', 'am set-standby-bucket ' + PKG + ' active'],
          ['c', 'am set-inactive --user 0 ' + PKG + ' false'], ['n', '… the other 9 apps'], ['k', '✓ 10/10 apps back as they were']],
      ],
      hz: [
        [['h', '# 60 Hz refresh lock'], ['c', 'settings put system min_refresh_rate 60; settings put system peak_refresh_rate 60'],
          ['c', "dumpsys display | grep -m1 -oE 'renderFrameRate [0-9.]+'"], ['o', 'renderFrameRate 60.0'], ['k', '✓ The display is running at 60 Hz']],
        [['h', '# Lock off → restore the values read on game start'], ['c', 'settings delete system min_refresh_rate; settings put system peak_refresh_rate 120'],
          ['k', '✓ Refresh rate back as it was']],
      ],
      dnd: [
        [['h', "# Do Not Disturb · Cryo's own rule"], ['a', 'NotificationManager.setAutomaticZenRuleState(Cryo · playing, on)'],
          ['c', 'dumpsys notification | grep -m1 mZenMode'], ['o', 'mZenMode=ZEN_MODE_IMPORTANT_INTERRUPTIONS'],
          ['k', '✓ Pop-up notifications hidden; alarms and calls from starred contacts still ring']],
        [['h', '# Do Not Disturb off'], ['a', 'NotificationManager.setAutomaticZenRuleState(Cryo · playing, off)'],
          ['o', 'mZenMode=ZEN_MODE_OFF'], ['k', '✓ Notifications show as usual']],
      ],
      wifi: [
        [['h', '# Low-latency Wi-Fi'], ['a', 'IWifiManager.acquireWifiLock(LOW_LATENCY, "cryo-ll-game", WorkSource{uid 10342 · Polar Run})'],
          ['c', 'dumpsys wifi | grep -m1 cryo-ll-game'], ['o', 'WifiLock{cryo-ll-game type=4 …}'],
          ['k', "✓ Android turns on low-latency mode while the game is on screen"], ['n', 'How much it helps depends on the Wi-Fi chip and router']],
        [['h', '# Low-latency Wi-Fi off'], ['a', 'IWifiManager.releaseWifiLock("cryo-ll-game")'], ['k', '✓ Wi-Fi back to normal mode']],
      ],
      afk: [
        [['h', '# AFK screen'], ['a', 'WindowManager.addView(TYPE_APPLICATION_OVERLAY · black · screenBrightness = 0)'],
          ['k', '✓ Screen black, backlight off; the game keeps running. Double-tap to come back']],
        [['a', 'WindowManager.removeView(AFK screen)'], ['k', '✓ Screen back on']],
      ],
    },
  };
  function playDemo(sc) {
    const scr = $('.play-scr', sc), afkSw = $('[data-sw="afk"]', sc), dndSw = $('[data-sw="dnd"]', sc);
    const game = liveCanvas(scr, () => !scr.classList.contains('afk-on'));
    const afk = afkLayer(scr, () => { if (afkSw.getAttribute('aria-checked') === 'true') setSwitch(afkSw, false); });
    /* ---- Nhật ký lệnh: các dòng xếp hàng, gõ ra lần lượt (lệnh nhanh, dòng kết luận chờ thêm một nhịp như đang đọc lại). */
    const logBox = $('.pl-log', sc), logList = $('.pl-log-b', sc);
    const queue = [];
    let logT = 0;
    const pump = () => {
      logT = 0;
      const it = queue.shift();
      if (!it) { logBox.classList.remove('busy'); return; }
      const li = d.createElement('li'); li.className = it[0] + (reduced ? '' : ' in'); li.textContent = it[1];
      logList.appendChild(li);
      while (logList.children.length > 40) logList.firstChild.remove();
      logList.scrollTop = logList.scrollHeight;
      const next = queue[0];
      logT = setTimeout(pump, reduced ? 0 : next && next[0] === 'k' ? 620 : next && next[0] === 'h' ? 380 : 230);
    };
    const log = (lines) => {
      if (!lines) return;
      queue.push(...lines); logBox.classList.add('busy');
      if (!logT) logT = setTimeout(pump, reduced ? 0 : 120);
    };
    const logSw = (kind, on) => { const L = PLAY_LOG[lang()][kind]; if (L) log(L[on ? 0 : 1]); };
    let logged = false;
    afkSw.addEventListener('sw', (e) => { if (e.detail) afk.show(); else afk.hide(); logSw('afk', e.detail); });
    const mkEl = (cls) => { const e = d.createElement('div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); scr.appendChild(e); return e; };
    const note = mkEl('pl-note'), frost = mkEl('frost'), hu = mkEl('hu');
    let running = false, noteT = 0, huT = 0, huHide = 0, huIdx = 0;
    function say(kind, on) {
      const t = PLAY[lang()];
      note.innerHTML = '<span class="ms pl-ic ic-' + kind + '">' + PLAY_IC[kind][on ? 0 : 1] + '</span><span>' + t[kind][on ? 0 : 1] + '</span>';
      note.classList.remove('on'); void note.offsetWidth; note.classList.add('on');
      clearTimeout(noteT); noteT = setTimeout(() => note.classList.remove('on'), 2200);
    }
    function heads(show) {
      clearTimeout(huHide);
      if (!show) { hu.classList.remove('on'); return; }
      const m = PLAY[lang()].hu[huIdx++ % 3];
      hu.innerHTML = '<span class="hu-ic ms">' + m[0] + '</span><span class="hu-tx"><small>' + m[1] + ' · ' + PLAY[lang()].now + '</small><b>' + m[2] + '</b></span>';
      hu.classList.add('on');
      huHide = setTimeout(() => hu.classList.remove('on'), 2400);
    }
    /* Không làm phiền đang tắt + màn đang hiện: một thông báo mỗi ~3,6 s. */
    function schedule() {
      clearInterval(huT); huT = 0;
      if (!running || reduced || dndSw.getAttribute('aria-checked') === 'true') return;
      setTimeout(() => { if (running && dndSw.getAttribute('aria-checked') !== 'true') heads(true); }, 500);
      huT = setInterval(() => heads(true), 3600);
    }
    $$('.a-sw[data-sw]', sc).forEach((sw) => {
      const kind = sw.dataset.sw;
      if (!PLAY_IC[kind]) return;
      sw.addEventListener('sw', (e) => {
        const ic = $('.a-ic', sw.closest('.a-row'));
        if (ic && !reduced) { ic.classList.remove('pop'); void ic.offsetWidth; ic.classList.add('pop'); }
        say(kind, e.detail);
        logSw(kind, e.detail);
        if (kind === 'focus' && e.detail && !reduced) { frost.classList.remove('go'); void frost.offsetWidth; frost.classList.add('go'); }
        if (kind === 'dnd') { if (e.detail) heads(false); schedule(); }
      });
    });
    refreshers.push(() => { note.classList.remove('on'); hu.classList.remove('on'); });
    /* Lần đầu màn này hiện: như lúc game vừa mở — chạy lần lượt các công tắc đang bật. Đổi ngôn ngữ thì gõ lại từ đầu. */
    const replay = () => {
      clearTimeout(logT); logT = 0; queue.length = 0; logList.textContent = '';
      log(PLAY_LOG[lang()].start);
      ['focus', 'hz', 'dnd', 'wifi'].forEach((k) => { const s = $('[data-sw="' + k + '"]', sc); if (s && s.getAttribute('aria-checked') === 'true') logSw(k, true); });
    };
    refreshers.push(() => { if (logged) replay(); });
    return {
      start() { running = true; game.run(true); schedule(); if (!logged) { logged = true; replay(); } else if (queue.length && !logT) logT = setTimeout(pump, 200); },
      stop() { running = false; game.run(false); clearInterval(huT); huT = 0; heads(false); clearTimeout(logT); logT = 0; },
    };
  }

  /* ---------- Mô phỏng 5: báo cáo ---------- */
  function repDemo(sc) {
    const scr = $('.comp-rep', sc), sheet = $('.sheet', sc), body = $('.sheet-body', sc);
    let t = 0, c = 0;
    /* Thanh cuộn mảnh của riêng bảng (thanh cuộn hệ thống đã ẩn): cho thấy bảng còn dài, đang ở đâu. */
    const bar = d.createElement('i'); bar.className = 'sheet-bar'; bar.setAttribute('aria-hidden', 'true');
    const thumb = d.createElement('i'); bar.appendChild(thumb); sheet.appendChild(bar);
    let edge = '', dim = null;
    /* Kích thước đo một lần mỗi lần mở / đổi cỡ: lúc tự cuộn, mỗi khung chỉ còn đọc scrollTop và ghi transform. */
    const measure = () => {
      const max = body.scrollHeight - body.clientHeight, bh = bar.clientHeight;
      if (!bh) return null;
      const h = Math.max(18, bh * body.clientHeight / Math.max(1, body.scrollHeight));
      thumb.style.height = h.toFixed(1) + 'px';
      return (dim = { max, h, room: bh - h });
    };
    addEventListener('resize', () => { dim = null; }, { passive: true });
    const paint = () => {
      const D = dim || measure();
      if (!D) return;
      const { max, room } = D, y = body.scrollTop;
      thumb.style.transform = 'translateY(' + (max > 0 ? room * clamp(y / max, 0, 1) : 0).toFixed(1) + 'px)';
      /* Mờ mép trên khi đã cuộn xuống, mép dưới khi chưa tới cuối — đổi lớp chỉ khi đổi trạng thái. */
      const e = (y > 4 ? 't' : '') + (y < max - 4 ? 'b' : '');
      if (e !== edge) { edge = e; body.classList.toggle('fade-t', e.includes('t')); body.classList.toggle('fade-b', e.includes('b')); }
    };
    body.addEventListener('scroll', paint, { passive: true });
    /* Tự cuộn chậm xuống cuối rồi lên đầu (user #302: bảng "trông không giống vuốt được"). Người xem chạm, lăn chuột, rê
       chuột vào bảng hay bấm phím là dừng ngay; thôi đụng vào 5 s thì đi tiếp từ chỗ đang đứng. Chỉ chạy khi màn này đang
       hiện (start/stop) VÀ bảng còn nằm trong khung nhìn — máy tính: chương cuối vẫn "đang hiện" khi đã cuộn xuống cuối
       trang (đo #302: chân trang tốn 239 ms/giây chỉ vì bảng khuất vẫn tự cuộn). Nghỉ ở hai đầu bằng hẹn giờ, không giữ rAF. */
    const SPEED = 42;
    let raf = 0, dir = 1, leg = null, holdT = 0, touring = false, inside = false, inView = true, pokedAt = -1e9;
    const ease = (p) => p * p * (3 - 2 * p);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => {
      inView = e.isIntersecting;
      if (inView && touring && !raf) hold(Math.max(500, pokedAt + 5000 - performance.now()));
    })).observe(sheet);
    const step = (now) => {
      raf = 0;
      if (!touring || !inView) return;
      const D = dim || measure();
      if (!D) { hold(600); return; }
      if (D.max < 8) return;
      const max = D.max;
      if (!leg) {
        const from = body.scrollTop, to = dir > 0 ? max : 0;
        leg = { from, to, t0: now, T: Math.max(700, Math.abs(to - from) / SPEED * 1000) };
      }
      const p = clamp((now - leg.t0) / leg.T, 0, 1);
      body.scrollTop = lerp(leg.from, leg.to, ease(p));
      if (p >= 1) { dir = -dir; leg = null; hold(dir < 0 ? 1600 : 2600); return; }
      raf = requestAnimationFrame(step);
    };
    const hold = (ms) => {
      cancelAnimationFrame(raf); raf = 0; leg = null; clearTimeout(holdT);
      holdT = setTimeout(() => { if (touring && !inside && inView && !raf) raf = requestAnimationFrame(step); }, ms);
    };
    const tour = (on) => {
      touring = on && !reduced;
      if (!touring) { cancelAnimationFrame(raf); raf = 0; leg = null; clearTimeout(holdT); return; }
      dir = 1; hold(1300);
    };
    const poke = () => { pokedAt = performance.now(); if (touring) hold(5000); };
    ['wheel', 'pointerdown', 'touchstart', 'keydown'].forEach((ev) => body.addEventListener(ev, poke, { passive: true }));
    sheet.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { inside = true; poke(); } });
    sheet.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { inside = false; if (touring) hold(1400); } });
    /* Bảng báo cáo cuộn bên trong (như app); mỗi lần mở lại bắt đầu từ đầu. */
    const open = () => { body.scrollTop = 0; dim = null; paint(); scr.classList.add('open'); tour(true); };
    const close = () => { tour(false); scr.classList.remove('open'); };
    const closeNow = () => { tour(false); sheet.style.transition = 'none'; scr.classList.remove('open'); void sheet.offsetHeight; sheet.style.transition = ''; };
    $('.rp-close', sc).addEventListener('click', close);
    /* "Chơi lại": app đóng bảng rồi mở game qua Cryo — ở đây đóng bảng, lộ lại màn game. */
    const play = $('.rp-play', sc);
    if (play) play.addEventListener('click', close);
    $('.rp-again', sc).addEventListener('click', () => {
      if (scr.classList.contains('open')) { close(); clearTimeout(t); t = setTimeout(open, 380); } else open();
    });
    /* Màn này rời đi thì bảng đóng SAU khi khối đã bay khỏi khung (exit ~420 ms; điện thoại: đã cuộn khuất). Quay lại thì chỉ
       mở khi đang đóng — bản cũ đóng phắt bảng đang mở rồi mở lại ngay lúc màn vừa hiện: nháy hai lần (user #302). */
    return {
      start() {
        clearTimeout(c);
        if (scr.classList.contains('open')) { tour(true); return; }
        if (reduced) { open(); return; }
        clearTimeout(t); t = setTimeout(open, 420);
      },
      stop() { clearTimeout(t); tour(false); clearTimeout(c); c = setTimeout(closeNow, 480); },
    };
  }

  /* ---------- Câu chuyện: sân khấu dính (máy tính) hoặc từng màn ngay dưới chữ (điện thoại) ---------- */
  const DEMOS = { res: resDemo, freeze: fzDemo, mon: monDemo, play: playDemo, rep: repDemo };
  /* Mô phỏng nào đổi chiều cao (thẻ xổ ra) gọi refit(màn, phần cao thêm) để sân khấu máy tính co lại cho vừa. */
  let refit = () => {};
  /* chapMorph (bên dưới) gán: dựng phần biến hình của chương NGAY TRƯỚC khi nó sáng lên, để chương nào sáng cũng được biến
     hình từ dáng thường — kể cả khi sáng sớm hơn lúc dựng sẵn (cuộn vào câu chuyện khi màn mở đầu chưa xong, mở link giữa
     trang). Review #303. */
  let morphReady = () => {};
  const stage = $('.stage'), deskMQ = matchMedia('(min-width: 1024px)');
  const screens = {};
  /* Mô phỏng của từng chương dựng LÚC CẦN (#303), không dựng cả năm lúc tải: dựng một mô phỏng là dựng DOM cửa sổ nổi, biểu
     đồ, canvas game, đọc bố cục… — đo trên điện thoại giả lập (CPU ×4): cả năm cùng lúc chặn luồng chính hàng trăm ms đúng
     lúc tiêu đề mở đầu đang nở. Nay: chương tới gần (cách 1,5 màn) thì dựng; còn lại dựng dần lúc rảnh sau màn mở đầu.
     HTML tĩnh đã mang sẵn trạng thái đầu của từng màn nên dựng muộn không đổi thứ người xem thấy. */
  $$('.chap').forEach((c) => {
    const el = $('.screen', c), key = c.dataset.screen;
    const fit = d.createElement('div'); fit.className = 'fit';
    while (el.firstChild) fit.appendChild(el.firstChild);
    el.appendChild(fit);
    screens[key] = { key, el, fit, chap: c, slot: $('.slot', c), blocks: $$('[data-b]', fit), timers: [], seen: false, made: null,
      get demo() { return this.made || (this.made = DEMOS[key](el)); } };
  });
  const prepDemos = (list) => list.forEach((sc) => { void sc.demo; });
  /* Hướng bay vào của từng khối; khi rời đi khối bay tiếp theo hướng ngược lại (OUT). */
  const FROM = { up: { y: 70, s: 0.94 }, left: { x: -150, r: -5, s: 0.96 }, right: { x: 160, r: 4, s: 0.94 }, zoom: { s: 0.84, y: 30 }, fade: { y: 16 } };
  const OUT = { up: { y: -50, s: 0.95 }, left: { x: -110, r: -3, s: 0.96 }, right: { x: 120, r: 3, s: 0.95 }, zoom: { s: 1.05, y: -20 }, fade: { y: -12 } };

  /* offsetWidth/Height không tính transform nên đo được mà không phải gỡ scale cũ. extra = phần cao sắp thêm (thẻ đang
     xổ ra) để co ngay tới cỡ cuối; anim = co mượt (.fit-anim) thay vì đặt thẳng. */
  function fitScreen(sc, extra, anim) {
    if (!deskMQ.matches) { sc.fit.style.transform = ''; return; }
    const H = stage.clientHeight, W = stage.clientWidth, h = sc.fit.offsetHeight + (extra || 0), w = sc.fit.offsetWidth;
    const s = Math.min(1, H / Math.max(1, h), W / Math.max(1, w));
    sc.fit.classList.toggle('fit-anim', !!anim && !reduced);
    sc.fit.style.transform = s < 0.999 ? 'scale(' + s.toFixed(4) + ')' : '';
  }
  refit = (el, extra) => { const sc = Object.values(screens).find((x) => x.el === el); if (sc && active === sc.key) fitScreen(sc, extra, true); };
  function enter(sc, delay) {
    /* Dựng mô phỏng (nếu chưa) TRƯỚC khi đo khung để co sân khấu: mô phỏng thêm cửa sổ nổi, biểu đồ… vào màn. */
    void sc.demo;
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
    if (sc.made) sc.made.stop();
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
    morphReady(screens[key].chap);
    Object.values(screens).forEach((sc) => sc.chap.classList.toggle('chap-on', sc.key === key));
    pulseMark(screens[key]);
    stage.dataset.tone = key;
    if (prev) exit(prev);
    enter(screens[key], prev ? 230 : 0);
  }

  /* Huy hiệu hình khối trên tên chương đổi dáng một nhịp khi chương sáng lên (shapes() bên dưới gắn cryoPulse). */
  const pulseMark = (sc) => { const m = sc && $('.cm-shape', sc.chap); if (m && m.cryoPulse && !reduced) m.cryoPulse(); };
  let bandIO = null, stageIO = null, slotIO = null, chapIO = null;
  function place() {
    const desk = deskMQ.matches;
    [bandIO, stageIO, slotIO, chapIO].forEach((o) => o && o.disconnect());
    Object.values(screens).forEach((sc) => {
      sc.timers.forEach(clearTimeout); sc.timers = []; if (sc.made) sc.made.stop();
      sc.el.classList.remove('on'); sc.chap.classList.remove('chap-on');
      const target = desk ? stage : sc.slot;
      if (sc.el.parentNode !== target) target.appendChild(sc.el);
      sc.fit.style.transform = '';
      sc.blocks.forEach((b) => put(b, { x: 0, y: 0, s: 1, r: 0, o: desk ? 1 : (sc.seen || reduced ? 1 : 0) }));
    });
    active = null;
    if (desk) {
      /* Mỗi lần dải giữa màn đổi (chương vào HAY ra), chọn lại chương đang nằm ngay giữa màn. Bản cũ chỉ bật chương vừa
         VÀO dải: ranh hai chương nằm trong dải thì chương dưới vào trước, rồi vuốt ngược lên chương trên chưa từng rời dải
         nên không có sự kiện nào → nó kẹt mờ (user #302: "vuốt lên lại để xem thì nó vẫn bị mờ"). */
      const pick = () => {
        const mid = innerHeight / 2;
        const hit = Object.values(screens).find((sc) => { const r = sc.chap.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
        if (hit) activate(hit.key);
      };
      bandIO = new IntersectionObserver(pick, { rootMargin: '-49% 0px -49% 0px' });
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
        } else if (sc.made) sc.made.stop();
      }), { threshold: 0.22 });
      Object.values(screens).forEach((sc) => { sc.el.dataset.key = sc.key; slotIO.observe(sc.el); });
      /* Điện thoại không có sân khấu dính: chương sáng lên (số nền + huy hiệu) khi phần chữ của nó tới giữa màn hình. */
      chapIO = new IntersectionObserver((es) => es.forEach((e) => {
        const sc = screens[e.target.closest('.chap').dataset.screen];
        /* Sáng rồi thì giữ: điện thoại không làm mờ chương cũ, và biến hình trục chữ (số nền, tên chương) chỉ chạy lần đầu —
           cuộn qua lại không dựng lại phông cỡ lớn mỗi lượt. */
        if (!e.isIntersecting || sc.chap.classList.contains('chap-on')) return;
        morphReady(sc.chap); pulseMark(sc); sc.chap.classList.add('chap-on');
      }), { rootMargin: '-30% 0px -30% 0px' });
      Object.values(screens).forEach((sc) => chapIO.observe($('.chap-in', sc.chap)));
    }
  }
  place();
  deskMQ.addEventListener('change', place);
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      near.unobserve(e.target);
      /* Chưa xong màn mở đầu thì chờ (cuộn thẳng tới chương thì enter() tự dựng ngay khi cần). */
      afterIntro(() => prepDemos(Object.values(screens).filter((sc) => sc.chap === e.target)));
    }), { rootMargin: '150% 0px' });
    Object.values(screens).forEach((sc) => near.observe(sc.chap));
  }
  afterIntro(() => idleEach(Object.values(screens), (sc) => { void sc.demo; }));
  /* Cả phần câu chuyện khuất khỏi màn → quầng màu sau chương thôi trôi (site.css .story.off-view). */
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('off-view', !e.isIntersecting))).observe($('.story'));
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

  /* ---------- Chương sáng lên: số nền + chữ nhấn của tên chương biến hình ---------- */
  /* User #302 vòng 5: "lag và chậm quá". Bản cũ đổi trục phông bằng CSS steps(14)/steps(12) trong 1,1 s / 0,9 s: mỗi giá trị
     trục mới là Chrome dựng một bản phông mới (đo: ~2–4 ms/khung trên máy tính, ×4 CPU ~16 ms), nên đã chia nấc — mà 13
     nấc/giây thì giật. Nay:
     - số nền là SVG vẽ từ nét thật của phông ở 9 mốc trục (assets/numerals.js), nội suy nét theo lò xo: mượt ở mọi tần số
       quét, không dựng bản phông nào;
     - chữ nhấn tên chương đi theo BẢNG nấc cố định: Chrome giữ bản phông đã dựng và dùng lại (đo: 31 nấc lần đầu 68 ms, lần
       sau 6–11 ms); lúc rảnh dựng sẵn cả bảng bằng chữ ẩn nên lần đầu cũng rẻ. */
  (function chapMorph() {
    const chaps = $$('.chap'); if (!chaps.length) return;
    const parts = [];

    /* Số nền. Gốc toạ độ: đầu chữ số đầu, chân chữ; đơn vị phông (upm 2000), y hướng xuống. */
    const NUM = window.CryoNum, G = NUM && NUM.g, K = NUM && NUM.k, UPM = 2000, LS = -0.05 * UPM;
    /* Lò xo nảy quá 1 thì nét đi tiếp theo đoạn cuối (đậm/nghiêng thêm chút); dưới 0 thì giữ dáng mảnh nhất. */
    const seg = (u) => { const f = clamp(u, 0, 1.08) * (K - 1), j = Math.min(Math.floor(f), K - 2); return [j, f - j]; };
    const advAt = (g, j, t) => g.a[j] + (g.a[j + 1] - g.a[j]) * t;
    const pathAt = (g, j, t, dx) => {
      const A = g.p[j], B = g.p[j + 1]; let s = '', n = 0;
      for (const c of g.c) {
        s += c; if (c === 'Z') continue;
        for (let q = c === 'Q' ? 2 : 1; q > 0; q--, n += 2) s += Math.round(A[n] + (B[n] - A[n]) * t + dx) + ' ' + Math.round(A[n + 1] + (B[n + 1] - A[n + 1]) * t) + ' ';
      }
      return s;
    };
    /* Khung vẽ chung cho mọi số, cả căn trái (máy tính) lẫn căn phải (điện thoại): quét mọi mốc + đoạn vượt của lò xo.
       Số chương có dạng "0N" (01–05): mép trái lấy từ nét "0", phần nhô quá bước tiến lấy từ chữ số sau. Thêm số dạng
       khác (vd. "10") thì phải quét thêm cặp đó — chương nào thiếu dữ liệu nét vẫn tự về số chữ cũ. */
    let box = null, boxDone = false;
    const getBox = () => {
      if (boxDone || !G) return box;
      boxDone = true;
      let x0 = 0, x1 = 0, y0 = 0, y1 = 0, XR = 0;
      const frames = (g) => g.p.concat([g.p[K - 1].map((v, i) => v + (v - g.p[K - 2][i]) * 0.64)]);
      Object.keys(G).forEach((ch) => {
        if (ch === '0') return;
        const a = frames(G['0']), b = frames(G[ch]);
        for (let j = 0; j <= K; j++) {
          const jj = Math.min(j, K - 1), w0 = G['0'].a[jj] + LS, W = w0 + G[ch].a[jj] + LS;
          XR = Math.max(XR, W);
          a[j].forEach((v, i) => { if (i & 1) { y0 = Math.min(y0, v); y1 = Math.max(y1, v); } else x0 = Math.min(x0, v); });
          b[j].forEach((v, i) => { if (i & 1) { y0 = Math.min(y0, v); y1 = Math.max(y1, v); } else x1 = Math.max(x1, v + w0 - W); });
        }
      });
      const P = 60;
      return (box = { x0: x0 - P, y0: y0 - P, x1: XR + x1 + P, y1: y1 + P, XR });
    };
    const em = (v) => (v / UPM).toFixed(4) + 'em';
    const alignEnd = () => !deskMQ.matches;

    /* Chữ nhấn tên chương: dáng thường (chương chưa tới) → dáng nhấn .x-c/.x-t/.x-w. Đọc từ CSS để một nguồn sự thật. */
    const XN = 24, AX = ['wght', 'wdth', 'slnt', 'ROND'];
    const fvOf = (cs) => { const o = { wght: parseFloat(cs.fontWeight) || 400, wdth: 100, slnt: 0, ROND: 0 }; cs.fontVariationSettings.replace(/["'](\w{4})["']\s+(-?[\d.]+)/g, (_, k, v) => { o[k] = +v; }); return o; };
    /* Mẫu đo đặt trong một khung .chap GIẢ (ẩn, không sáng): chữ data-x ở đó mang đúng dáng thường của CSS
       (.js .chap:not(.chap-on) …); ba chữ .x-* thì mang dáng nhấn. Khung giả nên không phụ thuộc chương nào đang sáng —
       bảng được tính lúc cần (#303), khi đó có thể đã có chương sáng. */
    let TB = null;
    const table = () => {
      if (TB) return TB;
      const host = d.createElement('div'); host.className = 'chap'; host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;width:0;height:0;min-height:0;padding:0;overflow:hidden';
      const probe = d.createElement('span'); probe.className = 'h3';
      probe.innerHTML = '<span data-x="p">a</span><span class="x-c">a</span><span class="x-t">a</span><span class="x-w">a</span>';
      host.appendChild(probe); d.body.appendChild(host);
      const pcs = getComputedStyle(probe), pfs = parseFloat(pcs.fontSize) || 1, ps = getComputedStyle($('[data-x="p"]', probe));
      const plain = fvOf(ps), plainLs = (parseFloat(ps.letterSpacing) || 0) / pfs;
      TB = {};
      ['c', 't', 'w'].forEach((s) => {
        const cs = getComputedStyle($('.x-' + s, probe)), e = fvOf(cs), ls = (parseFloat(cs.letterSpacing) || 0) / pfs;
        TB[s] = [];
        for (let k = 0; k <= XN; k++) {
          const u = k / XN;
          TB[s].push({
            fv: AX.map((a) => "'" + a + "' " + +lerp(plain[a], e[a], u).toFixed(a === 'wght' ? 0 : 1)).join(', '),
            ls: lerp(plainLs, ls, u).toFixed(4) + 'em',
          });
        }
      });
      host.remove();
      return TB;
    };

    /* Dựng phần biến hình của MỘT chương — lúc chương tới gần (cách 1,5 màn) hoặc lúc rảnh sau màn mở đầu (#303). */
    const setup = (chap) => {
      if (chap.cryoMorph) return;
      const i = chaps.indexOf(chap), TB = table(), box = getBox();
      const p = chap.cryoMorph = { chap, on: chap.classList.contains('chap-on') };
      /* Số nền SVG — thiếu dữ liệu nét cho chữ số nào thì giữ số chữ cũ (CSS steps). */
      const bg = $('.chap-bg', chap), str = bg && bg.textContent.trim();
      if (box && /^0[1-9]$/.test(str || '') && G[str[1]]) {
        const svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'chap-num'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
        svg.setAttribute('viewBox', [box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0].join(' '));
        svg.innerHTML = '<defs><linearGradient id="cn-g' + i + '" gradientUnits="userSpaceOnUse"><stop offset=".15" class="cn-a"/><stop offset=".6" class="cn-b"/><stop offset=".92" class="cn-c"/></linearGradient></defs><path fill="url(#cn-g' + i + ')"/>';
        svg.style.cssText = '--w:' + em(box.x1 - box.x0) + ';--h:' + em(box.y1 - box.y0) + ';--x0:' + em(box.x0) + ';--y0:' + em(box.y0) + ';--xr:' + em(box.x1 - box.XR);
        bg.after(svg); chap.classList.add('cn');
        const path = $('path', svg), grad = $('linearGradient', svg), gs = [...str].map((c) => G[c]);
        const width = (j, t) => gs.reduce((w, g) => w + advAt(g, j, t) + LS, 0);
        let end = null;
        const n = new Spring(p.on ? 1 : 0, 0.001, null);
        n.owner = owner(() => {
          const [j, t] = seg(n.x), e = alignEnd();
          if (e !== end) {
            /* Dải màu phủ hộp chữ cũ (165°, lề trong .1/.34em, cao 1,14em, chân chữ cách đỉnh hộp .96em) ở dáng đậm. */
            end = e;
            const W = width(K - 2, 1), ox = e ? box.XR - W : 0, bx = ox - 0.1 * UPM, bw = W + 0.44 * UPM, by = -0.96 * UPM, bh = 1.14 * UPM;
            const sx = Math.sin(165 * Math.PI / 180), sy = -Math.cos(165 * Math.PI / 180), L = bw * Math.abs(sx) + bh * Math.abs(sy);
            const cx = bx + bw / 2, cy = by + bh / 2;
            grad.setAttribute('x1', (cx - sx * L / 2).toFixed(0)); grad.setAttribute('y1', (cy - sy * L / 2).toFixed(0));
            grad.setAttribute('x2', (cx + sx * L / 2).toFixed(0)); grad.setAttribute('y2', (cy + sy * L / 2).toFixed(0));
          }
          let x = e ? box.XR - width(j, t) : 0, s = '';
          gs.forEach((g) => { s += pathAt(g, j, t, x); x += advAt(g, j, t) + LS; });
          path.setAttribute('d', s);
        });
        n.set(n.x);
        p.num = n;
        deskMQ.addEventListener('change', () => n.touch());
      }
      /* Chữ nhấn tên chương (cả hai thứ tiếng). Lò xo chạy liên tục, trục đổi theo nấc của bảng. fx.js có thể tách tên chương
         thành chữ cái (phình theo con trỏ) và dựng lại các span chữ nhấn (#303) — khi đó nó gọi p.redo() để tìm lại span và
         ghi lại nấc hiện tại. Biến hình bắt đầu / xong thì báo cho fx.js (cryo:morph / cryo:morphed). */
      const xsNow = () => $$('.h3 [data-x]', chap).filter((el) => TB[el.dataset.x]);
      let xs = xsNow();
      if (xs.length) {
        let last = -1;
        xs.forEach((el) => el.classList.add('xm'));
        const h = new Spring(p.on ? 1 : 0, 0.001, null);
        h.owner = owner(() => {
          const k = Math.round(clamp(h.x, 0, 1) * XN);
          if (k !== last) {
            last = k;
            xs.forEach((el) => { const v = TB[el.dataset.x][k]; el.style.fontVariationSettings = v.fv; el.style.letterSpacing = v.ls; });
          }
          if (p.moving && h.x === h.t) {
            p.moving = false; chap.dispatchEvent(new CustomEvent('cryo:morphed', { detail: h.t === 1 }));
            /* Biến hình xong, chờ thêm 0,9 s rồi trả lớp. */
            clearTimeout(p.layerT); p.layerT = setTimeout(() => { if (!p.moving) chap.classList.remove('morphing'); }, 900);
          }
        });
        h.set(h.x);
        p.head = h;
        p.redo = () => { xs = xsNow(); xs.forEach((el) => el.classList.add('xm')); last = -1; h.touch(); };
      }
      p.go = (on) => {
        if (p.num) p.num.to(on ? 1 : 0, on ? SPEC.m3SlowSpatial : SPEC.m3Spatial);
        if (p.head) {
          /* Trong lúc biến hình: tên chương có lớp riêng (.chap.morphing, site.css) — đổi nét mỗi khung mà nằm chung mảng
             ảnh thì vẽ lại cả vùng quanh nó (xem liveLayer trong fx.js). */
          if (!p.moving) { p.moving = true; clearTimeout(p.layerT); if (!reduced) chap.classList.add('morphing'); chap.dispatchEvent(new CustomEvent('cryo:morph')); }
          p.head.to(on ? 1 : 0, on ? SPEC.m3SlowSpatial : SPEC.m3Spatial);
        }
      };
      parts.push(p);
    };
    morphReady = setup;
    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        near.unobserve(e.target);
        /* Chờ màn mở đầu xong; chương nào sáng sớm hơn thì morphReady đã dựng nó ngay trước lúc sáng. */
        afterIntro(() => setup(e.target));
      }), { rootMargin: '150% 0px' });
      chaps.forEach((c) => near.observe(c));
    } else chaps.forEach(setup);
    afterIntro(() => idleEach(chaps, setup));
    const watch = new MutationObserver(() => parts.forEach((p) => {
      const on = p.chap.classList.contains('chap-on');
      if (on !== p.on) { p.on = on; p.go(on); }
    }));
    chaps.forEach((c) => watch.observe(c, { attributes: true, attributeFilter: ['class'] }));

    /* Dựng sẵn các bản phông của bảng nấc lúc rảnh: mỗi nấc một chữ ẩn cùng cỡ (.h3) chứa đủ ký tự của các chữ nhấn (để
       đủ cả bộ phông latin lẫn tiếng Việt). Vài nấc mỗi lượt rảnh, đọc offsetWidth để bố cục (= dựng phông) ngay lúc đó. */
    if (reduced) return;
    /* Mỗi lượt rảnh MỘT nấc (#303: bản cũ dựng nhiều nấc một lượt, mỗi nấc là một lần bố cục + dựng phông, lượt rảnh bị
       kéo dài quá hạn), chỉ sau màn mở đầu và không chen vào lúc đang cuộn (idleEach). */
    const xsAll = $$('.chap .h3 [data-x]').filter((el) => ['c', 't', 'w'].includes(el.dataset.x));
    if (!xsAll.length) return;
    const chars = [...new Set(xsAll.map((el) => el.textContent).join('').replace(/\s/g, ''))].join('');
    afterIntro(() => {
      const TB = table();
      const jobs = [...new Set(xsAll.map((el) => el.dataset.x))].flatMap((s) => TB[s].map((v) => v.fv));
      const warm = d.createElement('div'); warm.className = 'xm-warm'; warm.setAttribute('aria-hidden', 'true');
      idleEach(jobs, (fv) => {
        if (!warm.isConnected) d.body.appendChild(warm);
        /* span (không phải i): <i> nghiêng mặc định → bản phông khác (nghiêng giả), không trúng bộ đệm. */
        const el = d.createElement('span'); el.className = 'h3'; el.dataset.w = chars; el.style.fontVariationSettings = fv;
        warm.appendChild(el); void warm.offsetWidth;
      }, 1);
    });
  })();

  /* Lớp hiệu ứng fx.js dùng chung lò xo, hình khối và trạng thái ngôn ngữ với trang. */
  window.CryoMotion = { Spring, SPEC, owner, mo, go, put, reduced, lang, refreshers, clamp, lerp, SHAPES, shapePts, morphPath, view, $, $$, afterIntro, idleEach };

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
  /* Chờ cả DOMContentLoaded: sự kiện này chỉ tới SAU khi mọi script defer (cả fx.js) đã chạy. Phông đã có sẵn (vào lại
     trang, bộ nhớ đệm) thì fonts.ready xong ngay sau site.js — mở đầu chạy trước khi fx.js kịp nghe 'cryo:intro', tiêu đề
     mất màn nở chữ (#303). */
  const dclDone = () => { const n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0]; return !!(n && n.domContentLoadedEventStart); };
  const domReady = new Promise((r) => { if (dclDone()) r(); else d.addEventListener('DOMContentLoaded', () => r(), { once: true }); });
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 900))]).then(() => domReady).then(() => {
    intro();
    root.classList.add('booted');
    setTimeout(finishIntro, reduced ? 0 : 1800);
  });
})();
