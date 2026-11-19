// BlockVerse — cliente 3D (three.js). O servidor é a autoridade; aqui ficam render, física do jogador e interface (estilo Windows 98).
import * as THREE from "/vendor/three.module.min.js";
import { CS, H, REACH, DAY_MS, idx, ckey, BLOCKS, ITEM, AIR, WATER, LAVA, RECIPES, digTime, itemName, placeable, daylight } from "./shared.mjs";
import { buildAtlas, faceTiles, iconURL, ATLAS_COLS, ATLAS_ROWS } from "./textures.js";
import { hudIcon } from "./sprites.js";

const $ = id => document.getElementById(id);
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// ======================= Render =======================
const canvas = $("game"), viewport = $("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(+store.get("bv-fov", "75"), 1, 0.08, 400);
camera.rotation.order = "YXZ";
scene.add(camera);
function resize() {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize();

const atlasCanvas = buildAtlas();
const atlas = new THREE.CanvasTexture(atlasCanvas);
atlas.magFilter = atlas.minFilter = THREE.NearestFilter; atlas.generateMipmaps = false;

const uniforms = { map: { value: atlas }, uDay: { value: 1 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 40 }, fogFar: { value: 64 }, uAlpha: { value: 1 } };
const VS = `attribute vec2 light; varying vec2 vUv; varying vec3 vCol; varying vec2 vL; varying float vFog;
void main(){ vUv = uv; vCol = color; vL = light; vec4 mv = modelViewMatrix * vec4(position, 1.0); vFog = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS = `uniform sampler2D map; uniform float uDay; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float uAlpha;
varying vec2 vUv; varying vec3 vCol; varying vec2 vL; varying float vFog;
void main(){ vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard;
  float l = max(max(vL.x * uDay, vL.y), 0.05);
  vec3 c = t.rgb * vCol * l; float f = smoothstep(fogNear, fogFar, vFog);
  gl_FragColor = vec4(mix(c, fogColor, f), uAlpha); }`;
const matSolid = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, vertexColors: true, side: THREE.DoubleSide });
const waterUniforms = { ...uniforms, uAlpha: { value: 0.72 } };
const matWater = new THREE.ShaderMaterial({ uniforms: waterUniforms, vertexShader: VS, fragmentShader: FS, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });

const amb = new THREE.AmbientLight(0xffffff, 0.6), sun = new THREE.DirectionalLight(0xffffff, 0.7);
scene.add(amb, sun);
const sunSprite = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xfff2a8, fog: false }));
const moonSprite = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: 0xdde6ff, fog: false }));
scene.add(sunSprite, moonSprite);

// ======================= Mundo (cliente) =======================
const chunks = new Map(); // key -> {cx,cz,blocks,meta,mesh,water}
const dirty = new Set();
function getB(x, y, z) {
  if (y < 0 || y >= H) return AIR;
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = chunks.get(ckey(cx, cz));
  return c ? c.blocks[idx(x - cx * CS, y, z - cz * CS)] : -1;
}
function getM(x, y, z) {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = chunks.get(ckey(cx, cz));
  return c && y >= 0 && y < H ? c.meta[idx(x - cx * CS, y, z - cz * CS)] : 0;
}
function setLocal(x, y, z, id, meta) {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = chunks.get(ckey(cx, cz));
  if (!c || y < 0 || y >= H) return;
  const lx = x - cx * CS, lz = z - cz * CS, i = idx(lx, y, lz);
  c.blocks[i] = id; c.meta[i] = meta;
  dirty.add(ckey(cx, cz));
  // luz e faces vizinhas atravessam a borda do chunk
  if (lx < 8) dirty.add(ckey(cx - 1, cz)); if (lx > 7) dirty.add(ckey(cx + 1, cz));
  if (lz < 8) dirty.add(ckey(cx, cz - 1)); if (lz > 7) dirty.add(ckey(cx, cz + 1));
}
/** Altura sólida do bloco na célula (0 = atravessável). Chunk ainda não carregado conta como sólido. */
function solidH(x, y, z) {
  const id = getB(x, y, z); if (id < 0) return 1;
  if (id === 27) return getM(x, y, z) & 1 ? 0 : 1;
  const b = BLOCKS[id]; return b.solid ? (b.ch ?? 1) : 0;
}
const isLiq = id => id === WATER || id === LAVA;

const lightOf = (id, m) => id === 16 ? 14 : id === 25 ? (m & 1 ? 15 : 0) : id === 22 ? 12 : id === 13 ? 6 : id === 15 ? (m & 1 ? 13 : 0)
  : id === 26 ? (m & 1 ? 7 : 0) : id === 21 ? (m > 0 ? 3 : 0) : id === 44 ? 15 : id === 51 ? 15 : 0;

// ---------- Malha de um chunk (com luz do céu + luz de blocos por BFS) ----------
const RX = CS + 16; // região: chunk ± 8 blocos
const FACES = [ // +X, -X, +Z, -Z, +Y, -Y (cantos: inf.-esq., inf.-dir., sup.-dir., sup.-esq. vistos de fora)
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.65 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.65 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
];
const SIDE_OF_FACING = [2, 0, 3, 1];
function buildChunk(c) {
  const ox = c.cx * CS - 8, oz = c.cz * CS - 8, N = RX * RX * H;
  const blk = new Uint8Array(N), met = new Uint8Array(N), sky = new Uint8Array(N), bl = new Uint8Array(N);
  const R = (x, y, z) => (y * RX + z) * RX + x;
  for (let rz = 0; rz < RX; rz++) for (let rx = 0; rx < RX; rx++) {
    const wx = ox + rx, wz = oz + rz, ccx = Math.floor(wx / CS), ccz = Math.floor(wz / CS), cc = chunks.get(ckey(ccx, ccz));
    if (!cc) continue;
    const lx = wx - ccx * CS, lz = wz - ccz * CS;
    for (let y = 0; y < H; y++) { const i = idx(lx, y, lz), r = R(rx, y, rz); blk[r] = cc.blocks[i]; met[r] = cc.meta[i]; }
  }
  const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let rz = 0; rz < RX; rz++) for (let rx = 0; rx < RX; rx++) {
    let lv = 15;
    for (let y = H - 1; y >= 0; y--) { const r = R(rx, y, rz), id = blk[r]; if (BLOCKS[id].opaque) break; if (id === WATER || id === 7 || id === 39 || id === 41 || id === 34) lv = Math.max(0, lv - 2); sky[r] = lv; if (lv > 1) q[qt++] = r; }
  }
  const spread = arr => {
    while (qh < qt) {
      const r = q[qh++], lv = arr[r] - 1; if (lv <= 0) continue;
      const x = r % RX, z = Math.floor(r / RX) % RX, y = Math.floor(r / (RX * RX));
      const tryN = (nx, ny, nz) => { if (nx < 0 || nz < 0 || nx >= RX || nz >= RX || ny < 0 || ny >= H) return; const n = R(nx, ny, nz); if (arr[n] >= lv || BLOCKS[blk[n]].opaque) return; arr[n] = lv; if (qt < N) q[qt++] = n; };
      tryN(x + 1, y, z); tryN(x - 1, y, z); tryN(x, y + 1, z); tryN(x, y - 1, z); tryN(x, y, z + 1); tryN(x, y, z - 1);
    }
  };
  spread(sky);
  qh = qt = 0;
  for (let r = 0; r < N; r++) { const l = lightOf(blk[r], met[r]); if (l) { bl[r] = l; q[qt++] = r; } }
  spread(bl);

  const out = { solid: newGeo(), water: newGeo() };
  const isOp = id => BLOCKS[id].opaque;
  for (let y = 0; y < H; y++) for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
    const rx = lx + 8, rz = lz + 8, r = R(rx, y, rz), id = blk[r]; if (id === AIR) continue;
    const b = BLOCKS[id], m = met[r], wx = c.cx * CS + lx, wz = c.cz * CS + lz;
    const tiles = faceTiles(id, m), glow = lightOf(id, m) / 15 || (b.glow ? 0.8 : 0);
    const L = rr => [sky[rr] / 15, Math.max(bl[rr] / 15, glow)];
    const facing = (m >> 2) & 3;
    if (b.shape === "cube") {
      const liquid = isLiq(id), g = id === WATER || b.translucent ? out.water : out.solid;
      const front = tiles[3] !== undefined ? facing : -1;
      for (let f = 0; f < 6; f++) {
        const [dx, dy, dz] = FACES[f].n, ny = y + dy;
        let nid;
        if (ny < 0) continue; else if (ny >= H) nid = AIR; else nid = blk[R(rx + dx, ny, rz + dz)];
        if (liquid ? (nid === id || isOp(nid)) : (isOp(nid) || (nid === id && !b.opaque))) continue;
        const nr = ny >= H ? r : R(rx + dx, ny, rz + dz);
        const tile = f === 4 ? tiles[0] : f === 5 ? tiles[1] : (front >= 0 && SIDE_OF_FACING[front] === f ? tiles[3] : tiles[2]);
        const top = liquid && (y + 1 >= H || blk[R(rx, y + 1, rz)] !== id) ? 0.88 : 1;
        addFace(g, f, wx, y, wz, tile, FACES[f].shade, id === LAVA ? [1, 1] : L(nr), [1, 1, 1], top);
      }
      continue;
    }
    const lt = L(r), S = out.solid;
    switch (b.shape) {
      case "cross": addCross(S, wx, y, wz, tiles[2], lt); break;
      case "slab": { const p = m / 15; addBox(S, wx, y, wz, 0, 0, 0, 1, 1 / 16, 1, tiles, [lt[0], Math.max(lt[1], p * 0.6)], [0.55 + p * 0.45, 0.55 + p * 0.2, 0.6 + p * 0.4]); break; }
      case "cactus": addBox(S, wx, y, wz, 1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16, tiles, lt, [1, 1, 1]); break;
      case "chest": addBox(S, wx, y, wz, 1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16, tiles, lt, [1, 1, 1], facing); break;
      case "bed": addBox(S, wx, y, wz, 0, 0, 0, 1, 9 / 16, 1, tiles, lt, [1, 1, 1]); break;
      case "ladder": {
        const t = 1 / 16, boxes = [[0, 0, 0, t, 1, 1], [1 - t, 0, 0, 1, 1, 1], [0, 0, 0, 1, 1, t], [0, 0, 1 - t, 1, 1, 1]];
        addBox(S, wx, y, wz, ...boxes[facing], [tiles[0], tiles[0], tiles[0]], lt, [1, 1, 1]); break;
      }
      case "small":
        if (id === 16) addBox(S, wx, y, wz, 7 / 16, 0, 7 / 16, 9 / 16, 10 / 16, 9 / 16, tiles, [lt[0], 1], [1, 1, 1]);
        else if (id === 23) { addBox(S, wx, y, wz, 5 / 16, 0, 5 / 16, 11 / 16, 2 / 16, 11 / 16, tiles, lt, [0.7, 0.7, 0.72]); const o = m & 1 ? 2 / 16 : -2 / 16; addBox(S, wx, y, wz, 7 / 16 + o, 2 / 16, 7 / 16, 9 / 16 + o, 10 / 16, 9 / 16, tiles, lt, m & 1 ? [1, 0.45, 0.45] : [0.75, 0.5, 0.35]); }
        else if (id === 24) { const h = m & 1 ? 1 / 16 : 2.5 / 16; addBox(S, wx, y, wz, 5 / 16, 0, 5 / 16, 11 / 16, h, 11 / 16, tiles, lt, m & 1 ? [0.6, 1, 1] : [1, 1, 1]); }
        break;
      case "door": {
        const face = facing + (m & 1 ? 1 : 0), t = 3 / 16;
        const boxes = [[0, 0, 0, 1, 1, t], [1 - t, 0, 0, 1, 1, 1], [0, 0, 1 - t, 1, 1, 1], [0, 0, 0, t, 1, 1]];
        addBox(S, wx, y, wz, ...boxes[face % 4], tiles, lt, [1, 1, 1]); break;
      }
    }
  }
  return out;
}
const newGeo = () => ({ pos: [], uv: [], col: [], light: [], idx: [] });
function tileUV(t) {
  const u0 = (t % ATLAS_COLS) / ATLAS_COLS, v1 = 1 - Math.floor(t / ATLAS_COLS) / ATLAS_ROWS, e = 0.0004;
  return [u0 + e, v1 - 1 / ATLAS_ROWS + e, u0 + 1 / ATLAS_COLS - e, v1 - e];
}
function pushQuad(g, pts, tile, shade, lt, tint, vMax = 1) {
  const [u0, v0, u1, v1] = tileUV(tile), vv = v0 + (v1 - v0) * vMax, n = g.pos.length / 3;
  const uvs = [[u0, v0], [u1, v0], [u1, vv], [u0, vv]];
  for (let k = 0; k < 4; k++) { g.pos.push(...pts[k]); g.uv.push(...uvs[k]); g.col.push(tint[0] * shade, tint[1] * shade, tint[2] * shade); g.light.push(lt[0], lt[1]); }
  g.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
}
function addFace(g, f, x, y, z, tile, shade, lt, tint, top = 1) {
  const pts = FACES[f].c.map(([a, b, c]) => [x + a, y + (b ? top : 0), z + c]);
  pushQuad(g, pts, tile, shade, lt, tint, f < 4 ? top : 1);
}
/** Caixa com texturas [topo, base, lados, frente?]; "facing" escolhe qual lado recebe a frente. */
function addBox(g, x, y, z, x0, y0, z0, x1, y1, z1, tiles, lt, tint, facing = -1) {
  const t = Array.isArray(tiles) ? tiles : [tiles, tiles, tiles];
  for (let f = 0; f < 6; f++) {
    const pts = FACES[f].c.map(([a, b, c]) => [x + (a ? x1 : x0), y + (b ? y1 : y0), z + (c ? z1 : z0)]);
    const tile = f === 4 ? t[0] : f === 5 ? t[1] : (facing >= 0 && t[3] !== undefined && SIDE_OF_FACING[facing] === f ? t[3] : t[2]);
    pushQuad(g, pts, tile, FACES[f].shade, lt, tint, f < 4 ? (y1 - y0) : 1);
  }
}
function addCross(g, x, y, z, tile, lt) {
  const a = 0.15, b = 0.85;
  pushQuad(g, [[x + a, y, z + a], [x + b, y, z + b], [x + b, y + 1, z + b], [x + a, y + 1, z + a]], tile, 0.95, lt, [1, 1, 1]);
  pushQuad(g, [[x + b, y, z + a], [x + a, y, z + b], [x + a, y + 1, z + b], [x + b, y + 1, z + a]], tile, 0.95, lt, [1, 1, 1]);
}
function toMesh(g, mat) {
  if (!g.idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(g.col, 3));
  geo.setAttribute("light", new THREE.Float32BufferAttribute(g.light, 2));
  geo.setIndex(g.idx);
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; return m;
}
function remesh(c) {
  for (const k of ["mesh", "water"]) if (c[k]) { scene.remove(c[k]); c[k].geometry.dispose(); c[k] = null; }
  const o = buildChunk(c);
  c.mesh = toMesh(o.solid, matSolid); c.water = toMesh(o.water, matWater);
  if (c.mesh) scene.add(c.mesh); if (c.water) { c.water.renderOrder = 1; scene.add(c.water); }
}

// ======================= Rede =======================
let ws = null, me = null, myKey = null, inv = Array(36).fill(null), stat = { hp: 20, food: 20, air: 15, creative: false, dead: false };
let worldTime = 0, timeAt = 0, sel = 0, openUI = null, started = false;
let ui = { cursor: null, grid: [], size: 2, result: null, f: null, chest: null };
const others = new Map(), mobs = new Map(), arrows = new Map();
const requested = new Set();
function connect() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/blockverse`);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => { $("conn").textContent = "Conectado. Pronto para jogar."; $("play").disabled = false; if (started) hello(); };
  ws.onclose = () => { $("conn").textContent = "Sem conexão com o servidor — tentando de novo…"; $("play").disabled = true; requested.clear(); setTimeout(connect, 2000); };
  ws.onmessage = e => typeof e.data === "string" ? onMsg(JSON.parse(e.data)) : onChunk(e.data);
}
const sendJ = o => { if (ws?.readyState === 1) ws.send(JSON.stringify(o)); };
function hello() { sendJ({ type: "hello", name: $("nameIn").value.trim() }); }
function onChunk(buf) {
  const dv = new DataView(buf), cx = dv.getInt32(4, true), cz = dv.getInt32(8, true), n = CS * CS * H, k = ckey(cx, cz);
  const old = chunks.get(k);
  const c = { cx, cz, blocks: new Uint8Array(buf, 12, n).slice(), meta: new Uint8Array(buf, 12 + n, n).slice(), mesh: old?.mesh, water: old?.water };
  chunks.set(k, c); requested.delete(k);
  for (const kk of [k, ckey(cx + 1, cz), ckey(cx - 1, cz), ckey(cx, cz + 1), ckey(cx, cz - 1)]) if (chunks.has(kk)) dirty.add(kk);
}
function onMsg(m) {
  switch (m.type) {
    case "welcome":
      myKey = m.id; worldTime = m.time; timeAt = performance.now();
      if (!me) me = { x: m.p.x, y: m.p.y, z: m.p.z, vx: 0, vy: 0, vz: 0, yaw: m.p.yaw, pitch: m.p.pitch, onGround: false, fallStart: m.p.y, fly: false };
      $("nameIn").value = $("name2").value = m.name; store.set("bv-name", m.name);
      $("appTitle").textContent = `BlockVerse — ${m.name}`;
      sendJ({ type: "mode", creative: $("creativeIn").checked });
      break;
    case "inv": inv = m.inv; drawHotbar(); if (openUI) drawInv(); break;
    case "stat": {
      const wasCreative = stat.creative; stat = m; drawBars();
      $("creative2").checked = $("creativeIn").checked = m.creative;
      $("mCreative").classList.toggle("check", m.creative);
      $("tabCreative").hidden = !m.creative;
      if (!m.creative && me) me.fly = false;
      $("dead").hidden = !m.dead; $("deadWhy").textContent = m.dead ? `Causa: ${m.why || "desconhecida"}` : "";
      if (m.dead) { document.exitPointerLock?.(); closePanel(true); hideDialogs(); }
      if (wasCreative !== m.creative && openUI) drawInv();
      break;
    }
    case "hurt": $("hurt").style.opacity = 1; setTimeout(() => $("hurt").style.opacity = 0, 180); break;
    case "knock": if (me) { me.vx += m.x; me.vz += m.z; me.vy = 5; } break;
    case "tp": if (me) { me.x = m.x; me.y = m.y; me.z = m.z; me.vx = me.vy = me.vz = 0; me.fallStart = me.y; } break;
    case "msg": toast(m.text); break;
    case "chat": chatLine(m.from, m.text); break;
    case "kicked": toast("Você abriu o jogo em outra aba."); break;
    case "open": openPanel(m.ui); break;
    case "ui": ui = m; if (openUI) drawInv(); break;
    case "furnace": ui.f = m.f; if (openUI?.ui === "furnace") drawFurnace(); break;
    case "tick":
      worldTime = m.time; timeAt = performance.now();
      if (m.sets) for (const [x, y, z, id, meta] of m.sets) setLocal(x, y, z, id, meta);
      syncEntities(others, m.players, r => ({ key: r[0], name: r[1], x: r[2], y: r[3], z: r[4], yaw: r[5], pitch: r[6] }), makePlayerModel);
      syncEntities(mobs, m.mobs, r => ({ key: r[0], type: r[1], x: r[2], y: r[3], z: r[4], yaw: r[5], hurt: r[6] }), makeMobModel);
      syncEntities(arrows, m.arrows, r => ({ key: r[0], x: r[1], y: r[2], z: r[3], vx: r[4], vy: r[5], vz: r[6] }), makeArrowModel);
      break;
  }
}

// ======================= Modelos (jogadores, criaturas, flechas) =======================
const lambert = c => new THREE.MeshLambertMaterial({ color: c });
function boxPart(w, h, d, color, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color)); m.position.set(x, y, z); parent.add(m); return m; }
function nameTag(text) {
  const cv = document.createElement("canvas"), g = cv.getContext("2d"); cv.width = 256; cv.height = 48;
  g.font = "bold 24px Tahoma, Arial, sans-serif"; const w = Math.min(250, g.measureText(text).width + 16);
  g.fillStyle = "#ffffe1"; g.fillRect((256 - w) / 2, 6, w, 36); g.strokeStyle = "#000"; g.lineWidth = 2; g.strokeRect((256 - w) / 2, 6, w, 36);
  g.fillStyle = "#000"; g.textAlign = "center"; g.fillText(text, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })); s.scale.set(2, 0.375, 1); s.renderOrder = 5; return s;
}
function makePlayerModel(e) {
  const g = new THREE.Group(), hue = [...e.key].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  const shirt = new THREE.Color(`hsl(${hue},60%,45%)`);
  boxPart(0.5, 0.7, 0.3, shirt, 0, 1.05, 0, g);
  boxPart(0.48, 0.7, 0.28, 0x2a3a5a, 0, 0.35, 0, g);
  boxPart(0.2, 0.7, 0.2, shirt, -0.35, 1.05, 0, g); boxPart(0.2, 0.7, 0.2, shirt, 0.35, 1.05, 0, g);
  const head = new THREE.Group(); head.position.y = 1.62; g.add(head);
  boxPart(0.45, 0.45, 0.45, 0xe8b88a, 0, 0, 0, head); boxPart(0.1, 0.08, 0.02, 0x222222, -0.1, 0.04, -0.23, head); boxPart(0.1, 0.08, 0.02, 0x222222, 0.1, 0.04, -0.23, head);
  g.userData.head = head;
  const tag = nameTag(e.name); tag.position.y = 2.2; g.add(tag);
  return g;
}
const MOB_SIZE = { capybara: [0.9, 0.9], chicken: [0.5, 0.7], sheep: [0.9, 1.2], shade: [0.6, 1.9], crawler: [1.1, 0.6] };
function makeMobModel(e) {
  const g = new THREE.Group(), legs = [];
  const eye = c => new THREE.MeshBasicMaterial({ color: c });
  if (e.type === "capybara") {
    boxPart(0.7, 0.55, 1.1, 0x8a5e3a, 0, 0.55, 0, g); boxPart(0.5, 0.45, 0.45, 0x7a5232, 0, 0.75, 0.7, g); boxPart(0.42, 0.2, 0.15, 0x3a2414, 0, 0.68, 0.95, g);
    for (const [x, z] of [[-0.25, -0.4], [0.25, -0.4], [-0.25, 0.4], [0.25, 0.4]]) legs.push(boxPart(0.16, 0.3, 0.16, 0x6a4428, x, 0.15, z, g));
  } else if (e.type === "chicken") {
    boxPart(0.4, 0.4, 0.5, 0xf4f4f0, 0, 0.45, 0, g); boxPart(0.25, 0.3, 0.25, 0xf4f4f0, 0, 0.75, 0.25, g); boxPart(0.12, 0.08, 0.12, 0xf0a020, 0, 0.72, 0.43, g); boxPart(0.08, 0.12, 0.08, 0xd02020, 0, 0.92, 0.25, g);
    legs.push(boxPart(0.06, 0.25, 0.06, 0xf0a020, -0.1, 0.12, 0, g), boxPart(0.06, 0.25, 0.06, 0xf0a020, 0.1, 0.12, 0, g));
  } else if (e.type === "sheep") {
    boxPart(0.75, 0.65, 1.0, 0xeeeeee, 0, 0.75, 0, g); boxPart(0.38, 0.38, 0.38, 0x4a4a4a, 0, 0.95, 0.6, g); boxPart(0.42, 0.18, 0.2, 0xeeeeee, 0, 1.15, 0.55, g);
    for (const [x, z] of [[-0.22, -0.35], [0.22, -0.35], [-0.22, 0.35], [0.22, 0.35]]) legs.push(boxPart(0.16, 0.45, 0.16, 0x4a4a4a, x, 0.22, z, g));
  } else if (e.type === "crawler") {
    boxPart(0.7, 0.4, 0.8, 0x2a1a14, 0, 0.45, -0.15, g); boxPart(0.45, 0.35, 0.4, 0x3a2418, 0, 0.45, 0.4, g);
    for (const x of [-0.12, 0.12]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), eye(0xff2020)); m.position.set(x, 0.5, 0.61); g.add(m); }
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) { const l = boxPart(0.6, 0.07, 0.07, 0x1a100c, side * 0.55, 0.4, -0.45 + i * 0.22, g); l.rotation.z = side * -0.5; legs.push(l); }
  } else { // shade
    const dark = 0x241a3a; boxPart(0.5, 0.75, 0.3, dark, 0, 1.1, 0, g);
    legs.push(boxPart(0.22, 0.75, 0.26, 0x1a1228, -0.12, 0.38, 0, g), boxPart(0.22, 0.75, 0.26, 0x1a1228, 0.12, 0.38, 0, g));
    boxPart(0.18, 0.8, 0.18, dark, -0.34, 1.05, 0.25, g).rotation.x = -1.2; boxPart(0.18, 0.8, 0.18, dark, 0.34, 1.05, 0.25, g).rotation.x = -1.2;
    boxPart(0.45, 0.45, 0.45, 0x2e2248, 0, 1.7, 0, g);
    for (const x of [-0.11, 0.11]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), eye(0xff3fd8)); m.position.set(x, 1.74, 0.23); g.add(m); }
  }
  g.userData.legs = legs;
  return g;
}
function makeArrowModel() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), lambert(0xb07a40)); g.add(shaft);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.1), lambert(0x9a9aa8)); tip.position.z = 0.33; g.add(tip);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), lambert(0xffffff)); fl.position.z = -0.25; g.add(fl);
  return g;
}
function syncEntities(map, rows, parse, make) {
  const seen = new Set();
  for (const r of rows || []) {
    const e = parse(r); seen.add(e.key);
    let o = map.get(e.key);
    if (!o) { o = { ...e, model: make(e), rx: e.x, ry: e.y, rz: e.z, ryaw: e.yaw || 0 }; scene.add(o.model); map.set(e.key, o); }
    Object.assign(o, e);
  }
  for (const [k, o] of map) if (!seen.has(k)) { scene.remove(o.model); map.delete(k); }
}
function animateEntities(dt, t) {
  const k = 1 - Math.exp(-dt * 12);
  for (const map of [others, mobs]) for (const o of map.values()) {
    const moving = Math.hypot(o.x - o.rx, o.z - o.rz) > 0.01;
    o.rx += (o.x - o.rx) * k; o.ry += (o.y - o.ry) * k; o.rz += (o.z - o.rz) * k;
    let dy = o.yaw - o.ryaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.ryaw += dy * k;
    o.model.position.set(o.rx, o.ry, o.rz);
    o.model.rotation.y = o.ryaw;
    if (o.model.userData.head) o.model.userData.head.rotation.x = -(o.pitch || 0);
    const legs = o.model.userData.legs || [];
    legs.forEach((l, i) => { if (o.type !== "crawler") l.rotation.x = moving ? Math.sin(t * 9 + (i % 2) * Math.PI) * 0.6 : 0; });
    const red = o.hurt ? 0.6 : 0;
    o.model.traverse(m => { if (m.material?.emissive) m.material.emissive.setRGB(red, 0, 0); });
  }
  for (const a of arrows.values()) {
    a.rx += (a.x - a.rx) * k; a.ry += (a.y - a.ry) * k; a.rz += (a.z - a.rz) * k;
    a.model.position.set(a.rx, a.ry, a.rz);
    if (Math.hypot(a.vx, a.vy, a.vz) > 0.1) a.model.lookAt(a.rx + a.vx, a.ry + a.vy, a.rz + a.vz);
  }
}

// ======================= Entrada =======================
const keys = {};
let locked = false, mouseL = false, digTarget = null, digProg = 0, actCd = 0, lastSpace = 0, bowStart = 0, chatOpen = false;
let sens = +store.get("bv-sens", "25") / 10000;
$("nameIn").value = store.get("bv-name", "");
const setDist = v => { $("distIn").value = $("dist2").value = v; $("distV").textContent = $("dist2V").textContent = v; store.set("bv-dist", v); };
setDist(store.get("bv-dist", "4"));
const viewDist = () => +$("dist2").value;
$("distIn").oninput = () => setDist($("distIn").value);
$("dist2").oninput = () => setDist($("dist2").value);
$("fovIn").value = camera.fov; $("fovV").textContent = camera.fov;
$("fovIn").oninput = () => { camera.fov = +$("fovIn").value; $("fovV").textContent = camera.fov; camera.updateProjectionMatrix(); store.set("bv-fov", camera.fov); };
$("sensIn").value = Math.round(sens * 10000); $("sensV").textContent = $("sensIn").value;
$("sensIn").oninput = () => { sens = +$("sensIn").value / 10000; $("sensV").textContent = $("sensIn").value; store.set("bv-sens", $("sensIn").value); };
$("play").onclick = () => { started = true; $("start").hidden = true; hello(); lock(); };
$("helpBtn").onclick = () => showDialog("help");
$("creative2").onchange = () => sendJ({ type: "mode", creative: $("creative2").checked });
$("creativeIn").onchange = () => { if (started) sendJ({ type: "mode", creative: $("creativeIn").checked }); };
$("optOk").onclick = () => {
  const n = $("name2").value.trim();
  if (n && n !== $("nameIn").value) { sendJ({ type: "name", name: n }); store.set("bv-name", n); $("nameIn").value = n; $("appTitle").textContent = `BlockVerse — ${n}`; toast("Nome salvo — os outros veem o novo nome quando você reentrar."); }
  $("options").hidden = true; if (started) lock();
};
$("respawn").onclick = () => { sendJ({ type: "respawn" }); $("dead").hidden = true; lock(); };
$("invClose").onclick = () => closePanel();
function lock() { if (!started || !$("dead").hidden) return; canvas.requestPointerLock?.(); }

// ---------- Janelas e menus (Win98) ----------
const DIALOGS = ["pause", "options", "help", "about"];
function hideDialogs() { for (const d of DIALOGS) $(d).hidden = true; }
function showDialog(id) { hideDialogs(); closeMenus(); if (id === "options") $("name2").value = $("nameIn").value; $(id).hidden = false; document.exitPointerLock?.(); }
function closeMenus() { document.querySelectorAll(".dropdown").forEach(d => d.hidden = true); document.querySelectorAll(".menubar .mi").forEach(m => m.classList.remove("open")); }
document.querySelectorAll(".menubar .mi").forEach(mi => {
  const open = () => { closeMenus(); const d = $(mi.dataset.menu); d.hidden = false; d.style.left = `${mi.offsetLeft}px`; mi.classList.add("open"); };
  mi.onmousedown = e => { e.stopPropagation(); if (mi.classList.contains("open")) closeMenus(); else { document.exitPointerLock?.(); open(); } };
  mi.onmouseenter = () => { if (document.querySelector(".menubar .mi.open")) open(); };
});
document.addEventListener("mousedown", e => { if (!e.target.closest(".dropdown")) closeMenus(); }, true);
function act(a) {
  closeMenus();
  if (a === "resume") { hideDialogs(); lock(); }
  else if (a === "inv") { if (started && !stat.dead) openInventory(); }
  else if (a === "home") { sendJ({ type: "home" }); hideDialogs(); lock(); }
  else if (a === "creative") sendJ({ type: "mode", creative: !stat.creative });
  else if (a === "close") closeGame();
  else if (a === "full") toggleFull();
  else showDialog(a);
}
document.querySelectorAll("[data-act]").forEach(el => el.addEventListener("click", () => act(el.dataset.act)));
document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", () => { $(el.dataset.close).hidden = true; if (started && !openUI) $("pause").hidden = false; }));
$("tbMin").onclick = () => { document.exitPointerLock?.(); if (started) showDialog("pause"); };
$("tbMax").onclick = () => toggleFull();
$("tbClose").onclick = () => closeGame();
function toggleFull() {
  if (document.fullscreenElement) return document.exitFullscreen();
  $("app").requestFullscreen?.().catch(() => { try { parent.document.getElementById("btn-max")?.click(); } catch {} });
}
function closeGame() { try { if (window.top !== window) { window.top.location.hash = "#/"; return; } } catch {} history.back(); }

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { hideDialogs(); closePanel(true); closeMenus(); }
  else if (started && !openUI && !chatOpen && $("dead").hidden && DIALOGS.every(d => $(d).hidden)) $("pause").hidden = false;
  mouseL = false; bowStart = 0;
});
canvas.addEventListener("click", () => { if (started && !locked && !openUI) lock(); });
document.addEventListener("mousemove", e => {
  if (!locked || !me) return;
  me.yaw -= e.movementX * sens; me.pitch -= e.movementY * sens;
  me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch));
});
document.addEventListener("mousedown", e => {
  if (!locked) return;
  if (e.button === 0) { mouseL = true; tryAttack(); }
  if (e.button === 2) { if (ITEM[heldId()]?.bow) bowStart = performance.now(); else rightClick(); }
});
document.addEventListener("mouseup", e => {
  if (e.button === 0) { mouseL = false; digTarget = null; digProg = 0; }
  if (e.button === 2 && bowStart) shootBow();
});
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("wheel", e => { if (locked) { sel = (sel + (e.deltaY > 0 ? 1 : 8)) % 9; selChanged(); } });
document.addEventListener("keydown", e => {
  if (chatOpen) {
    if (e.key === "Enter") { const t = $("chatin").value.trim(); if (t) sendJ({ type: "chat", text: t }); closeChat(); }
    else if (e.key === "Escape") closeChat();
    return;
  }
  if (openUI && (e.code === "KeyE" || e.key === "Escape")) { closePanel(); e.preventDefault(); return; }
  if (!locked) return;
  keys[e.code] = true;
  if (e.code.startsWith("Digit") && e.code !== "Digit0") { sel = +e.code.slice(5) - 1; selChanged(); }
  if (e.code === "KeyE") openInventory();
  if (e.code === "KeyT" || e.key === "Enter") { e.preventDefault(); openChat(); }
  if (e.code === "KeyH") sendJ({ type: "home" });
  if (e.code === "KeyF" && stat.creative) { me.fly = !me.fly; toast(me.fly ? "Voo ligado" : "Voo desligado"); }
  if (e.code === "Space") { const now = performance.now(); if (stat.creative && now - lastSpace < 300) me.fly = !me.fly; lastSpace = now; }
  if (["Space", "Tab"].includes(e.code)) e.preventDefault();
});
document.addEventListener("keyup", e => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
function openChat() { chatOpen = true; $("chatin").style.display = "block"; $("chatin").value = ""; document.exitPointerLock(); setTimeout(() => $("chatin").focus(), 0); }
function closeChat() { chatOpen = false; $("chatin").style.display = "none"; $("chatin").blur(); lock(); }
function selChanged() { drawHotbar(); sendJ({ type: "sel", slot: sel }); digTarget = null; digProg = 0; bowStart = 0; }
function openInventory() { sendJ({ type: "openinv" }); ui = { cursor: null, grid: [], size: 2, result: null, f: null, chest: null }; openPanel("inventory"); }

// ======================= Física do jogador =======================
const PW = 0.3, PH = 1.8, EYE = 1.62;
function collidesAt(x, y, z) {
  for (let bx = Math.floor(x - PW); bx <= Math.floor(x + PW); bx++)
    for (let by = Math.floor(y); by <= Math.floor(y + PH - 0.001); by++)
      for (let bz = Math.floor(z - PW); bz <= Math.floor(z + PW); bz++) {
        const h = solidH(bx, by, bz);
        if (h && y < by + h - 0.0001) return true;
      }
  return false;
}
const cell = (dy) => getB(Math.floor(me.x), Math.floor(me.y + dy), Math.floor(me.z));
function physics(dt) {
  if (!me || stat.dead) return;
  if (!chunks.has(ckey(Math.floor(me.x / CS), Math.floor(me.z / CS)))) return; // espera o chunk chegar
  const feet = cell(0.1), body = cell(0.9), head = cell(EYE);
  const liquid = isLiq(feet) ? feet : isLiq(body) ? body : 0;
  const lava = liquid === LAVA;
  $("water").style.display = head === WATER ? "block" : "none";
  $("lavafx").style.display = head === LAVA ? "block" : "none";
  const ladder = BLOCKS[feet]?.climb || BLOCKS[body]?.climb;
  let fx = 0, fz = 0;
  if (locked) { if (keys.KeyW) fz -= 1; if (keys.KeyS) fz += 1; if (keys.KeyA) fx -= 1; if (keys.KeyD) fx += 1; }
  const moving = fx || fz;
  const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len;
  const sprint = keys.ShiftLeft && !me.fly && fz < 0 && !liquid;
  const speed = me.fly ? 11 : lava ? 1.4 : liquid ? 2.8 : sprint ? 5.8 : 4.3;
  const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
  const wx = (fx * cos + fz * sin) * speed, wz = (-fx * sin + fz * cos) * speed;
  const onIce = me.onGround && getB(Math.floor(me.x), Math.floor(me.y - 0.05), Math.floor(me.z)) === 34;
  const acc = me.fly || liquid ? 1 - Math.exp(-dt * 12) : me.onGround ? 1 - Math.exp(-dt * (onIce ? 2 : 18)) : 1 - Math.exp(-dt * 3);
  me.vx += (wx - me.vx) * acc; me.vz += (wz - me.vz) * acc;
  if (me.fly) {
    me.vy = ((keys.Space ? 1 : 0) - (keys.ShiftLeft ? 1 : 0)) * 9;
  } else if (ladder) {
    me.vy = keys.Space || (keys.KeyW && locked) ? 3.2 : keys.ShiftLeft ? 0 : Math.max(me.vy - 28 * dt, -2.4);
  } else if (liquid) {
    me.vy -= (lava ? 6 : 9) * dt; me.vy *= Math.exp(-dt * 2.5);
    if (keys.Space) me.vy = Math.min(me.vy + 26 * dt, lava ? 2 : 3.6);
    if (me.vy < -4) me.vy = -4;
  } else {
    me.vy -= 28 * dt; if (me.vy < -40) me.vy = -40;
    if (keys.Space && me.onGround) me.vy = 8.6;
  }
  me.sprint = sprint && Math.hypot(me.vx, me.vz) > 4;
  const step = (axis, d) => {
    const n = { x: me.x, y: me.y, z: me.z }; n[axis] += d;
    if (!collidesAt(n.x, n.y, n.z)) { me[axis] = n[axis]; return false; }
    return true;
  };
  const steps = Math.ceil(Math.max(Math.abs(me.vx), Math.abs(me.vy), Math.abs(me.vz)) * dt / 0.3) || 1;
  const wasGround = me.onGround; me.onGround = false;
  let blocked = false;
  for (let s = 0; s < steps; s++) {
    if (step("x", me.vx * dt / steps)) { me.vx = 0; blocked = true; }
    if (step("z", me.vz * dt / steps)) { me.vz = 0; blocked = true; }
    if (step("y", me.vy * dt / steps)) {
      if (me.vy < 0) { me.onGround = true; me.y = snapDown(); }
      me.vy = 0;
    }
  }
  // sair da água/lava: encostado na beirada e tentando andar ou nadar, dá um impulso para subir no bloco
  if (liquid && blocked && (moving || keys.Space) && !collidesAt(me.x, me.y + 1.2, me.z)) me.vy = Math.max(me.vy, lava ? 8 : 9.2);
  // na superfície (cabeça fora d'água), o espaço funciona como pulo
  if (liquid && !isLiq(head) && keys.Space && me.vy < 4 && solidUnderWater()) me.vy = 6.5;
  if (me.onGround && !wasGround && !me.fly) {
    const fall = me.fallStart - me.y;
    if (fall > 3.5 && !stat.creative && !liquid) sendJ({ type: "fall", dmg: Math.floor(fall - 3) });
  }
  if (me.onGround || me.fly || liquid || ladder || me.vy > 0) me.fallStart = me.y;
}
function solidUnderWater() { return collidesAt(me.x, me.y - 0.6, me.z); } // há chão perto dos pés (água rasa)
function snapDown() { let y = me.y; for (let i = 0; i < 20 && !collidesAt(me.x, y - 0.02, me.z); i++) y -= 0.02; return y; }

// ======================= Mira =======================
function lookDir() { const cp = Math.cos(me.pitch); return new THREE.Vector3(-Math.sin(me.yaw) * cp, Math.sin(me.pitch), -Math.cos(me.yaw) * cp); }
function raycast(maxD = REACH, liquids = false) {
  const o = camera.position, d = lookDir();
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
  let n = [0, 0, 0], t = 0;
  while (t <= maxD) {
    const id = getB(x, y, z);
    if (id > 0 && (liquids || !isLiq(id))) return { x, y, z, id, n, t };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}
function mobHit() {
  const o = camera.position, d = lookDir(); let best = null;
  for (const m of mobs.values()) {
    const [w, h] = MOB_SIZE[m.type] || [0.6, 1];
    const mn = [m.rx - w / 2, m.ry, m.rz - w / 2], mx = [m.rx + w / 2, m.ry + h, m.rz + w / 2];
    let t0 = 0, t1 = 4.5;
    for (let a = 0; a < 3; a++) {
      const oo = [o.x, o.y, o.z][a], dd = [d.x, d.y, d.z][a];
      if (Math.abs(dd) < 1e-6) { if (oo < mn[a] || oo > mx[a]) { t0 = 1e9; break; } continue; }
      let ta = (mn[a] - oo) / dd, tb = (mx[a] - oo) / dd; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    if (t0 <= t1 && (!best || t0 < best.t)) best = { mob: m, t: t0 };
  }
  return best;
}
function tryAttack() {
  const h = mobHit(), b = raycast();
  if (h && (!b || h.t < b.t) && actCd <= 0) { sendJ({ type: "attack", mob: h.mob.key, slot: sel }); actCd = 0.35; mouseL = false; }
}
const heldId = () => inv[sel]?.[0];
function shootBow() {
  const power = Math.min(1, (performance.now() - bowStart) / 900); bowStart = 0;
  if (power < 0.15) return;
  const d = lookDir(); sendJ({ type: "shoot", dir: [d.x, d.y, d.z], power, slot: sel });
}
function rightClick() {
  if (actCd > 0 || !me) return; actCd = 0.2;
  const held = heldId(), it = ITEM[held];
  if (held === 116) { // balde vazio: mira na água
    const w = raycast(REACH, true);
    if (w && w.id === WATER) return sendJ({ type: "use", x: w.x, y: w.y, z: w.z, slot: sel });
  }
  const hit = raycast();
  if (hit) {
    const b = BLOCKS[hit.id];
    if (b.use && !keys.ShiftLeft) return sendJ({ type: "use", x: hit.x, y: hit.y, z: hit.z, slot: sel });
    if (it?.tool === "enxada" && (hit.id === 1 || hit.id === 2 || hit.id === 32)) return sendJ({ type: "use", x: hit.x, y: hit.y, z: hit.z, slot: sel });
    if (held && (placeable(held) || it?.plants || held === 117)) {
      const into = b.replaceable;
      const p = into ? [hit.x, hit.y, hit.z] : [hit.x + hit.n[0], hit.y + hit.n[1], hit.z + hit.n[2]];
      if (BLOCKS[held]?.solid && !into && collidesPlayer(p, BLOCKS[held].ch ?? 1)) return;
      return sendJ({ type: "place", x: p[0], y: p[1], z: p[2], slot: sel, yaw: me.yaw, n: hit.n });
    }
  }
  if (it?.food) sendJ({ type: "eat", slot: sel });
}
const collidesPlayer = ([x, y, z], h = 1) => me.x + PW > x && me.x - PW < x + 1 && me.z + PW > z && me.z - PW < z + 1 && me.y < y + h && me.y + PH > y;

const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
scene.add(selBox);
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
scene.add(crack);
function setBar(p) { $("dig").style.display = p == null ? "none" : "block"; if (p != null) $("dig").firstElementChild.style.width = `${Math.min(100, p * 100)}%`; }
function updateDig(dt) {
  const hit = locked ? raycast() : null;
  selBox.visible = !!hit; crack.visible = false;
  if (bowStart) { const p = Math.min(1, (performance.now() - bowStart) / 900); setBar(p); camera.fov = +$("fovIn").value - 12 * p; camera.updateProjectionMatrix(); }
  else { if (camera.fov !== +$("fovIn").value) { camera.fov = +$("fovIn").value; camera.updateProjectionMatrix(); } setBar(null); }
  if (!hit) { digTarget = null; return; }
  selBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  if (!mouseL || stat.dead) return;
  const key = `${hit.x},${hit.y},${hit.z}`;
  if (digTarget !== key) { digTarget = key; digProg = 0; }
  const time = stat.creative ? 0.12 : digTime(hit.id, heldId());
  if (!isFinite(time)) return;
  digProg += dt / Math.max(0.05, time);
  if (!stat.creative) { crack.visible = true; crack.position.copy(selBox.position); crack.material.opacity = Math.min(0.55, digProg * 0.6); setBar(digProg); }
  if (digProg >= 1) {
    sendJ({ type: "break", x: hit.x, y: hit.y, z: hit.z, slot: sel });
    const above = getB(hit.x, hit.y + 1, hit.z);
    setLocal(hit.x, hit.y, hit.z, AIR, 0);
    if (above > 0 && ["cross", "slab", "small", "door", "cactus"].includes(BLOCKS[above].shape)) setLocal(hit.x, hit.y + 1, hit.z, AIR, 0);
    digTarget = null; digProg = 0;
  }
}

// ======================= HUD =======================
let toastT = null;
function toast(t) { const el = $("toast"); el.textContent = t; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 2800); }
function chatLine(from, text) {
  const d = document.createElement("div"); d.className = "tip98";
  const b = document.createElement("b"); b.textContent = from === "★" ? "★ " : `${from}: `;
  d.append(b, document.createTextNode(text)); $("chatlog").append(d);
  while ($("chatlog").children.length > 8) $("chatlog").firstChild.remove();
  setTimeout(() => { d.style.opacity = 0; }, 12000);
}
function slotEl(st, cls = "") {
  const d = document.createElement("div"); d.className = `slot ${cls}`;
  if (st) { const im = new Image(); im.src = iconURL(st[0], atlasCanvas); d.append(im); if (st[1] > 1) { const s = document.createElement("small"); s.textContent = st[1]; d.append(s); } d.dataset.tip = itemName(st[0]); }
  return d;
}
function drawHotbar() {
  $("hotbar").replaceChildren(...inv.slice(0, 9).map((st, i) => slotEl(st, i === sel ? "sel" : "")));
  $("held").textContent = inv[sel] ? itemName(inv[sel][0]) : "";
}
function iconRow(kind, value, max = 20) {
  return Array.from({ length: max / 2 }, (_, i) => { const v = value - i * 2, im = new Image(); im.src = hudIcon(kind, v >= 2 ? "full" : v === 1 ? "half" : "empty"); return im; });
}
function drawBars() {
  if (stat.creative) { $("hp").replaceChildren(); $("food").replaceChildren(); $("air").replaceChildren(); return; }
  $("hp").replaceChildren(...iconRow("heart", stat.hp));
  $("food").replaceChildren(...iconRow("food", stat.food).reverse());
  const air = stat.air ?? 15;
  $("air").replaceChildren(...(air < 15 ? Array.from({ length: Math.ceil(air / 1.5) }, () => { const im = new Image(); im.src = hudIcon("bubble", "full"); return im; }) : []));
}

// ---------- Inventário / crafting (grade com cursor) / fornalha / baú ----------
function openPanel(kind) {
  openUI = { ui: kind };
  document.exitPointerLock?.(); hideDialogs(); closeMenus();
  $("inv").hidden = false;
  $("invTitle").textContent = { workbench: "Bancada", furnace: "Fornalha", chest: "Baú" }[kind] || "Inventário";
  $("craftBox").hidden = kind === "furnace" || kind === "chest"; $("furnBox").hidden = kind !== "furnace"; $("chestBox").hidden = kind !== "chest";
  $("craftLegend").textContent = kind === "workbench" ? "Crafting (3×3)" : "Crafting (2×2)";
  showTab("book"); drawInv();
}
function closePanel(silent) {
  if (!openUI) return;
  sendJ({ type: "close" });
  openUI = null; ui.cursor = null; $("inv").hidden = true; $("tip").style.display = "none"; $("cursor").hidden = true;
  if (!silent) lock();
}
function showTab(t) {
  $("tabBook").setAttribute("aria-selected", t === "book"); $("tabCreative").setAttribute("aria-selected", t === "creative");
  $("recipes").hidden = t !== "book"; $("palette").hidden = t !== "creative";
  if (t === "creative") drawPalette();
}
$("tabBook").onclick = () => showTab("book");
$("tabCreative").onclick = () => showTab("creative");
/** Um espaço clicável: esquerdo pega/solta/junta, direito pega metade/solta 1, Shift move rápido. */
function clickable(el, slot) {
  el.onmousedown = e => { e.preventDefault(); sendJ({ type: "click", slot, button: e.button, shift: e.shiftKey }); };
  return el;
}
function drawInv() {
  if (!openUI) return;
  $("invGrid").replaceChildren(...Array.from({ length: 27 }, (_, k) => clickable(slotEl(inv[k + 9]), k + 9)));
  $("invHot").replaceChildren(...Array.from({ length: 9 }, (_, k) => clickable(slotEl(inv[k], k === sel ? "sel" : ""), k)));
  const g = $("cgrid"); g.style.gridTemplateColumns = `repeat(${ui.size}, 38px)`;
  g.replaceChildren(...Array.from({ length: ui.size ** 2 }, (_, i) => clickable(slotEl(ui.grid?.[i]), `g${i}`)));
  $("cout").replaceChildren(clickable(slotEl(ui.result, ui.result ? "ready" : ""), "out"));
  if (openUI.ui === "chest") $("chestGrid").replaceChildren(...Array.from({ length: 27 }, (_, i) => clickable(slotEl(ui.chest?.[i]), `k${i}`)));
  if (openUI.ui === "furnace") drawFurnace();
  drawRecipes(); drawCursor();
}
let mouseXY = [0, 0];
function drawCursor() {
  const c = $("cursor");
  if (!openUI || !ui.cursor) { c.hidden = true; return; }
  c.hidden = false; c.replaceChildren(...[...slotEl(ui.cursor).childNodes]);
  c.style.left = `${mouseXY[0] - 19}px`; c.style.top = `${mouseXY[1] - 19}px`;
}
$("trash").onmousedown = e => { e.preventDefault(); sendJ({ type: "click", slot: "trash" }); };
const count = id => inv.reduce((a, s) => a + (s && s[0] === id ? s[1] : 0), 0) + (ui.grid || []).reduce((a, s) => a + (s && s[0] === id ? s[1] : 0), 0);
function miniIcon(id, size = 16) { const i = new Image(); i.src = iconURL(id, atlasCanvas); i.width = i.height = size; i.title = itemName(id); return i; }
function drawRecipes() {
  const list = RECIPES.map((r, i) => ({ ...r, i })).filter(r => r.shape);
  const fits = r => r.w <= ui.size && r.h <= ui.size;
  const has = r => r.need.every(([id, n]) => count(id) >= n);
  list.sort((a, b) => (fits(b) && has(b)) - (fits(a) && has(a)));
  const els = list.map(r => {
    const ok = fits(r) && has(r), d = document.createElement("div"); d.className = `rec ${ok ? "" : "no"}`;
    const name = document.createElement("span"); name.textContent = `${itemName(r.out[0])}${r.out[1] > 1 ? ` ×${r.out[1]}` : ""}`;
    const pat = document.createElement("div"); pat.className = "pat"; pat.style.gridTemplateColumns = `repeat(${r.w}, 16px)`;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const ch = r.shape[y][x] ?? " "; const c = document.createElement("i"); if (ch !== " ") c.append(miniIcon(r.key[ch])); pat.append(c); }
    const tag = document.createElement("small"); tag.className = "where"; tag.textContent = !fits(r) ? "bancada" : !has(r) ? "faltam itens" : "";
    d.append(miniIcon(r.out[0], 24), name, tag, pat);
    d.title = ok ? "Clique para colocar os ingredientes na grade" : !fits(r) ? "Precisa da bancada (grade 3×3)" : "Você não tem todos os ingredientes";
    if (ok) d.onclick = () => sendJ({ type: "fill", r: r.i });
    return d;
  });
  const h = document.createElement("h4"); h.textContent = "Fornalha (fundição)";
  const furn = RECIPES.filter(r => r.where === "furnace").map(r => { const d = document.createElement("div"); d.className = "rec no2"; const t = document.createElement("span"); t.textContent = `${itemName(r.need[0][0])} → ${itemName(r.out[0])}`; d.append(miniIcon(r.need[0][0], 24), t, miniIcon(r.out[0], 24)); return d; });
  $("recipes").replaceChildren(...els, h, ...furn);
}
function drawPalette() {
  const ids = [...BLOCKS.filter(b => placeable(b.id)).map(b => b.id), ...Object.values(ITEM).filter(i => i.item).map(i => i.id)];
  $("palette").replaceChildren(...ids.map(id => { const el = slotEl([id, 1]); el.onmousedown = e => { e.preventDefault(); sendJ({ type: "give", id }); }; return el; }));
}
function drawFurnace() {
  const f = ui.f || {};
  for (const [k, slot] of [["in", "fin"], ["fuel", "ffuel"], ["out", "fout"]]) document.querySelector(`#furn [data-f="${k}"]`).replaceChildren(clickable(slotEl(f[k]), slot));
  $("furnProg").firstElementChild.style.width = `${Math.min(100, (f.prog || 0) / 5 * 100)}%`;
  $("furnFlame").classList.toggle("on", f.burn > 0);
}
document.addEventListener("mousemove", e => {
  mouseXY = [e.clientX, e.clientY];
  if (openUI && ui.cursor) { $("cursor").style.left = `${e.clientX - 19}px`; $("cursor").style.top = `${e.clientY - 19}px`; }
  const t = e.target.closest?.("[data-tip]"), tip = $("tip");
  if (!openUI || ui.cursor || !t || !t.dataset.tip) { tip.style.display = "none"; return; }
  tip.textContent = t.dataset.tip; tip.style.display = "block"; tip.style.left = `${e.clientX + 14}px`; tip.style.top = `${e.clientY + 16}px`;
});

// ======================= Laço =======================
const skyDay = new THREE.Color(0x87c6ff), skyNight = new THREE.Color(0x070b1e), skyDusk = new THREE.Color(0xff8a5a), tmp = new THREE.Color();
const skyWater = new THREE.Color(0x1a3a7a), skyLava = new THREE.Color(0x8a2a00);
let last = performance.now(), posT = 0, chunkT = 0, infoT = 0, fps = 0, frames = 0, fpsT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  actCd -= dt;
  if (me) {
    physics(dt);
    camera.position.set(me.x, me.y + EYE, me.z);
    camera.rotation.set(me.pitch, me.yaw, 0);
    updateDig(dt);
    posT -= dt;
    if (posT <= 0) { posT = 0.1; sendJ({ type: "pos", x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), sprint: me.sprint }); }
    chunkT -= dt; if (chunkT <= 0) { chunkT = 0.25; manageChunks(); }
  }
  if (dirty.size && me) { // meshes pendentes: os mais próximos primeiro, poucos por quadro
    const pcx = Math.floor(me.x / CS), pcz = Math.floor(me.z / CS);
    const list = [...dirty].filter(k => chunks.has(k)).map(k => { const [a, b] = k.split(",").map(Number); return [k, Math.hypot(a - pcx, b - pcz)]; }).sort((a, b) => a[1] - b[1]);
    for (const k of [...dirty]) if (!chunks.has(k)) dirty.delete(k);
    const t0 = performance.now();
    for (const [k] of list) { remesh(chunks.get(k)); dirty.delete(k); if (performance.now() - t0 > 12) break; }
  }
  const t = worldTime + (now - timeAt), day = daylight(t), ph = ((t % DAY_MS) / DAY_MS) * Math.PI * 2;
  const dusk = Math.max(0, 1 - Math.abs(Math.sin(ph)) * 3) * (day > 0.05 ? 1 : 0);
  tmp.copy(skyNight).lerp(skyDay, day).lerp(skyDusk, dusk * 0.45);
  const underW = $("water").style.display === "block", underL = $("lavafx").style.display === "block";
  scene.background = underL ? skyLava : underW ? skyWater : tmp;
  uniforms.uDay.value = 0.12 + day * 0.88; uniforms.fogColor.value.copy(scene.background);
  const far = viewDist() * CS; uniforms.fogNear.value = underL ? 0.5 : underW ? 2 : far * 0.6; uniforms.fogFar.value = underL ? 4 : underW ? 18 : far * 0.95;
  amb.intensity = 0.25 + day * 0.6; sun.intensity = day * 0.8;
  if (me) {
    const sx = Math.cos(ph) * 150, sy = Math.sin(ph) * 150;
    sunSprite.position.set(me.x + sx, me.y + sy, me.z); sunSprite.lookAt(camera.position);
    moonSprite.position.set(me.x - sx, me.y - sy, me.z); moonSprite.lookAt(camera.position);
    sun.position.set(sx, Math.max(20, sy), 40);
  }
  animateEntities(dt, now / 1000);
  if (!me) scene.background = skyNight;
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT >= 1) { fps = frames; frames = 0; fpsT = 0; }
  infoT -= dt; if (infoT <= 0 && me) { infoT = 0.25; drawStatus(t); }
}
function drawStatus(t) {
  const frac = (t % DAY_MS) / DAY_MS, hours = (frac * 24 + 6) % 24;
  const hh = String(Math.floor(hours)).padStart(2, "0"), mm = String(Math.floor((hours % 1) * 60)).padStart(2, "0");
  const hit = locked ? raycast() : null;
  $("stPos").textContent = `X ${me.x.toFixed(0)}  Y ${me.y.toFixed(0)}  Z ${me.z.toFixed(0)}`;
  $("stTime").textContent = `${hh}:${mm} ${daylight(t) < 0.25 ? "noite" : "dia"}`;
  $("stPlayers").textContent = `${others.size + 1} jogador(es) · ${mobs.size} criaturas`;
  $("stTarget").textContent = hit ? `${itemName(hit.id)}${BLOCKS[hit.id].crop ? ` — crescimento ${Math.min(8, getM(hit.x, hit.y, hit.z) + 1)}/8` : ""}${hit.id === 21 ? ` — energia ${getM(hit.x, hit.y, hit.z)}` : ""}` : "Pronto";
  $("stFps").textContent = `${fps} qps`;
}
function manageChunks() {
  const pcx = Math.floor(me.x / CS), pcz = Math.floor(me.z / CS), R = viewDist();
  const want = [];
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dz * dz > (R + 0.5) ** 2) continue;
    const k = ckey(pcx + dx, pcz + dz); if (!chunks.has(k) && !requested.has(k)) want.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
  }
  want.sort((a, b) => a[2] - b[2]);
  const batch = want.slice(0, Math.max(0, 12 - requested.size)).map(([a, b]) => [a, b]);
  if (batch.length) { for (const [a, b] of batch) requested.add(ckey(a, b)); sendJ({ type: "chunks", list: batch }); }
  for (const [k, c] of chunks) if (Math.abs(c.cx - pcx) > R + 2 || Math.abs(c.cz - pcz) > R + 2) {
    for (const m of ["mesh", "water"]) if (c[m]) { scene.remove(c[m]); c[m].geometry.dispose(); }
    chunks.delete(k); dirty.delete(k);
  }
  for (const k of requested) { const [a, b] = k.split(",").map(Number); if (Math.abs(a - pcx) > R + 2 || Math.abs(b - pcz) > R + 2) requested.delete(k); }
}

const logo = iconURL(1, atlasCanvas);
$("logo").src = $("logo2").src = logo;
$("titleIco").src = logo;
drawHotbar(); drawBars();
connect();
requestAnimationFrame(loop);
window.__bv = { get me() { return me; }, chunks, mobs, others, arrows, get inv() { return inv; }, get stat() { return stat; }, get ui() { return ui; }, sendJ, raycast, getB, getM, keys, setSel: i => { sel = i; selChanged(); }, openInventory, setLocked: v => { locked = v; } };
