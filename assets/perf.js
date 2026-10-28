/* Cryo — bảng đo khung hình ẩn (#303). Chỉ tải khi địa chỉ có "perf" (…/?perf hoặc …/#perf); người xem thường không tải
   tệp này nên không tốn gì. Dùng để đo trên ĐÚNG máy của người dùng (máy thật mà phiên làm việc không cắm được):
   - đo số khung/giây của phần chạy bằng JS (rAF) và nhịp của nó (máy tính = tần số màn; Chrome Android màn ≥ 120 Hz chạy
     phần này ở nửa tần số, cuộn thì vẫn đủ);
   - "Tự cuộn 20 s": người dùng tự cuộn như mọi khi, chỉ tính khung lúc đang cuộn — đúng cái họ thấy khựng;
   - "Đo cuộn": tự cuộn cả trang với tốc độ đều, báo khung/giây theo từng mục;
   - mọi phép đo kèm khung "khựng" nặng nhất + mục, và khung > 50 ms kèm đoạn mã gây ra (Long Animation Frames);
   - "Tìm thủ phạm": cuộn nhiều lượt, mỗi lượt tắt thử MỘT hiệu ứng, so với lượt không tắt → hiệu ứng nào làm tụt khung;
   - tắt tay từng hiệu ứng để tự nhìn.
   Kết quả là chữ (bôi đen chép được / chụp màn hình gửi lại). Bảng tự đếm khung bằng rAF — thu nhỏ bảng thì ngừng đếm để
   trang đứng yên giống hệt lúc không có bảng. */
(() => {
  'use strict';
  if (window.CryoPerf) return;
  const d = document;
  const P = (window.CryoPerf = { noGame: false, noBreath: false });

  /* ---------- Các hiệu ứng tắt được ---------- */
  /* [khoá, tên, CSS tắt, cờ JS, chỉ chạy lúc đứng yên (lượt cuộn không đo được → "Tìm thủ phạm" bỏ qua)] */
  const OFF = [
    ['amb', 'Ánh nền (3 quầng màu + hạt)', '.amb{display:none!important}'],
    ['blur', 'Thanh đầu trang kính mờ', '.top-bar{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}'],
    ['deco', 'Quầng sáng + lưới sau chữ', '.hero::before,.hero::after,.chap::before,.stage::before,.hs-glow,.pro-aura{display:none!important}'],
    ['orbs', 'Khối 3D', '.orbs{display:none!important}'],
    ['nums', 'Số chương cỡ lớn', '.chap-num,.chap-bg{display:none!important}'],
    ['anim', 'Mọi hoạt ảnh CSS', '*,*::before,*::after{animation-play-state:paused!important}'],
    ['game', 'Game chạy trên canvas', null, 'noGame'],
    ['breath', 'Chữ "thở" ở đầu trang', null, 'noBreath', true],
  ];
  const on = new Set();
  /* Con trỏ tuỳ biến của trang giấu con trỏ hệ thống (html.cur-on *) — trên bảng thì trả lại. */
  const base = d.createElement('style');
  base.textContent = '#cryo-perf,#cryo-perf *{cursor:auto!important}#cryo-perf button,#cryo-perf label{cursor:pointer!important}' +
    'html:has(#cryo-perf:hover) .m3-cursor{opacity:0!important}';
  const style = d.createElement('style'); style.id = 'cryo-perf-css';
  d.head.append(base, style);
  const apply = () => {
    style.textContent = OFF.filter((o) => on.has(o[0]) && o[2]).map((o) => o[2]).join('\n');
    P.noGame = on.has('game'); P.noBreath = on.has('breath');
    box.querySelectorAll('input[data-k]').forEach((c) => { c.checked = on.has(c.dataset.k); });
  };

  /* ---------- Giao diện ---------- */
  const box = d.createElement('div');
  box.id = 'cryo-perf';
  box.setAttribute('translate', 'no');
  box.style.cssText = 'position:fixed;z-index:2147483000;left:8px;bottom:8px;max-width:min(360px,calc(100vw - 16px));max-height:70vh;overflow:auto;' +
    'background:#0d0e13;color:#e3e1e9;border:1px solid #45464f;border-radius:14px;padding:10px 12px;font:12px/1.45 system-ui,sans-serif;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.5);touch-action:auto';
  box.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:13px">Đo khung hình</b>' +
    '<span id="pf-live" style="margin-left:auto;font-variant-numeric:tabular-nums">…</span>' +
    '<button id="pf-min" style="all:unset;padding:2px 8px;border-radius:8px;background:#292a2f">–</button></div>' +
    '<div id="pf-body">' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
    '<button data-act="self">Tự cuộn 20 s</button><button data-act="scroll">Đo cuộn</button><button data-act="idle">Đứng yên 3 s</button><button data-act="hunt">Tìm thủ phạm (~2 phút)</button><button data-act="copy">Chép kết quả</button></div>' +
    '<div id="pf-sw"><div style="opacity:.8;margin-bottom:4px">Tắt thử:</div><div id="pf-offs"></div></div>' +
    '<pre id="pf-out" style="white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 system-ui,sans-serif;font-variant-numeric:tabular-nums;user-select:text;-webkit-user-select:text"></pre></div>';
  box.querySelectorAll('button[data-act]').forEach((b) => { b.style.cssText = 'all:unset;padding:5px 10px;border-radius:999px;background:#354479;color:#dce1ff'; });
  const offs = box.querySelector('#pf-offs');
  OFF.forEach(([k, label]) => {
    const l = d.createElement('label'); l.style.cssText = 'display:flex;gap:6px;align-items:center;padding:2px 0';
    l.innerHTML = '<input type="checkbox" data-k="' + k + '"><span>' + label + '</span>';
    offs.appendChild(l);
  });
  let busy = false;
  offs.addEventListener('change', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    if (e.target.checked) on.add(k); else on.delete(k);
    apply();
  });
  const out = box.querySelector('#pf-out'), live = box.querySelector('#pf-live'), body = box.querySelector('#pf-body'), sw = box.querySelector('#pf-sw');
  (d.body || d.documentElement).appendChild(box);

  /* ---------- Đếm khung ---------- */
  /* Mỗi khoảng giữa hai khung (rAF) vào một vòng đệm 600 ô (đoán nhịp màn hình = phân vị 10%: đa số khung đúng nhịp) và vào
     mọi "giỏ" đang mở (mỗi phép đo mở một giỏ riêng). Khung "trễ" = dài hơn 1,5 nhịp màn hình. */
  const RING = 600, ring = new Float64Array(RING), sinks = new Set();
  let rn = 0, lastT = 0, raf = 0, cnt = 0, cntT = 0;
  let tick = 0;
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (lastT) { const dt = t - lastT; ring[rn++ % RING] = dt; cnt++; sinks.forEach((f) => f(dt)); }
    lastT = t;
  };
  const counting = (yes) => {
    if (yes && !raf) { lastT = 0; cnt = 0; cntT = performance.now(); raf = requestAnimationFrame(loop); tick = setInterval(show, 500); }
    if (!yes && raf) { cancelAnimationFrame(raf); raf = 0; clearInterval(tick); }
  };
  /* Nhịp = nhịp ngắn nhất từng đo được (≥ 60 khung): máy đang ì thì phân vị 10% cũng dài ra, đừng để nó kéo nhịp xuống. */
  let vBest = Infinity;
  const vsync = () => {
    const n = Math.min(rn, RING);
    if (n >= 60) { const s = Array.from(ring.subarray(0, n)).sort((x, y) => x - y), v = s[Math.floor(n * 0.1)]; if (v > 4) vBest = Math.min(vBest, v); }
    return vBest < Infinity ? vBest : 16.7;
  };
  /* Khung "khựng" = mắt thấy: dài hơn 2,5 nhịp màn và hơn 20 ms (60 Hz: ≥ 42 ms; 165 Hz: ≥ 20 ms). */
  const hitchMs = (v) => Math.max(2.5 * v, 20);
  /* Long Animation Frames (Chrome 123+): mỗi khung > 50 ms kèm đoạn mã đã chạy trong khung đó (hàm, tệp:vị trí ký tự) và
     phần dựng kiểu/bố cục/vẽ → biết khựng do MÃ, do DỰNG, hay do chờ (GPU/hệ thống). buffered: lấy cả các khung từ lúc mở
     trang. Giữ 1500 khung gần nhất (bỏ khung cũ nhất). */
  const loafs = [];
  let loafObs = null;
  const takeLoaf = (list) => list.forEach((e) => {
    const end = e.startTime + e.duration;
    loafs.push({ t: e.startTime, dur: e.duration, layout: e.styleAndLayoutStart ? end - e.styleAndLayoutStart : 0,
      scripts: (e.scripts || []).map((x) => ({ d: x.duration, k: (x.sourceFunctionName || x.invokerType || x.invoker || '?') + ' ' +
        String(x.sourceURL || '').split('/').pop().split('?')[0] + ':' + x.sourceCharPosition })) });
    if (loafs.length > 1500) loafs.shift();
  });
  try {
    if ((PerformanceObserver.supportedEntryTypes || []).includes('long-animation-frame')) {
      loafObs = new PerformanceObserver((l) => takeLoaf(l.getEntries()));
      loafObs.observe({ type: 'long-animation-frame', buffered: true });
    }
  } catch (e) { loafObs = null; /* trình duyệt không có — bỏ phần này */ }
  /* keep(t): chỉ lấy khung thoả điều kiện (vd. "Tự cuộn" chỉ lấy khung lúc đang cuộn). Mã = mọi đoạn mã trong khung (cả
     rAF); dựng = từ lúc dựng kiểu/bố cục tới hết khung; chờ/khác = phần còn lại. */
  const loafSum = (t0, t1, secAt, keep) => {
    if (!loafObs) return '';
    takeLoaf(loafObs.takeRecords()); // khung vừa xong còn nằm trong hàng đợi của observer
    const L = loafs.filter((x) => x.t >= t0 && x.t < t1 && (!keep || keep(x.t)));
    if (!L.length) return 'Khung > 50 ms: không có\n';
    const by = new Map(); let sc = 0, ly = 0, tot = 0;
    L.forEach((x) => { tot += x.dur; ly += x.layout; x.scripts.forEach((y) => { sc += y.d; by.set(y.k, (by.get(y.k) || 0) + y.d); }); });
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const big = L.slice().sort((a, b) => b.dur - a.dur).slice(0, 3);
    return 'Khung > 50 ms: ' + L.length + ' (tổng ' + Math.round(tot) + ' ms: mã ' + Math.round(sc) + ', dựng kiểu/bố cục/vẽ ' + Math.round(ly) +
      ', chờ/khác ' + Math.max(0, Math.round(tot - sc - ly)) + ')' + (secAt ? ' — dài nhất: ' + big.map((x) => Math.round(x.dur) + ' ms ' + secAt(x.t)).join(', ') : '') +
      (top.length ? '\n  mã: ' + top.map(([k, v]) => k + ' ' + Math.round(v) + ' ms').join(' · ') : '') + '\n';
  };
  function show() {
    const now = performance.now(); if (now - cntT < 250) return; // vừa đặt lại sau một phép đo
    const f = cnt * 1000 / (now - cntT);
    cnt = 0; cntT = now;
    if (!busy) live.textContent = Math.round(f) + ' khung/s · nhịp ~' + Math.round(1000 / vsync()) + ' Hz';
  }
  counting(true);
  box.querySelector('#pf-min').addEventListener('click', () => {
    if (busy) return;
    body.hidden = !body.hidden;
    counting(!body.hidden);
    if (body.hidden) live.textContent = 'đã thu nhỏ';
  });

  /* ---------- Đo ---------- */
  const NAMES = { res: 'Độ phân giải', freeze: 'Đóng băng', mon: 'Cửa sổ theo dõi', play: 'Trong lúc chơi', rep: 'Báo cáo' };
  const parts = () => {
    const y0 = scrollY, list = [];
    const add = (name, el) => { if (!el) return; const r = el.getBoundingClientRect(); list.push({ name, top: r.top + y0, bottom: r.bottom + y0 }); };
    add('Mở đầu', d.querySelector('.hero'));
    add('Dải chữ chạy', d.querySelector('.kin'));
    d.querySelectorAll('.chap').forEach((c, i) => add('Chương: ' + (NAMES[c.dataset.screen] || i + 1), c));
    add('Hoàn tác', d.querySelector('.undo-zone'));
    add('Shizuku', d.querySelector('.shz'));
    add('Miễn phí & PRO', d.querySelector('.price'));
    add('Câu hỏi', d.querySelector('.faq'));
    add('Cộng đồng + cuối trang', d.querySelector('.community'));
    add('Cộng đồng + cuối trang', d.querySelector('.end'));
    add('Cộng đồng + cuối trang', d.querySelector('.foot'));
    add('Câu chuyện (giữa các chương)', d.querySelector('.story')); // sau cùng: chỉ bắt phần không thuộc chương nào
    return list;
  };
  const scrollToY = (y) => { const L = window.CryoLenis; if (L) L.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); };
  const bucket = () => ({ n: 0, ms: 0, late: 0, hitch: 0 });
  const fps = (r) => (r && r.ms ? r.n * 1000 / r.ms : 0);
  const lateP = (r) => Math.round(100 * r.late / Math.max(1, r.n));
  /* Màn tắt / chuyển app giữa chừng (rAF dừng, khoảng khung vọt lên hàng giây) thì lượt đó vô nghĩa → huỷ cả phép đo. */
  const STOPPED = 'Màn hình tắt hoặc chuyển app giữa chừng — bấm lại, giữ màn sáng.';
  /* Bộ ghi của một phép đo: mỗi khoảng khung vào tổng (all) và vào mục đang ở giữa màn (sec); khung khựng nặng nhất kèm
     mục; dòng thời gian mục (để gắn khung > 50 ms của Long Animation Frames vào đúng mục). Ranh giới các mục đọc lại mỗi
     30 khung (lần đầu cuộn qua, chương còn đang dựng nên trang có thể cao lên). where(y) = vị trí cuộn của khung này. */
  const recorder = () => {
    const v = vsync(), hm = hitchMs(v), all = bucket(), sec = new Map(), worst = [], tl = [];
    let P0 = parts(), k = 0, cur = null, curName = '', gap = false;
    const t0 = performance.now();
    const where = (y) => {
      if (++k % 30 === 0) P0 = parts();
      const mid = y + innerHeight / 2, p = P0.find((q) => mid >= q.top && mid < q.bottom), n = p ? p.name : 'khác';
      if (n !== curName) { curName = n; tl.push([performance.now(), n]); cur = sec.get(n) || (sec.set(n, bucket()), sec.get(n)); }
    };
    const sink = (dt) => {
      if (dt > 2500) gap = true;
      const late = dt > v * 1.5 ? 1 : 0, hit = dt > hm ? 1 : 0;
      all.n++; all.ms += dt; all.late += late; all.hitch += hit;
      if (cur) { cur.n++; cur.ms += dt; cur.late += late; cur.hitch += hit; }
      if (hit && (worst.length < 3 || dt > worst[2][0])) { worst.push([dt, curName]); worst.sort((a, b) => b[0] - a[0]); if (worst.length > 3) worst.length = 3; }
    };
    const secAt = (t) => { let n = 'trước khi đo'; for (const [tt, nn] of tl) { if (tt > t) break; n = nn; } return n; };
    return { v, hm, all, sec, worst, where, sink, secAt, t0, get gap() { return gap; }, done() { sinks.delete(sink); this.t1 = performance.now(); return this; } };
  };
  /* Dòng tóm tắt một phép đo: khung/s, trễ, khựng (kèm 3 khung nặng nhất + mục), rồi khung > 50 ms và mã gây ra. */
  const report = (R, title) => {
    const A = R.all;
    return title + ': ' + Math.round(fps(A)) + ' khung/s, trễ ' + lateP(A) + '%, khựng (> ' + Math.round(R.hm) + ' ms) ' + A.hitch +
      (R.worst.length ? ' — nặng nhất: ' + R.worst.map(([ms, n]) => Math.round(ms) + ' ms ' + n).join(', ') : '') + '\n' +
      loafSum(R.t0, R.t1, R.secAt, R.keep);
  };
  const slowest = (sec, n) => [...sec.entries()].filter(([k, r]) => r.ms >= 250 && k !== 'khác').sort((x, y) => fps(x[1]) - fps(y[1])).slice(0, n);
  const secLines = (R) => { let s = ''; R.sec.forEach((r, k) => { if (r.n) s += '· ' + k + ': ' + Math.round(fps(r)) + '/s, trễ ' + lateP(r) + '%' + (r.hitch ? ', khựng ' + r.hitch : '') + '\n'; }); return s; };
  /* Cuộn đều từ đầu tới cuối trang (px/giây). */
  const scrollRun = (speed) => new Promise((res, rej) => {
    scrollToY(0);
    let R = null, t0 = 0, H = 0, f = 0;
    const end = (err) => { if (R) R.done(); if (err) rej(err); else res(R); };
    const step = (t) => {
      try {
        if (!t0) { t0 = t; R = recorder(); sinks.add(R.sink); H = d.documentElement.scrollHeight - innerHeight; requestAnimationFrame(step); return; }
        if (R.gap || d.hidden) return end(new Error(STOPPED));
        if (++f % 30 === 0) H = d.documentElement.scrollHeight - innerHeight;
        const y = Math.min(H, (t - t0) * speed / 1000);
        scrollToY(y);
        R.where(y); // khung này vẽ ở y → khoảng tới khung sau tính cho mục ở y
        if (y < H) requestAnimationFrame(step); else end();
      } catch (e) { end(e); }
    };
    setTimeout(() => requestAnimationFrame(step), 400);
  });
  /* Người dùng tự cuộn (ngón / lăn chuột như mọi khi) trong 20 s: chỉ tính khung lúc đang cuộn (có sự kiện cuộn trong
     0,2 s gần nhất) — đúng cái người xem cảm thấy, kể cả cuộn mượt Lenis trên máy tính. */
  const selfRun = (secs) => new Promise((res, rej) => {
    const R = recorder();
    /* Khoảng đang cuộn [đầu, cuối]: sự kiện cuộn cách nhau < 0,2 s thì cùng một khoảng. Khung được tính khi nó BẮT ĐẦU
       trong lúc đang cuộn (khung kẹt 350 ms giữa cú lăn chuột Lenis vẫn được tính dù trong lúc kẹt không có sự kiện cuộn). */
    const spans = [];
    let last = -1e9;
    R.scrolls = 0;
    const onS = () => {
      const now = performance.now();
      if (now - last > 200 || !spans.length) spans.push([now, now]); else spans[spans.length - 1][1] = now;
      last = now; R.scrolls++; R.where(scrollY);
    };
    R.keep = (t) => spans.some(([a, b]) => t >= a - 50 && t <= b + 200);
    const inner = R.sink;
    const sink = (dt) => { const L = window.CryoLenis; if (performance.now() - dt - last < 200 || (L && L.isScrolling)) inner(dt); };
    addEventListener('scroll', onS, { passive: true });
    sinks.add(sink);
    const tEnd = performance.now() + secs * 1000;
    const iv = setInterval(() => {
      const left = Math.ceil((tEnd - performance.now()) / 1000);
      live.textContent = 'tự cuộn… còn ' + Math.max(0, left) + ' s';
      if (left > 0 && !R.gap && !d.hidden) return;
      clearInterval(iv); removeEventListener('scroll', onS); sinks.delete(sink); R.done();
      if (R.gap || d.hidden) rej(new Error(STOPPED)); else res(R);
    }, 250);
  });
  const head = () => {
    const ua = navigator.userAgent, m = /(Chrome|Firefox|Version)\/([\d.]+)/.exec(ua), and = /Android/.test(ua), M = window.CryoMotion;
    /* Nhịp rAF = nhịp phần chạy bằng JS. Chrome Android cố ý chạy phần này ở NỬA tần số khi màn ≥ 120 Hz (cờ
       ThrottleMainFrameTo60Hz, bật mặc định) — cuộn và hoạt ảnh CSS vẫn đủ tần số màn. */
    return 'Cryo đo khung · ' + (m ? m[1] + ' ' + m[2].split('.')[0] : '?') + (and ? ' · Android' : /iPhone|iPad/.test(ua) ? ' · iOS' : '') +
      ' · DPR ' + (devicePixelRatio || 1).toFixed(2) + ' · ' + innerWidth + '×' + innerHeight + ' · nhịp JS ~' + Math.round(1000 / vsync()) + ' Hz' +
      (navigator.hardwareConcurrency ? ' · ' + navigator.hardwareConcurrency + ' nhân' : '') + (navigator.deviceMemory ? ' · ' + navigator.deviceMemory + ' GB' : '') +
      /* Bản nào đang chạy (dấu ?v= của site.js) + đường chuyển động của khối — để biết chắc kết quả thuộc bản nào. */
      (M ? ' · bản ' + (M.build || '?') + ' · khối chạy ' + (M.comp ? 'compositor' : 'luồng chính') : '');
  };
  const offNames = () => (on.size ? OFF.filter((o) => on.has(o[0])).map((o) => o[1]).join(', ') : 'không');
  const say = (s) => { out.textContent = s; };
  const run = async (fn) => {
    if (busy) return;
    /* Đang đo thì bảng gọn lại (giấu danh sách tắt thử): bảng che nửa màn là bớt phần trang phải vẽ, số đo lệch. Giữ màn
       sáng (đo ~2 phút không chạm thì điện thoại tự khoá); trình duyệt không cho thì vẫn đo, lượt nào màn tắt sẽ tự huỷ. */
    busy = true; sw.hidden = true; live.textContent = 'đang đo…';
    offs.querySelectorAll('input').forEach((c) => { c.disabled = true; });
    let lock = null;
    try { lock = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null; } catch (e) { lock = null; }
    try { await fn(); } catch (e) { say('Dừng đo: ' + (e && e.message || e)); } finally {
      busy = false; sw.hidden = false; cnt = 0; cntT = performance.now();
      offs.querySelectorAll('input').forEach((c) => { c.disabled = false; });
      if (lock) lock.release().catch(() => {});
    }
  };
  /* Không chép được (trình duyệt trong app, bị chặn quyền) thì bôi đen sẵn để giữ ngón chép tay. */
  let labelT = 0;
  const label = (btn, s, ms) => { clearTimeout(labelT); btn.textContent = s; labelT = setTimeout(() => { btn.textContent = 'Chép kết quả'; }, ms); };
  const selectOut = (btn) => {
    const r = d.createRange(); r.selectNodeContents(out);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    label(btn, 'Đã bôi đen — giữ để chép', 2500);
  };

  box.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button[data-act]'), a = btn && btn.dataset.act;
    if (!a) return;
    if (a === 'copy') {
      const s = out.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).then(() => label(btn, 'Đã chép', 1500), () => selectOut(btn));
      } else selectOut(btn);
      return;
    }
    if (a === 'self') run(async () => {
      say('Cuộn trang như bình thường (lên xuống, qua các mục thấy khựng) trong 20 s…');
      const R = await selfRun(20);
      if (R.scrolls < 10) { say(head() + '\nGần như không cuộn trong 20 s — bấm lại rồi cuộn liên tục.'); return; }
      say(head() + '\n' + report(R, 'Tự cuộn 20 s (chỉ tính lúc đang cuộn)') + secLines(R) + 'Đang tắt: ' + offNames());
    });
    if (a === 'idle') run(async () => {
      say('Đang đo, đừng chạm…');
      const R = recorder(); R.where(scrollY); sinks.add(R.sink);
      await new Promise((ok) => setTimeout(ok, 3000));
      R.done();
      say(head() + '\n' + report(R, 'Đứng yên 3 s ở vị trí này') + 'Đang tắt: ' + offNames());
    });
    if (a === 'scroll') run(async () => {
      say('Đang cuộn cả trang, đừng chạm…');
      const R = await scrollRun(1500);
      say(head() + '\n' + report(R, 'Cuộn cả trang 1500 px/s') + secLines(R) + 'Đang tắt: ' + offNames());
      scrollToY(0);
    });
    if (a === 'hunt') run(async () => {
      /* Lượt khởi động không tính vào phép so; lượt gốc chạy đầu và cuối (máy nóng dần thì vẫn so công bằng). Hiệu ứng chỉ
         chạy lúc đứng yên (chữ thở) không đo được bằng lượt cuộn nên bỏ qua. */
      const saved = new Set(on); on.clear(); apply();
      try { await hunt(); } finally { on.clear(); saved.forEach((k) => on.add(k)); apply(); scrollToY(0); }
    });
    async function hunt() {
      const list = OFF.filter((o) => !o[4]);
      const N = list.length + 3;
      let i = 0;
      const once = async (what) => { i++; say('Đang đo lượt ' + i + '/' + N + ' (' + what + ') — đừng chạm, ~2 phút…'); return scrollRun(2000); };
      const warm = await once('khởi động');
      const base1 = await once('không tắt gì');
      const res = [];
      for (const o of list) { on.clear(); on.add(o[0]); apply(); res.push([o, await once('tắt: ' + o[1])]); }
      on.clear(); apply();
      const base2 = await once('không tắt gì');
      const b = (fps(base1.all) + fps(base2.all)) / 2;
      const rows = res.map(([o, R]) => [o[1], fps(R.all), lateP(R.all), R.sec, R.all.hitch]).sort((x, y) => y[1] - x[1]);
      /* Lượt khởi động là lượt duy nhất có chữ hiện ra + dựng chương (nếu trước đó chưa cuộn qua) — đúng cảm giác lần đầu. */
      const s3 = slowest(warm.sec, 3);
      let s = head() + '\n' + report(warm, 'Lượt đầu (dựng + chữ hiện ra)') +
        (s3.length ? '  chậm: ' + s3.map(([k, r]) => k + ' ' + Math.round(fps(r))).join(', ') + '\n' : '') +
        'Tìm thủ phạm (cuộn 2000 px/s, mỗi lượt tắt MỘT thứ)\nKhông tắt gì: ' + Math.round(b) + ' khung/s (hai lượt: ' +
        Math.round(fps(base1.all)) + ' và ' + Math.round(fps(base2.all)) + '), khựng ' + base1.all.hitch + ' và ' + base2.all.hitch + '\n';
      rows.forEach(([n, f, late, , hit]) => { s += '· Tắt ' + n + ': ' + Math.round(f) + '/s (' + (f - b >= 0 ? '+' : '') + Math.round(f - b) + '), trễ ' + late + '%, khựng ' + hit + '\n'; });
      /* Mục chậm nhất ở lượt gốc + thứ cứu nó nhiều nhất. */
      slowest(base1.sec, 3).forEach(([k, r]) => {
        const best = rows.map(([n, , , sec]) => [n, fps(sec.get(k))]).sort((x, y) => y[1] - x[1])[0];
        if (best) s += '! Chậm nhất: ' + k + ' ' + Math.round(fps(r)) + '/s → tắt ' + best[0] + ' thì ' + Math.round(best[1]) + '/s\n';
      });
      say(s);
    }
  });
  apply();
  say(head() + '\n"Tự cuộn 20 s": bấm rồi cuộn như mọi khi qua chỗ thấy khựng. "Tìm thủ phạm": mở trang mới, đừng cuộn, bấm rồi để yên ~2 phút. Xong thì chụp màn hình bảng (hoặc "Chép kết quả").');
})();
