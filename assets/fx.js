/* Cryo — lớp hiệu ứng "có cảm xúc" kiểu M3 Expressive cho trang chủ:
   con trỏ âm bản bay vào nút, chữ biến thiên (trục wght/wdth/ROND của Google Sans Flex), khối 3D nền theo màu chủ đề,
   dải chữ chạy theo cuộn, đường tiến độ dạng sóng. Dùng chung lò xo của site.js (window.CryoMotion).
   Toàn bộ chỉ là trang trí: không có tệp này hoặc bật giảm chuyển động thì nội dung vẫn đủ và đọc được. */
(() => {
  'use strict';
  const M = window.CryoMotion;
  if (!M) return;
  const { Spring, SPEC, owner, go, put, reduced, clamp, lerp, SHAPES, shapePts, morphPath, $, $$ } = M;
  const afterIntro = M.afterIntro || ((f) => f());
  /* Đang nằm trong màn hình ngay lúc này → làm luôn, không chờ màn mở đầu (mở trang giữa chừng, link tới cuối trang): chờ
     thì chữ hiện trơ vài giây rồi mới ẩn đi để nở. */
  const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const soon = (el, fn) => (onScreen(el) ? fn() : afterIntro(fn));
  const d = document, root = d.documentElement;
  const fine = typeof M.fine === 'boolean' ? M.fine : matchMedia('(hover: hover) and (pointer: fine)').matches; // một luật với site.js
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
  /* Chữ nằm trong phần tử có data-x (kiểu chữ nhấn, bảng STY) giữ kiểu đó: từng CHỮ CÁI mang lớp x-<kiểu> và nhớ kiểu
     (k.xs). Từ cắt theo dấu cách, nên dấu câu ngay sau phần tử nhấn vẫn dính vào từ (không chèn thêm dấu cách). */
  /* keepX (tên chương): chữ nhấn nằm trong một span [data-x] dựng lại trong từ, chữ cái thừa kế dáng của span đó — site.js
     (chapMorph) biến hình span theo lúc chương sáng/tắt, như với chữ gốc chưa tách. */
  function split(el, withSr, keepX) {
    const toks = [];
    const walk = (node, x) => node.childNodes.forEach((n) => {
      if (n.nodeType === 3) toks.push([n.textContent, x]);
      else if (n.nodeType === 1) walk(n, (n.dataset && n.dataset.x) || x);
    });
    walk(el, '');
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    const vis = d.createElement('span'); vis.className = 'kt';
    if (withSr !== false) {
      const sr = d.createElement('span'); sr.className = 'sr'; sr.textContent = text; el.appendChild(sr);
      vis.setAttribute('aria-hidden', 'true');
    }
    const ws0 = []; let cur = null;
    toks.forEach(([t, x]) => t.split(/(\s+)/).forEach((p) => {
      if (!p) return;
      if (/^\s+$/.test(p)) { cur = null; return; }
      if (!cur) { cur = { parts: [] }; ws0.push(cur); }
      cur.parts.push([p, x]);
    }));
    const words = [], letters = [], xs = [];
    ws0.forEach((w) => {
      const ws = d.createElement('span'); ws.className = 'kw';
      w.parts.forEach(([s, x]) => {
        let host = ws;
        if (keepX && x) { host = d.createElement('span'); host.className = 'x-' + x; host.dataset.x = x; ws.appendChild(host); }
        graphemes(s).forEach((ch) => { const c = d.createElement('span'); c.className = 'kc' + (x && !keepX ? ' x-' + x : ''); c.textContent = ch; host.appendChild(c); letters.push(c); xs.push(x); });
      });
      words.push(ws);
    });
    el.appendChild(vis);
    const k = { el, vis, words, letters, xs, locked: false, busy: 0 };
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
      /* Chiều cao thật (lẻ), không offsetHeight (làm tròn): khoá dòng không được xô phần bên dưới nửa điểm ảnh. */
      return [Math.ceil(b.right - a.left) + 1, l.getBoundingClientRect().height];
    });
    lines.forEach((l, i) => { l.style.width = box[i][0] + 'px'; l.style.height = box[i][1] + 'px'; l.classList.add('kl-c'); });
    k.locked = true;
    return true;
  }

  /* Mỗi chữ cái có hai lò xo: a = đã "nở" (0 hẹp-mảnh → 1 dáng gốc), u = độ phình khi con trỏ tới gần. Cả khối chữ chung
     một chủ: mỗi khung tính trục cho từng chữ rồi xếp vị trí cả khối một lượt (place).
     Giá trị trục làm tròn theo bậc (wght 10, wdth 1): mỗi tổ hợp trục là một bản phông riêng phải dựng và shape lại —
     để liên tục thì khung nào cũng dựng phông mới (đo được ~15 ms/khung); theo bậc thì bản phông được dùng lại từ bộ đệm. */
  /* Kiểu chữ nhấn (#302, user: "phông phá cách, chuyển động cảm xúc như quảng cáo Google" — mẫu "Oh, hi! I'm Google Sans
     Flex!"): CÙNG họ Google Sans Flex, trộn trục cực đoan trong một câu. b = dáng đứng yên [wght, wdth, slnt], e = dáng khi
     phình / "thở", r = ROND. Phải khớp ĐÚNG luật .x-* trong site.css (đứng yên chữ cái thừa kế từ CSS; lệch là nhảy).
       c: siêu hẹp đậm, bớt tròn — phình thì nở ngang.   t: mảnh nghiêng — phình thì đậm lên.
       w: siêu rộng đậm — phình thì nghiêng và thu lại một chút. */
  const STY = {
    c: { b: [860, 32, 0], e: [1000, 58, 0], r: 60 },
    t: { b: [160, 60, -10], e: [400, 80, -10], r: 100 },
    w: { b: [1000, 151, 0], e: [1000, 126, -10], r: 100 },
  };
  /* Kiểu của từng chữ cái: chữ thường lấy theo khối (opt), chữ nhấn theo STY. z = điểm xuất phát lúc "nở". */
  const styleOf = (x, opt) => {
    const S = x && STY[x];
    if (!S) return { x: '', b: [opt.w0, opt.d0, 0], e: [opt.w1, opt.d1, 0], z: [opt.w0a, opt.d0a], r: opt.r0 == null ? 100 : opt.r0 };
    return { x, b: S.b, e: S.e, z: [Math.min(S.b[0], opt.w0a), Math.min(S.b[1], opt.d0a)], r: S.r };
  };
  const fvOf = (w, dd, s, r) => "'wght' " + w + ", 'wdth' " + dd + ", 'slnt' " + (s || 0) + ", 'ROND' " + (r === undefined ? 100 : r);
  /* Chữ nhấn đổi trục theo bậc THÔ hơn (wght 30, wdth 3): dải trục của nó rộng gấp mấy lần chữ thường nên bậc mịn là gần
     như khung nào cũng dựng phông + bố cục lại. Đo #302 (đầu trang đứng yên, chữ đang thở): bố cục 134 → 38 ms/giây; vị trí
     chữ vẫn trôi liên tục nhờ ô chữ cố định, chỉ nét chữ đổi theo bậc. */
  const XSW = 30, XSD = 3;
  function letterKit(k, opt) {
    const sw0 = opt.sw || 10, sd0 = opt.sd || 1;
    const kit = k.letters.map((c, i) => ({ c, st: styleOf(k.xs && k.xs[i], opt), a: null, u: null, x: 0, y: 0, fv: '', col: '', w: 0, wd: 0, ws: 0, rw: 0, rd: 0, tx: 0 }));
    const o = owner(() => {
      kit.forEach((L) => {
        const a = L.a.x, u = Math.max(0, L.u.x), S = L.st;
        let fv = '', col = '';
        L.rw = S.b[0]; L.rd = S.b[1];
        if (!(L.a.t === 1 && L.u.t === 0 && Math.abs(a - 1) < 0.003 && u < 0.003)) {
          /* Trễ bậc: chỉ nhảy sang bậc mới khi giá trị đã đi quá ¾ bậc — không thì dao động nhỏ quanh ranh giới hai bậc
             làm chữ nhảy qua lại mỗi khung (user #301: "Cryo" di quanh mà không vào chữ thì rung giật). */
          const rw = L.rw = clamp(lerp(S.z[0], S.b[0], a) + (S.e[0] - S.b[0]) * u, 100, 1000);
          const rd = L.rd = clamp(lerp(S.z[1], S.b[1], a) + (S.e[1] - S.b[1]) * u, 25, 151);
          const rs = S.b[2] + (S.e[2] - S.b[2]) * u;
          /* Lưới bậc tính TỪ dáng đứng yên: về 0 bậc là trùng đúng luật CSS, không nhích một bậc lúc thôi phình. */
          const sw = S.x ? XSW : sw0, sd = S.x ? XSD : sd0;
          if (!L.w || Math.abs(rw - L.w) >= sw * 0.75) L.w = clamp(S.b[0] + Math.round((rw - S.b[0]) / sw) * sw, 100, 1000);
          if (!L.wd || Math.abs(rd - L.wd) >= sd * 0.75) L.wd = clamp(+(S.b[1] + Math.round((rd - S.b[1]) / sd) * sd).toFixed(2), 25, 151);
          if (Math.abs(rs - L.ws) >= 0.75) L.ws = Math.round(rs);
          fv = fvOf(L.w, L.wd, L.ws, S.r);
          if (opt.tint && !S.x && u > 0.03) col = 'color-mix(in oklab, var(--primary) ' + Math.round(clamp(u, 0, 1) * 20) * 5 + '%, var(--on-surface))';
        }
        if (!fv) { L.w = L.wd = 0; L.ws = L.st.b[2]; }
        if (fv !== L.fv) { L.fv = fv; L.c.style.fontVariationSettings = fv; }
        if (col !== L.col) { L.col = col; L.c.style.color = col; }
      });
      if (k.slot) slotPlace(k, kit, opt);
      liveLayer(k, kit.some((L) => L.fv));
    });
    kit.forEach((L) => { L.ws = L.st.b[2]; L.a = new Spring(1, 0.002, o); L.u = new Spring(0, 0.002, o); });
    kit.o = o; k.kit = kit;
    return kit;
  }

  /* Chữ đang đổi dáng (nở / phình theo con trỏ hay ngón) có lớp riêng trong lúc đổi (#303). Không có lớp riêng thì mỗi
     khung đổi nét chữ là trình duyệt vẽ lại cả mảng ảnh chứa nó — kể cả quầng làm mờ / lưới có mặt nạ / số chương nằm bên
     dưới. Đo (máy tính 1440×900 @1,5, GPU giả lập) ở đầu trang lúc chữ thở: 39 → 60 khung/giây, GPU 10,7 → 2,8 ms/khung,
     vẽ lại 702 → 116 ms/giây. Đứng yên 0,9 s thì trả lớp (lớp thừa cũng tốn: xem mo() bên site.js). */
  /* Một khối chữ (tiêu đề) có thể có vài bộ chữ cái (hai thứ tiếng, hai dòng) → trạng thái "đang đổi" giữ ở chính phần tử
     mang lớp, đếm theo bộ. Có chuột (máy tính) thì giữ lớp luôn sau lần đầu: tháo lớp là chữ đổi từ khử răng cưa xám về
     ClearType (Windows) — nhìn như chữ nhích một cái sau mỗi lần rê. Màn chạm không có ClearType → nghỉ 0,9 s thì trả lớp.
     Tiêu đề đầu trang giữ lớp sẵn bằng CSS (thở theo chu kỳ, bật/tắt mỗi chu kỳ là vẽ lại cả lớp). */
  const layerHost = (k) => (k.layerEl !== undefined ? k.layerEl : (k.layerEl = k.el.closest('.hero-h') ? null : (k.el.closest('.h2, .fx-h, .fin-word') || null)));
  function liveLayer(k, live) {
    const h = layerHost(k);
    if (!h) return;
    const S = h.cryoLive || (h.cryoLive = new Set());
    if (live) {
      if (!S.has(k)) S.add(k);
      if (h.cryoLiveT) { clearTimeout(h.cryoLiveT); h.cryoLiveT = 0; }
      if (!h.cryoLayer) { h.cryoLayer = true; h.classList.add('kx-live'); }
    } else if (S.delete(k) && !S.size && !fine && !h.cryoLiveT) {
      h.cryoLiveT = setTimeout(() => { h.cryoLiveT = 0; if (!S.size) { h.cryoLayer = false; h.classList.remove('kx-live'); } }, 900);
    }
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
  const SLOT_N = 8;
  function pin(k, opt) {
    if (k.slot) return true;
    if (k.busy || !k.kit || !shown(k.vis)) return false;
    const kit = k.kit, cs = kit.map((L) => L.c);
    /* fv(L) → chuỗi trục cho từng chữ (mỗi chữ có đường phình riêng theo kiểu của nó); '' = đứng yên theo CSS. */
    const rects = (fv) => { kit.forEach((L) => { L.c.style.fontVariationSettings = fv(L); }); return cs.map((c) => c.getBoundingClientRect()); };
    const at = (u) => (L) => { const S = L.st; return fvOf(+lerp(S.b[0], S.e[0], u).toFixed(2), +lerp(S.b[1], S.e[1], u).toFixed(2), +lerp(S.b[2], S.e[2], u).toFixed(2), S.r); };
    cs.forEach((c) => { c.style.transform = ''; });
    const path = [];
    for (let j = 1; j <= SLOT_N; j++) path.push(rects(at(j / SLOT_N)));
    const r1 = rects((L) => fvOf(L.st.e[0], L.st.b[1], L.st.b[2], L.st.r)), r2 = rects((L) => fvOf(L.st.b[0], L.st.e[1], L.st.b[2], L.st.r));
    const r0 = rects(() => '');
    const box = k.el.getBoundingClientRect(), ta = getComputedStyle(k.el).textAlign;
    k.slot = {
      align: ta === 'center' ? 0.5 : (ta === 'right' || ta === 'end') ? 1 : 0,
      m: cs.map((c, i) => ({
        line: c.closest('.kl') || k.vis, w: r0[i].width, g: [r0[i].width].concat(path.map((r) => r[i].width)),
        pw: r1[i].width - r0[i].width, pd: r2[i].width - r0[i].width,
      })),
    };
    /* Chữ tô bằng background-clip:text (opt.pad — "Cryo" cuối trang) chỉ hiện phần nét nằm TRONG hộp của chính chữ đó; ô
       ghim rộng bằng lúc đứng yên, chữ phình tràn sang phải → mất mép (user #302: "chữ cryo giãn nở bị cắt xén"). Nới lề
       phải bằng đúng phần tràn lớn nhất đo được (lề âm bù lại nên bố cục không đổi). */
    const fs = k.slot.fs = parseFloat(getComputedStyle(k.el).fontSize) || 0;
    kit.forEach((L, i) => {
      L.x = r0[i].left + r0[i].width / 2 - box.left; L.y = r0[i].top + r0[i].height / 2 - box.top;
      L.fv = '\u0000'; L.tx = 0;
      L.c.style.width = r0[i].width + 'px'; L.c.classList.add('kc-pin');
      if (opt.pad) {
        /* box-sizing:border-box → lề trong nằm TRONG width: nới lề phải thêm bao nhiêu thì width tăng bấy nhiêu. */
        const base = fs * 0.12, ex = Math.ceil(Math.max(r1[i].width, r2[i].width, ...k.slot.m[i].g) - r0[i].width + base);
        L.c.style.width = (r0[i].width + ex - base) + 'px';
        L.c.style.paddingRight = ex + 'px'; L.c.style.marginRight = -ex + 'px';
      }
    });
    kit.o.apply();
    return true;
  }
  function unpin(k) {
    if (!k.slot) return;
    k.slot = null;
    k.kit.forEach((L) => { L.c.classList.remove('kc-pin'); L.c.style.width = L.c.style.paddingRight = L.c.style.marginRight = L.c.style.transform = ''; L.tx = 0; });
  }
  function slotPlace(k, kit, opt) {
    const S = k.slot, sx = new Array(kit.length);
    /* Bề rộng chữ ở trục (w, dd) theo đường phình RIÊNG của chữ đó. Trục nào kiểu đó không đổi khi phình (vd. "w" giữ
       wght 1000) thì không dùng để suy u. */
    const width = (m, L, w, dd) => {
      const S = L.st, dw = S.e[0] - S.b[0], dD = S.e[1] - S.b[1];
      const uw = dw ? (w - S.b[0]) / dw : null, ud = dD ? (dd - S.b[1]) / dD : null;
      const u = uw === null ? (ud === null ? 0 : ud) : ud === null ? uw : (uw + ud) / 2;
      const f = clamp(u, 0, 1) * SLOT_N, j = Math.min(SLOT_N - 1, Math.floor(f));
      return m.g[j] + (m.g[j + 1] - m.g[j]) * (f - j) + (uw === null ? 0 : (uw - u) * m.pw) + (ud === null ? 0 : (ud - u) * m.pd);
    };
    let line = null, acc = 0, from = 0;
    const close = (to) => { if (S.align) for (let j = from; j < to; j++) sx[j] -= acc * S.align; };
    for (let i = 0; i < kit.length; i++) {
      const L = kit[i], m = S.m[i];
      if (m.line !== line) { close(i); line = m.line; acc = 0; from = i; }
      /* opt.gap: chữ phình thì giãn thêm khoảng chữ (theo em) — "Cryo" khoảng chữ âm, hai chữ cạnh nhau cùng đậm thì dính. */
      const V = width(m, L, L.rw, L.rd) + (opt.gap ? S.fs * opt.gap * clamp(L.u.x, 0, 1) : 0);
      const A = L.fv ? width(m, L, L.w, L.wd) : m.w;
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
      if (m.some((x) => x.moving || Math.abs(x.y.x) > 0.3 || x.o.x < 0.995)) { setTimeout(clear, 400); return; }
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
  /* Phình từng chữ theo khoảng cách tới điểm (x, y) — một công thức cho cả con trỏ chuột lẫn ngón tay (tapFx). r = khung
     của khối chữ đọc ngay trước đó; on = false → mọi chữ về 0. */
  const fsOf = (s) => s.fs || (s.fs = parseFloat(getComputedStyle(s.k.el).fontSize) || 60);
  function swellTo(s, x, y, r, on, spec) {
    const R = fsOf(s) * s.opt.reach;
    s.kit.forEach((L) => {
      const dx = x - (r.left + L.x), dy = (y - (r.top + L.y)) * 1.25;
      const t = on ? Math.exp(-(dx * dx + dy * dy) / (R * R)) : 0;
      if (Math.abs(t - L.u.t) > 0.015) L.u.to(t < 0.02 ? 0 : t, spec);
    });
  }
  if (fine && !reduced) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      swells.forEach((s) => {
        if (!s.inView && !s.hot) return;
        if (s.k.busy || !shown(s.k.vis)) return;
        const r = s.k.el.getBoundingClientRect(), R = fsOf(s) * s.opt.reach, pad = R * 1.6;
        const near = e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad;
        if (!near && !s.hot) return;
        /* Ô chữ + toạ độ tâm từng chữ đo một lần lúc đứng yên (pin); đổi cỡ/ngôn ngữ thì gỡ ra và đo lại lần sau. */
        if (!pin(s.k, s.opt)) return;
        s.hot = near;
        swellTo(s, e.clientX, e.clientY, r, near, SWELL);
      });
    }, { passive: true });
    d.addEventListener('mouseout', (e) => { if (!e.relatedTarget) swells.forEach((s) => { s.hot = false; s.kit.forEach((L) => L.u.to(0, SWELL)); }); });
  }
  const restale = () => swells.forEach((s) => { unpin(s.k); s.fs = 0; });

  /* Tiêu đề mở đầu: nở khi tải trang, phình theo con trỏ. */
  /* Chữ thường của tiêu đề mảnh-hẹp vừa (wght 380, wdth 90) để chữ nhấn (STY) nổi hẳn lên — khớp .hero-h trong site.css. */
  const HERO = { w0a: 200, w0: 380, w1: 600, d0a: 60, d0: 90, d1: 106, reach: 1.35, tint: true };
  const heroKs = [];
  /* Chữ nhấn "thở" (như quảng cáo Google Sans Flex: chữ tự đổi dáng theo nhịp): cứ ~3,6 s một từ nhấn, lần lượt qua mọi từ
     nhấn của tiêu đề, đổi sang dáng e rồi về. Chữ phía sau trôi theo nhờ ô chữ cố định (pin), không xô dòng. Chữ cái trong
     từ đổi CÙNG nhịp (cùng một bản phông cho cả từ). Chỉ chạy khi tiêu đề trong màn hình, tab đang mở, không đang cuộn, con
     trỏ không ở gần (con trỏ gần thì phình theo con trỏ).
     Đo #302 (đầu trang đứng yên): cả dòng thở từng chữ cái + bậc mịn 366 ms/giây luồng chính; tắt hẳn 42. */
  const BREATH = { z: 0.92, k: 46 };
  let breathOn = false, breathT = 0, bi = 0, scrolledAt = 0, prePinT = 0;
  addEventListener('scroll', () => { scrolledAt = performance.now(); }, { passive: true });
  const breathe = () => {
    breathT = 0;
    if (!breathOn || reduced) return;
    if (window.CryoPerf && window.CryoPerf.noBreath) { breathT = setTimeout(breathe, 3600); return; } // bảng đo tắt thử
    if (!d.hidden && performance.now() - scrolledAt > 900) {
      /* Mỗi nhịp MỘT từ nhấn (lần lượt mọi từ nhấn của cả hai dòng): số chữ cái đổi trục mỗi khung ít đi ~3 lần. */
      const all = [];
      heroKs.forEach((x) => { if (shown(x.k.vis)) x.k.words.forEach((w) => { const g = x.kit.filter((L) => L.st.x && L.c.parentNode === w); if (g.length) all.push({ x, g }); }); });
      const it = all.length && all[bi++ % all.length];
      if (it && !it.x.s.hot && !it.x.k.busy && pin(it.x.k, HERO)) {
        it.g.forEach((L) => L.u.to(1, BREATH));
        setTimeout(() => { if (!it.x.s.hot) it.g.forEach((L) => L.u.to(0, BREATH)); }, 1250);
      }
    }
    breathT = setTimeout(breathe, 3600);
  };
  d.addEventListener('cryo:intro', () => {
    $$('.hero-h .hl').forEach((el) => {
      const k = split(el), kit = letterKit(k, HERO);
      heroKs.push({ k, kit, s: swell(k, kit, HERO) });
    });
    let delay = 80;
    heroKs.forEach(({ k, kit }) => { if (lock(k)) { bloom(k, kit, delay, 26); delay += k.letters.length * 26 * 0.6; } });
    if (!reduced) io([$('.hero')], { threshold: 0.2 }, (el, on) => {
      breathOn = on;
      if (on && !breathT) {
        breathT = setTimeout(breathe, 2600);
        /* Đo sẵn ô chữ (pin: ~11 lần bố cục với trục khác nhau) lúc rảnh, không dồn vào đúng khung chữ bắt đầu thở. */
        if (M.idleEach && !prePinT) prePinT = setTimeout(() => { prePinT = 0; M.idleEach(heroKs, (x) => { if (!x.k.busy && !x.k.slot && breathOn) pin(x.k, HERO); }, 1); }, 1500);
      }
    });
  });

  /* Tiêu đề mục: nở khi cuộn tới. */
  /* Tách chữ LÚC CẦN (#303): bản cũ tách mọi tiêu đề (cả hai thứ tiếng) thành từng chữ cái ngay lúc tải — hàng nghìn phần
     tử + đọc bố cục, chặn luồng chính đúng lúc màn mở đầu đang chạy. Nay tiêu đề tới gần (cách một màn) thì tách và ẩn sẵn
     (sau màn mở đầu), cuộn tới thì nở như cũ. Giảm chuyển động: không có hiệu ứng nào cần tách → giữ nguyên chữ. */
  const H2 = { w0a: 300, w0: 580, w1: 760, d0a: 75, d0: 100, d1: 110, reach: 1.2, tint: true };
  const headKs = [];
  const reveal = (h) => headKs.filter((x) => x.h === h && !x.done).forEach((x) => {
    x.done = true;
    if (lock(x.k)) bloom(x.k, x.kit, 0, 18); else x.k.words.forEach((w) => put(w, { o: 1 }));
  });
  const prepHead = (h) => {
    if (h.cryoSplit) return;
    h.cryoSplit = true;
    const parts = $$('[lang]', h);
    (parts.length ? parts : [h]).forEach((p) => {
      const k = split(p), kit = letterKit(k, H2);
      headKs.push({ h, k, kit, done: false });
      swell(k, kit, H2);
      if (shown(k.vis)) k.words.forEach((w) => put(w, { o: 0 }));
    });
  };
  if (!reduced) {
    const h2s = $$('.h2');
    /* Hai bộ quan sát theo đúng thứ tự tạo: "tới gần" luôn báo trước "đã thấy" trong cùng một khung. */
    io(h2s, { rootMargin: '100% 0px' }, (h, on, o) => {
      if (!on) return;
      if (o) o.unobserve(h);
      soon(h, () => {
        if (h.cryoSplit) return;
        /* Lúc tách mà tiêu đề đã nằm trong màn (cuộn nhanh khi mở đầu chưa xong): nở luôn thay vì ẩn rồi chờ. */
        const r = h.getBoundingClientRect(), inView = r.bottom > 0 && r.top < innerHeight * 0.94;
        prepHead(h);
        if (inView) reveal(h);
      });
    });
    io(h2s, { threshold: 0.3, rootMargin: '0px 0px -6% 0px' }, (h, on, o) => {
      if (!on) return;
      if (o) o.unobserve(h);
      prepHead(h);
      reveal(h);
    });
  }

  /* ================= Tên chương + tiêu đề vừa: phình theo con trỏ =================
     User #303: "tiêu đề các chương cũng có hiệu ứng như thế, cũng như mấy tiêu đề lớn khác" — chữ phình theo chuột + con
     trỏ thành thấu kính khi nằm trên chữ (lớp .fx-h). Màn chạm: chạm / kéo ngang trên chữ thì phình (tapFx). Không "nở" khi cuộn tới: tên chương đã có màn biến hình riêng lúc chương sáng (site.js chapMorph), các tiêu đề vừa
     vốn đứng yên. Trục gốc đọc từ CSS của chính tiêu đề (mỗi loại một cỡ, một độ tròn) để lúc bắt đầu phình không nhảy.
     Thẻ PRO bỏ qua: chữ tô dải màu bằng background-clip:text, tách thành chữ cái có transform là mất màu. */
  const swellKs = [];
  const axesOf = (el) => {
    const cs = getComputedStyle(el), o = { wght: parseFloat(cs.fontWeight) || 400, wdth: 100, ROND: 0 };
    cs.fontVariationSettings.replace(/["'](\w{4})["']\s+(-?[\d.]+)/g, (_, a, v) => { o[a] = +v; });
    return o;
  };
  /* Tên chương: chữ nhấn đổi dáng theo chương (thường ↔ nhấn). Lúc đang biến hình thì khoá phình + trả dòng về bố cục
     thường (chữ rộng/hẹp ra thì xuống dòng lại được); biến hình xong thì lấy dáng mới làm gốc và khoá dòng lại. */
  function chapKit(x, chap) {
    const k = x.k;
    let morphing = false;
    const restyle = (on) => x.kit.forEach((L, i) => { L.st = styleOf(on ? k.xs[i] : '', x.opt); L.ws = L.st.b[2]; L.w = L.wd = 0; });
    const m = chap.cryoMorph;
    if (m && m.moving) { morphing = true; k.busy++; }
    restyle(chap.classList.contains('chap-on'));
    if (m && m.redo) m.redo();
    chap.addEventListener('cryo:morph', () => {
      if (!morphing) { morphing = true; k.busy++; }
      x.s.hot = false; x.s.fs = 0;
      unpin(k); x.kit.forEach((L) => L.u.set(0));
      if (k.locked) unlock(k);
    });
    chap.addEventListener('cryo:morphed', (e) => {
      if (morphing) { morphing = false; k.busy--; }
      restyle(!!e.detail);
      if (!k.busy) lock(k);
    });
  }
  function prepSwell(h) {
    if (h.cryoSplit) return;
    h.cryoSplit = true;
    h.classList.add('fx-h');
    const chap = h.closest('.chap'), parts = $$(':scope > [lang]', h);
    (parts.length ? parts : [h]).forEach((p) => {
      const a = axesOf(p), fs = parseFloat(getComputedStyle(p).fontSize) || 24;
      const opt = { w0: a.wght, w0a: a.wght, w1: Math.min(1000, a.wght + 180), d0: a.wdth, d0a: a.wdth, d1: Math.min(151, a.wdth + 10), r0: a.ROND, reach: Math.max(1.2, 64 / fs), tint: true };
      const k = split(p, true, !!chap), kit = letterKit(k, opt), x = { h, k, kit, opt, done: true };
      x.s = swell(k, kit, opt);
      swellKs.push(x);
      if (chap) chapKit(x, chap);
      if (!k.busy) lock(k);
    });
  }
  /* Có chuột: tách sẵn khi tới gần. Màn chạm: tách ở lần CHẠM đầu vào tiêu đề (tapFx) — không tách sẵn, để lúc cuộn không
     có thêm việc (tên chương đổi dáng khi sáng là phải gỡ/khoá lại dòng). */
  const SWELL_H = '.chap .h3, .step h3, .plan:not(.plan-pro) h3, .privacy h3, .cm-h';
  if (fine && !reduced) {
    io($$(SWELL_H), { rootMargin: '100% 0px' }, (h, on, o) => {
      if (!on) return;
      if (o) o.unobserve(h);
      afterIntro(() => prepSwell(h));
    });
  }

  /* Chữ "Cryo" cỡ lớn cuối trang: mảnh và hẹp, phình mạnh theo con trỏ; trên điện thoại nở một lần khi cuộn tới. */
  /* Chữ rất lớn: bậc trục mịn hơn (mỗi bậc wdth ở cỡ này là vài điểm ảnh) — chỉ 4 chữ cái nên dựng phông vẫn rẻ. */
  const FIN = { w0a: 300, w0: 330, w1: 800, d0a: 75, d0: 92, d1: 125, reach: 0.55, tint: false, sw: 4, sd: 0.5, pad: true, gap: 0.06 };
  const finEl = $('.fin-word');
  /* Dựng lúc cần (#303): chữ cuối trang tới gần (cách một màn) mới tách + đo, không lúc tải. */
  if (finEl) {
    io([finEl], { rootMargin: '100% 0px' }, (el, on, o) => { if (!on) return; if (o) o.unobserve(el); soon(el, makeFin); });
    /* Lọt vào màn trước khi việc hoãn kịp chạy (cuộn nhanh xuống cuối khi màn mở đầu chưa xong) → dựng ngay. */
    io([finEl], {}, (el, on, o) => { if (!on) return; if (o) o.unobserve(el); makeFin(); });
  }
  function makeFin() {
    if (finEl.cryoSplit) return;
    finEl.cryoSplit = true;
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
    heroKs.concat(headKs, swellKs).forEach((x) => {
      if (!(x.k.locked || x.h === undefined || x.done)) return;
      if (x.k.busy) relockPending = true; else lock(x.k);
    });
    restale();
  };
  M.refreshers.push(() => requestAnimationFrame(relock));
  /* Phông web tải xong sau lần ghim đầu: bề rộng ô chữ đo bằng phông dự phòng là sai → gỡ ghim, đo lại. */
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => requestAnimationFrame(relock));
  /* Chỉ khi BỀ RỘNG đổi: điện thoại ẩn/hiện thanh địa chỉ lúc cuộn là đổi chiều cao liên tục — khoá + đo lại cả tiêu đề mỗi lần là phí. */
  let lastW = innerWidth;
  addEventListener('resize', later(() => { if (innerWidth !== lastW) { lastW = innerWidth; relock(); } }, 220));

  /* Liên kết đầu trang: rê vào thì chữ giãn rộng, đậm lên, đổi màu. Giữ sẵn chỗ bằng bề rộng lúc giãn để hàng không xô. */
  (function nav() {
    const links = $$('.top-nav a'), nav = $('.top-nav');
    /* Ghi hết → đọc hết → ghi hết: một lần bố cục thay vì mỗi liên kết một lần. Thanh ẩn (màn hẹp) thì khỏi đo. */
    const fit = () => {
      if (!nav || !shown(nav)) return;
      links.forEach((a) => { a.style.minWidth = ''; a.classList.add('wide'); });
      const ws = links.map((a) => a.offsetWidth);
      links.forEach((a, i) => { a.classList.remove('wide'); if (ws[i]) a.style.minWidth = Math.ceil(ws[i]) + 'px'; });
    };
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
     Màn chạm KHÔNG dùng khối này — xem tapFx ngay dưới. */
  (function cursor() {
    if (reduced) return;
    const mk = (cls) => { const e = d.createElement('div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); const i = d.createElement('i'); e.appendChild(i); d.body.appendChild(e); return [e, i]; };
    /* Hai khối con trỏ chỉ được tạo ở lần vẽ đầu tiên — tức là khi có chuột thật. Màn chạm không bao giờ cần chúng (#303:
       trước đây điện thoại vẫn mang hai lớp hoà trộn "difference" vô hình suốt trang). */
    let el = null, blob = null, hel = null, ring = null;
    const ensure = () => { if (!el) { [el, blob] = mk('m3-cursor'); [hel, ring] = mk('m3-cursor m3-halo'); } };
    if (fine) root.classList.add('cur-on');
    const HIT = 'a[href], button, summary, [role="switch"], [role="radio"], .ov, input[type="range"]';
    const MAG = '.btn, .top-nav a, .brand, .seg button, .swatches button, .play-badge, .foot-links a, .more summary, .rp-close';
    /* Chữ "Cryo" cuối trang không dùng thấu kính: để hiệu ứng phình chữ tự nói. */
    const LENS = '.hero-h, .h2, .kin-row, .fx-h';
    /* Thấu kính CHỈ khi con trỏ nằm trên phần có chữ (user #303: rê ra khoảng trống bên phải tiêu đề mà con trỏ vẫn to —
       khung tiêu đề rộng hết hàng). Tiêu đề đã tách: dòng chữ .kl rộng đúng bằng chữ, từ .kw; dải chữ chạy kín chữ cả hàng. */
    const TEXT = '.kl, .kw, .kin-row';
    /* Dòng chưa khoá (tên chương đang biến hình, tiêu đề đang nở): khoảng trắng giữa hai từ thuộc .kt — vẫn là chữ, không
       để con trỏ co lại giữa các từ. Đã khoá thì không tính .kt: khoảng trống bên phải dòng cũng thuộc nó. */
    const lensOf = (node) => {
      const L = node.closest(LENS);
      if (!L) return null;
      const tx = node.closest(TEXT) || (node.classList && node.classList.contains('kt') && !node.querySelector('.kl') ? node : null);
      return tx && L.contains(tx) ? L : null;
    };
    const FOLLOW = { z: 0.82, k: 1100 }, SHRINK = { z: 0.92, k: 760 };
    /* Vùng có màu thật của ảnh huy hiệu Google Play (ảnh có lề trong suốt): [lề ngang, lề dọc, bán kính góc] theo tỉ lệ. */
    const BADGE = { vi: [0, 0.116, 0.13], en: [0.0635, 0.164, 0.137] };
    let px = -200, py = -200, tgt = null, lens = null, kind = 'free', inside = false, shownR = 6, follow = 0;
    let touch = !fine, ringOut = false, ringBw = -1;
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
      ensure();
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
      lens = !t && !touch && node && node.closest ? lensOf(node) : null;
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
        if (tgt.matches('input[type="range"]')) { kind = 'free'; size(8); chase(); }
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
      else { kind = 'free'; size(12); chase(); }
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
    const toMouse = () => { touch = false; root.classList.add('cur-on'); };
    addEventListener('pointermove', (e) => {
      /* Chạm: khối con trỏ không dùng (xem tapFx bên dưới). */
      if (e.pointerType === 'touch') return;
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
      /* Máy lai (chuột + màn chạm): vừa chạm thì cất khối con trỏ chuột đi. */
      if (!touch) { touch = true; root.classList.remove('cur-on'); inside = false; ringOut = false; O.to(0, SPEC.m3FastEffects); hO.to(0, SPEC.m3FastEffects); }
    }, { passive: true });
    const lift = (e) => {
      if (e.pointerType === 'mouse') { S.to(1, SPEC.m3FastSpatial); if (inside) track(450); }
    };
    addEventListener('pointerup', lift, { passive: true });
    addEventListener('pointercancel', lift, { passive: true });
  })();

  /* ================= Phản hồi chạm (màn cảm ứng) =================
     User #302: con trỏ bám ngón tay "hoạt động khá dở" — muốn học từ đâu đó, KHÔNG ảnh hưởng lúc lướt, đơn giản mà ấn
     tượng. Học đúng Android (Material ripple + ViewConfiguration): trong vùng cuộn được, trạng thái "đang nhấn" chỉ hiện sau
     tap timeout ~100 ms; ngón di quá touch slop (~8 dp) hay trình duyệt nhận cú cuộn (pointercancel) là huỷ → vuốt trang
     KHÔNG bao giờ nháy gì. Chạm thật vào nút: gợn sóng lan từ đúng chỗ ngón trong lòng nút (đúng hình + bo góc của nút, màu
     chữ của nút ~16% như lớp trạng thái M3), thả tay thì tan. Chạm vào chỗ không phải nút: một vòng sáng mảnh nở ra rồi tan
     tại chỗ ngón. Chỉ là vài phần tử position:fixed chạy bằng chuyển tiếp CSS — không vòng rAF, không chặn sự kiện. */
  (function tapFx() {
    if (reduced) return;
    const HIT = 'a[href], button, summary, [role="switch"], [role="radio"]';
    const TAP_MS = 90, SLOP = 10;
    let st = null, host = null;
    const shapeOf = (t) => {
      const r = t.getBoundingClientRect(), v = getComputedStyle(t).borderTopLeftRadius, n = parseFloat(v) || 0;
      let rad = Math.min(r.height / 2, r.width / 2, /%$/.test(v) ? Math.min(r.width, r.height) * n / 100 : n), pad = 0;
      /* Chữ / liên kết không có nền: chừa lề như một viên thuốc, để gợn sóng không cắt sát mép chữ. */
      if (rad < 6) { pad = 6; rad = Math.min(14, (r.height + 12) / 2) - pad; }
      return { l: r.left - pad, t: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2, r: rad + pad };
    };
    const fade = () => {
      const h = host; host = null;
      if (!h) return;
      h.classList.add('out');
      setTimeout(() => h.remove(), 380);
    };
    const press = () => {
      if (!st || st.pressed) return;
      st.pressed = true;
      fade();
      const t = st.t;
      if (!t || !t.isConnected) return;
      const f = shapeOf(t);
      if (!f.w || !f.h || f.w > innerWidth * 1.2) return;
      const h = d.createElement('div'); h.className = 'tap-host'; h.setAttribute('aria-hidden', 'true');
      h.style.cssText = 'left:' + f.l + 'px;top:' + f.t + 'px;width:' + f.w + 'px;height:' + f.h + 'px;border-radius:' + f.r + 'px';
      /* Bán kính phủ hết nút từ chỗ ngón (góc xa nhất), như RippleDrawable. */
      const x = st.x - f.l, y = st.y - f.t, R = Math.hypot(Math.max(x, f.w - x), Math.max(y, f.h - y));
      const c = d.createElement('i'); c.className = 'tap-rip';
      c.style.cssText = 'left:' + (x - R) + 'px;top:' + (y - R) + 'px;width:' + R * 2 + 'px;height:' + R * 2 + 'px;background:color-mix(in srgb, ' + getComputedStyle(t).color + ' 16%, transparent)';
      h.appendChild(c); d.body.appendChild(h); host = h;
      void c.offsetWidth; h.classList.add('on');
    };
    const ring = (x, y) => {
      const e = d.createElement('i'); e.className = 'tap-ring'; e.setAttribute('aria-hidden', 'true');
      e.style.left = x + 'px'; e.style.top = y + 'px';
      d.body.appendChild(e);
      setTimeout(() => e.remove(), 600);
    };
    /* Chữ tiêu đề dưới ngón (#303, bản cho màn chạm của "rê chuột thì chữ phình"; user: "bám ngón cũng được"):
       - chạm nhanh vào chữ: chữ quanh chỗ ngón phình lên theo khoảng cách rồi trở lại — một nhịp;
       - kéo NGANG trên dòng chữ: vùng phình bám theo ngón, nhấc ngón là trở lại.
       KHÔNG kích hoạt khi vuốt dọc, cũng không khi chỉ đặt ngón giữ yên (user #303 hỏi "vuốt trang thì kích hoạt có ổn
       không" — không: vuốt là để cuộn; người đọc hay đặt ngón nghỉ trên chữ rồi mới vuốt, chữ phình rồi xẹp mỗi lần như
       thế là rối mắt, lại đổi trục phông + bố cục trên luồng chính đúng lúc cần mượt nhất, và trái luật #302 "không ảnh
       hưởng lúc lướt"; giữ lâu là việc của Android: chọn chữ). Tiêu đề giữ cử chỉ ngang (touch-action: pan-y khi html.tfx,
       site.css); kéo dọc là huỷ, trình duyệt nhận cú cuộn thì gửi pointercancel → chữ về như cũ. Chạm khoảng trống của dải
       tiêu đề, hay chữ đang ẩn chờ nở: vòng sáng như cũ. */
    root.classList.add('tfx');
    const TAP_UP = { z: 1, k: 520 };
    const headAt = (node) => {
      if (!node || !node.closest || !node.closest('.hero-h, .h2, .fx-h')) return null;
      const w = node.closest('.kw');
      if (!w || +getComputedStyle(w).opacity < 0.5) return null;
      const sw = swells.find((x) => x.k.vis.contains(node));
      return sw && !sw.k.busy ? sw : null;
    };
    const swellAt = (sw, x, y) => {
      if (sw.k.busy || !pin(sw.k, sw.opt)) return false;
      swellTo(sw, x, y, sw.k.el.getBoundingClientRect(), true, TAP_UP);
      return true;
    };
    const relax = (sw, delay) => {
      clearTimeout(sw.tapT);
      sw.tapT = setTimeout(() => { sw.hot = false; sw.kit.forEach((L) => L.u.to(0, SWELL)); }, delay || 0);
    };
    /* Kéo: gom các sự kiện di chuyển về một lần mỗi khung (màn 120 Hz gửi tới 240 sự kiện/giây). */
    const track = (s) => {
      if (s.raf) return;
      s.raf = requestAnimationFrame(() => { s.raf = 0; if (st === s && s.follow) swellAt(s.sw, s.x, s.y); });
    };
    const follow = (s) => {
      if (!s.sw || s.follow) return;
      s.follow = true; s.sw.hot = true; clearTimeout(s.sw.tapT);
      if (!swellAt(s.sw, s.x, s.y)) { s.follow = false; s.sw.hot = false; }
    };
    const cancel = () => {
      if (!st) return;
      clearTimeout(st.timer); cancelAnimationFrame(st.raf);
      if (st.follow) relax(st.sw);
      st = null; fade();
    };
    addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      cancel();
      const t = e.target && e.target.closest ? e.target.closest(HIT) : null;
      /* Thanh trượt và cửa sổ nổi kéo được có phản hồi riêng (tay cầm, sóng, kéo theo ngón): bỏ qua. */
      if (t && t.matches('input[type="range"]')) return;
      if (e.target.closest && e.target.closest('.ov, .a-slider')) return;
      /* Tên chương / tiêu đề vừa chưa tách (màn chạm không tách sẵn): tách ngay bây giờ rồi dò lại chữ dưới ngón. */
      let node = e.target;
      const cand = !t && node.closest && node.closest(SWELL_H);
      if (cand && !cand.cryoSplit) {
        prepSwell(cand);
        node = d.elementFromPoint(e.clientX, e.clientY) || node;
        /* Tách chữ có thể vừa gỡ đúng phần tử dưới ngón khỏi trang: các sự kiện tiếp theo của cú chạm sẽ bắn vào phần tử
           đã gỡ và không về tới window → giữ cú chạm trên chính tiêu đề. */
        if (!e.target.isConnected) { try { cand.setPointerCapture(e.pointerId); } catch (err) { /* không giữ được: bỏ qua */ } }
      }
      st = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t, sw: t ? null : headAt(node), follow: false, pressed: false, timer: 0, raf: 0 };
      if (!st.sw) st.timer = setTimeout(press, TAP_MS);
    }, { passive: true });
    addEventListener('pointermove', (e) => {
      if (!st || e.pointerType !== 'touch' || !e.isPrimary) return;
      st.x = e.clientX; st.y = e.clientY;
      if (st.follow) { track(st); return; }
      const dx = Math.abs(st.x - st.x0), dy = Math.abs(st.y - st.y0);
      if (Math.hypot(dx, dy) <= SLOP) return;
      /* Kéo ngang trên chữ tiêu đề: bám ngón. Còn lại (kéo dọc = cuộn, hay không phải tiêu đề): huỷ như cũ. */
      if (st.sw && dx > dy) follow(st); else cancel();
    }, { passive: true });
    addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') cancel(); }, { passive: true });
    addEventListener('pointerup', (e) => {
      if (!st || e.pointerType !== 'touch' || !e.isPrimary) return;
      const s = st;
      clearTimeout(s.timer); cancelAnimationFrame(s.raf);
      if (s.follow) { st = null; relax(s.sw, 120); return; }
      if (s.t) { press(); st = null; const h = host; setTimeout(() => { if (host === h) fade(); }, 140); return; }
      st = null;
      /* Chạm nhanh vào chữ: phình một nhịp rồi trở lại. */
      if (s.sw) { s.sw.hot = true; if (swellAt(s.sw, s.x, s.y)) { relax(s.sw, 520); return; } s.sw.hot = false; }
      ring(s.x, s.y);
    }, { passive: true });
    /* Trang cuộn trong lúc đang nhấn giữ (một số trình duyệt không gửi pointercancel): tan ngay. Chỉ cuộn của TRANG (không
       bắt pha capture): bảng báo cáo tự cuộn bên trong không được huỷ cú chạm. */
    addEventListener('scroll', () => { if (st) cancel(); else if (host) fade(); }, { passive: true });
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
  /* Thị sai theo CUỘN: trình duyệt có hoạt ảnh gắn thanh cuộn (animation-timeline) thì để CSS chạy (site.css orbPar,
     compositor). Điện thoại cuộn trên luồng riêng; JS dời khối theo sự kiện cuộn luôn trễ một nhịp và thưa hơn nhịp cuộn
     120 Hz → khối giật so với trang (user #302 vòng 5: "web trên Vivo cảm giác chỉ 30 Hz"). JS chỉ còn đặt biên độ --pd:
     dịch = (tâm mục − tâm màn) × −0.22 × độ sâu, tuyến tính suốt dải view() "cover" dài (cao màn + cao mục) → hai đầu
     ±0.11 × độ sâu × (cao màn + cao mục). */
  const SDA = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  const geo = (ob) => {
    const r = ob.w.parentNode.getBoundingClientRect(); sY = scrollY; ob.hy = r.top + sY + r.height / 2;
    if (SDA) ob.w.style.setProperty('--pd', (0.11 * ob.dep * (innerHeight + r.height)).toFixed(1) + 'px');
  };
  const place = owner(() => orbs.forEach((ob) => {
    if (!ob.on) return;
    const sy = SDA ? 0 : (ob.hy - sY - innerHeight / 2) * -0.22 * ob.dep;
    ob.w.style.transform = 'translate3d(' + (ox.x * 44 * ob.dep).toFixed(1) + 'px,' + (oy.x * 32 * ob.dep + sy).toFixed(1) + 'px,0)';
  }));
  ox.owner = oy.owner = place;
  if (orbs.length) {
    if (fine && !reduced) addEventListener('pointermove', (e) => {
      ptrX = e.clientX / innerWidth - 0.5; ptrY = e.clientY / innerHeight - 0.5;
      ox.to(ptrX, SPEC.gentle); oy.to(ptrY, SPEC.gentle);
    }, { passive: true });
    if (!reduced && !SDA) addEventListener('scroll', () => { sY = M.view.y; place.apply(); }, { passive: true });
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
    /* Dịch theo cuộn bằng hoạt ảnh gắn thanh cuộn của CSS khi có (site.css kinPar, compositor — xem thị sai khối 3D ở
       trên: JS theo sự kiện cuộn thì dải chữ giật trên điện thoại). Dịch = vị trí cuộn × 0.42, quấn vòng theo nửa dải
       (--kh) → số vòng trên cả dải cuộn --kn = 0.42 × quãng cuộn / nửa dải. JS chỉ còn nghiêng theo vận tốc. */
    const SDA = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
    /* Đo LÚC CẦN (#303): đọc scrollWidth ngay khi fx.js chạy bắt cả trang bố cục giữa lúc tải (đo: ~385 ms ở CPU ×4). Dải
       chữ đứng yên (.kin chưa .live) tới khi gần màn hình, nên đo trong lần IO báo "gần" là đủ — lúc đó bố cục vừa tính. */
    let measured = false;
    const measure = () => {
      measured = true;
      const range = Math.max(1, d.documentElement.scrollHeight - innerHeight);
      rows.forEach((r) => {
        r.half = r.loop.scrollWidth / 2 || 1;
        r.loop.style.animationDuration = (r.half / 34).toFixed(1) + 's';
        if (SDA) { r.tr.style.setProperty('--kh', r.half.toFixed(1) + 'px'); r.tr.style.setProperty('--kn', (0.42 * range / r.half).toFixed(3)); }
      });
    };
    const remeasure = () => { if (measured) measure(); };
    M.refreshers.push(remeasure);
    addEventListener('resize', later(remeasure, 150));
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(remeasure);
    /* Trang cao lên/thấp xuống (mở câu hỏi, bảng thiết bị) thì quãng cuộn đổi → số vòng đổi theo. */
    if (SDA && 'ResizeObserver' in window) new ResizeObserver(later(remeasure, 200)).observe(d.body);
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
        r.tr.style.transform = (SDA ? '' : 'translate3d(' + (-mod(y * 0.42 * r.dir, r.half)).toFixed(2) + 'px,0,0) ') + 'skewX(' + sk.toFixed(2) + 'deg)';
      });
      quiet = Math.abs(vel) < 4 && dy === 0 ? quiet + 1 : 0;
      raf = on && quiet < 20 ? requestAnimationFrame(frame) : 0;
    }
    addEventListener('scroll', () => {
      y = M.view.y;
      if (on && !raf) { t0 = 0; quiet = 0; raf = requestAnimationFrame(frame); }
    }, { passive: true });
    /* Đo khi còn cách một màn (lúc IO báo, bố cục vừa tính xong nên đọc không tốn), để lúc hiện ra dải đã dời đúng chỗ. */
    io([sec], { rootMargin: '100% 0px' }, (el, vis, o) => { if (!vis) return; if (o) o.unobserve(el); if (!measured) measure(); });
    io([sec], { rootMargin: '80px 0px' }, (el, vis) => {
      if (vis && !measured) measure();
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
      const v = clamp(p, 0, 1);
      if (v === prog.t && prog.x === v && prog.v === 0) return;
      prog.to(v, SPEC.m3Spatial);
    }
    function frame(t) {
      const dt = t0 ? Math.min(0.05, (t - t0) / 1000) : 0; t0 = t;
      phase = (phase + dt * 3.2) % (Math.PI * 2);
      draw();
      raf = on ? requestAnimationFrame(frame) : 0;
    }
    /* Khuất khỏi màn thì không đo, không đuổi lò xo theo cuộn (#303: bản cũ mỗi sự kiện cuộn ở BẤT KỲ đâu trên trang đều
       chạy một nhịp lò xo + dựng lại đường sóng). Hiện lại thì IO đo và bắt kịp. */
    const fresh = () => { if (on) { measure(); target(); } };
    (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(fresh);
    addEventListener('resize', later(fresh, 150));
    M.refreshers.push(() => requestAnimationFrame(fresh));
    addEventListener('scroll', () => { if (on) target(); }, { passive: true });
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
    /* Ba quầng nền vẽ bằng canvas NHỎ (128 điểm ảnh) rồi để bộ dựng hình phóng lên (#303). Quầng là dải màu tròn mềm nên
       phóng lên không khác gì vẽ thẳng, mà:
       - đổi tông theo mục (1,4 s) chỉ còn vẽ lại ba ô 128×128 — bản CSS vẽ lại ba lớp 90vmax (~4,7 triệu điểm ảnh mỗi lớp
         trên điện thoại) mỗi khung: đo trên điện thoại giả lập, GPU kín 1,4 s, khung vẽ được tụt còn ~1/3 mỗi lần cuộn qua
         ranh giới mục;
       - bộ nhớ đồ hoạ ~60 MB → ~0,2 MB.
       Màu chuyển y như chuyển tiếp CSS cũ: đường ease 1,4 s, nội suy trong Oklab (chuẩn của <color>). Không JS thì CSS gốc. */
    const blobs = $$('i', amb);
    const probe = d.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (blobs.length !== 3 || !probe) return;
    probe.canvas.width = probe.canvas.height = 1;
    const N = 128, ALPHA = [0.62, 0.48, 0.34], WHICH = ['--amb1', '--amb2', '--amb1'];
    const ctxs = blobs.map((b) => { const c = d.createElement('canvas'); c.width = c.height = N; c.className = 'amb-cv'; b.appendChild(c); return c.getContext('2d'); });
    amb.classList.add('cv');
    /* Màu đích đọc từ CSS (một nguồn sự thật: bảng màu + luật .amb[data-amb]); .amb.cv tắt chuyển tiếp CSS nên đọc ra đích ngay. */
    const rgbOf = (v) => {
      probe.clearRect(0, 0, 1, 1); probe.fillStyle = '#000'; probe.fillStyle = v; probe.fillRect(0, 0, 1, 1);
      const p = probe.getImageData(0, 0, 1, 1).data; return [p[0], p[1], p[2]];
    };
    const read = () => { const cs = getComputedStyle(amb); return { a1: rgbOf(cs.getPropertyValue('--amb1').trim()), a2: rgbOf(cs.getPropertyValue('--amb2').trim()) }; };
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const gam = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
    const toLab = (c) => {
      const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2];
    };
    const toRgb = (L) => {
      const l = Math.pow(L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], 3), m = Math.pow(L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], 3), s2 = Math.pow(L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2], 3);
      return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2].map((v) => clamp(Math.round(gam(v)), 0, 255));
    };
    /* Hàm ease của CSS = cubic-bezier(.25, .1, .25, 1): tìm tham số theo trục thời gian bằng chia đôi. */
    const ease = (x) => {
      const bz = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 20; i++) { t = (lo + hi) / 2; if (bz(t, 0.25, 0.25) < x) lo = t; else hi = t; }
      return bz(t, 0.1, 1);
    };
    const paint = (c, i) => {
      const ctx = ctxs[i], h = N / 2;
      ctx.clearRect(0, 0, N, N);
      const g = ctx.createRadialGradient(h, h, 0, h, h, h), rgb = c[0] + ',' + c[1] + ',' + c[2];
      g.addColorStop(0, 'rgba(' + rgb + ',' + ALPHA[i] + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
    };
    let cur = read(), from = null, to = null, t0 = 0, raf = 0, last = 0;
    const show = (v) => WHICH.forEach((k, i) => paint(k === '--amb1' ? v.a1 : v.a2, i));
    show(cur);
    /* Vẽ lại ~30 lần/giây: mỗi bước màu chỉ đổi ~1 mức trên nền tối, nhịp 60/120 chỉ thêm việc đẩy khung. */
    const tick = (now) => {
      raf = 0;
      if (!t0) t0 = now;
      const p = clamp((now - t0) / 1400, 0, 1), e = ease(p);
      if (p < 1 && now - last < 30) { raf = requestAnimationFrame(tick); return; }
      last = now;
      const mix = (a, b) => { const A = toLab(a), B = toLab(b); return toRgb([lerp(A[0], B[0], e), lerp(A[1], B[1], e), lerp(A[2], B[2], e)]); };
      cur = { a1: mix(from.a1, to.a1), a2: mix(from.a2, to.a2) };
      show(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const retone = () => {
      const next = read();
      if (to && next.a1 + '' === to.a1 + '' && next.a2 + '' === to.a2 + '') return;
      if (reduced) { cur = to = next; cancelAnimationFrame(raf); raf = 0; show(cur); return; }
      from = cur; to = next; t0 = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    new MutationObserver(retone).observe(amb, { attributes: true, attributeFilter: ['data-amb'] });
    new MutationObserver(retone).observe(root, { attributes: true, attributeFilter: ['data-scheme'] });
  })();
})();
