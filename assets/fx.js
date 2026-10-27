/* Cryo — lớp hiệu ứng "có cảm xúc" kiểu M3 Expressive cho trang chủ:
   con trỏ âm bản bay vào nút, chữ biến thiên (trục wght/wdth/ROND của Google Sans Flex), khối 3D nền theo màu chủ đề,
   dải chữ chạy theo cuộn, đường tiến độ dạng sóng. Dùng chung lò xo của site.js (window.CryoMotion).
   Toàn bộ chỉ là trang trí: không có tệp này hoặc bật giảm chuyển động thì nội dung vẫn đủ và đọc được. */
(() => {
  'use strict';
  const M = window.CryoMotion;
  if (!M) return;
  const { Spring, SPEC, owner, go, put, reduced, clamp, lerp, SHAPES, shapePts, morphPath, $, $$ } = M;
  const d = document, root = d.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const shown = (el) => !!el && el.getClientRects().length > 0;
  const later = (fn, ms) => { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  const io = (els, opts, fn) => {
    if (!('IntersectionObserver' in window)) { els.forEach((el) => fn(el, true)); return; }
    const o = new IntersectionObserver((es) => es.forEach((e) => fn(e.target, e.isIntersecting, o)), opts);
    els.forEach((el) => o.observe(el));
  };

  /* ================= Chữ biến thiên ================= */
  const graphemes = (() => {
    try { const s = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); return (w) => Array.from(s.segment(w), (x) => x.segment); }
    catch (e) { return (w) => Array.from(w); }
  })();
  /* Tách một khối chữ thành từ (inline-block, để bay lên) và chữ cái (inline, chỉ đổi trục biến thiên nên giữ kerning).
     Trình đọc màn hình đọc bản .sr nguyên câu; bản tách bị ẩn khỏi cây truy cập. */
  function split(el, withSr) {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    const vis = d.createElement('span'); vis.className = 'kt';
    if (withSr !== false) {
      const sr = d.createElement('span'); sr.className = 'sr'; sr.textContent = text; el.appendChild(sr);
      vis.setAttribute('aria-hidden', 'true');
    }
    const words = [], letters = [];
    text.split(' ').forEach((w) => {
      const ws = d.createElement('span'); ws.className = 'kw';
      graphemes(w).forEach((ch) => { const c = d.createElement('span'); c.className = 'kc'; c.textContent = ch; ws.appendChild(c); letters.push(c); });
      words.push(ws);
    });
    el.appendChild(vis);
    const k = { el, vis, words, letters, locked: false, busy: 0 };
    unlock(k, true);
    return k;
  }
  /* Khoá chỗ xuống dòng theo bố cục cuối: chữ co giãn trong lúc chạy không làm từ nhảy dòng. */
  function unlock(k, force) {
    if (!k.locked && !force) return;
    k.vis.textContent = '';
    k.words.forEach((w, i) => { k.vis.appendChild(w); if (i < k.words.length - 1) k.vis.appendChild(d.createTextNode(' ')); });
    k.locked = false;
  }
  function lock(k) {
    if (!shown(k.vis)) return false;
    unpin(k);
    unlock(k);
    const rows = []; let top = null;
    k.words.forEach((w) => {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { rows.push([]); top = t; }
      rows[rows.length - 1].push(w);
    });
    k.vis.textContent = '';
    const lines = rows.map((r) => {
      const line = d.createElement('span'); line.className = 'kl';
      r.forEach((w, i) => { line.appendChild(w); if (i < r.length - 1) line.appendChild(d.createTextNode(' ')); });
      k.vis.appendChild(line);
      return line;
    });
    /* Mỗi dòng thành một gốc bố cục (chiều cao cố định + contain): chữ co giãn theo con trỏ chỉ bố cục lại trong dòng đó,
       không kéo cả đầu trang bố cục lại mỗi khung. Đọc hết rồi mới ghi để không ép bố cục nhiều lần. */
    /* contain:size coi dòng như rỗng khi tính bề rộng nội tại → tiêu đề nằm trong ô flex (mục cuối trang) co về 0 và
       bị huy hiệu đè lên. Đặt luôn bề rộng = từ đầu tới hết từ cuối của dòng. */
    const box = lines.map((l) => {
      const ws = l.querySelectorAll('.kw'), a = ws[0].getBoundingClientRect(), b = ws[ws.length - 1].getBoundingClientRect();
      return [Math.ceil(b.right - a.left) + 1, l.offsetHeight];
    });
    lines.forEach((l, i) => { l.style.width = box[i][0] + 'px'; l.style.height = box[i][1] + 'px'; l.classList.add('kl-c'); });
    k.locked = true;
    return true;
  }

  /* Mỗi chữ cái có hai lò xo: a = đã "nở" (0 hẹp-mảnh → 1 dáng gốc), u = độ phình khi con trỏ tới gần. Cả khối chữ chung
     một chủ: mỗi khung tính trục cho từng chữ rồi xếp vị trí cả khối một lượt (place).
     Giá trị trục làm tròn theo bậc (wght 10, wdth 1): mỗi tổ hợp trục là một bản phông riêng phải dựng và shape lại —
     để liên tục thì khung nào cũng dựng phông mới (đo được ~15 ms/khung); theo bậc thì bản phông được dùng lại từ bộ đệm. */
  function letterKit(k, opt) {
    const sw = opt.sw || 10, sd = opt.sd || 1;
    const kit = k.letters.map((c) => ({ c, a: null, u: null, x: 0, y: 0, fv: '', col: '', w: 0, wd: 0, rw: 0, rd: 0, tx: 0 }));
    const o = owner(() => {
      kit.forEach((L) => {
        const a = L.a.x, u = Math.max(0, L.u.x);
        let fv = '', col = '';
        L.rw = opt.w0; L.rd = opt.d0;
        if (!(L.a.t === 1 && L.u.t === 0 && Math.abs(a - 1) < 0.003 && u < 0.003)) {
          /* Trễ bậc: chỉ nhảy sang bậc mới khi giá trị đã đi quá ¾ bậc — không thì dao động nhỏ quanh ranh giới hai bậc
             làm chữ nhảy qua lại mỗi khung (user #301: "Cryo" di quanh mà không vào chữ thì rung giật). */
          const rw = L.rw = clamp(lerp(opt.w0a, opt.w0, a) + (opt.w1 - opt.w0) * u, 300, 800);
          const rd = L.rd = clamp(lerp(opt.d0a, opt.d0, a) + (opt.d1 - opt.d0) * u, 75, 125);
          if (!L.w || Math.abs(rw - L.w) >= sw * 0.75) L.w = Math.round(rw / sw) * sw;
          if (!L.wd || Math.abs(rd - L.wd) >= sd * 0.75) L.wd = Math.round(rd / sd) * sd;
          fv = "'wght' " + L.w + ", 'wdth' " + L.wd + ", 'ROND' 100";
          if (opt.tint && u > 0.03) col = 'color-mix(in oklab, var(--primary) ' + Math.round(clamp(u, 0, 1) * 20) * 5 + '%, var(--on-surface))';
        }
        if (!fv) L.w = L.wd = 0;
        if (fv !== L.fv) { L.fv = fv; L.c.style.fontVariationSettings = fv; }
        if (col !== L.col) { L.col = col; L.c.style.color = col; }
      });
      if (k.slot) slotPlace(k, kit, opt);
    });
    kit.forEach((L) => { L.a = new Spring(1, 0.002, o); L.u = new Spring(0, 0.002, o); });
    kit.o = o; k.kit = kit;
    return kit;
  }

  /* Ô chữ cố định (#302). Chữ phình mà vẫn để trình duyệt xếp theo dòng thì mỗi bậc trục của MỘT chữ đẩy cả phần dòng phía
     sau nó nhảy một bậc; nhiều chữ đổi bậc so le nhau là cả dòng run qua lại (user #301, #302: "rê chuột chậm qua tiêu đề,
     chữ co giãn vẫn rung"; "Cryo" căn giữa thì run cả hai đầu). Nở xong, mỗi chữ cái thành một ô inline-block rộng đúng
     bằng lúc đứng yên (đo từ bố cục thật nên giữ nguyên khoảng chữ + kerning); vị trí khi phình tính bằng transform từ bề
     rộng LIÊN TỤC — chữ trôi êm từng phần điểm ảnh, còn bậc trục chỉ đổi nét chữ, căn giữa trong ô của nó. Dòng không còn
     bố cục lại mỗi khung.
     Bề rộng KHÔNG tuyến tính theo trục (đo #302: "Cryo" 480 px lệch tới 19 px so với nội suy hai đầu) → đo SLOT_N + 1 mốc
     dọc đường phình (wght và wdth cùng tăng theo u) rồi nội suy từng đoạn; độ lệch nhỏ khỏi đường do làm tròn bậc thì tính
     bằng độ dốc riêng của từng trục. Đo một lần mỗi lần ghim (vài lượt bố cục của riêng dòng chữ). */
  const fvOf = (w, dd) => "'wght' " + w + ", 'wdth' " + dd + ", 'ROND' 100";
  const SLOT_N = 8;
  function pin(k, opt) {
    if (k.slot) return true;
    if (k.busy || !k.kit || !shown(k.vis)) return false;
    const kit = k.kit, cs = kit.map((L) => L.c);
    const rects = (fv) => { cs.forEach((c) => { c.style.fontVariationSettings = fv; }); return cs.map((c) => c.getBoundingClientRect()); };
    cs.forEach((c) => { c.style.transform = ''; });
    const path = [];
    for (let j = 1; j <= SLOT_N; j++) path.push(rects(fvOf(+lerp(opt.w0, opt.w1, j / SLOT_N).toFixed(2), +lerp(opt.d0, opt.d1, j / SLOT_N).toFixed(2))));
    const r1 = rects(fvOf(opt.w1, opt.d0)), r2 = rects(fvOf(opt.w0, opt.d1)), r0 = rects('');
    const box = k.el.getBoundingClientRect(), ta = getComputedStyle(k.el).textAlign;
    k.slot = {
      align: ta === 'center' ? 0.5 : (ta === 'right' || ta === 'end') ? 1 : 0,
      m: cs.map((c, i) => ({
        line: c.closest('.kl') || k.vis, w: r0[i].width, g: [r0[i].width].concat(path.map((r) => r[i].width)),
        pw: r1[i].width - r0[i].width, pd: r2[i].width - r0[i].width,
      })),
    };
    kit.forEach((L, i) => {
      L.x = r0[i].left + r0[i].width / 2 - box.left; L.y = r0[i].top + r0[i].height / 2 - box.top;
      L.fv = '\u0000'; L.tx = 0;
      L.c.style.width = r0[i].width + 'px'; L.c.classList.add('kc-pin');
    });
    kit.o.apply();
    return true;
  }
  function unpin(k) {
    if (!k.slot) return;
    k.slot = null;
    k.kit.forEach((L) => { L.c.classList.remove('kc-pin'); L.c.style.width = ''; L.c.style.transform = ''; L.tx = 0; });
  }
  function slotPlace(k, kit, opt) {
    const S = k.slot, sx = new Array(kit.length);
    const width = (m, w, dd) => {
      const uw = (w - opt.w0) / (opt.w1 - opt.w0), ud = (dd - opt.d0) / (opt.d1 - opt.d0), u = (uw + ud) / 2;
      const f = clamp(u, 0, 1) * SLOT_N, j = Math.min(SLOT_N - 1, Math.floor(f));
      return m.g[j] + (m.g[j + 1] - m.g[j]) * (f - j) + (uw - u) * m.pw + (ud - u) * m.pd;
    };
    let line = null, acc = 0, from = 0;
    const close = (to) => { if (S.align) for (let j = from; j < to; j++) sx[j] -= acc * S.align; };
    for (let i = 0; i < kit.length; i++) {
      const L = kit[i], m = S.m[i];
      if (m.line !== line) { close(i); line = m.line; acc = 0; from = i; }
      const V = width(m, L.rw, L.rd), A = L.fv ? width(m, L.w, L.wd) : m.w;
      sx[i] = acc + (V - A) / 2;
      acc += V - m.w;
    }
    close(kit.length);
    kit.forEach((L, i) => {
      const t = Math.abs(sx[i]) < 0.05 ? 0 : Math.round(sx[i] * 20) / 20;
      if (t !== L.tx) { L.tx = t; L.c.style.transform = t ? 'translateX(' + t + 'px)' : ''; }
    });
  }
  /* Chữ "nở" lần lượt: từ bay lên, chữ cái từ hẹp-mảnh sang dáng gốc. Nở thì về bố cục dòng thường (bề rộng đổi nhiều). */
  function bloom(k, kit, delay, gap, done) {
    if (reduced) return;
    unpin(k);
    k.busy++;
    kit.forEach((L) => L.a.set(0));
    k.words.forEach((w) => put(w, { y: 28, o: 0 }));
    let i = 0;
    k.words.forEach((w) => {
      const t0 = delay + i * gap;
      setTimeout(() => go(w, { y: 0, o: 1 }, SPEC.stage, SPEC.fade), t0);
      w.querySelectorAll('.kc').forEach(() => { const L = kit[i]; setTimeout(() => L.a.to(1, SPEC.m3SlowSpatial), delay + i * gap); i++; });
    });
    setTimeout(() => { k.busy--; if (!k.busy && relockPending) { relockPending = false; relock(); } if (done) done(); }, delay + i * gap + 900);
    /* Xong thì bỏ transform của từng từ: transform 3D giữ lại biến mỗi từ thành một lớp compositor, làm mọi khung sau
       đó tốn thêm công xếp lớp. */
    setTimeout(function clear() {
      const m = k.words.map((w) => M.mo(w));
      if (m.some((x) => Math.abs(x.y.x) > 0.3 || x.o.x < 0.995)) { setTimeout(clear, 400); return; }
      k.words.forEach((w) => { w.style.transform = ''; w.style.opacity = ''; });
    }, delay + i * gap + 1600);
  }

  /* Phình theo khoảng cách tới con trỏ (chỉ chuột). Toạ độ chữ cái đo lúc đứng yên, tính theo khung của nhóm. */
  /* Chỉ nhóm đang trong màn hình mới được xét (IntersectionObserver; thứ tiếng đang ẩn không bao giờ "trong màn hình"),
     nên mỗi lần chuột nhúc nhích chỉ đọc khung của một hai tiêu đề thay vì của tất cả. */
  const swells = [];
  /* Phình không nảy (tắt dần tới hạn): nảy qua lại là chữ co giãn qua lại = rung. */
  const SWELL = { z: 1, k: 240 };
  const seen = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { const s = swells.find((x) => x.k.vis === e.target); if (s) s.inView = e.isIntersecting; }), { rootMargin: '25% 0px' })
    : null;
  function swell(k, kit, opt) {
    const s = { k, kit, opt, inView: !seen };
    swells.push(s);
    if (seen && fine && !reduced) seen.observe(k.vis);
    return s;
  }
  if (fine && !reduced) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      swells.forEach((s) => {
        if (!s.inView && !s.hot) return;
        if (s.k.busy || !shown(s.k.vis)) return;
        if (!s.fs) s.fs = parseFloat(getComputedStyle(s.k.el).fontSize) || 60;
        const r = s.k.el.getBoundingClientRect(), R = s.fs * s.opt.reach, pad = R * 1.6;
        const near = e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad;
        if (!near && !s.hot) return;
        /* Ô chữ + toạ độ tâm từng chữ đo một lần lúc đứng yên (pin); đổi cỡ/ngôn ngữ thì gỡ ra và đo lại lần sau. */
        if (!pin(s.k, s.opt)) return;
        s.hot = near;
        s.kit.forEach((L) => {
          const dx = e.clientX - (r.left + L.x), dy = (e.clientY - (r.top + L.y)) * 1.25;
          const t = near ? Math.exp(-(dx * dx + dy * dy) / (R * R)) : 0;
          if (Math.abs(t - L.u.t) > 0.015) L.u.to(t < 0.02 ? 0 : t, SWELL);
        });
      });
    }, { passive: true });
    d.addEventListener('mouseout', (e) => { if (!e.relatedTarget) swells.forEach((s) => { s.hot = false; s.kit.forEach((L) => L.u.to(0, SWELL)); }); });
  }
  const restale = () => swells.forEach((s) => { unpin(s.k); s.fs = 0; });

  /* Tiêu đề mở đầu: nở khi tải trang, phình theo con trỏ. */
  const HERO = { w0a: 300, w0: 640, w1: 800, d0a: 75, d0: 100, d1: 112, reach: 1.35, tint: true };
  const heroKs = [];
  d.addEventListener('cryo:intro', () => {
    $$('.hero-h .hl').forEach((el) => {
      const k = split(el), kit = letterKit(k, HERO);
      heroKs.push({ k, kit });
      swell(k, kit, HERO);
    });
    let delay = 80;
    heroKs.forEach(({ k, kit }) => { if (lock(k)) { bloom(k, kit, delay, 26); delay += k.letters.length * 26 * 0.6; } });
  });

  /* Tiêu đề mục: nở khi cuộn tới. */
  const H2 = { w0a: 300, w0: 580, w1: 760, d0a: 75, d0: 100, d1: 110, reach: 1.2, tint: true };
  const headKs = [];
  $$('.h2').forEach((h) => {
    const parts = $$('[lang]', h);
    (parts.length ? parts : [h]).forEach((p) => {
      const k = split(p), kit = letterKit(k, H2);
      headKs.push({ h, k, kit, done: false });
      swell(k, kit, H2);
    });
  });
  if (!reduced) {
    headKs.forEach((x) => { if (shown(x.k.vis)) x.k.words.forEach((w) => put(w, { o: 0 })); });
    io($$('.h2'), { threshold: 0.3, rootMargin: '0px 0px -6% 0px' }, (h, on, o) => {
      if (!on) return;
      if (o) o.unobserve(h);
      headKs.filter((x) => x.h === h && !x.done).forEach((x) => {
        x.done = true;
        if (lock(x.k)) bloom(x.k, x.kit, 0, 18); else x.k.words.forEach((w) => put(w, { o: 1 }));
      });
    });
  }

  /* Chữ "Cryo" cỡ lớn cuối trang: mảnh và hẹp, phình mạnh theo con trỏ; trên điện thoại nở một lần khi cuộn tới. */
  /* Chữ rất lớn: bậc trục mịn hơn (mỗi bậc wdth ở cỡ này là vài điểm ảnh) — chỉ 4 chữ cái nên dựng phông vẫn rẻ. */
  const FIN = { w0a: 300, w0: 330, w1: 800, d0a: 75, d0: 92, d1: 125, reach: 0.55, tint: false, sw: 4, sd: 0.5 };
  const finEl = $('.fin-word');
  if (finEl) {
    const k = split(finEl, false), kit = letterKit(k, FIN);
    swell(k, kit, FIN);
    /* Dải màu tô TỪNG chữ cái (CSS .fin-word.split .kc), kéo dài bằng cả từ và dời theo chỗ của chữ đó, nên nhìn vẫn là
       một dải liền. Trước đây cả khối chữ lẫn từ cùng tô background-clip:text: lúc từ đang bay lên (có transform), Chrome
       vẽ thêm một bản chữ của khối cha lệch hẳn sang trái — user #302 thấy "CryoCryo" mỗi lần chữ hiện ra. */
    const grad = () => {
      const w = k.words[0], wr = w.getBoundingClientRect();
      if (!wr.width) return;
      kit.forEach((L) => {
        const r = L.c.getBoundingClientRect();
        L.c.style.backgroundSize = wr.width.toFixed(1) + 'px 100%';
        L.c.style.backgroundPosition = (wr.left - r.left - L.tx).toFixed(1) + 'px 0';
      });
    };
    finEl.classList.add('split');
    /* Như dòng tiêu đề: khung cố định + contain để chữ phình chỉ bố cục lại bên trong. */
    const fitFin = () => {
      if (k.busy) return;
      unpin(k);
      finEl.classList.remove('kl-c'); finEl.style.height = ''; finEl.style.height = finEl.offsetHeight + 'px'; finEl.classList.add('kl-c');
      grad();
    };
    fitFin();
    addEventListener('resize', later(fitFin, 200));
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(fitFin);
    if (!reduced) {
      k.words.forEach((w) => put(w, { o: 0 }));
      io([finEl], { threshold: 0.4 }, (el, on, o) => {
        if (!on) return;
        if (o) o.unobserve(el);
        /* Điện thoại: không có con trỏ để rê → nở xong thì tự phình một nhịp (trên ô chữ cố định, không xô dòng). */
        bloom(k, kit, 0, 90, () => {
          fitFin();
          if (!fine && pin(k, FIN)) kit.forEach((L, i) => setTimeout(() => { L.u.to(0.55, SPEC.m3SlowSpatial); }, i * 110));
        });
      });
    }
  }

  /* Đổi ngôn ngữ / đổi cỡ: khoá lại dòng cho thứ tiếng đang hiện, đo lại chữ cái. */
  /* Tiêu đề đang nở thì bỏ qua (đo lúc chữ đang hẹp là sai) và đánh dấu để khoá lại ngay khi nở xong. */
  let relockPending = false;
  const relock = () => {
    heroKs.concat(headKs).forEach((x) => {
      if (!(x.k.locked || x.h === undefined || x.done)) return;
      if (x.k.busy) relockPending = true; else lock(x.k);
    });
    restale();
  };
  M.refreshers.push(() => requestAnimationFrame(relock));
  /* Phông web tải xong sau lần ghim đầu: bề rộng ô chữ đo bằng phông dự phòng là sai → gỡ ghim, đo lại. */
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => requestAnimationFrame(relock));
  addEventListener('resize', later(relock, 220));

  /* Liên kết đầu trang: rê vào thì chữ giãn rộng, đậm lên, đổi màu. Giữ sẵn chỗ bằng bề rộng lúc giãn để hàng không xô. */
  (function nav() {
    const links = $$('.top-nav a');
    const fit = () => links.forEach((a) => {
      a.style.minWidth = ''; a.classList.add('wide');
      const w = a.offsetWidth; a.classList.remove('wide');
      if (w) a.style.minWidth = Math.ceil(w) + 'px';
    });
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(fit);
    M.refreshers.push(fit);
    addEventListener('resize', later(fit, 200));
  })();

  /* ================= Con trỏ âm bản ================= */
  /* Hai lớp, cùng hoà trộn "difference" để thấy được trên cả nền tối lẫn khu nền sáng:
     - khối âm bản (chấm trắng): nút trong suốt / chữ → khối bay vào phủ đúng viên thuốc của nút, chữ bên dưới đảo màu;
     - vòng sáng: nút TÔ MÀU, nút có ảnh (logo, huy hiệu Google Play) → đảo màu lên chúng ra tông xỉn/bẩn (user #301 chê
       "Open game bị tối đi", và huy hiệu Google Play không được đổi màu) → vòng bung ra từ chính cái chấm, ôm quanh nút.
     Rời nút: hình thu về chấm theo hướng chuột, KHÔNG xoay (bản trước kéo giãn theo vận tốc bằng phép xoay cả hình → viên
     thuốc rời theo chiều dọc bị "nằm ngang rồi xoay dọc").
     Điện thoại (#302, user muốn có con trỏ cả trên điện thoại): không có chuột để bám, nên con trỏ chỉ hiện khi CHẠM —
     bung ra dưới ngón tay, bay vào ôm nút vừa chạm (cùng khối / vòng như máy tính), thả tay thì giữ thêm một nhịp rồi thu
     về và tan. Vuốt cuộn trang thì tan ngay: bám theo ngón tay suốt lúc cuộn chỉ che nội dung và rối mắt. */
  (function cursor() {
    if (reduced) return;
    const mk = (cls) => { const e = d.createElement('div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); const i = d.createElement('i'); e.appendChild(i); d.body.appendChild(e); return [e, i]; };
    const [el, blob] = mk('m3-cursor'), [hel, ring] = mk('m3-cursor m3-halo');
    if (fine) root.classList.add('cur-on');
    const HIT = 'a[href], button, summary, [role="switch"], [role="radio"], .ov, input[type="range"]';
    const MAG = '.btn, .top-nav a, .brand, .seg button, .swatches button, .play-badge, .foot-links a, .more summary, .rp-close';
    /* Chữ "Cryo" cuối trang không dùng thấu kính: để hiệu ứng phình chữ tự nói. */
    const LENS = '.hero-h, .h2, .kin-row';
    const FOLLOW = { z: 0.82, k: 1100 }, SHRINK = { z: 0.92, k: 760 };
    /* Chạm vào chỗ không phải nút: khối cỡ đầu ngón tay (lộ ra quanh ngón), không phải chấm 12 px nằm khuất dưới ngón. */
    const TOUCH_FREE = 44;
    /* Vùng có màu thật của ảnh huy hiệu Google Play (ảnh có lề trong suốt): [lề ngang, lề dọc, bán kính góc] theo tỉ lệ. */
    const BADGE = { vi: [0, 0.116, 0.13], en: [0.0635, 0.164, 0.137] };
    let px = -200, py = -200, tgt = null, lens = null, kind = 'free', inside = false, shownR = 6, follow = 0;
    let touch = !fine, ringOut = false, ringBw = -1, liftT = 0;
    const o = owner(paint);
    /* Cỡ (rộng/cao) của con trỏ: phình ra tính theo điểm ảnh, co lại tính theo LOG của cỡ. Độ nảy khi co nhờ thế tỉ lệ với
       cỡ đích: từ khung nút 200 px về chấm 12 px vẫn nảy mềm quanh 12 px (xuống ~9 px rồi về) mà không lộn qua 0 — vòng #301
       phải bỏ hẳn nảy lúc co vì lộn qua 0, và user #302 chê "thu lại mất mềm mại, mất nảy như trước". Đổi miền giữa chừng giữ
       nguyên vận tốc nên không khựng. */
    function dim(v0) {
      const s = new Spring(v0, 0.05, o);
      let log = false;
      const val = () => (log ? Math.exp(s.x) : s.x);
      return {
        get x() { return val(); },
        get v() { return log ? s.v * val() : s.v; },
        set(v) { log = false; s.eps = 0.05; s.set(v); },
        to(v, spec) {
          if (Math.abs(v - (log ? Math.exp(s.t) : s.t)) < 0.01) return;
          const x = val(), down = v < x;
          if (down !== log) {
            const vel = log ? s.v * x : s.v / Math.max(1, x);
            log = down; s.eps = log ? 0.002 : 0.05;
            s.x = log ? Math.log(Math.max(1, x)) : x; s.v = vel;
          }
          s.to(log ? Math.log(Math.max(1, v)) : v, spec);
        },
      };
    }
    const X = new Spring(px, 0.05, o), Y = new Spring(py, 0.05, o), W = dim(12), H = dim(12);
    const R = new Spring(6, 0.05, o), S = new Spring(1, 0.001, o), O = new Spring(0, 0.002, o);
    const hX = new Spring(px, 0.05, o), hY = new Spring(py, 0.05, o), hW = dim(12), hH = dim(12);
    const hR = new Spring(6, 0.05, o), hO = new Spring(0, 0.002, o);
    /* Nền đặc (màu có độ phủ) hay có ảnh → vòng sáng. Màu tính ra có thể ở dạng color()/oklab() (do color-mix) → vẽ thử
       1 điểm ảnh để đọc độ phủ; nhớ theo chuỗi màu. */
    const probe = d.createElement('canvas').getContext('2d', { willReadFrequently: true });
    probe.canvas.width = probe.canvas.height = 1;
    const solid = (t) => {
      if (t.querySelector('img')) return true;
      const cs = getComputedStyle(t), bg = cs.backgroundColor + cs.backgroundImage;
      if (t.cryoBg !== bg) {
        probe.clearRect(0, 0, 1, 1); probe.fillStyle = 'transparent'; probe.fillStyle = cs.backgroundColor; probe.fillRect(0, 0, 1, 1);
        t.cryoBg = bg; t.cryoSolid = cs.backgroundImage !== 'none' || probe.getImageData(0, 0, 1, 1).data[3] > 128;
      }
      return t.cryoSolid;
    };
    /* Độ giãn theo vận tốc — chỉ khi hình gần tròn (viên thuốc dài mà giãn thêm thì méo). */
    const stretch = (sx, sy, w, h) => { const round = Math.min(w, h) / Math.max(1, w, h); return Math.min(0.38, Math.hypot(sx.v, sy.v) / 4400) * round * round; };
    const box = (b, i, sx, sy, w, h, r, k, sc) => {
      /* Kéo giãn theo hướng chuột mà không xoay hình: xoay vào hướng, giãn, xoay trả lại. */
      const a = Math.atan2(sy.v, sx.v) * 57.2958;
      b.style.transform = 'translate3d(' + sx.x.toFixed(1) + 'px,' + sy.x.toFixed(1) + 'px,0)' +
        (k > 0.004 ? ' rotate(' + a.toFixed(1) + 'deg) scale(' + (1 + k).toFixed(3) + ',' + (1 - k * 0.45).toFixed(3) + ') rotate(' + (-a).toFixed(1) + 'deg)' : '') +
        (sc !== 1 ? ' scale(' + sc.toFixed(3) + ')' : '');
      i.style.width = w.toFixed(1) + 'px'; i.style.height = h.toFixed(1) + 'px';
      i.style.margin = (-h / 2).toFixed(1) + 'px 0 0 ' + (-w / 2).toFixed(1) + 'px';
      i.style.borderRadius = r.toFixed(1) + 'px';
    };
    function paint() {
      const hw = Math.max(0, hW.x), hh = Math.max(0, hH.x), m = Math.min(hw, hh);
      /* Vòng và chấm là MỘT khối: vòng càng nhỏ viền càng dày, tới cỡ chấm thì đặc hẳn. Vòng bung ra từ chính cái chấm;
         rời nút thì thu lại (nảy) thành đúng cái chấm rồi mới trao chỗ cho khối âm bản — cùng cỡ, cùng chỗ nên không thấy
         chỗ nối. Bản #301 cho vòng mờ đi khi còn to, trong lúc một cái chấm khác hiện ra ở chỗ con trỏ: hai vật khác nhau
         (user #302: "mất liền mạch"). Trao chỗ TRƯỚC khi ghi kiểu của cả hai: không có khung nào cả hai cùng ẩn. */
      if (ringOut && Math.abs(hw - 12) < 0.8 && Math.abs(hh - 12) < 0.8 && Math.abs(hW.v) < 30 && Math.abs(hH.v) < 30) {
        ringOut = false; hO.set(0);
        if (inside) { W.set(hw); H.set(hh); X.set(hX.x); Y.set(hY.x); O.set(1); W.to(12, SPEC.m3FastSpatial); H.to(12, SPEC.m3FastSpatial); }
      }
      const w = Math.max(0, W.x), h = Math.max(0, H.x);
      /* Ngoài lúc phủ nút, khối luôn là viên thuốc/chấm tròn (bán kính = nửa cạnh ngắn) — không bao giờ ra chữ nhật góc
         vuông lúc đang co về. */
      shownR = kind === 'shape' ? clamp(R.x, 0, Math.min(w, h) / 2) : Math.min(w, h) / 2;
      box(el, blob, X, Y, w, h, shownR, kind === 'shape' ? 0 : stretch(X, Y, w, h), S.x);
      el.style.opacity = clamp(O.x, 0, 1).toFixed(3);
      const f = clamp((28 - m) / 14, 0, 1), bw = Math.round(lerp(2, m / 2, f * f * (3 - 2 * f)) * 10) / 10;
      if (bw !== ringBw) { ringBw = bw; ring.style.boxShadow = 'inset 0 0 0 ' + bw + 'px #fff'; }
      box(hel, ring, hX, hY, hw, hh, clamp(hR.x, 0, m / 2), ringOut ? stretch(hX, hY, hw, hh) : 0, S.x);
      hel.style.opacity = clamp(hO.x, 0, 1).toFixed(3);
    }
    /* Nút nhích theo con trỏ một chút (thuộc tính translate, cộng dồn được với transform sẵn có của nút). */
    const mags = new Map();
    function magnet(t, dx, dy) {
      let m = mags.get(t);
      if (!m) {
        const mo2 = owner(() => {
          const idle = m.x.t === 0 && m.y.t === 0 && Math.abs(m.x.x) < 0.05 && Math.abs(m.y.x) < 0.05;
          t.style.translate = idle ? '' : m.x.x.toFixed(2) + 'px ' + m.y.x.toFixed(2) + 'px';
        });
        m = { x: new Spring(0, 0.02, mo2), y: new Spring(0, 0.02, mo2) };
        mags.set(t, m);
      }
      m.x.to(dx, SPEC.m3FastSpatial); m.y.to(dy, SPEC.m3FastSpatial);
    }
    function pick(node) {
      const t = node && node.closest ? node.closest(HIT) : null;
      if (t !== tgt) {
        if (tgt && mags.has(tgt)) magnet(tgt, 0, 0);
        tgt = t;
      }
      lens = !t && !touch && node && node.closest ? node.closest(LENS) : null;
    }
    /* Khung + bán kính THẬT của nút, đọc lại mỗi lần (nút bấm vuông góc lại, nút bật/tắt đổi dáng → con trỏ bám theo).
       Huy hiệu Google Play: lấy đúng vùng có màu của ảnh. Chữ/logo không viền: chừa lề và bo tối thiểu như một viên thuốc. */
    function frame(t) {
      const img = t.matches('.play-badge') && [...t.querySelectorAll('img')].find((i) => i.getClientRects().length);
      if (img) {
        const r = img.getBoundingClientRect(), b = BADGE[img.lang] || BADGE.en, ix = r.width * b[0], iy = r.height * b[1];
        return { l: r.left + ix, t: r.top + iy, w: r.width - ix * 2, h: r.height - iy * 2, r: (r.height - iy * 2) * b[2] };
      }
      const r = t.getBoundingClientRect(), v = getComputedStyle(t).borderTopLeftRadius, n = parseFloat(v) || 0;
      let rad = Math.min(r.height / 2, r.width / 2, /%$/.test(v) ? Math.min(r.width, r.height) * n / 100 : n), pad = 0;
      if (rad < 6) { pad = 6; rad = Math.min(14, (r.height + 12) / 2) - pad; }
      return { l: r.left - pad, t: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2, r: rad + pad };
    }
    function update() {
      if (tgt && !tgt.isConnected) tgt = null;
      let halo = null;
      if (tgt) {
        const r = tgt.getBoundingClientRect();
        if (tgt.matches('input[type="range"]')) { kind = 'free'; size(touch ? 20 : 8); chase(); }
        else if (!r.width || r.height > 78 || r.width > 460) { kind = 'soft'; size(44); chase(); }
        else {
          const f = frame(tgt), m = mags.get(tgt);
          const cx = f.l + f.w / 2 - (m ? m.x.x : 0), cy = f.t + f.h / 2 - (m ? m.y.x : 0), dx = px - cx, dy = py - cy;
          let mx = 0, my = 0;
          /* Nam châm chỉ cho chuột: dưới ngón tay thì nút nhích theo chỉ làm lệch chỗ vừa chạm. */
          if (!touch && tgt.matches(MAG)) { mx = clamp(dx * 0.16, -7, 7); my = clamp(dy * 0.22, -5, 5); magnet(tgt, mx, my); }
          const g = { x: cx + mx + dx * 0.05, y: cy + my + dy * 0.05, w: f.w, h: f.h, r: f.r };
          if (solid(tgt)) { halo = g; kind = 'halo'; size(6); chase(); }
          else {
            if (kind !== 'shape') R.set(shownR);
            kind = 'shape';
            X.to(g.x, SPEC.m3FastSpatial); Y.to(g.y, SPEC.m3FastSpatial);
            W.to(g.w, SPEC.m3FastSpatial); H.to(g.h, SPEC.m3FastSpatial); R.to(g.r, SPEC.m3FastSpatial);
          }
        }
      } else if (lens) { kind = 'lens'; size(92); chase(); }
      else { kind = 'free'; size(touch ? TOUCH_FREE : 12); chase(); }
      /* Vòng sáng: bung ra từ chấm tại vị trí con trỏ tới ôm nút (cách mép 5px). Rời nút về con trỏ trần (chuột): thu về
         thành chấm rồi trao chỗ (xem paint). Rời sang thứ khác (thấu kính, nút trong suốt) hoặc trên điện thoại: tan dần. */
      if (halo) {
        ringOut = false;
        if (hO.t === 0) { hX.set(px); hY.set(py); hW.set(12); hH.set(12); hR.set(6); }
        hX.to(halo.x, SPEC.m3FastSpatial); hY.to(halo.y, SPEC.m3FastSpatial);
        hW.to(halo.w + 10, SPEC.m3FastSpatial); hH.to(halo.h + 10, SPEC.m3FastSpatial); hR.to(halo.r + 5, SPEC.m3FastSpatial);
        hO.to(1, SPEC.m3FastEffects); O.to(0, SPEC.m3FastEffects);
      } else {
        hX.to(px, FOLLOW); hY.to(py, FOLLOW); hW.to(12, SPEC.m3FastSpatial); hH.to(12, SPEC.m3FastSpatial); hR.to(6, SHRINK);
        if (hO.t > 0 && kind === 'free' && inside && !touch) ringOut = true;
        else if (hO.t > 0 || ringOut) { ringOut = false; hO.to(0, SPEC.m3Effects); }
        if (inside && !ringOut) O.to(1, SPEC.m3FastEffects);
      }
    }
    function size(s) { W.to(s, SPEC.m3FastSpatial); H.to(s, SPEC.m3FastSpatial); R.to(s / 2, SHRINK); }
    function chase() { X.to(px, FOLLOW); Y.to(py, FOLLOW); }
    /* Bấm / thả: nút đổi dáng và đổi màu trong ~0,3 s — bám theo từng khung trong lúc đó. */
    function track(ms) {
      clearTimeout(follow); let on = true; follow = setTimeout(() => { on = false; }, ms);
      const loop = () => { if (!on || !inside) return; update(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    const toMouse = () => { if (touch) { touch = false; clearTimeout(liftT); } root.classList.add('cur-on'); };
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        /* Ngón tay đang đặt (chưa thành cú cuộn): bám theo, dò lại thứ dưới ngón (sự kiện chạm luôn gắn với chỗ đặt tay). */
        if (touch && inside && e.isPrimary) { px = e.clientX; py = e.clientY; pick(d.elementFromPoint(px, py)); update(); }
        return;
      }
      /* Bút trên máy có chuột: trả con trỏ gốc của hệ thống (không thì không còn con trỏ nào hiện). */
      if (e.pointerType !== 'mouse') { O.to(0, SPEC.m3FastEffects); hO.to(0, SPEC.m3FastEffects); inside = false; ringOut = false; root.classList.remove('cur-on'); return; }
      toMouse();
      px = e.clientX; py = e.clientY;
      if (!inside) { inside = true; X.set(px); Y.set(py); O.to(1, SPEC.m3FastEffects); }
      pick(e.target); update();
    }, { passive: true });
    /* Lúc cuộn, phần tử dưới con trỏ đổi theo: dò lại (hit-test, ép bố cục) tối đa ~8 lần/giây, không phải mỗi sự kiện. */
    let probeT = 0;
    addEventListener('scroll', () => {
      if (!inside || probeT || touch) return;
      probeT = setTimeout(() => { probeT = 0; if (inside && !touch) { pick(d.elementFromPoint(px, py)); update(); } }, 120);
    }, { passive: true });
    const leave = () => { if (touch) return; inside = false; ringOut = false; O.to(0, SPEC.m3FastEffects); hO.to(0, SPEC.m3FastEffects); };
    d.addEventListener('mouseout', (e) => { if (!e.relatedTarget) leave(); });
    addEventListener('blur', leave);
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { toMouse(); S.to(kind === 'shape' || kind === 'halo' ? 0.95 : 0.75, SPEC.m3FastSpatial); track(400); return; }
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      touch = true; root.classList.remove('cur-on'); clearTimeout(liftT);
      px = e.clientX; py = e.clientY;
      /* Chạm mới (con trỏ đã tan): bung ra từ đúng đầu ngón tay. */
      if (O.x < 0.05 && hO.x < 0.05) { X.set(px); Y.set(py); W.set(6); H.set(6); hX.set(px); hY.set(py); hO.set(0); }
      inside = true; ringOut = false; O.to(1, SPEC.m3FastEffects);
      pick(e.target); update(); S.to(0.92, SPEC.m3FastSpatial); track(400);
    }, { passive: true });
    const lift = (e) => {
      if (e.pointerType === 'mouse') { S.to(1, SPEC.m3FastSpatial); if (inside) track(450); return; }
      if (!touch || e.pointerType !== 'touch' || !e.isPrimary) return;
      const up = e.type === 'pointerup';
      S.to(1, SPEC.m3FastSpatial);
      if (up) track(320);
      /* Thả tay: giữ hình trên nút thêm một nhịp (thấy nút đã nhận cú chạm; nút đổi màu/dáng thì con trỏ bám theo), rồi thu
         về và tan. Vuốt cuộn (pointercancel) thì tan ngay. */
      clearTimeout(liftT);
      liftT = setTimeout(() => {
        inside = false; tgt = null; lens = null; kind = 'free'; ringOut = false;
        size(8); chase(); O.to(0, SPEC.m3Effects);
        hX.to(px, FOLLOW); hY.to(py, FOLLOW); hW.to(12, SPEC.m3FastSpatial); hH.to(12, SPEC.m3FastSpatial); hR.to(6, SHRINK);
        hO.to(0, SPEC.m3SlowEffects);
      }, up ? 340 : 0);
    };
    addEventListener('pointerup', lift, { passive: true });
    addEventListener('pointercancel', lift, { passive: true });
  })();

  /* ================= Khối 3D theo màu chủ đề ================= */
  const hex = (s) => { s = (s || '').trim().replace('#', ''); if (s.length === 3) s = s.replace(/./g, '$&$&'); const n = parseInt(s, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mixA = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = (c, al) => (al === undefined ? 'rgb(' : 'rgba(') + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + (al === undefined ? ')' : ',' + al + ')');
  /* Tăng độ bão hoà quanh độ sáng trung bình: màu tông 80 của M3 vốn nhạt, khối 3D cần đậm đà như ảnh minh hoạ. */
  const sat = (c, k) => { const m = (c[0] + c[1] + c[2]) / 3; return c.map((v) => clamp(m + (v - m) * k, 0, 255)); };
  const BLACK = [0, 0, 0], WHITE = [255, 255, 255];
  const orbs = $$('.orb').map((w, i) => {
    const cv = d.createElement('canvas'); w.appendChild(cv);
    const names = (w.dataset.shape || 'cookie9 flower').split(' ');
    const ob = {
      w, cv, ctx: cv.getContext('2d'), i,
      A: shapePts(SHAPES[names[0]] || SHAPES.cookie9, 150), B: shapePts(SHAPES[names[1] || names[0]] || SHAPES.flower, 150),
      roles: (w.dataset.c || 'primary tertiary').split(' '), dep: +w.dataset.depth || 0.3, col: null, on: false, timer: 0,
    };
    const o = owner(() => { ob.dirty = true; queueOrbs(); });
    ob.u = new Spring(0, 0.001, o); ob.rot = new Spring(+w.dataset.rot || 0, 0.05, o);
    return ob;
  });
  function colors(ob) {
    const cs = getComputedStyle(ob.w), get = (n) => hex(cs.getPropertyValue('--' + n));
    /* Tông sâu mặc định là màu nền chứa (-c) của màu thứ hai — trên nền tối nó đậm hơn; khu nền sáng thì chỉ định riêng
       (data-deep) vì ở bảng sáng màu nền chứa lại nhạt hơn. */
    const rb = ob.roles[1] || ob.roles[0];
    const a = sat(get(ob.roles[0]), 1.35), b = sat(get(rb), 1.45), deep = sat(get(ob.w.dataset.deep || rb + '-c'), 1.3);
    /* Mặt: sáng (a) → màu thứ hai (b) → ngả về tông sâu ở góc khuất. Thân: từ tông sâu tới gần đen. */
    ob.col = { a, m: mixA(a, b, 0.55), b: mixA(b, deep, 0.38), s1: mixA(b, deep, 0.62), s2: mixA(deep, BLACK, 0.6) };
  }
  /* Khối "đất sét": thân đùn chéo xuống phải đậm dần, mặt trên chuyển màu chéo, bóng trong dưới-phải + ánh trong trên-trái. */
  function render(ob) {
    const cv = ob.cv, W = cv.clientWidth, Hh = cv.clientHeight;
    if (!W || !Hh) return;
    if (!ob.col) colors(ob);
    const dpr = Math.min(1.5, devicePixelRatio || 1), pw = Math.round(W * dpr), ph = Math.round(Hh * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const c = ob.ctx, col = ob.col;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, Hh);
    const u = ob.u.x, ro = ob.rot.x * Math.PI / 180, cs = Math.cos(ro), sn = Math.sin(ro);
    const R = W * 0.33, cx = W * 0.46, cy = Hh * 0.43, D = R * 0.3;
    const face = new Path2D();
    for (let i = 0; i < ob.A.length; i += 2) {
      const x0 = lerp(ob.A[i], ob.B[i], u), y0 = lerp(ob.A[i + 1], ob.B[i + 1], u);
      const x = cx + (x0 * cs - y0 * sn) * R, y = cy + (x0 * sn + y0 * cs) * R;
      if (i) face.lineTo(x, y); else face.moveTo(x, y);
    }
    face.closePath();
    /* Thân: mỗi lớp một màu nội suy liên tục theo độ sâu (không thành sọc), sáng bên trái tối bên phải như có đèn. */
    const N = Math.max(14, Math.round(D / 1.2)), ex = 0.36, ey = 0.93;
    for (let k = N; k >= 1; k--) {
      const f = k / N, base = mixA(col.s1, col.s2, Math.pow(f, 0.8));
      c.save();
      c.translate(ex * D * f, ey * D * f);
      if (k === N) { c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = R * 0.55; c.shadowOffsetY = R * 0.18; }
      const g = c.createLinearGradient(cx - R, cy, cx + R, cy);
      g.addColorStop(0, rgb(mixA(base, WHITE, 0.14))); g.addColorStop(0.55, rgb(base)); g.addColorStop(1, rgb(mixA(base, BLACK, 0.3)));
      c.fillStyle = g; c.fill(face);
      c.restore();
    }
    const g = c.createLinearGradient(cx - R * 0.75, cy - R, cx + R * 0.75, cy + R);
    g.addColorStop(0, rgb(col.a)); g.addColorStop(0.5, rgb(col.m)); g.addColorStop(1, rgb(col.b));
    c.fillStyle = g; c.fill(face);
    c.save();
    c.clip(face);
    /* Viền ngoài chỉ vừa đủ phủ phần bóng (chi phí làm mờ bóng tỉ lệ với diện tích hình được tô). */
    const pad = R * 0.5, hole = new Path2D(); hole.rect(cx - R * 1.4 - pad, cy - R * 1.4 - pad, R * 2.8 + pad * 2, R * 2.8 + pad * 2); hole.addPath(face);
    c.fillStyle = '#000';
    c.shadowColor = 'rgba(0,0,0,.38)'; c.shadowBlur = R * 0.32; c.shadowOffsetX = -R * 0.09; c.shadowOffsetY = -R * 0.13;
    c.fill(hole, 'evenodd');
    c.shadowColor = 'rgba(255,255,255,.5)'; c.shadowBlur = R * 0.2; c.shadowOffsetX = R * 0.05; c.shadowOffsetY = R * 0.07;
    c.fill(hole, 'evenodd');
    c.shadowColor = 'transparent';
    const sp = c.createRadialGradient(cx - R * 0.38, cy - R * 0.42, 0, cx - R * 0.38, cy - R * 0.42, R * 0.75);
    sp.addColorStop(0, 'rgba(255,255,255,.28)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sp; c.fillRect(0, 0, W, Hh);
    c.restore();
  }
  /* Vẽ lại khối gom về một nhịp rAF, tối đa ~30 lần/giây: đổi dáng chậm, mắt không phân biệt được với 60. */
  let orbRaf = 0, orbLast = 0;
  function queueOrbs() { if (!orbRaf) orbRaf = requestAnimationFrame(flushOrbs); }
  function flushOrbs(t) {
    orbRaf = 0;
    if (t - orbLast < 30) { queueOrbs(); return; }
    orbLast = t;
    orbs.forEach((ob) => { if (ob.dirty) { ob.dirty = false; render(ob); } });
  }
  /* Thị sai theo chuột và theo vị trí cuộn của mục chứa khối. Vị trí mục đo sẵn (toạ độ trang) để lúc cuộn không phải
     đọc bố cục mỗi khung. */
  /* sY lấy từ sự kiện cuộn: đọc scrollY ngay trong nhịp ghi kiểu (sau khi chữ/con trỏ vừa đổi) sẽ ép trình duyệt tính
     lại bố cục giữa chừng mỗi khung — profiler đo ra ~25% một nhân lúc rê chuột. */
  let ptrX = 0, ptrY = 0, sY = scrollY;
  const ox = new Spring(0, 0.001, null), oy = new Spring(0, 0.001, null);
  const geo = (ob) => { const r = ob.w.parentNode.getBoundingClientRect(); sY = scrollY; ob.hy = r.top + sY + r.height / 2; };
  const place = owner(() => orbs.forEach((ob) => {
    if (!ob.on) return;
    const sy = (ob.hy - sY - innerHeight / 2) * -0.22 * ob.dep;
    ob.w.style.transform = 'translate3d(' + (ox.x * 44 * ob.dep).toFixed(1) + 'px,' + (oy.x * 32 * ob.dep + sy).toFixed(1) + 'px,0)';
  }));
  ox.owner = oy.owner = place;
  if (orbs.length) {
    if (fine && !reduced) addEventListener('pointermove', (e) => {
      ptrX = e.clientX / innerWidth - 0.5; ptrY = e.clientY / innerHeight - 0.5;
      ox.to(ptrX, SPEC.gentle); oy.to(ptrY, SPEC.gentle);
    }, { passive: true });
    if (!reduced) addEventListener('scroll', () => { sY = M.view.y; place.apply(); }, { passive: true });
    const morph = (ob) => {
      ob.u.to(ob.u.t > 0.5 ? 0 : 1, SPEC.m3SlowSpatial);
      ob.rot.to(ob.rot.t + (ob.i % 2 ? -1 : 1) * (50 + ob.i * 17), SPEC.m3SlowSpatial);
    };
    io(orbs.map((ob) => ob.w), { rootMargin: '120px 0px' }, (w, on) => {
      const ob = orbs.find((x) => x.w === w);
      ob.on = on;
      w.classList.toggle('live', on);
      clearInterval(ob.timer);
      if (!on) return;
      geo(ob); render(ob); place.apply();
      /* Khối mờ (xa) đứng dáng: đổi dáng sau lớp mờ gần như không thấy mà vẫn tốn vẽ lại. */
      if (!reduced && !ob.w.classList.contains('far')) ob.timer = setInterval(() => morph(ob), 7200 + ob.i * 1500);
    });
    /* Đổi màu chủ đề: đọc lại màu và vẽ lại ngay (trước khi trình duyệt chụp trạng thái mới cho hiệu ứng lộ màu). */
    new MutationObserver(() => orbs.forEach((ob) => { ob.col = null; if (ob.on) render(ob); })).observe(root, { attributes: true, attributeFilter: ['data-scheme'] });
    addEventListener('resize', later(() => orbs.forEach((ob) => { if (ob.on) { geo(ob); render(ob); } }), 150));
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => orbs.forEach((ob) => { if (ob.on) geo(ob); }));
    if ('ResizeObserver' in window) new ResizeObserver(later(() => { orbs.forEach((ob) => { if (ob.on) geo(ob); }); place.apply(); }, 100)).observe(d.body);
  }

  /* ================= Dải chữ chạy theo cuộn ================= */
  (function marquee() {
    const sec = $('.kin');
    if (!sec) return;
    const KS = ['cookie9', 'clover', 'sunny', 'pill', 'flower', 'burst', 'cookie4'];
    /* Hai lớp chuyển động: .kin-loop trôi đều bằng hoạt ảnh CSS (compositor, đứng yên thì luồng chính không làm gì);
       .kin-track do JS dịch theo vị trí cuộn và nghiêng theo vận tốc cuộn — chỉ chạy trong lúc đang cuộn. */
    const rows = $$('.kin-row', sec).map((row) => {
      const tr = $('.kin-track', row), loop = d.createElement('div');
      loop.className = 'kin-loop';
      while (tr.firstChild) loop.appendChild(tr.firstChild);
      loop.innerHTML += loop.innerHTML;
      tr.appendChild(loop);
      return { row, tr, loop, dir: +row.dataset.dir || 1, half: 1 };
    });
    /* Màu và góc xoay theo thứ tự hình (k0/k1/k2) — :nth-of-type đếm cả span chữ xen giữa nên không dùng được. */
    $$('.ks', sec).forEach((s, i) => {
      const A = shapePts(SHAPES[KS[i % KS.length]], 72);
      $('path', s).setAttribute('d', morphPath(A, A, 0, 50, 50, 48));
      s.classList.add('k' + (i % 3));
    });
    const measure = () => rows.forEach((r) => {
      r.half = r.loop.scrollWidth / 2 || 1;
      r.loop.style.animationDuration = (r.half / 34).toFixed(1) + 's';
    });
    measure();
    M.refreshers.push(measure);
    addEventListener('resize', later(measure, 150));
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(measure);
    if (reduced) return;
    let on = false, raf = 0, t0 = 0, y = scrollY, lastY = y, vel = 0, quiet = 0;
    const mod = (a, n) => ((a % n) + n) % n;
    function frame(t) {
      const dt = t0 ? Math.min(0.05, (t - t0) / 1000) : 0; t0 = t;
      const dy = y - lastY; lastY = y;
      /* Vận tốc làm mượt theo THỜI GIAN (~0,25 s) và chặn đỉnh: sự kiện cuộn không đến đều từng khung nên vận tốc thô
         nhảy 0 ↔ gấp đôi, làm độ nghiêng rung (user #301: dải chữ "chưa mượt khi lướt"). */
      if (dt) vel += (clamp(dy / dt, -5000, 5000) - vel) * (1 - Math.exp(-dt * 4));
      /* Cuộn nhanh thì chữ nghiêng nhẹ theo hướng cuộn — như chữ bị gió thổi; chỉ ghi transform. */
      const sk = clamp(-vel / 800, -4, 4);
      rows.forEach((r) => {
        r.tr.style.transform = 'translate3d(' + (-mod(y * 0.42 * r.dir, r.half)).toFixed(2) + 'px,0,0) skewX(' + sk.toFixed(2) + 'deg)';
      });
      quiet = Math.abs(vel) < 4 && dy === 0 ? quiet + 1 : 0;
      raf = on && quiet < 20 ? requestAnimationFrame(frame) : 0;
    }
    addEventListener('scroll', () => {
      y = M.view.y;
      if (on && !raf) { t0 = 0; quiet = 0; raf = requestAnimationFrame(frame); }
    }, { passive: true });
    io([sec], { rootMargin: '80px 0px' }, (el, vis) => {
      on = vis;
      sec.classList.toggle('live', vis);
      if (on && !raf) { t0 = 0; quiet = 0; y = lastY = scrollY; raf = requestAnimationFrame(frame); }
    });
  })();

  /* ================= Đường tiến độ dạng sóng nối ba bước Shizuku ================= */
  (function stepsWave() {
    const ol = $('.steps');
    if (!ol) return;
    const steps = $$('.step', ol), shapes = steps.map((s) => $('.shape', s));
    const NS = 'http://www.w3.org/2000/svg';
    const svg = d.createElementNS(NS, 'svg'); svg.setAttribute('class', 'wv'); svg.setAttribute('aria-hidden', 'true');
    const ina = d.createElementNS(NS, 'path'), act = d.createElementNS(NS, 'path'), stop = d.createElementNS(NS, 'circle');
    ina.setAttribute('class', 'wv-ina'); act.setAttribute('class', 'wv-act'); stop.setAttribute('class', 'wv-stop'); stop.setAttribute('r', '2.5');
    svg.append(ina, act, stop);
    ol.prepend(svg);
    let geo = null, phase = 0, on = false, raf = 0, t0 = 0;
    const reached = steps.map(() => false);
    const prog = new Spring(0, 0.0005, owner(draw));
    function measure() {
      const r0 = ol.getBoundingClientRect();
      const pts = shapes.map((s) => { const r = s.getBoundingClientRect(); return [r.left + r.width / 2 - r0.left, r.top + r.height / 2 - r0.top]; });
      const a = pts[0], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      /* top = toạ độ trang của khung: lúc cuộn chỉ cần scrollY, không đọc lại bố cục mỗi sự kiện cuộn. */
      geo = { a, b, L, top: r0.top + scrollY, ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L, at: pts.map((p) => ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L)), vert: Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) };
      svg.setAttribute('viewBox', '0 0 ' + r0.width.toFixed(1) + ' ' + r0.height.toFixed(1));
      svg.style.width = r0.width + 'px'; svg.style.height = r0.height + 'px';
      draw();
    }
    function line(s0, s1, amp) {
      const { a, ux, uy } = geo, nx = -uy, ny = ux;
      let p = '';
      for (let s = s0; ; s += 3) {
        const t = Math.min(s, s1), taper = Math.min(1, (t - s0) / 18, (s1 - t) / 18);
        const w = amp * Math.max(0, taper) * Math.sin(t / 30 * Math.PI * 2 - phase);
        p += (s === s0 ? 'M' : 'L') + (a[0] + ux * t + nx * w).toFixed(1) + ' ' + (a[1] + uy * t + ny * w).toFixed(1);
        if (t >= s1) break;
      }
      return p;
    }
    function draw() {
      if (!geo) return;
      const { a, L, ux, uy } = geo, pr = clamp(prog.x, 0, 1), s = pr * L, gap = 12;
      act.setAttribute('d', s > 1 ? line(0, s, 3.2) : '');
      ina.setAttribute('d', s + gap < L - 2 ? line(s + gap, L, 0) : '');
      stop.setAttribute('cx', (a[0] + ux * L).toFixed(1)); stop.setAttribute('cy', (a[1] + uy * L).toFixed(1));
      stop.style.opacity = s + gap < L - 2 ? 1 : 0;
      geo.at.forEach((t, i) => {
        const hit = pr > 0.002 && pr >= t - 0.02;
        if (hit !== reached[i]) {
          reached[i] = hit;
          steps[i].classList.toggle('on', hit);
          if (hit && shapes[i].cryoPulse && !reduced) shapes[i].cryoPulse();
        }
      });
    }
    function target() {
      if (!geo) return;
      const ay = geo.top - M.view.y + geo.a[1];
      const p = geo.vert ? (innerHeight * 0.62 - ay) / geo.L : (innerHeight * 0.78 - ay) / (innerHeight * 0.42);
      prog.to(clamp(p, 0, 1), SPEC.m3Spatial);
    }
    function frame(t) {
      const dt = t0 ? Math.min(0.05, (t - t0) / 1000) : 0; t0 = t;
      phase = (phase + dt * 3.2) % (Math.PI * 2);
      draw();
      raf = on ? requestAnimationFrame(frame) : 0;
    }
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => { measure(); target(); });
    addEventListener('resize', later(() => { measure(); target(); }, 150));
    M.refreshers.push(() => requestAnimationFrame(() => { measure(); target(); }));
    addEventListener('scroll', target, { passive: true });
    /* Mục phía trên mở/đóng (Cách hoạt động, Câu hỏi) làm trang cao lên: đo lại vị trí đã lưu. */
    if ('ResizeObserver' in window) new ResizeObserver(later(() => { if (on) { measure(); target(); } }, 100)).observe(d.body);
    io([ol], { rootMargin: '60px 0px' }, (el, vis) => {
      on = vis;
      if (vis) { measure(); target(); }
      if (on && !raf && !reduced) { t0 = 0; raf = requestAnimationFrame(frame); }
    });
  })();

  /* ================= Thẻ Miễn phí / PRO ================= */
  (function plans() {
    const plans = $$('.plan');
    if (!plans.length) return;
    if (!reduced) root.classList.add('fx');
    /* Quyền lợi bật lên khi thẻ vào màn hình; cực quang của thẻ PRO chỉ xoay khi thẻ đang hiện. */
    io(plans, { threshold: 0.25 }, (el, on) => { if (on) el.classList.add('in'); el.classList.toggle('live', on); });
    const card = $('.plan-pro'), shine = card && $('.pro-shine', card);
    if (!card || !fine || reduced) return;
    /* Nghiêng 3D theo con trỏ (lò xo M3) + đốm sáng chạy theo — như cầm một tấm thẻ thật dưới đèn. */
    const o = owner(() => {
      const still = Math.abs(rx.x) < 0.01 && Math.abs(ry.x) < 0.01 && rx.t === 0 && ry.t === 0;
      card.style.transform = still ? '' : 'perspective(1000px) rotateX(' + rx.x.toFixed(2) + 'deg) rotateY(' + ry.x.toFixed(2) + 'deg)';
    });
    const rx = new Spring(0, 0.01, o), ry = new Spring(0, 0.01, o);
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      ry.to((u - 0.5) * 9, SPEC.m3Spatial); rx.to(-(v - 0.5) * 7, SPEC.m3Spatial);
      shine.style.setProperty('--mx', (u * 100).toFixed(1) + '%'); shine.style.setProperty('--my', (v * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { rx.to(0, SPEC.m3Spatial); ry.to(0, SPEC.m3Spatial); });
  })();

  /* ================= Ánh nền đổi tông theo mục ================= */
  (function ambience() {
    const amb = $('.amb'), secs = $$('[data-amb]');
    if (!amb || !secs.length) return;
    io(secs, { rootMargin: '-45% 0px -45% 0px' }, (el, on) => { if (on) amb.dataset.amb = el.dataset.amb; });
  })();
})();
