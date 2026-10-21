// Balance Scale: drag items onto two pans, the beam and dial show the difference.

// ---- constants (stage pixels) ----
const STAGE_W = 1256;
const STAGE_H = 936;
const PIVOT = { x: 629.5, y: 187.5 };      // beam pivot (centre of the blue cap)
const HOOK_DIST = 314;                      // pivot to each pan hook, along the beam
const DEG_PER_UNIT = 1.5;                   // beam tilt per unit of difference
const MAX_TILT = 15;
const DIAL_MAX_ANGLE = 80;                  // measured: the "10" tick sits 80deg from vertical
const DIAL_MAX = 10;
const BEAM_MS = 550;
const NEEDLE_MS = 900;
const RETURN_MS = 250;
const PIECE_SCALE = 1.15;                   // pictures on the pan vs. the tray size

// Pan geometry. rest = top-left of the pan art, hookX = x of its hook at rest,
// cx = middle of the tray, tray = [left, right] of the pan surface, all in stage pixels.
const PANS = {
  left:  { rest: [170, 160], hookX: 315.5, tray: [181, 439],  cx: 310 },
  right: { rest: [797, 160], hookX: 943.5, tray: [820, 1079], cx: 949.5 },
};
const SURFACE_Y = 436;                      // pictures stand on this line (stage y at rest)
const ZONE_TOP = 215;                       // drop zone: from just under the beam...
const ZONE_BOTTOM = 530;                    // ...to just under the pan
const ZONE_PAD = 30;

// One row per picture. weight is the only number the logic uses; the tile image has it printed on.
// tile = [x0, y0, x1, y1] in the tray; w, h = size of the draggable picture (before PIECE_SCALE).
const ITEMS = [
  { id: "books",          name: "Books",          weight: 1, tile: [55, 575, 150, 732],   w: 71,  h: 88 },
  { id: "chair",          name: "Chair",          weight: 1, tile: [167, 572, 251, 732],  w: 57,  h: 94 },
  { id: "boy",            name: "Boy",            weight: 2, tile: [273, 564, 354, 731],  w: 45,  h: 101 },
  { id: "girl",           name: "Girl",           weight: 2, tile: [380, 572, 459, 732],  w: 54,  h: 94 },
  { id: "bicycle",        name: "Bicycle",        weight: 2, tile: [480, 623, 569, 734],  w: 65,  h: 45 },
  { id: "trampoline",     name: "Trampoline",     weight: 2, tile: [585, 629, 674, 734],  w: 64,  h: 39 },
  { id: "scooter",        name: "Scooter",        weight: 2, tile: [689, 581, 782, 731],  w: 65,  h: 84 },
  { id: "car",            name: "Green car",      weight: 4, tile: [795, 622, 884, 734],  w: 62,  h: 46 },
  { id: "family",         name: "Family",         weight: 3, tile: [898, 572, 990, 726],  w: 68,  h: 73 },
  { id: "tree",           name: "Tree",           weight: 3, tile: [1003, 572, 1089, 732], w: 61, h: 94 },
  { id: "hut",            name: "Sukkah hut",     weight: 3, tile: [1110, 622, 1199, 734], w: 57, h: 46 },
  { id: "tractor",        name: "Tractor",        weight: 4, tile: [69, 750, 201, 910],   w: 108, h: 87 },
  { id: "purple-truck",   name: "Purple truck",   weight: 4, tile: [227, 757, 374, 913],  w: 123, h: 89 },
  { id: "school-bus",     name: "School bus",     weight: 5, tile: [397, 761, 537, 909],  w: 116, h: 76 },
  { id: "fire-truck",     name: "Fire truck",     weight: 5, tile: [564, 750, 696, 909],  w: 108, h: 88 },
  { id: "delivery-truck", name: "Delivery truck", weight: 5, tile: [723, 750, 867, 910],  w: 120, h: 86 },
  { id: "house",          name: "House",          weight: 6, tile: [899, 750, 1021, 909], w: 98,  h: 88 },
  { id: "airplane",       name: "Airplane",       weight: 6, tile: [1052, 775, 1197, 909], w: 121, h: 61 },
];
const byId = Object.fromEntries(ITEMS.map(it => [it.id, it]));

// ---- state: the only source of truth ----
const state = { left: [], right: [] };      // item ids, in the order they were placed (later = in front)
let held = null;                            // { id, dx, dy, from } while a picture is being dragged
const flying = new Set();                   // ids still animating back to the tray

// ---- elements ----
const stage = document.getElementById("stage");
const beamEl = document.getElementById("beam");
const needleEl = document.getElementById("needle");
const trayEl = document.getElementById("tray");
const statusEl = document.getElementById("status");
const panEls = {
  left: document.getElementById("pan-left"),
  right: document.getElementById("pan-right"),
};
const piles = { left: panEls.left.querySelector(".pile"), right: panEls.right.querySelector(".pile") };
const tiles = {};
const pieces = {};

// ---- stage scaling ----
let stageScale = 1;
function fitStage() {
  stageScale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  stage.style.transform = `translate(-50%, -50%) scale(${stageScale})`;
}
window.addEventListener("resize", fitStage);
fitStage();

// client (screen) pixels -> stage pixels; goes through the live stage rect so it survives any resize
function toStagePoint(clientX, clientY) {
  const r = stage.getBoundingClientRect();
  return { x: (clientX - r.left) / stageScale, y: (clientY - r.top) / stageScale };
}

// ---- build tiles and pictures ----
ITEMS.forEach(it => {
  const [x0, y0, x1, y1] = it.tile;
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.dataset.id = it.id;
  Object.assign(tile.style, { left: x0 + "px", top: y0 + "px", width: x1 - x0 + "px", height: y1 - y0 + "px" });
  const img = new Image();
  img.src = `assets/images/tiles/${it.id}.png`;
  img.alt = `${it.name}, weight ${it.weight}`;
  img.draggable = false;
  tile.appendChild(img);
  trayEl.appendChild(tile);
  tiles[it.id] = tile;

  const piece = new Image();
  piece.src = `assets/images/items/${it.id}.png`;
  piece.alt = `${it.name}, weight ${it.weight}`;
  piece.draggable = false;
  piece.className = "piece";
  piece.dataset.id = it.id;
  piece.style.width = it.w * PIECE_SCALE + "px";
  piece.style.height = it.h * PIECE_SCALE + "px";
  pieces[it.id] = piece;
});

// ---- physics ----
const sum = ids => ids.reduce((t, id) => t + byId[id].weight, 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const diffNow = () => sum(state.right) - sum(state.left);   // positive = right side heavier

// ---- tweening (one tween per animated value) ----
const view = { beam: 0, needle: 0 };        // degrees currently on screen
const tweens = {};
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeSettle = t => 1 - Math.exp(-6 * t) * Math.cos(8 * t);   // small overshoot, then rests
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function tweenTo(key, to, ms, ease) {
  tweens[key] = { from: view[key], to, ms: reduceMotion.matches ? 0 : ms, ease, start: performance.now() };
  if (!tweens.running) { tweens.running = true; requestAnimationFrame(tick); }
}
function tick(now) {
  let active = false;
  for (const key of ["beam", "needle"]) {
    const tw = tweens[key];
    if (!tw) continue;
    const t = tw.ms ? Math.min(1, (now - tw.start) / tw.ms) : 1;
    view[key] = t >= 1 ? tw.to : tw.from + (tw.to - tw.from) * tw.ease(t);
    if (t >= 1) tweens[key] = null; else active = true;
  }
  applyView();
  if (active) requestAnimationFrame(tick); else tweens.running = false;
}

// Pans hang from the hooks and stay level; only the hooks move with the beam.
const panPos = { left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } };
function applyView() {
  const rad = view.beam * Math.PI / 180;
  beamEl.style.transform = `rotate(${view.beam}deg)`;
  needleEl.style.transform = `rotate(${view.needle}deg)`;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const hooks = {
    left:  { x: PIVOT.x - HOOK_DIST * cos, y: PIVOT.y - HOOK_DIST * sin },
    right: { x: PIVOT.x + HOOK_DIST * cos, y: PIVOT.y + HOOK_DIST * sin },
  };
  for (const side of ["left", "right"]) {
    const dx = hooks[side].x - PANS[side].hookX;
    const dy = hooks[side].y - PIVOT.y;
    panPos[side] = { dx, dy };
    panEls[side].style.transform = `translate(${dx}px, ${dy}px)`;
  }
}

// ---- audio: a soft chime, created on the first tap (browsers need a gesture) ----
let audioCtx = null;
function unlockAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function chime() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + 0.05;
  [659.25, 987.77].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = t0 + i * 0.12;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 1);
  });
}

// ---- render: everything on screen is derived from state / held ----
let lastDiff = 0;

function layoutPile(side) {
  const ids = state[side];
  const n = ids.length;
  const pan = PANS[side];
  const cxRel = pan.cx - pan.rest[0];
  const surfRel = SURFACE_Y - pan.rest[1];
  const step = n > 1 ? Math.min(14, 196 / (n - 1)) : 0;   // later pictures sit a little to the side, in front
  ids.forEach((id, k) => {
    const el = pieces[id];
    const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
    const w = byId[id].w * PIECE_SCALE, h = byId[id].h * PIECE_SCALE;
    if (el.parentNode !== piles[side]) piles[side].appendChild(el);
    el.classList.remove("lifted", "flying");
    el.classList.add("in-pile");
    el.style.left = cxRel + off - w / 2 + "px";
    el.style.top = surfRel - h + "px";
    el.style.zIndex = k + 1;
  });
}

function render() {
  const placed = new Set([...state.left, ...state.right]);
  ITEMS.forEach(it => {
    const used = placed.has(it.id) || (held && held.id === it.id) || flying.has(it.id);
    tiles[it.id].classList.toggle("used", used);
  });
  layoutPile("left");
  layoutPile("right");
  updateScale();
}

function updateScale() {
  const diff = diffNow();
  const shown = clamp(diff, -DIAL_MAX, DIAL_MAX);
  tweenTo("beam", clamp(diff * DEG_PER_UNIT, -MAX_TILT, MAX_TILT), BEAM_MS, easeOutCubic);
  tweenTo("needle", shown * (DIAL_MAX_ANGLE / DIAL_MAX), NEEDLE_MS, easeSettle);

  const items = state.left.length + state.right.length;
  if (diff === 0 && lastDiff !== 0 && items > 0) setTimeout(chime, 350);
  lastDiff = diff;

  statusEl.textContent =
    items === 0 ? "Both pans are empty." :
    diff === 0 ? `Balanced. Both sides weigh ${sum(state.left)}.` :
    diff > 0 ? `Right side is heavier by ${diff}.` : `Left side is heavier by ${-diff}.`;
}

// ---- drag and drop ----
function zoneAt(p) {
  for (const side of ["left", "right"]) {
    const { tray } = PANS[side];
    const { dx, dy } = panPos[side];
    if (p.x >= tray[0] - ZONE_PAD + dx && p.x <= tray[1] + ZONE_PAD + dx &&
        p.y >= ZONE_TOP + dy && p.y <= ZONE_BOTTOM + dy) return side;
  }
  return null;
}
function setHot(side) {
  panEls.left.classList.toggle("hot", side === "left");
  panEls.right.classList.toggle("hot", side === "right");
}

function movePiece(p) {
  const it = byId[held.id];
  const el = pieces[held.id];
  el.style.left = p.x - held.dx - it.w * PIECE_SCALE / 2 + "px";
  el.style.top = p.y - held.dy - it.h * PIECE_SCALE / 2 + "px";
}

function pickUp(id, e, from) {
  const el = pieces[id];
  const it = byId[id];
  const p = toStagePoint(e.clientX, e.clientY);
  let dx = 0, dy = 0;
  if (from) {
    // grabbed from a pan: keep the spot under the finger, so the picture doesn't jump
    const r = el.getBoundingClientRect();
    const c = toStagePoint(r.left + r.width / 2, r.top + r.height / 2);
    dx = p.x - c.x; dy = p.y - c.y;
    state[from] = state[from].filter(x => x !== id);
  }
  held = { id, dx, dy, from };
  el.classList.remove("in-pile", "flying");
  el.classList.add("lifted");
  el.style.transform = "";
  el.style.zIndex = "";
  stage.appendChild(el);
  movePiece(p);
  stage.setPointerCapture(e.pointerId);
  render();
}

function dropOn(side, e) {
  const id = held.id;
  const el = pieces[id];
  const before = el.getBoundingClientRect();
  held = null;
  setHot(null);
  state[side].push(id);
  render();
  // glide from where it was released into its spot on the pan
  const after = el.getBoundingClientRect();
  const sx = (before.left + before.width / 2 - after.left - after.width / 2) / stageScale;
  const sy = (before.top + before.height / 2 - after.top - after.height / 2) / stageScale;
  el.style.transition = "none";
  el.style.transform = `translate(${sx}px, ${sy}px) scale(1.1)`;
  el.getBoundingClientRect();
  el.style.transition = "left .22s ease, top .22s ease, transform .22s ease";
  el.style.transform = "";
  setTimeout(() => { el.style.transition = ""; }, 260);
}

function sendToTray() {
  const id = held.id;
  const el = pieces[id];
  const it = byId[id];
  held = null;
  setHot(null);
  flying.add(id);
  const [x0, y0, x1, y1] = it.tile;
  el.classList.add("flying");
  el.style.left = (x0 + x1) / 2 - it.w * PIECE_SCALE / 2 + "px";
  el.style.top = y0 + (y1 - y0 - 56) / 2 - it.h * PIECE_SCALE / 2 + "px";
  render();
  setTimeout(() => {
    el.classList.remove("flying", "lifted");
    el.remove();
    flying.delete(id);
    render();
  }, RETURN_MS + 20);
}

function returnToPan(side) {
  // the drag was interrupted: put the picture back where it came from
  const id = held.id;
  const el = pieces[id];
  held = null;
  setHot(null);
  state[side].push(id);
  el.classList.remove("lifted");
  render();
}

stage.addEventListener("pointerdown", e => {
  unlockAudio();
  if (held || e.button > 0) return;
  const pieceEl = e.target.closest(".piece");
  if (pieceEl) {
    const side = state.left.includes(pieceEl.dataset.id) ? "left" : "right";
    pickUp(pieceEl.dataset.id, e, side);
    return;
  }
  const tile = e.target.closest(".tile");
  if (tile && !tile.classList.contains("used")) pickUp(tile.dataset.id, e, null);
});

stage.addEventListener("pointermove", e => {
  if (!held) return;
  const p = toStagePoint(e.clientX, e.clientY);
  movePiece(p);
  setHot(zoneAt(p));
});

function release(e, cancelled) {
  if (!held) return;
  if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  const side = zoneAt(toStagePoint(e.clientX, e.clientY));
  if (cancelled) held.from ? returnToPan(held.from) : sendToTray();
  else if (side) dropOn(side, e);
  else sendToTray();
}
stage.addEventListener("pointerup", e => release(e, false));
stage.addEventListener("pointercancel", e => release(e, true));
stage.addEventListener("contextmenu", e => e.preventDefault());

document.getElementById("reset").addEventListener("click", () => {
  unlockAudio();
  state.left = [];
  state.right = [];
  Object.values(pieces).forEach(el => el.remove());
  render();
});

applyView();
render();
