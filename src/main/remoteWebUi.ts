/**
 * Giao diện Web App cảm ứng (Zero-install Mobile Controller) phục vụ qua mạng LAN Wi-Fi
 * khi điện thoại quét mã QR từ Parallax Studio.
 */

export function renderMobileRemoteHtml(token: string): string {
  const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, '')
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Parallax Studio — Mobile Remote</title>
  <style>
    :root {
      --bg-0: #0b0e14;
      --bg-1: #121722;
      --bg-2: #1a2130;
      --bg-3: #232c40;
      --line: #2a354d;
      --text: #f1f5f9;
      --text-dim: #94a3b8;
      --accent: #3b82f6;
      --cyan: #38bdf8;
      --gold: #f59e0b;
      --ok: #22c55e;
      --danger: #ef4444;
      --radius: 8px;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-0);
      color: var(--text);
      overflow-x: hidden;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }
    .top-bar {
      background: var(--bg-1);
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .status-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--ok); box-shadow: 0 0 8px var(--ok);
      flex-shrink: 0;
    }
    .dot.offline { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
    .comp-title {
      font-size: 13px; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .time-pill {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px; color: var(--cyan);
      background: var(--bg-2); padding: 4px 8px;
      border-radius: 6px; border: 1px solid var(--line);
      flex-shrink: 0;
    }
    .transport-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      padding: 8px 12px;
      background: var(--bg-1);
      border-bottom: 1px solid var(--line);
    }
    .btn {
      background: var(--bg-2);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 9px 6px;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      cursor: pointer;
      transition: transform 0.08s, background 0.12s;
    }
    .btn:active { transform: scale(0.96); background: var(--bg-3); }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.key { background: rgba(245, 158, 11, 0.18); border-color: var(--gold); color: #fde68a; }
    .btn.active { background: var(--accent); border-color: var(--cyan); color: #fff; }
    .preview-box {
      margin: 8px 12px 0;
      background: #05070a;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
      display: none;
      position: relative;
      aspect-ratio: 16 / 9;
      max-height: 190px;
    }
    .preview-box.open { display: flex; align-items: center; justify-content: center; }
    .preview-box img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .mode-tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin: 10px 12px 6px;
      padding: 3px;
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius);
    }
    .tab-btn {
      background: transparent;
      color: var(--text-dim);
      border: none;
      border-radius: 6px;
      padding: 8px 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .tab-btn.active { background: var(--accent); color: #fff; }
    .pane { display: none; padding: 6px 12px 24px; flex-direction: column; gap: 10px; }
    .pane.active { display: flex; }
    .sub-pills {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(95px, 1fr));
      gap: 5px;
    }
    .pill {
      background: var(--bg-1);
      border: 1px solid var(--line);
      color: var(--text-dim);
      padding: 7px 6px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
    }
    .pill.active {
      background: rgba(59, 130, 246, 0.22);
      border-color: var(--cyan);
      color: #fff;
    }
    .touchpad {
      position: relative;
      height: 230px;
      background:
        linear-gradient(to right, rgba(56, 189, 248, 0.07) 1px, transparent 1px) 0 0 / 28px 28px,
        linear-gradient(to bottom, rgba(56, 189, 248, 0.07) 1px, transparent 1px) 0 0 / 28px 28px,
        radial-gradient(circle at center, #172033 0%, #0d121d 100%);
      border: 1.5px solid var(--line);
      border-radius: 10px;
      touch-action: none;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 10px;
    }
    .touchpad.dragging { border-color: var(--cyan); box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25); }
    .tp-axis-h {
      position: absolute; left: 0; right: 0; top: 50%; height: 1px;
      background: rgba(56, 189, 248, 0.22); pointer-events: none;
    }
    .tp-axis-v {
      position: absolute; top: 0; bottom: 0; left: 50%; width: 1px;
      background: rgba(56, 189, 248, 0.22); pointer-events: none;
    }
    .tp-cursor {
      position: absolute;
      width: 44px; height: 44px;
      margin-left: -22px; margin-top: -22px;
      border-radius: 50%;
      background: rgba(56, 189, 248, 0.22);
      border: 2px solid var(--cyan);
      left: 50%; top: 50%;
      pointer-events: none;
      transition: transform 0.05s;
    }
    .tp-head, .tp-foot {
      position: relative; z-index: 2;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; color: var(--text-dim); pointer-events: none;
    }
    .tp-readout {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      color: var(--cyan); font-size: 11.5px; font-weight: 600;
    }
    .card {
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .slider-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: var(--text-dim);
    }
    .slider-label b { color: var(--text); font-family: ui-monospace, monospace; }
    input[type="range"] {
      width: 100%;
      accent-color: var(--accent);
      height: 24px;
      margin: 0;
    }
    .layer-strip {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .layer-chip {
      flex-shrink: 0;
      background: var(--bg-2);
      border: 1px solid var(--line);
      color: var(--text-dim);
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .layer-chip.active {
      background: var(--accent);
      border-color: var(--cyan);
      color: #fff;
    }
    .shot-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .shot-card {
      background: var(--bg-2);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .shot-card.active { border-color: var(--cyan); background: rgba(59, 130, 246, 0.16); }
    .sens-bar { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .sens-pills { display: flex; gap: 4px; }
    .sens-pill {
      padding: 4px 8px; font-size: 11px; border-radius: 5px;
      background: var(--bg-2); border: 1px solid var(--line); color: var(--text-dim);
    }
    .sens-pill.active { background: var(--accent); color: #fff; border-color: var(--cyan); }
  </style>
</head>
<body>
  <header class="top-bar">
    <div class="status-wrap">
      <span id="conn-dot" class="dot"></span>
      <span id="comp-title" class="comp-title">Parallax Studio Remote</span>
    </div>
    <span id="time-readout" class="time-pill">0.00s</span>
  </header>

  <div class="transport-row">
    <button class="btn primary" id="btn-play" onclick="sendAction({ action: 'toggle_play' })">▶ Phát</button>
    <button class="btn key" onclick="sendAction({ action: 'keyframe', target_kind: activeTab === 'camera' ? 'camera' : 'layer' })">💎 Đặt Key</button>
    <button class="btn" id="btn-undo" onclick="sendAction({ action: 'undo' })">↶ Hoàn tác</button>
    <button class="btn" id="btn-redo" onclick="sendAction({ action: 'redo' })">↷ Làm lại</button>
    <button class="btn" id="btn-preview" onclick="togglePreview()">👁 Xem</button>
  </div>

  <div id="preview-box" class="preview-box">
    <img id="preview-img" alt="Live Viewport Preview" />
  </div>

  <nav class="mode-tabs">
    <button class="tab-btn active" id="tab-camera" onclick="switchTab('camera')">🎥 Camera 3D</button>
    <button class="tab-btn" id="tab-layer" onclick="switchTab('layer')">🗂 Layer 2.5D</button>
    <button class="tab-btn" id="tab-shots" onclick="switchTab('shots')">🎬 Cảnh & Time</button>
  </nav>

  <!-- TAB 1: CAMERA 3D -->
  <section id="pane-camera" class="pane active">
    <div class="sub-pills">
      <div class="pill active" id="cam-mode-pan" onclick="setCamMode('pan')">✥ Dời ngang/dọc (X/Y)</div>
      <div class="pill" id="cam-mode-dolly" onclick="setCamMode('dolly')">🚀 Đẩy sâu 2.5D (X/Z)</div>
      <div class="pill" id="cam-mode-orbit" onclick="setCamMode('orbit')">🌐 Xoay góc Orbit 3D</div>
    </div>

    <div class="touchpad" id="cam-pad">
      <div class="tp-axis-h"></div>
      <div class="tp-axis-v"></div>
      <div class="tp-cursor" id="cam-cursor"></div>
      <div class="tp-head">
        <span id="cam-pad-hint">Chạm & vuốt để dời Camera X/Y</span>
        <span class="tp-readout" id="cam-readout">X:0 Y:0 Z:1200</span>
      </div>
      <div class="tp-foot">
        <span>Kéo 1 ngón realtime 60fps</span>
        <span id="cam-fov-readout">FOV: 50°</span>
      </div>
    </div>

    <div class="card">
      <div class="sens-bar">
        <span style="font-size:11.5px;color:var(--text-dim)">Độ nhạy cảm ứng (Sensitivity):</span>
        <div class="sens-pills">
          <button class="sens-pill" onclick="setSens(0.5, this)">0.5×</button>
          <button class="sens-pill active" onclick="setSens(1, this)">1×</button>
          <button class="sens-pill" onclick="setSens(2, this)">2×</button>
          <button class="sens-pill" onclick="setSens(4, this)">4×</button>
        </div>
      </div>

      <div class="slider-row">
        <div class="slider-label"><span>Độ sâu Camera (Trục Z)</span><b id="lbl-cam-z">1200</b></div>
        <input type="range" id="rng-cam-z" min="-600" max="2600" step="5" value="1200"
          oninput="onCamZInput(this.value)" />
      </div>

      <div class="slider-row">
        <div class="slider-label"><span>Góc ống kính (FOV °)</span><b id="lbl-cam-fov">50°</b></div>
        <input type="range" id="rng-cam-fov" min="15" max="110" step="1" value="50"
          oninput="onCamFovInput(this.value)" />
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
        <button class="btn key" onclick="sendAction({ action: 'keyframe', target_kind: 'camera' })">💎 Lưu Key Camera</button>
        <button class="btn" onclick="sendAction({ action: 'reset_camera' })">🎯 Reset Camera</button>
      </div>
    </div>
  </section>

  <!-- TAB 2: LAYER 2.5D -->
  <section id="pane-layer" class="pane">
    <div id="layer-strip" class="layer-strip"></div>

    <div class="sub-pills">
      <div class="pill active" id="lyr-mode-xy" onclick="setLayerMode('xy')">✥ Vị trí X/Y</div>
      <div class="pill" id="lyr-mode-xz" onclick="setLayerMode('xz')">📐 Độ sâu X/Z</div>
      <div class="pill" id="lyr-mode-rot" onclick="setLayerMode('rot')">🔄 Nghiêng 3D (RX/RY)</div>
      <div class="pill" id="lyr-mode-scale" onclick="setLayerMode('scale')">🔍 Xoay Z & Scale</div>
    </div>

    <div class="touchpad" id="lyr-pad">
      <div class="tp-axis-h"></div>
      <div class="tp-axis-v"></div>
      <div class="tp-cursor" id="lyr-cursor"></div>
      <div class="tp-head">
        <span id="lyr-pad-hint">Vuốt để di chuyển Layer đang chọn</span>
        <span class="tp-readout" id="lyr-readout">X:0 Y:0 Z:0</span>
      </div>
      <div class="tp-foot">
        <span id="lyr-rot-readout">Rot: 0° / 0° / 0°</span>
        <span id="lyr-scale-readout">Scale: 100%</span>
      </div>
    </div>

    <div class="card">
      <div class="slider-row">
        <div class="slider-label"><span>Độ sâu Layer 2.5D (Trục Z)</span><b id="lbl-lyr-z">0</b></div>
        <input type="range" id="rng-lyr-z" min="-1500" max="900" step="5" value="0"
          oninput="onLayerZInput(this.value)" />
      </div>

      <div class="slider-row">
        <div class="slider-label"><span>Tỉ lệ kích thước (Scale %)</span><b id="lbl-lyr-scale">100%</b></div>
        <input type="range" id="rng-lyr-scale" min="10" max="300" step="1" value="100"
          oninput="onLayerScaleInput(this.value)" />
      </div>

      <div class="slider-row">
        <div class="slider-label"><span>Độ mờ (Opacity %)</span><b id="lbl-lyr-op">100%</b></div>
        <input type="range" id="rng-lyr-op" min="0" max="100" step="1" value="100"
          oninput="onLayerOpacityInput(this.value)" />
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:4px">
        <button class="btn" onclick="sendAction({ action: 'toggle_layer_visible' })">👁 Ẩn/Hiện</button>
        <button class="btn key" onclick="sendAction({ action: 'keyframe', target_kind: 'layer' })">💎 Đặt Key</button>
        <button class="btn" onclick="sendAction({ action: 'reset_layer_transform' })">↺ Reset</button>
      </div>
    </div>
  </section>

  <!-- TAB 3: SHOTS & TIMELINE -->
  <section id="pane-shots" class="pane">
    <div class="card">
      <div class="slider-row">
        <div class="slider-label"><span>Thanh thời gian (Timeline Scrub)</span><b id="lbl-scrub">0.00s</b></div>
        <input type="range" id="rng-scrub" min="0" max="15" step="0.04" value="0"
          oninput="onScrubInput(this.value)" />
      </div>
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px">
        <button class="btn" onclick="sendAction({ action: 'seek', time: 0 })">⏮ 0.0s</button>
        <button class="btn" onclick="sendAction({ action: 'seek', delta_time: -0.5 })">-0.5s</button>
        <button class="btn" onclick="sendAction({ action: 'seek', delta_time: 0.5 })">+0.5s</button>
        <button class="btn" onclick="sendAction({ action: 'toggle_play' })">⏯ Phát</button>
      </div>
    </div>

    <div class="card">
      <div style="font-size:12px;font-weight:700;color:var(--text-dim)">Danh sách Cảnh (Shots) — Chạm để chuyển cảnh</div>
      <div id="shot-grid" class="shot-grid"></div>
    </div>
  </section>

  <script>
    const TOKEN = "${safeToken}";
    let activeTab = "camera";
    let camMode = "pan";
    let layerMode = "xy";
    let sensitivity = 1;
    let appState = null;
    let previewOpen = false;
    let previewTimer = null;
    let inflight = false;
    let pendingDelta = null;

    function vibrate(ms = 8) {
      try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
    }

    function switchTab(tab) {
      vibrate(6);
      activeTab = tab;
      ["camera", "layer", "shots"].forEach((k) => {
        document.getElementById("tab-" + k).classList.toggle("active", k === tab);
        document.getElementById("pane-" + k).classList.toggle("active", k === tab);
      });
    }

    function setSens(val, btn) {
      vibrate(6);
      sensitivity = val;
      document.querySelectorAll(".sens-pill").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
    }

    function setCamMode(m) {
      vibrate(6);
      camMode = m;
      ["pan", "dolly", "orbit"].forEach((k) => {
        document.getElementById("cam-mode-" + k).classList.toggle("active", k === m);
      });
      const hints = {
        pan: "Chạm & vuốt để dời Camera Ngang/Dọc (X/Y)",
        dolly: "Vuốt lên/xuống để đẩy sâu Z · Trái/phải dời X",
        orbit: "Vuốt để xoay góc nhìn Orbit 3D quanh tâm"
      };
      document.getElementById("cam-pad-hint").textContent = hints[m];
    }

    function setLayerMode(m) {
      vibrate(6);
      layerMode = m;
      ["xy", "xz", "rot", "scale"].forEach((k) => {
        document.getElementById("lyr-mode-" + k).classList.toggle("active", k === m);
      });
    }

    async function apiCall(path, body) {
      const opts = body
        ? { method: "POST", headers: { "Content-Type": "application/json", "X-Remote-Token": TOKEN }, body: JSON.stringify(body) }
        : { method: "GET", headers: { "X-Remote-Token": TOKEN } };
      const res = await fetch(path + "?t=" + encodeURIComponent(TOKEN), opts);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }

    async function sendAction(payload) {
      vibrate(8);
      try {
        const data = await apiCall("/api/action", payload);
        if (data && data.state) renderState(data.state);
      } catch (e) {
        document.getElementById("conn-dot").classList.add("offline");
      }
    }

    function renderState(s) {
      if (!s) return;
      appState = s;
      document.getElementById("conn-dot").classList.remove("offline");
      document.getElementById("comp-title").textContent = s.comp?.name || "Parallax Studio";
      document.getElementById("time-readout").textContent = (s.time ?? 0).toFixed(2) + "s / " + (s.comp?.duration ?? 0).toFixed(1) + "s";
      document.getElementById("btn-play").textContent = s.playing ? "⏸ Dừng" : "▶ Phát";

      if (s.camera) {
        const [cx, cy, cz] = s.camera.position || [0, 0, 1200];
        document.getElementById("cam-readout").textContent = "X:" + Math.round(cx) + " Y:" + Math.round(cy) + " Z:" + Math.round(cz);
        document.getElementById("cam-fov-readout").textContent = "FOV: " + Math.round(s.camera.fov || 50) + "°";
        document.getElementById("lbl-cam-z").textContent = Math.round(cz);
        document.getElementById("rng-cam-z").value = Math.round(cz);
        document.getElementById("lbl-cam-fov").textContent = Math.round(s.camera.fov || 50) + "°";
        document.getElementById("rng-cam-fov").value = Math.round(s.camera.fov || 50);
      }

      const strip = document.getElementById("layer-strip");
      const layers = s.layers || [];
      strip.innerHTML = layers.map((l) =>
        '<button class="layer-chip ' + (l.id === s.selectedLayerId ? 'active' : '') + '" onclick="sendAction({action:\\'select_layer\\',layer_id:\\'' + l.id + '\\'})">' +
        (l.visible ? '👁 ' : '🚫 ') + l.name + '</button>'
      ).join("");

      const activeLayer = layers.find((l) => l.id === s.selectedLayerId) || layers[0];
      if (activeLayer) {
        const [lx, ly, lz] = activeLayer.position || [0, 0, 0];
        const [rx, ry, rz] = activeLayer.rotation || [0, 0, 0];
        const sc = Math.round((activeLayer.scale?.[0] ?? 1) * 100);
        const op = Math.round((activeLayer.opacity ?? 1) * 100);
        document.getElementById("lyr-readout").textContent = "X:" + Math.round(lx) + " Y:" + Math.round(ly) + " Z:" + Math.round(lz);
        document.getElementById("lyr-rot-readout").textContent = "Rot: " + Math.round(rx) + "°/" + Math.round(ry) + "°/" + Math.round(rz) + "°";
        document.getElementById("lyr-scale-readout").textContent = "Scale: " + sc + "%";
        document.getElementById("lbl-lyr-z").textContent = Math.round(lz);
        document.getElementById("rng-lyr-z").value = Math.round(lz);
        document.getElementById("lbl-lyr-scale").textContent = sc + "%";
        document.getElementById("rng-lyr-scale").value = sc;
        document.getElementById("lbl-lyr-op").textContent = op + "%";
        document.getElementById("rng-lyr-op").value = op;
      }

      const scrub = document.getElementById("rng-scrub");
      scrub.max = s.comp?.duration || 15;
      scrub.value = s.time || 0;
      document.getElementById("lbl-scrub").textContent = (s.time || 0).toFixed(2) + "s";

      const shotGrid = document.getElementById("shot-grid");
      shotGrid.innerHTML = (s.shots || []).map((sh) => {
        const pos = sh.position || [0, 0, 0];
        return '<div class="shot-card ' + (sh.id === s.selectedShotId ? 'active' : '') + '">' +
        '<div style="font-weight:700;font-size:12px">' + sh.name + '</div>' +
        '<div style="font-size:10.5px;color:var(--text-dim)">X:' + Math.round(pos[0]) + ' · Z:' + Math.round(pos[2]) + '</div>' +
        '<div style="display:flex;gap:4px">' +
        '<button class="btn" style="flex:1;padding:6px" onclick="sendAction({action:\\'select_shot\\',shot_id:\\'' + sh.id + '\\',fly:false})">Chọn</button>' +
        '<button class="btn primary" style="flex:1;padding:6px" onclick="sendAction({action:\\'select_shot\\',shot_id:\\'' + sh.id + '\\',fly:true})">✈ Bay tới</button>' +
        '</div></div>';
      }).join("");
    }

    function queueContinuousAction(payload) {
      pendingDelta = payload;
      if (!inflight) flushContinuousAction();
    }

    async function flushContinuousAction() {
      if (!pendingDelta || inflight) return;
      const next = pendingDelta;
      pendingDelta = null;
      inflight = true;
      try {
        const data = await apiCall("/api/action", next);
        if (data && data.state) renderState(data.state);
      } catch {}
      inflight = false;
      if (pendingDelta) flushContinuousAction();
    }

    function bindTouchpad(padId, cursorId, onMoveDelta) {
      const pad = document.getElementById(padId);
      const cursor = document.getElementById(cursorId);
      let lastX = 0, lastY = 0, active = false;

      pad.addEventListener("pointerdown", (e) => {
        active = true;
        lastX = e.clientX;
        lastY = e.clientY;
        pad.setPointerCapture(e.pointerId);
        pad.classList.add("dragging");
      });

      pad.addEventListener("pointermove", (e) => {
        if (!active) return;
        const dx = (e.clientX - lastX) * sensitivity;
        const dy = (e.clientY - lastY) * sensitivity;
        lastX = e.clientX;
        lastY = e.clientY;
        const rect = pad.getBoundingClientRect();
        const relX = Math.max(15, Math.min(rect.width - 15, e.clientX - rect.left));
        const relY = Math.max(15, Math.min(rect.height - 15, e.clientY - rect.top));
        cursor.style.left = relX + "px";
        cursor.style.top = relY + "px";
        if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
          onMoveDelta(dx, dy);
        }
      });

      const stop = () => {
        active = false;
        pad.classList.remove("dragging");
        cursor.style.left = "50%";
        cursor.style.top = "50%";
      };
      pad.addEventListener("pointerup", stop);
      pad.addEventListener("pointercancel", stop);
    }

    bindTouchpad("cam-pad", "cam-cursor", (dx, dy) => {
      if (camMode === "pan") {
        queueContinuousAction({ action: "nudge_camera", mode: "pan", dx: dx * 2.2, dy: -dy * 2.2 });
      } else if (camMode === "dolly") {
        queueContinuousAction({ action: "nudge_camera", mode: "dolly", dx: dx * 2.0, dz: dy * 3.2 });
      } else {
        queueContinuousAction({ action: "nudge_camera", mode: "orbit", dx: dx * 0.35, dy: -dy * 0.35 });
      }
    });

    bindTouchpad("lyr-pad", "lyr-cursor", (dx, dy) => {
      if (layerMode === "xy") {
        queueContinuousAction({ action: "nudge_layer", dx: dx * 2.0, dy: -dy * 2.0 });
      } else if (layerMode === "xz") {
        queueContinuousAction({ action: "nudge_layer", dx: dx * 2.0, dz: dy * 3.0 });
      } else if (layerMode === "rot") {
        queueContinuousAction({ action: "nudge_layer", drx: dy * 0.4, dry: dx * 0.4 });
      } else {
        queueContinuousAction({ action: "nudge_layer", drz: dx * 0.45, ds: -dy * 0.005 });
      }
    });

    function onCamZInput(v) {
      document.getElementById("lbl-cam-z").textContent = v;
      queueContinuousAction({ action: "set_camera_transform", z: Number(v) });
    }
    function onCamFovInput(v) {
      document.getElementById("lbl-cam-fov").textContent = v + "°";
      queueContinuousAction({ action: "set_camera_transform", fov: Number(v) });
    }
    function onLayerZInput(v) {
      document.getElementById("lbl-lyr-z").textContent = v;
      queueContinuousAction({ action: "set_layer_transform", z: Number(v) });
    }
    function onLayerScaleInput(v) {
      document.getElementById("lbl-lyr-scale").textContent = v + "%";
      const s = Number(v) / 100;
      queueContinuousAction({ action: "set_layer_transform", scale: [s, s, 1] });
    }
    function onLayerOpacityInput(v) {
      document.getElementById("lbl-lyr-op").textContent = v + "%";
      queueContinuousAction({ action: "set_layer_transform", opacity: Number(v) / 100 });
    }
    function onScrubInput(v) {
      document.getElementById("lbl-scrub").textContent = Number(v).toFixed(2) + "s";
      queueContinuousAction({ action: "seek", time: Number(v) });
    }

    function togglePreview() {
      previewOpen = !previewOpen;
      document.getElementById("preview-box").classList.toggle("open", previewOpen);
      document.getElementById("btn-preview").classList.toggle("active", previewOpen);
      if (previewOpen) refreshPreview();
    }

    async function refreshPreview() {
      if (!previewOpen) return;
      try {
        const res = await apiCall("/api/preview");
        if (res && res.data) {
          document.getElementById("preview-img").src = "data:" + (res.mime || "image/jpeg") + ";base64," + res.data;
        }
      } catch {}
      if (previewOpen) previewTimer = setTimeout(refreshPreview, 450);
    }

    async function pollState() {
      try {
        const res = await apiCall("/api/state");
        if (res && res.state) renderState(res.state);
      } catch {
        document.getElementById("conn-dot").classList.add("offline");
      }
    }

    pollState();
    setInterval(pollState, 1200);
  </script>
</body>
</html>`;
}
