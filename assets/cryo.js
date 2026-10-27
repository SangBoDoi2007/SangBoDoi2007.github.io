/* ==========================================================================
   CRYO: GAME MODE & FPS METER — INTERACTIVE HARDWARE SANDBOX & I18N ENGINE
   ASTVN Studios · com.astvn.cryo · v1.0.67 (vc72)
   ========================================================================== */

(function () {
  'use strict';

  // --- Global Sandbox State ---
  const state = {
    lang: localStorage.getItem('cryo_lang') || 'en',
    shizukuConnected: true,
    renderScale: 70,          // 30 to 100, step 5
    downscaleMode: 'buffer',  // 'buffer' (Android 13+ cmd game) | 'wm' (Fullscreen wm size)
    resLock: false,           // Keep wm size outside games
    freezeLevel: 'L2',        // 'L1' | 'L2' | 'L3' | 'L4'
    afkActive: false,         // 0% LUX black overlay
    lock60Hz: false,          // 60Hz refresh rate cap
    dndActive: true,          // Do Not Disturb
    lowLatencyWifi: true,     // Android 10+ Low-latency Wi-Fi
    hudCollapsed: false,      // Floating monitor pill vs full panel
    drawerOpen: false,        // Progressive disclosure deep-dive drawer
    focusLabActive: false,    // Focus Mode interactive section state
    sessionIndex: 0,          // Active session report preset
    sessionMode: 'detailed',  // 'basic' | 'detailed'
    fpsHistory: [118, 120, 119, 120, 120, 118, 120, 119, 120, 120, 119, 120, 120, 118, 120, 120, 119, 120, 120, 120]
  };

  // --- Freeze Level Metadata (Accurate to Cryo vc72) ---
  const FREEZE_DATA = {
    L1: {
      ramSavedGB: 0.9,
      appsCount: 12,
      cmd: 'cmd appops set <pkg> RUN_ANY_IN_BACKGROUND ignore',
      en: {
        badge: 'L1 · Light (Block Background)',
        desc: 'Blocks background activity & mobile data in background. App still opens normally.',
        hudTag: 'Focus · 12 apps L1'
      },
      vi: {
        badge: 'L1 · Nhẹ (Chặn chạy ngầm)',
        desc: 'Chặn chạy ngầm và dùng dữ liệu nền. Ứng dụng vẫn mở và hoạt động bình thường.',
        hudTag: 'Focus · 12 app mức L1'
      }
    },
    L2: {
      ramSavedGB: 1.6,
      appsCount: 16,
      cmd: 'am force-stop <pkg> && cmd appops set <pkg> RUN_IN_BACKGROUND ignore',
      en: {
        badge: 'L2 · Medium (Close & Hold)',
        desc: 'Closes the app + blocks background wakeup. If it restarts itself, Cryo closes it again.',
        hudTag: 'Focus · 16 apps L2 · 4 apps L1'
      },
      vi: {
        badge: 'L2 · Vừa (Đóng & Giữ im)',
        desc: 'Đóng ứng dụng + chặn chạy ngầm. Nếu tự khởi động lại, Cryo sẽ đóng tiếp.',
        hudTag: 'Focus · 16 app L2 · 4 app L1'
      }
    },
    L3: {
      ramSavedGB: 2.1,
      appsCount: 19,
      cmd: 'pm suspend --user 0 <pkg>',
      en: {
        badge: 'L3 · Strong (Pause App)',
        desc: 'Pauses the app: icon turns grey and cannot open until unfrozen. App data is kept.',
        hudTag: 'Focus · 19 apps L3 (Paused)'
      },
      vi: {
        badge: 'L3 · Mạnh (Tạm dừng app)',
        desc: 'Tạm dừng ứng dụng: biểu tượng xám đi và không mở được cho tới khi rã đông. Giữ nguyên dữ liệu.',
        hudTag: 'Focus · 19 app L3 (Tạm dừng)'
      }
    },
    L4: {
      ramSavedGB: 2.5,
      appsCount: 22,
      cmd: 'pm disable-user --user 0 <pkg>',
      en: {
        badge: 'L4 · Extreme (Disable & Hide)',
        desc: 'Turns the app off completely: icon disappears from launcher until unfrozen. Data is kept.',
        hudTag: 'Focus · 22 apps L4 (Disabled)'
      },
      vi: {
        badge: 'L4 · Tối đa (Tắt & Ẩn biểu tượng)',
        desc: 'Tắt hẳn ứng dụng: ẩn khỏi màn hình chính cho tới khi rã đông. Dữ liệu được giữ nguyên.',
        hudTag: 'Focus · 22 app L4 (Đã tắt)'
      }
    }
  };

  // --- Focus Mode Interactive Lab Apps ---
  const FOCUS_APPS = [
    { id: 'msg', nameEn: 'Messages & Chat', nameVi: 'Tin nhắn & Chat', pkg: 'com.android.messaging', ram: 185, pinned: true, essential: true, icon: 'message-square' },
    { id: 'alarm', nameEn: 'Alarm & Clock', nameVi: 'Báo thức & Đồng hồ', pkg: 'com.android.deskclock', ram: 64, pinned: true, essential: true, icon: 'alarm-clock' },
    { id: 'bank', nameEn: 'Banking OTP', nameVi: 'Ngân hàng & OTP', pkg: 'vn.banking.secure', ram: 210, pinned: true, essential: true, icon: 'landmark' },
    { id: 'shortvid', nameEn: 'Short Video Feed', nameVi: 'Mạng xã hội Video', pkg: 'com.social.shortvideo', ram: 640, pinned: false, essential: false, icon: 'clapperboard' },
    { id: 'social', nameEn: 'Social Network', nameVi: 'Mạng xã hội Ảnh', pkg: 'com.social.timeline', ram: 520, pinned: false, essential: false, icon: 'share-2' },
    { id: 'shop', nameEn: 'E-Commerce Mall', nameVi: 'Ứng dụng Mua sắm', pkg: 'com.retail.shopping', ram: 410, pinned: false, essential: false, icon: 'shopping-bag' },
    { id: 'cloud', nameEn: 'Cloud Photo Sync', nameVi: 'Đồng bộ Đám mây', pkg: 'com.cloud.autosync', ram: 290, pinned: false, essential: false, icon: 'cloud' },
    { id: 'adsvc', nameEn: 'OEM Telemetry Daemon', nameVi: 'Dịch vụ ngầm không icon', pkg: 'com.oem.analytics.daemon', ram: 175, pinned: false, essential: false, icon: 'cpu', sysNoIcon: true }
  ];

  // --- Session Reports Data ---
  const SESSION_REPORTS = [
    {
      game: 'Polar Run',
      pkg: 'com.astvn.polarrun',
      timeEn: '28 min 14 s',
      timeVi: '28 phút 14 giây',
      scale: '70% (Game Buffer)',
      peakTemp: '36.4 °C',
      tempSubEn: 'Low 33.8 °C · avg 35.6 °C',
      tempSubVi: 'Thấp 33.8 °C · TB 35.6 °C',
      batteryUsed: '6%',
      powerDraw: '2.85 W',
      avgFps: 119,
      low5Fps: 112,
      sparkFps: [118, 120, 119, 120, 117, 120, 120, 118, 119, 120, 116, 120, 119, 120],
      sparkTemp: [33.8, 34.1, 34.5, 34.9, 35.2, 35.5, 35.7, 36.0, 36.1, 36.3, 36.4, 36.2, 36.0, 35.9]
    },
    {
      game: 'Tactical Arena 5v5',
      pkg: 'com.arena.moba5v5',
      timeEn: '42 min 05 s',
      timeVi: '42 phút 05 giây',
      scale: '75% (Game Buffer) · 60Hz Lock',
      peakTemp: '37.8 °C',
      tempSubEn: 'Low 34.2 °C · avg 36.9 °C',
      tempSubVi: 'Thấp 34.2 °C · TB 36.9 °C',
      batteryUsed: '9%',
      powerDraw: '3.10 W',
      avgFps: 60,
      low5Fps: 58,
      sparkFps: [60, 60, 59, 60, 60, 58, 60, 60, 60, 59, 60, 60, 60, 60],
      sparkTemp: [34.2, 34.8, 35.4, 36.0, 36.5, 37.0, 37.3, 37.5, 37.8, 37.6, 37.4, 37.2, 37.1, 37.0]
    },
    {
      game: 'Open-World Anime RPG',
      pkg: 'com.rpg.openworld3d',
      timeEn: '35 min 48 s',
      timeVi: '35 phút 48 giây',
      scale: '60% (Fullscreen wm size + Lock)',
      peakTemp: '38.9 °C',
      tempSubEn: 'Low 34.5 °C · avg 37.8 °C',
      tempSubVi: 'Thấp 34.5 °C · TB 37.8 °C',
      batteryUsed: '11%',
      powerDraw: '3.65 W',
      avgFps: 59,
      low5Fps: 52,
      sparkFps: [58, 60, 57, 59, 55, 60, 59, 54, 60, 58, 59, 56, 60, 59],
      sparkTemp: [34.5, 35.2, 36.0, 36.8, 37.4, 37.9, 38.3, 38.6, 38.9, 38.7, 38.5, 38.4, 38.2, 38.1]
    }
  ];

  // --- Compute Hardware Metrics from Sandbox Controls ---
  function computeMetrics() {
    const ratio = state.renderScale / 100;
    const areaPct = Math.round(ratio * ratio * 100);
    const pixelsSavedPct = 100 - areaPct;
    const baseW = 1260;
    const baseH = 2800;
    const targetW = Math.round((baseW * ratio) / 2) * 2;
    const targetH = Math.round((baseH * ratio) / 2) * 2;
    const targetDpi = Math.round(480 * ratio);

    // Realistic GPU load & temperature scaling based on pixel area
    // At 100% scale: GPU load ~86%, temp ~42.2°C, raw FPS ~48
    // At 70% scale (49% area): GPU load ~46%, temp ~35.8°C, raw FPS ~120
    // At 30% scale (9% area): GPU load ~22%, temp ~33.1°C, raw FPS ~120
    const freezeBonus = FREEZE_DATA[state.freezeLevel];
    const gpuLoad = Math.max(18, Math.min(96, Math.round(16 + areaPct * 0.68)));
    const cpuLoad = Math.max(12, Math.min(85, Math.round(34 - freezeBonus.ramSavedGB * 6 + (ratio - 0.5) * 14)));
    const cpuGhz = (2.15 + (cpuLoad / 100) * 1.05).toFixed(2);
    const gpuMhz = Math.round(240 + (gpuLoad / 100) * 580);

    let rawFps = Math.round(120 - Math.max(0, (areaPct - 55) * 1.45));
    if (state.freezeLevel === 'L1') rawFps -= 3;
    if (state.lock60Hz) rawFps = Math.min(60, rawFps);
    rawFps = Math.max(30, Math.min(120, rawFps));

    let batTemp = (33.0 + (areaPct / 100) * 8.8 - (state.lock60Hz ? 1.1 : 0) - (state.afkActive ? 1.6 : 0)).toFixed(1);
    const cpuTemp = Math.round(parseFloat(batTemp) + 4.2);
    const gpuTemp = Math.round(parseFloat(batTemp) + 3.5);
    const freeRam = (4.2 + freezeBonus.ramSavedGB).toFixed(1);

    return {
      ratio,
      areaPct,
      pixelsSavedPct,
      targetW,
      targetH,
      targetDpi,
      gpuLoad,
      cpuLoad,
      cpuGhz,
      gpuMhz,
      fps: rawFps,
      batTemp,
      cpuTemp,
      gpuTemp,
      freeRam
    };
  }

  // --- Update Sandbox DOM ---
  function renderSandbox() {
    const m = computeMetrics();
    const isVi = state.lang === 'vi';
    const freeze = FREEZE_DATA[state.freezeLevel];

    // 1. Slider & Resolution Labels
    const slider = document.getElementById('sandbox-res-slider');
    if (slider && parseInt(slider.value, 10) !== state.renderScale) {
      slider.value = state.renderScale;
    }

    const scaleReadout = document.getElementById('sandbox-scale-value');
    if (scaleReadout) scaleReadout.textContent = state.renderScale + '%';

    const pxReadout = document.getElementById('sandbox-px-readout');
    if (pxReadout) {
      pxReadout.textContent = `${m.targetW} × ${m.targetH} px (${m.areaPct}% ${isVi ? 'diện tích điểm ảnh' : 'pixel area'})`;
    }

    const areaBadge = document.getElementById('sandbox-area-saved');
    if (areaBadge) {
      areaBadge.textContent = m.pixelsSavedPct > 0
        ? `-${m.pixelsSavedPct}% ${isVi ? 'điểm ảnh/khung hình' : 'pixels/frame'}`
        : (isVi ? 'Độ phân giải gốc (100%)' : 'Native resolution (100%)');
    }

    // Preset buttons highlight
    document.querySelectorAll('[data-scale-preset]').forEach(btn => {
      const val = parseInt(btn.getAttribute('data-scale-preset'), 10);
      btn.classList.toggle('active', val === state.renderScale);
    });

    // Downscale mode buttons
    const btnBuffer = document.getElementById('mode-btn-buffer');
    const btnWm = document.getElementById('mode-btn-wm');
    const resLockRow = document.getElementById('sandbox-reslock-row');
    if (btnBuffer && btnWm) {
      btnBuffer.classList.toggle('active', state.downscaleMode === 'buffer');
      btnWm.classList.toggle('active', state.downscaleMode === 'wm');
      if (resLockRow) {
        resLockRow.classList.toggle('opacity-40', state.downscaleMode === 'buffer');
        resLockRow.classList.toggle('pointer-events-none', state.downscaleMode === 'buffer');
      }
    }

    // 2. Freeze Level Buttons & Info
    ['L1', 'L2', 'L3', 'L4'].forEach(lvl => {
      const btn = document.getElementById('freeze-btn-' + lvl);
      if (!btn) return;
      btn.classList.remove('active-L1', 'active-L2', 'active-L3', 'active-L4');
      if (state.freezeLevel === lvl) {
        btn.classList.add('active-' + lvl);
      }
    });

    const freezeTitle = document.getElementById('sandbox-freeze-title');
    const freezeDesc = document.getElementById('sandbox-freeze-desc');
    const freezeRam = document.getElementById('sandbox-freeze-ram');
    if (freezeTitle) freezeTitle.textContent = freeze[isVi ? 'vi' : 'en'].badge;
    if (freezeDesc) freezeDesc.textContent = freeze[isVi ? 'vi' : 'en'].desc;
    if (freezeRam) freezeRam.textContent = `+${freeze.ramSavedGB.toFixed(1)} GB RAM`;

    // 3. Switches ARIA states
    const setSwitch = (id, active) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('aria-checked', active ? 'true' : 'false');
    };
    setSwitch('sw-afk', state.afkActive);
    setSwitch('sw-60hz', state.lock60Hz);
    setSwitch('sw-dnd', state.dndActive);
    setSwitch('sw-wifi', state.lowLatencyWifi);
    setSwitch('sw-reslock', state.resLock);
    setSwitch('sw-shizuku', state.shizukuConnected);

    // 4. Live ADB Command Terminal Bar
    const cmdLine = document.getElementById('sandbox-adb-cmd');
    if (cmdLine) {
      if (!state.shizukuConnected) {
        cmdLine.textContent = isVi
          ? '# Shizuku đang tắt: Chỉ đọc RAM trống & nhiệt độ pin (không thể chạy lệnh hệ thống)'
          : '# Shizuku disconnected: Read-only fallback (Free RAM & Battery Temp only)';
        cmdLine.className = 'font-mono-tech text-xs text-amber-400 truncate';
      } else {
        const scaleRatio = (state.renderScale / 100).toFixed(2).replace(/0$/, '');
        const resCmd = state.downscaleMode === 'buffer'
          ? (state.renderScale === 100 ? 'cmd game reset com.astvn.polarrun' : `cmd game set --downscale ${scaleRatio} com.astvn.polarrun`)
          : (state.renderScale === 100 ? 'wm size reset && wm density reset' : `wm size ${m.targetW}x${m.targetH} && wm density ${m.targetDpi}`);
        cmdLine.textContent = `$ adb shell "${resCmd} && ${freeze.cmd}"`;
        cmdLine.className = 'font-mono-tech text-xs text-[#00E5FF] truncate';
      }
    }

    // 5. Floating Monitor HUD Update
    const hudFpsNum = document.getElementById('hud-fps-num');
    const hudFpsUnit = document.getElementById('hud-fps-unit');
    const hudDot = document.getElementById('hud-status-dot');
    const hudFocusTag = document.getElementById('hud-focus-tag');
    const hudModeLabel = document.getElementById('hud-mode-label');
    const hudCpuRow = document.getElementById('hud-row-cpu');
    const hudGpuRow = document.getElementById('hud-row-gpu');
    const hudSparkBox = document.getElementById('hud-spark-container');
    const hudCpuVal = document.getElementById('hud-cpu-val');
    const hudGpuVal = document.getElementById('hud-gpu-val');
    const hudRamVal = document.getElementById('hud-ram-val');
    const hudBatVal = document.getElementById('hud-bat-val');
    const hudAvgLow = document.getElementById('hud-avg-low');

    if (hudFpsNum && hudFpsUnit) {
      if (!state.shizukuConnected) {
        hudFpsNum.textContent = isVi ? 'FPS cần Shizuku' : 'FPS needs Shizuku';
        hudFpsNum.className = 'text-xs font-mono-tech font-semibold text-amber-400';
        hudFpsUnit.textContent = `· ${m.freeRam} GB`;
        if (hudDot) hudDot.className = 'w-2 h-2 rounded-full bg-amber-400';
      } else {
        hudFpsNum.textContent = m.fps;
        hudFpsNum.className = 'text-lg font-mono-tech font-bold text-white tabular-nums';
        hudFpsUnit.textContent = 'FPS';
        if (hudDot) hudDot.className = 'w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]';
      }
    }

    if (hudFocusTag) {
      hudFocusTag.textContent = '❄ ' + freeze[isVi ? 'vi' : 'en'].hudTag;
    }

    if (hudModeLabel) {
      if (!state.shizukuConnected) {
        hudModeLabel.textContent = isVi ? 'Chế độ cơ bản (Chưa kết nối Shizuku)' : 'Basic Readout (Shizuku Disconnected)';
        hudModeLabel.className = 'text-[11px] font-mono-tech text-amber-300';
      } else if (state.renderScale === 100) {
        hudModeLabel.textContent = isVi ? 'Gốc (Native 100%)' : 'Native (100%)';
        hudModeLabel.className = 'text-[11px] font-mono-tech text-slate-300';
      } else if (state.downscaleMode === 'buffer') {
        hudModeLabel.textContent = isVi
          ? `Bộ đệm game: ${state.renderScale}%`
          : `Game buffer: ${state.renderScale}%`;
        hudModeLabel.className = 'text-[11px] font-mono-tech text-emerald-400 font-semibold';
      } else {
        hudModeLabel.textContent = isVi
          ? `Toàn màn hình (wm size): ${state.renderScale}%${state.resLock ? ' · Đã khoá' : ''}`
          : `Fullscreen (wm size): ${state.renderScale}%${state.resLock ? ' · Locked' : ''}`;
        hudModeLabel.className = 'text-[11px] font-mono-tech text-sky-400 font-semibold';
      }
    }

    // Honest Telemetry Rule: Without Shizuku, hide CPU/GPU load & FPS graph rather than guessing
    if (hudCpuRow && hudGpuRow && hudSparkBox) {
      if (!state.shizukuConnected) {
        hudCpuRow.classList.add('hidden');
        hudGpuRow.classList.add('hidden');
        hudSparkBox.classList.add('hidden');
      } else {
        hudCpuRow.classList.remove('hidden');
        hudGpuRow.classList.remove('hidden');
        hudSparkBox.classList.remove('hidden');
      }
    }

    if (hudCpuVal) hudCpuVal.textContent = `${m.cpuLoad}%  ${m.cpuGhz} GHz  ${m.cpuTemp}°`;
    if (hudGpuVal) hudGpuVal.textContent = `${m.gpuLoad}%  ${m.gpuMhz} MHz  ${m.gpuTemp}°`;
    if (hudRamVal) hudRamVal.textContent = `${Math.round((11 - parseFloat(m.freeRam)) / 11 * 100)}%  ${m.freeRam} GB`;
    if (hudBatVal) {
      const tempNum = parseFloat(m.batTemp);
      hudBatVal.textContent = `${m.batTemp}°C`;
      hudBatVal.className = tempNum >= 39.5
        ? 'font-mono-tech text-amber-400 font-semibold tabular-nums'
        : 'font-mono-tech text-[#00E5FF] font-semibold tabular-nums';
    }
    if (hudAvgLow) {
      const lowFps = Math.max(28, m.fps - (state.renderScale > 85 ? 9 : 2));
      hudAvgLow.textContent = isVi
        ? `TB ${m.fps} · 5% thấp ${lowFps}`
        : `avg ${m.fps} · 5% low ${lowFps}`;
    }

    // Collapse / Expand state of Floating Monitor
    const hudBody = document.getElementById('hud-expanded-body');
    const hudCollapseBtn = document.getElementById('hud-collapse-btn');
    const hudWindow = document.getElementById('floating-monitor');
    if (hudBody && hudCollapseBtn && hudWindow) {
      if (state.hudCollapsed) {
        hudBody.classList.add('hidden');
        hudWindow.style.width = 'auto';
        hudCollapseBtn.textContent = isVi ? '▼ Mở rộng' : '▼ Expand';
      } else {
        hudBody.classList.remove('hidden');
        hudWindow.style.width = '248px';
        hudCollapseBtn.textContent = isVi ? '▲ Thu gọn' : '▲ Collapse';
      }
    }

    // 6. AFK Black Screen 0% Brightness Overlay
    const afkOverlay = document.getElementById('sandbox-afk-overlay');
    if (afkOverlay) {
      if (state.afkActive) {
        afkOverlay.classList.remove('opacity-0', 'pointer-events-none');
        afkOverlay.classList.add('opacity-100', 'pointer-events-auto');
      } else {
        afkOverlay.classList.add('opacity-0', 'pointer-events-none');
        afkOverlay.classList.remove('opacity-100', 'pointer-events-auto');
      }
    }

    // 7. System UI sharpness & status bar indicators in preview
    const sbHz = document.getElementById('sb-ind-hz');
    const sbWifi = document.getElementById('sb-ind-wifi');
    const sbDnd = document.getElementById('sb-ind-dnd');
    if (sbHz) {
      sbHz.textContent = state.lock60Hz ? '60Hz LOCK' : '120Hz';
      sbHz.className = state.lock60Hz
        ? 'px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30'
        : 'px-1.5 py-0.5 rounded bg-slate-800 text-slate-300';
    }
    if (sbWifi) {
      sbWifi.className = state.lowLatencyWifi
        ? 'hidden sm:inline-block px-1.5 py-0.5 rounded bg-sky-500/20 text-[#00E5FF] border border-sky-400/30 whitespace-nowrap'
        : 'hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-900 text-slate-600 line-through whitespace-nowrap';
    }
    if (sbDnd) {
      sbDnd.className = state.dndActive
        ? 'px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap'
        : 'px-1.5 py-0.5 rounded bg-slate-900 text-slate-600 line-through whitespace-nowrap';
    }

    const sysUiBar = document.getElementById('sandbox-sysui-bar');
    const sysUiBadge = document.getElementById('sandbox-sysui-badge');
    if (sysUiBar && sysUiBadge) {
      if (state.downscaleMode === 'buffer' || state.renderScale === 100) {
        sysUiBar.style.filter = 'none';
        sysUiBadge.textContent = isVi ? 'UI Hệ thống: Nét 100%' : 'System UI: 100% Sharp';
        sysUiBadge.className = 'text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate';
      } else {
        const blurPx = ((100 - state.renderScale) / 100) * 1.1;
        sysUiBar.style.filter = `blur(${blurPx.toFixed(2)}px)`;
        sysUiBadge.textContent = isVi ? `wm size: ${m.targetW}×${m.targetH}` : `wm size: ${m.targetW}×${m.targetH}`;
        sysUiBadge.className = 'text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 truncate';
      }
    }

    updateHudSparkline(m.fps);
  }

  // --- Live Sparkline inside Floating Monitor ---
  function updateHudSparkline(currentFps) {
    state.fpsHistory.push(currentFps);
    if (state.fpsHistory.length > 20) state.fpsHistory.shift();

    const pathEl = document.getElementById('hud-spark-path');
    const areaEl = document.getElementById('hud-spark-area');
    if (!pathEl || !areaEl) return;

    const w = 216;
    const h = 38;
    const pts = state.fpsHistory.map((val, idx) => {
      const x = (idx / (state.fpsHistory.length - 1)) * w;
      const y = h - Math.min(1, Math.max(0.1, val / 125)) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const dLine = 'M ' + pts.join(' L ');
    const dArea = `${dLine} L ${w},${h} L 0,${h} Z`;
    pathEl.setAttribute('d', dLine);
    areaEl.setAttribute('d', dArea);
  }

  // --- Interactive 2D Canvas Game Preview with Real Buffer Scaling ---
  function initSandboxCanvas() {
    const canvas = document.getElementById('sandbox-game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let t = 0;

    function drawFrame() {
      t += 0.025;
      // Scale internal buffer directly by state.renderScale (30% - 100%)
      const scale = state.renderScale / 100;
      const baseW = 480;
      const baseH = 320;
      const bufW = Math.max(96, Math.round(baseW * scale));
      const bufH = Math.max(64, Math.round(baseH * scale));

      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW;
        canvas.height = bufH;
      }

      ctx.save();
      ctx.scale(bufW / baseW, bufH / baseH);

      // Sky gradient (Cryo Polar Horizon)
      const sky = ctx.createLinearGradient(0, 0, 0, baseH);
      sky.addColorStop(0, '#040914');
      sky.addColorStop(0.55, '#0A192F');
      sky.addColorStop(1, '#07223B');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, baseW, baseH);

      // Aurora / Cryo wave ribbon
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= baseW; x += 16) {
        const y = 78 + Math.sin(x * 0.02 + t) * 16 + Math.cos(x * 0.01 - t * 0.7) * 10;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Distant wireframe mountains
      ctx.fillStyle = '#0B213A';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 195);
      const peaks = [0, 65, 130, 195, 270, 340, 415, 480];
      const heights = [165, 118, 152, 104, 148, 112, 156, 132];
      for (let i = 0; i < peaks.length; i++) {
        ctx.lineTo(peaks[i], heights[i]);
      }
      ctx.lineTo(baseW, 195);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Perspective 3D Grid Floor (moves at speed linked to FPS)
      const horizonY = 195;
      ctx.fillStyle = '#050C18';
      ctx.fillRect(0, horizonY, baseW, baseH - horizonY);

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.28)';
      ctx.lineWidth = 1;
      const centerX = baseW / 2;
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX + i * 14, horizonY);
        ctx.lineTo(centerX + i * 75, baseH);
        ctx.stroke();
      }

      // Moving horizontal depth lines
      const speedOffset = (t * (state.lock60Hz ? 1.4 : 2.4)) % 1;
      for (let row = 0; row < 8; row++) {
        const p = (row + speedOffset) / 8;
        const y = horizonY + Math.pow(p, 1.8) * (baseH - horizonY);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(baseW, y);
        ctx.stroke();
      }

      // Simulated 3D Game Target Nodes
      const shipX = centerX + Math.sin(t * 1.1) * 58;
      const shipY = 248 + Math.cos(t * 1.6) * 8;
      ctx.strokeStyle = '#00E5FF';
      ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shipX, shipY - 14);
      ctx.lineTo(shipX - 18, shipY + 12);
      ctx.lineTo(shipX, shipY + 6);
      ctx.lineTo(shipX + 18, shipY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Target Reticle on Canvas
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(shipX - 26, shipY - 22, 52, 42);

      ctx.restore();
      requestAnimationFrame(drawFrame);
    }

    requestAnimationFrame(drawFrame);
  }

  // --- Draggable Floating Monitor inside Game Viewport ---
  function initDraggableHud() {
    const hud = document.getElementById('floating-monitor');
    const container = document.getElementById('sandbox-viewport');
    const dragHandle = document.getElementById('hud-drag-handle');
    if (!hud || !container || !dragHandle) return;

    let dragging = false;
    let startX = 0, startY = 0, origLeft = 16, origTop = 44;

    dragHandle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      hud.classList.add('dragging');
      dragHandle.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      origLeft = hud.offsetLeft;
      origTop = hud.offsetTop;
    });

    dragHandle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const maxLeft = Math.max(8, container.clientWidth - hud.offsetWidth - 8);
      const maxTop = Math.max(36, container.clientHeight - hud.offsetHeight - 8);
      const nextLeft = Math.min(maxLeft, Math.max(8, origLeft + dx));
      const nextTop = Math.min(maxTop, Math.max(36, origTop + dy));
      hud.style.left = nextLeft + 'px';
      hud.style.top = nextTop + 'px';
    });

    const stopDrag = () => {
      if (!dragging) return;
      dragging = false;
      hud.classList.remove('dragging');
    };
    dragHandle.addEventListener('pointerup', stopDrag);
    dragHandle.addEventListener('pointercancel', stopDrag);
  }

  // --- Focus Mode & Pin Apps Interactive Lab ---
  function renderFocusLab() {
    const grid = document.getElementById('focus-lab-grid');
    if (!grid) return;
    const isVi = state.lang === 'vi';

    let freedRamMB = 0;
    let frozenCount = 0;

    grid.innerHTML = FOCUS_APPS.map(app => {
      const isFrozen = state.focusLabActive && !app.pinned;
      if (isFrozen) {
        freedRamMB += app.ram;
        frozenCount++;
      }
      const statusText = app.pinned
        ? (isVi ? 'Đã ghim · Focus chừa ra' : 'Pinned · Skipped by Focus')
        : isFrozen
          ? (app.sysNoIcon
              ? (isVi ? 'Đã dừng tạm (Dịch vụ không icon)' : 'Stopped temporarily (No-icon service)')
              : (isVi ? `Đã đóng băng (${state.freezeLevel})` : `Frozen (${state.freezeLevel})`))
          : (isVi ? `Đang chạy ngầm · ${app.ram} MB` : `Running in BG · ${app.ram} MB`);

      const statusColor = app.pinned
        ? 'text-amber-400'
        : isFrozen
          ? 'text-[#00E5FF]'
          : 'text-slate-400';

      return `
        <div class="app-sim-item p-3.5 rounded-xl bg-[#0B111E] border border-slate-800/90 flex items-center justify-between gap-3 ${isFrozen ? 'is-frozen' : ''} ${app.pinned ? 'is-pinned' : ''}">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm text-white truncate">${isVi ? app.nameVi : app.nameEn}</span>
              ${app.essential ? `<span class="text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">${isVi ? 'Thiết yếu' : 'Essential'}</span>` : ''}
            </div>
            <div class="text-[11px] font-mono-tech ${statusColor} mt-0.5 truncate">${statusText}</div>
          </div>
          <button type="button" data-pin-app="${app.id}" class="btn-kinetic px-2.5 py-1.5 rounded-lg text-xs font-mono-tech font-medium border transition-all flex-shrink-0 ${
            app.pinned
              ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
          }">
            ${app.pinned ? (isVi ? '📌 Đã ghim' : '📌 Pinned') : (isVi ? 'Ghim' : 'Pin')}
          </button>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-pin-app]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pin-app');
        const target = FOCUS_APPS.find(a => a.id === id);
        if (target) {
          target.pinned = !target.pinned;
          renderFocusLab();
        }
      });
    });

    const summaryEl = document.getElementById('focus-lab-summary');
    const toggleBtn = document.getElementById('focus-lab-trigger');
    if (summaryEl) {
      if (state.focusLabActive) {
        summaryEl.textContent = isVi
          ? `Đã đóng băng ${frozenCount} ứng dụng chưa ghim · Giải phóng +${(freedRamMB / 1024).toFixed(2)} GB RAM (${freedRamMB} MB)`
          : `Froze ${frozenCount} unpinned background apps · Reclaimed +${(freedRamMB / 1024).toFixed(2)} GB RAM (${freedRamMB} MB)`;
        summaryEl.className = 'text-xs font-mono-tech text-[#00E5FF] font-semibold';
      } else {
        summaryEl.textContent = isVi
          ? 'Trạng thái: Chưa kích hoạt Focus Mode. Bấm ghim ứng dụng quan trọng rồi bật Focus để thử.'
          : 'Status: Focus Mode Standby. Pin your essential apps, then trigger Focus Mode to test.';
        summaryEl.className = 'text-xs font-mono-tech text-slate-400';
      }
    }

    if (toggleBtn) {
      if (state.focusLabActive) {
        toggleBtn.textContent = isVi ? '☀ Rã đông 1 chạm (Thoát Game)' : '☀ One-Tap Thaw (Leave Game)';
        toggleBtn.className = 'btn-kinetic px-4 py-2.5 rounded-xl font-mono-tech text-xs font-bold bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]';
      } else {
        toggleBtn.textContent = isVi ? '❄ Kích hoạt Focus Mode (Vào Game)' : '❄ Trigger Focus Mode (Enter Game)';
        toggleBtn.className = 'btn-kinetic btn-cryo-primary px-4 py-2.5 rounded-xl font-mono-tech text-xs font-bold';
      }
    }
  }

  // --- Interactive Session Report Card ---
  function renderSessionReport() {
    const s = SESSION_REPORTS[state.sessionIndex];
    if (!s) return;
    const isVi = state.lang === 'vi';

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('rep-game-name', s.game);
    setTxt('rep-game-scale', s.scale);
    setTxt('rep-play-time', isVi ? s.timeVi : s.timeEn);
    setTxt('rep-peak-temp', s.peakTemp);
    setTxt('rep-temp-sub', isVi ? s.tempSubVi : s.tempSubEn);
    setTxt('rep-bat-used', s.batteryUsed);
    setTxt('rep-power-draw', s.powerDraw);
    setTxt('rep-avg-fps', `${s.avgFps} FPS`);
    setTxt('rep-low-fps', isVi ? `5% thấp nhất: ${s.low5Fps} FPS` : `5% low: ${s.low5Fps} FPS`);

    const fpsBox = document.getElementById('rep-fps-card');
    if (fpsBox) {
      if (state.sessionMode === 'basic') {
        fpsBox.classList.add('opacity-45');
      } else {
        fpsBox.classList.remove('opacity-45');
      }
    }

    // Session selector tabs
    document.querySelectorAll('[data-session-idx]').forEach(btn => {
      const idx = parseInt(btn.getAttribute('data-session-idx'), 10);
      btn.classList.toggle('active', idx === state.sessionIndex);
    });

    // Tracking mode buttons
    const btnBasic = document.getElementById('rep-mode-basic');
    const btnDetailed = document.getElementById('rep-mode-detailed');
    if (btnBasic && btnDetailed) {
      btnDetailed.classList.toggle('active', state.sessionMode === 'detailed');
      btnBasic.classList.toggle('active', state.sessionMode === 'basic');
    }

    // Render SVG Sparkline for Session Report
    const svgPath = document.getElementById('rep-sparkline-path');
    const svgArea = document.getElementById('rep-sparkline-area');
    if (svgPath && svgArea) {
      const w = 320;
      const h = 56;
      const data = state.sessionMode === 'detailed' ? s.sparkFps : s.sparkTemp;
      const maxV = state.sessionMode === 'detailed' ? 125 : 42;
      const minV = state.sessionMode === 'detailed' ? 30 : 32;
      const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const norm = (v - minV) / (maxV - minV);
        const y = h - Math.max(0.1, Math.min(0.95, norm)) * (h - 10) - 5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const d = 'M ' + pts.join(' L ');
      svgPath.setAttribute('d', d);
      svgArea.setAttribute('d', `${d} L ${w},${h} L 0,${h} Z`);
    }
  }

  // --- Bilingual Language Switcher (EN / VI without reload) ---
  function applyLanguage(lang) {
    state.lang = lang === 'vi' ? 'vi' : 'en';
    localStorage.setItem('cryo_lang', state.lang);
    document.documentElement.lang = state.lang;

    // Update all static elements with data-en / data-vi
    document.querySelectorAll('[data-en][data-vi]').forEach(el => {
      const content = el.getAttribute('data-' + state.lang);
      if (content !== null) {
        if (el.hasAttribute('data-html')) {
          el.innerHTML = content;
        } else {
          el.textContent = content;
        }
      }
    });

    // Update language toggle buttons in navbar
    const btnEn = document.getElementById('lang-btn-en');
    const btnVi = document.getElementById('lang-btn-vi');
    if (btnEn && btnVi) {
      btnEn.classList.toggle('active', state.lang === 'en');
      btnVi.classList.toggle('active', state.lang === 'vi');
    }

    renderSandbox();
    renderFocusLab();
    renderSessionReport();
  }

  // --- Bind Events & Observers ---
  function initEvents() {
    // Language Switcher
    const btnEn = document.getElementById('lang-btn-en');
    const btnVi = document.getElementById('lang-btn-vi');
    if (btnEn) btnEn.addEventListener('click', () => applyLanguage('en'));
    if (btnVi) btnVi.addEventListener('click', () => applyLanguage('vi'));

    // Resolution Slider & Presets
    const slider = document.getElementById('sandbox-res-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        state.renderScale = parseInt(e.target.value, 10);
        renderSandbox();
      });
    }

    document.querySelectorAll('[data-scale-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.renderScale = parseInt(btn.getAttribute('data-scale-preset'), 10);
        renderSandbox();
      });
    });

    // Downscale Mode (Game Buffer vs Fullscreen wm size)
    const btnBuffer = document.getElementById('mode-btn-buffer');
    const btnWm = document.getElementById('mode-btn-wm');
    if (btnBuffer) btnBuffer.addEventListener('click', () => { state.downscaleMode = 'buffer'; renderSandbox(); });
    if (btnWm) btnWm.addEventListener('click', () => { state.downscaleMode = 'wm'; renderSandbox(); });

    // Freeze Level Buttons
    ['L1', 'L2', 'L3', 'L4'].forEach(lvl => {
      const btn = document.getElementById('freeze-btn-' + lvl);
      if (btn) {
        btn.addEventListener('click', () => {
          state.freezeLevel = lvl;
          renderSandbox();
          renderFocusLab();
        });
      }
    });

    // Hardware Switches
    const bindSwitch = (id, key) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          state[key] = !state[key];
          renderSandbox();
        });
      }
    };
    bindSwitch('sw-afk', 'afkActive');
    bindSwitch('sw-60hz', 'lock60Hz');
    bindSwitch('sw-dnd', 'dndActive');
    bindSwitch('sw-wifi', 'lowLatencyWifi');
    bindSwitch('sw-reslock', 'resLock');
    bindSwitch('sw-shizuku', 'shizukuConnected');

    // HUD Quick Buttons
    const hudCollapseBtn = document.getElementById('hud-collapse-btn');
    if (hudCollapseBtn) {
      hudCollapseBtn.addEventListener('click', () => {
        state.hudCollapsed = !state.hudCollapsed;
        renderSandbox();
      });
    }

    const hudScreenOffBtn = document.getElementById('hud-screenoff-btn');
    if (hudScreenOffBtn) {
      hudScreenOffBtn.addEventListener('click', () => {
        state.afkActive = true;
        renderSandbox();
      });
    }

    const hudOptimizeBtn = document.getElementById('hud-optimize-btn');
    if (hudOptimizeBtn) {
      hudOptimizeBtn.addEventListener('click', () => {
        state.renderScale = 70;
        state.freezeLevel = 'L2';
        state.shizukuConnected = true;
        renderSandbox();
      });
    }

    // AFK Overlay Double-Tap / Double-Click to Wake
    const afkOverlay = document.getElementById('sandbox-afk-overlay');
    if (afkOverlay) {
      let lastTap = 0;
      afkOverlay.addEventListener('dblclick', () => {
        state.afkActive = false;
        renderSandbox();
      });
      afkOverlay.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTap < 350) {
          e.preventDefault();
          state.afkActive = false;
          renderSandbox();
        }
        lastTap = now;
      });
    }

    // Progressive Disclosure Drawer (Trend 03)
    const drawerTrigger = document.getElementById('tldr-drawer-trigger');
    const drawerContent = document.getElementById('tldr-drawer-content');
    const drawerChevron = document.getElementById('tldr-drawer-chevron');
    if (drawerTrigger && drawerContent) {
      drawerTrigger.addEventListener('click', () => {
        state.drawerOpen = !state.drawerOpen;
        drawerContent.classList.toggle('open', state.drawerOpen);
        if (drawerChevron) {
          drawerChevron.style.transform = state.drawerOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      });
    }

    // Deep-dive Tabs inside Progressive Disclosure Drawer
    document.querySelectorAll('[data-hood-tab]').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const target = tabBtn.getAttribute('data-hood-tab');
        document.querySelectorAll('[data-hood-tab]').forEach(b => {
          const active = b.getAttribute('data-hood-tab') === target;
          b.className = active
            ? 'px-3.5 py-2 rounded-lg text-xs font-mono-tech font-bold bg-[#00E5FF] text-slate-950 shadow-sm transition-all'
            : 'px-3.5 py-2 rounded-lg text-xs font-mono-tech text-slate-400 bg-slate-900/90 border border-slate-800 hover:text-white transition-all';
        });
        document.querySelectorAll('[data-hood-panel]').forEach(panel => {
          panel.classList.toggle('hidden', panel.getAttribute('data-hood-panel') !== target);
        });
      });
    });

    // Focus Lab Trigger
    const focusTrigger = document.getElementById('focus-lab-trigger');
    if (focusTrigger) {
      focusTrigger.addEventListener('click', () => {
        state.focusLabActive = !state.focusLabActive;
        renderFocusLab();
      });
    }

    // Session Report Controls
    document.querySelectorAll('[data-session-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.sessionIndex = parseInt(btn.getAttribute('data-session-idx'), 10);
        renderSessionReport();
      });
    });

    const btnBasic = document.getElementById('rep-mode-basic');
    const btnDetailed = document.getElementById('rep-mode-detailed');
    if (btnBasic) btnBasic.addEventListener('click', () => { state.sessionMode = 'basic'; renderSessionReport(); });
    if (btnDetailed) btnDetailed.addEventListener('click', () => { state.sessionMode = 'detailed'; renderSessionReport(); });

    // Maximalist Spec Cards Scroll Highlight (Trend 08)
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          entry.target.classList.toggle('in-view', entry.isIntersecting);
        });
      }, { threshold: 0.35 });
      document.querySelectorAll('.spec-card').forEach(card => obs.observe(card));
    }

    // Subtle real-time telemetry jitter every 1.4s so the Floating Monitor feels alive
    setInterval(() => {
      if (!state.shizukuConnected) return;
      const m = computeMetrics();
      const jitter = Math.floor(Math.random() * 3) - 1;
      const liveFps = state.lock60Hz
        ? Math.min(60, Math.max(58, m.fps + jitter))
        : Math.min(120, Math.max(30, m.fps + jitter));
      const hudFpsNum = document.getElementById('hud-fps-num');
      if (hudFpsNum) hudFpsNum.textContent = liveFps;
      updateHudSparkline(liveFps);
    }, 1400);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSandboxCanvas();
    initDraggableHud();
    initEvents();
    applyLanguage(state.lang);
  });
})();
