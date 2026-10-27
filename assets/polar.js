/* Polar Run — bản canvas của game minh hoạ của dự án (tools/demo_game, PlayActivity.java), port từng dòng: cùng màn chơi,
   cùng nhịp chạy, mọi vị trí là hàm của thời gian t (giây), nên trang vẽ đúng cảnh mà Cryo đo trên máy thật (ảnh chụp trang
   Play cũng từ game này). Ảnh: Kenney "New Platformer Pack" 1.1, CC0 — gom một tấm assets/polar-atlas.webp, mỗi ô chừa lề
   có mép kéo dài (lọc ảnh không rỉ màu ô bên cạnh); nền mây/đồi đã nhân sẵn màu trời (LightingColorFilter 0xA9CCFF).
   Tệp này chỉ vẽ MỘT khung khi được gọi; chạy/dừng theo màn đang hiện là việc của site.js. */
(() => {
  'use strict';
  const A = {"background_clouds":[2,2,512,512],"background_fade_hills":[2,518,512,512],"character_yellow_jump":[518,2,256,256],"character_yellow_walk_a":[518,262,256,256],"character_yellow_walk_b":[518,522,256,256],"bee_a":[2,1034,128,128],"bee_b":[134,1034,128,128],"block_coin":[266,1034,128,128],"block_exclamation":[398,1034,128,128],"coin_gold":[530,1034,128,128],"coin_gold_side":[662,1034,128,128],"flag_blue_a":[794,1034,128,128],"flag_blue_b":[926,1034,128,128],"fly_a":[2,1166,128,128],"fly_b":[134,1166,128,128],"hud_character_0":[266,1166,128,128],"hud_character_1":[398,1166,128,128],"hud_character_2":[530,1166,128,128],"hud_character_3":[662,1166,128,128],"hud_character_4":[794,1166,128,128],"hud_character_5":[926,1166,128,128],"hud_character_6":[2,1298,128,128],"hud_character_7":[134,1298,128,128],"hud_character_8":[266,1298,128,128],"hud_character_9":[398,1298,128,128],"hud_character_multiply":[530,1298,128,128],"hud_coin":[662,1298,128,128],"hud_heart":[794,1298,128,128],"hud_heart_half":[926,1298,128,128],"hud_player_helmet_yellow":[2,1430,128,128],"rock":[134,1430,128,128],"sign_right":[266,1430,128,128],"slime_spike_walk_a":[398,1430,128,128],"slime_spike_walk_b":[530,1430,128,128],"snow":[662,1430,128,128],"star":[794,1430,128,128],"terrain_snow_block_center":[926,1430,128,128],"terrain_snow_block_left":[2,1562,128,128],"terrain_snow_block_right":[134,1562,128,128],"terrain_snow_block_top":[266,1562,128,128],"terrain_snow_block_top_left":[398,1562,128,128],"terrain_snow_block_top_right":[530,1562,128,128],"terrain_snow_cloud_left":[662,1562,128,128],"terrain_snow_cloud_middle":[794,1562,128,128],"terrain_snow_cloud_right":[926,1562,128,128]};
  const img = new Image();
  img.decoding = 'async';
  img.src = 'assets/polar-atlas.webp';

  // ---- Màn chơi lặp, đơn vị ô. Độ cao tính từ mặt đất. (Giống hệt GameView.) ----
  const PERIOD = 56, SPEED = 4.2, JUMP_LEN = 3.4, JUMP_H = 2.3, COIN_BODY = 0.75;
  const GAPS = [[14, 16], [33, 35]], CLOUDS = [[4, 3, 2.7], [20, 4, 2.4], [39, 3, 2.9]], SLIMES = [9.5, 27, 44];
  const FLYERS = [[23, 3.6], [36.5, 3.2]], BLOCKS = [[17, 3.4], [18, 3.4], [19, 3.4]];
  const SNOW_PILES = [2.5, 11.5, 24, 30.5], ROCKS = [7, 37.5], SIGN = 0.6, FLAG = 55;
  /* Người chạy nhảy sao cho mỗi hố hay con slime nằm giữa cú nhảy. */
  const takeoffs = GAPS.map((g) => (g[0] + g[1]) / 2 - JUMP_LEN / 2).concat(SLIMES.map((s) => s - JUMP_LEN / 2)).sort((a, b) => a - b);
  const mod = (a, m) => { const r = a % m; return r < 0 ? r + m : r; };
  const fract = (v) => v - Math.floor(v);
  function jumpHeight(x) {
    for (const to of takeoffs) { const u = (x - to) / JUMP_LEN; if (u >= 0 && u < 1) return 4 * JUMP_H * u * (1 - u); }
    return 0;
  }
  const inGap = (x) => { const m = mod(x, PERIOD); return GAPS.some((g) => m >= g[0] && m < g[1]); };
  /* Xu: hàng trên mặt đất, một vòng cung theo mỗi cú nhảy, hàng trên mây (ngoài tầm với, đứng nguyên). */
  const coins = [];
  let coinsPerLoop = 0;
  (() => {
    const list = [];
    for (const x of [1.6, 2.4, 3.2, 18, 19, 21.5, 22.5, 29, 30, 38, 39, 40]) list.push([x, COIN_BODY]);
    for (const to of takeoffs) for (const u of [0.12, 0.31, 0.5, 0.69, 0.88]) list.push([to + u * JUMP_LEN, 4 * JUMP_H * u * (1 - u) + COIN_BODY]);
    for (const c of CLOUDS) for (let x = c[0] + 0.5; x < c[0] + c[1]; x += 1) list.push([x, c[2] + 0.9]);
    for (const c of list) {
      const hit = Math.abs(c[1] - (jumpHeight(c[0]) + COIN_BODY)) < 0.5;
      coins.push([c[0], c[1], hit]);
      if (hit) coinsPerLoop++;
    }
  })();

  let c = null;
  function spr(n, x, y, w, h) { const a = A[n]; c.drawImage(img, a[0], a[1], a[2], a[3], x, y, w, h === undefined ? w : h); }
  function rrect(x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  }

  /* Vẽ một khung vào ctx (w × h điểm ảnh của canvas) tại thời điểm t giây. o.px = chỗ người chạy đứng theo bề ngang
     (0,27 như bản Android), o.snow = tuyết rơi. */
  function draw(ctx, w, h, t, o) {
    if (!img.complete || !img.naturalWidth) return false;
    o = o || {};
    c = ctx;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'medium';
    const playerX = o.px == null ? 0.27 : o.px;
    const tile = Math.round(h / 7.6), groundY = Math.round(h - 1.3 * tile);
    const playerScreen = w * playerX, scroll = t * SPEED, runner = scroll + playerScreen / tile, left = scroll;

    background(w, h, tile, groundY, scroll, t);
    const firstLoop = Math.floor(left / PERIOD), rightEdge = left + w / tile + 2;
    // Mây (bậc đứng), khối và đồ vật, rồi mặt đất.
    for (let loop = firstLoop; loop * PERIOD < rightEdge; loop++) {
      const base = loop * PERIOD;
      for (const cl of CLOUDS) {
        const n = cl[1] | 0;
        for (let i = 0; i < n; i++) {
          spr(i === 0 ? 'terrain_snow_cloud_left' : i === n - 1 ? 'terrain_snow_cloud_right' : 'terrain_snow_cloud_middle',
            Math.round((base + cl[0] + i - left) * tile), groundY - cl[2] * tile, tile);
        }
      }
      BLOCKS.forEach((b, i) => spr(i === 1 ? 'block_exclamation' : 'block_coin', Math.round((base + b[0] - left) * tile), groundY - b[1] * tile, tile));
      spr('sign_right', (base + SIGN - left) * tile, groundY - tile, tile);
      spr(((t * 4) | 0) & 1 ? 'flag_blue_b' : 'flag_blue_a', (base + FLAG - left) * tile, groundY - tile, tile);
      for (const x of SNOW_PILES) spr('snow', (base + x - left) * tile, groundY - tile * 0.98, tile);
      for (const x of ROCKS) spr('rock', (base + x - left) * tile, groundY - tile * 0.98, tile);
    }
    ground(w, h, tile, groundY, left);

    // Xu: người chạy chạm tới thì biến mất, một ngôi sao bật lên một thoáng.
    for (let loop = firstLoop; loop * PERIOD < rightEdge; loop++) {
      const base = loop * PERIOD;
      for (const cn of coins) {
        const gx = base + cn[0], sx = (gx - left) * tile, sy = groundY - cn[1] * tile;
        if (sx < -tile || sx > w + tile) continue;
        const since = runner - gx;
        if (cn[2] && since >= 0) {
          if (since < 1.1) {
            const a = since / 1.1, s = tile * (0.7 + 0.8 * a);
            c.globalAlpha = 1 - a;
            spr('star', sx - s / 2, sy - s / 2 - a * tile * 0.8, s);
            c.globalAlpha = 1;
          }
          continue;
        }
        // Xoay: vài lần mỗi giây xu hẹp lại thành cạnh.
        const spin = Math.abs(Math.cos(t * 5.5 + gx * 0.7));
        const cw = spin < 0.25 ? 0 : tile * 0.8 * spin;
        if (cw === 0) spr('coin_gold_side', sx - tile * 0.4, sy - tile * 0.4, tile * 0.8);
        else spr('coin_gold', sx - cw / 2, sy - tile * 0.4, cw, tile * 0.8);
      }
    }

    // Quái.
    for (let loop = firstLoop; loop * PERIOD < rightEdge; loop++) {
      const base = loop * PERIOD;
      SLIMES.forEach((s0, i) => {
        const phase = t * 1.4 + i * 2.1, x = base + s0 + 0.55 * Math.sin(phase), right = Math.cos(phase) > 0, sx = (x - left) * tile;
        if (sx < -tile * 2 || sx > w + tile) return;
        c.save();
        if (right) { c.translate(sx, 0); c.scale(-1, 1); c.translate(-sx, 0); }
        spr(((t * 6 + i) | 0) & 1 ? 'slime_spike_walk_b' : 'slime_spike_walk_a', sx - tile * 0.5, groundY - tile, tile);
        c.restore();
      });
      FLYERS.forEach((f, i) => {
        const x = base + f[0] + 0.3 * Math.sin(t * 0.9 + i), y = f[1] + 0.28 * Math.sin(t * 2.6 + i * 1.7);
        const fr = ((t * 14 + i) | 0) & 1;
        spr(i === 0 ? (fr ? 'bee_b' : 'bee_a') : (fr ? 'fly_b' : 'fly_a'), (x - left) * tile - tile * 0.5, groundY - y * tile - tile * 0.5, tile);
      });
    }

    // Người chạy + bóng trên tuyết.
    const lift = jumpHeight(mod(runner, PERIOD));
    if (!inGap(runner)) {
      const k = 1 / (1 + lift * 0.6);
      c.fillStyle = 'rgba(40,60,110,' + ((60 * k) | 0) / 255 + ')';
      c.beginPath(); c.ellipse(playerScreen, groundY, tile * 0.42 * k, tile * 0.07, 0, 0, Math.PI * 2); c.fill();
    }
    const body = lift > 0 ? 'character_yellow_jump' : (((runner / 0.45) | 0) & 1 ? 'character_yellow_walk_b' : 'character_yellow_walk_a');
    spr(body, playerScreen - tile, groundY - lift * tile - 2 * tile + tile * 0.02, 2 * tile);

    if (o.snow !== false) snow(w, h, tile, scroll, t);
    hud(w, h, runner);
    return true;
  }

  function background(w, h, tile, groundY, scroll, t) {
    c.fillStyle = 'rgb(129,181,255)';
    c.fillRect(0, 0, w, h);
    const b = Math.round(h * 0.66), hillsTop = groundY + tile * 0.55 - b, cloudsTop = hillsTop - b;
    /* Mây trôi 6 điểm ảnh/giây trên màn 1260 điểm ảnh của máy đo (Vivo) — ở đây quy theo chiều cao canvas. */
    let off = mod(scroll * tile * 0.12 + t * 6 * (h / 1260), b);
    for (let x = -off; x < w; x += b) spr('background_clouds', Math.round(x), Math.round(cloudsTop), b + 1);
    off = mod(scroll * tile * 0.3, b);
    for (let x = -off; x < w; x += b) spr('background_fade_hills', Math.round(x), Math.round(hillsTop), b + 1);
  }

  function ground(w, h, tile, groundY, left) {
    const first = Math.floor(left), frac = left - first, cols = ((w / tile) | 0) + 2;
    for (let i = 0; i <= cols; i++) {
      const col = first + i;
      if (inGap(col)) continue;
      const gapL = inGap(col - 1), gapR = inGap(col + 1), x = Math.round((i - frac) * tile);
      spr(gapL ? 'terrain_snow_block_top_left' : gapR ? 'terrain_snow_block_top_right' : 'terrain_snow_block_top', x, groundY, tile + 1);
      for (let y = groundY + tile; y < h; y += tile) {
        spr(gapL ? 'terrain_snow_block_left' : gapR ? 'terrain_snow_block_right' : 'terrain_snow_block_center', x, y, tile + 1);
      }
    }
  }

  function snow(w, h, tile, scroll, t) {
    const unit = h / 1440;
    for (let i = 0; i < 70; i++) {
      const a = fract(i * 0.6180339), b = fract(i * 0.7548776), depth = fract(i * 0.5698403);
      const x = mod(a * w - scroll * tile * (0.15 + 0.35 * depth) + 30 * unit * Math.sin(t * 0.9 + i), w);
      const y = mod(b * h + t * (60 + 90 * depth) * unit, h);
      c.fillStyle = 'rgba(255,255,255,' + (((150 + 90 * depth) | 0) / 255).toFixed(3) + ')';
      c.beginPath(); c.arc(x, y, (3 + 6 * depth) * unit, 0, Math.PI * 2); c.fill();
    }
  }

  function hud(w, h, runner) {
    const u = h / 100, l = 4 * u, r = w - 4 * u, top = 3.5 * u;
    // Xu đã nhặt.
    const loops = Math.floor(runner / PERIOD), inLoop = runner - loops * PERIOD;
    let got = 20 + loops * coinsPerLoop;
    for (const cn of coins) if (cn[2] && cn[0] <= inLoop) got++;
    const n = String(got);
    // Mạng và xu nằm trên viên thuốc mờ để chữ trắng đọc được trên tuyết và mây.
    c.fillStyle = 'rgba(20,40,90,' + (80 / 255).toFixed(3) + ')';
    rrect(l - 1.2 * u, top - 1 * u, 34.2 * u, 12 * u, 6 * u); c.fill();
    rrect(l - 1.2 * u, top + 12 * u, Math.max(l + 33 * u, l + 15 * u + n.length * 5.4 * u + 2 * u) - (l - 1.2 * u), 9 * u, 4.5 * u); c.fill();
    spr('hud_player_helmet_yellow', l, top, 10 * u);
    for (let i = 0; i < 3; i++) spr(i === 2 ? 'hud_heart_half' : 'hud_heart', l + 10.5 * u + i * 7.2 * u, top + 1.5 * u, 7.5 * u);
    const y2 = top + 11 * u;
    spr('hud_coin', l + 0.5 * u, y2, 8 * u);
    spr('hud_character_multiply', l + 8 * u, y2 + 1 * u, 6 * u);
    for (let i = 0; i < n.length; i++) spr('hud_character_' + n[i], l + 13 * u + i * 5.4 * u, y2 + 0.5 * u, 7 * u);

    // Tiến độ màn.
    const bw = w * 0.3, bx = (w - bw) / 2, by = top + 4 * u, bh = 2.2 * u, p = inLoop / PERIOD;
    c.fillStyle = 'rgba(255,255,255,' + (150 / 255).toFixed(3) + ')';
    rrect(bx, by, bw, bh, bh / 2); c.fill();
    c.fillStyle = 'rgb(255,196,46)';
    rrect(bx, by, bw * p, bh, bh / 2); c.fill();
    c.strokeStyle = 'rgb(47,50,76)'; c.lineWidth = 0.55 * u; c.lineJoin = 'round'; c.lineCap = 'round';
    rrect(bx, by, bw, bh, bh / 2); c.stroke();
    spr('hud_player_helmet_yellow', bx + bw * p - 3.2 * u, by + bh / 2 - 3.2 * u, 6.4 * u);
    spr('flag_blue_a', bx + bw - 1 * u, by - 4.6 * u, 6.4 * u);

    // Tạm dừng.
    const ps = 9 * u;
    c.fillStyle = 'rgba(255,255,255,' + (235 / 255).toFixed(3) + ')';
    rrect(r - ps, top, ps, ps, 2.4 * u); c.fill(); c.stroke();
    c.fillStyle = 'rgb(47,50,76)';
    const cx = r - ps / 2, cy = top + ps / 2;
    rrect(cx - 2.2 * u, cy - 2.6 * u, 1.4 * u, 5.2 * u, 0.5 * u); c.fill();
    rrect(cx + 0.8 * u, cy - 2.6 * u, 1.4 * u, 5.2 * u, 0.5 * u); c.fill();

    // Nút chạm: di chuyển dưới-trái, nhảy dưới-phải.
    const pr = 7.5 * u, py = h - 5 * u - pr;
    button(l + pr, py, pr, u); arrow(l + pr, py, u, -1);
    button(l + pr * 3.4, py, pr, u); arrow(l + pr * 3.4, py, u, 1);
    const jr = 10 * u;
    button(r - jr, h - 4.5 * u - jr, jr, u);
    chevron(r - jr, h - 4.5 * u - jr, u);
  }
  function button(x, y, r, u) {
    c.fillStyle = 'rgba(30,40,80,' + (70 / 255).toFixed(3) + ')';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,' + (210 / 255).toFixed(3) + ')'; c.lineWidth = 0.6 * u;
    c.stroke();
  }
  function arrow(x, y, u, dir) {
    c.beginPath();
    c.moveTo(x + dir * 2.6 * u, y); c.lineTo(x - dir * 1.8 * u, y - 3 * u); c.lineTo(x - dir * 1.8 * u, y + 3 * u); c.closePath();
    c.fillStyle = 'rgba(255,255,255,' + (230 / 255).toFixed(3) + ')'; c.fill();
  }
  function chevron(x, y, u) {
    c.beginPath();
    c.moveTo(x - 3.6 * u, y + 1.6 * u); c.lineTo(x, y - 2.4 * u); c.lineTo(x + 3.6 * u, y + 1.6 * u);
    c.strokeStyle = 'rgba(255,255,255,' + (235 / 255).toFixed(3) + ')'; c.lineWidth = 1.4 * u; c.stroke();
  }

  window.PolarRun = {
    draw,
    ready: () => img.complete && img.naturalWidth > 0,
    onReady(fn) { if (img.complete && img.naturalWidth) fn(); else img.addEventListener('load', fn, { once: true }); },
  };
})();
