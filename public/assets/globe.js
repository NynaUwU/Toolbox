// Globo em projeção ortográfica (canvas 2D), no estilo "esfera celeste": fundo preto, grade verde/magenta,
// equador branco com marcações. Arrastar gira, roda do mouse aproxima.
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

export class Globe {
  constructor(canvas, { lat = 0, lon = 0, zoom = 1 } = {}) {
    this.c = canvas; this.lat = lat; this.lon = lon; this.zoom = zoom; this.land = []; this.onDraw = null;
    let drag = null;
    canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, lat: this.lat, lon: this.lon }; canvas.setPointerCapture(e.pointerId); this.follow = null; });
    canvas.addEventListener("pointermove", e => {
      if (!drag) return;
      const k = 90 / (this.R() || 200);
      this.lon = drag.lon - (e.clientX - drag.x) * k; this.lat = Math.max(-89, Math.min(89, drag.lat + (e.clientY - drag.y) * k));
      this.draw();
    });
    canvas.addEventListener("pointerup", () => (drag = null));
    canvas.addEventListener("wheel", e => { e.preventDefault(); this.zoom = Math.max(0.6, Math.min(40, this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); this.draw(); }, { passive: false });
  }
  /** Continentes a partir de um TopoJSON (world-atlas) já convertido com topojson.feature. */
  setLand(geo) {
    this.land = [];
    const add = g => g.type === "Polygon" ? this.land.push(...g.coordinates) : g.type === "MultiPolygon" ? g.coordinates.forEach(p => this.land.push(...p)) : null;
    (geo.features || [geo]).forEach(f => add(f.geometry || f));
  }
  R() { return (Math.min(this.c.width, this.c.height) / 2 - 18) * this.zoom; }
  /** Projeta (lat, lon) → [x, y, visível]. */
  proj(lat, lon) {
    const f = lat * D2R, l = (lon - this.lon) * D2R, f0 = this.lat * D2R, R = this.R();
    const cosc = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l);
    return [this.c.width / 2 + R * Math.cos(f) * Math.sin(l), this.c.height / 2 - R * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l)), cosc >= 0];
  }
  /** Desenha uma linha (lista de [lat, lon]) quebrando onde passa para trás do globo. */
  path(g, pts) {
    let pen = false;
    g.beginPath();
    for (const [la, lo] of pts) { const [x, y, v] = this.proj(la, lo); if (v) { pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; } else pen = false; }
    g.stroke();
  }
  /** Círculo na superfície: centro (lat, lon), raio em graus de arco. */
  static circle(lat, lon, radiusDeg, n = 72) {
    const out = [], f1 = lat * D2R, l1 = lon * D2R, d = radiusDeg * D2R;
    for (let i = 0; i <= n; i++) {
      const b = (i / n) * 2 * Math.PI, f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
      out.push([f2 * R2D, (l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2))) * R2D]);
    }
    return out;
  }
  /** Ponto subsolar aproximado (para a linha dia/noite). */
  static subsolar(date) {
    const d = (date - Date.UTC(2000, 0, 1, 12)) / 864e5, g = (357.529 + 0.98560028 * d) * D2R, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R, e = (23.439 - 0.00000036 * d) * D2R;
    const dec = Math.asin(Math.sin(e) * Math.sin(L)), ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) * R2D;
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24 * 15;
    return [dec * R2D, ((ra - gmst + 540) % 360) - 180];
  }

  nightLayer(W, H, R, sl, so) {
    const key = [W, H, R.toFixed(1), this.lat.toFixed(2), this.lon.toFixed(2), Math.floor(Date.now() / 60000)].join();
    if (this._nightKey === key) return this._night;
    const cv = this._night || document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"); g.clearRect(0, 0, W, H); g.fillStyle = "rgba(0,0,0,0.62)";
    const f0 = this.lat * D2R, sx = Math.cos(sl * D2R) * Math.cos(so * D2R), sy = Math.cos(sl * D2R) * Math.sin(so * D2R), sz = Math.sin(sl * D2R), step = 6;
    for (let py = 0; py < H; py += step) for (let px = 0; px < W; px += step) {
      const x = (px + step / 2 - W / 2) / R, y = -(py + step / 2 - H / 2) / R, rho = Math.hypot(x, y);
      if (rho > 1) continue;
      const c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c);
      const lat = rho ? Math.asin(cc * Math.sin(f0) + (y * sc * Math.cos(f0)) / rho) : f0;
      const lon = this.lon * D2R + Math.atan2(x * sc, rho * cc * Math.cos(f0) - y * sc * Math.sin(f0));
      if (Math.cos(lat) * Math.cos(lon) * sx + Math.cos(lat) * Math.sin(lon) * sy + Math.sin(lat) * sz < 0) g.fillRect(px, py, step, step);
    }
    this._night = cv; this._nightKey = key; return cv;
  }

  draw() {
    const c = this.c, g = c.getContext("2d"), W = c.width, H = c.height, R = this.R(), cx = W / 2, cy = H / 2;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.clip();
    g.fillStyle = "#0c1a24"; g.fillRect(0, 0, W, H); // lado do dia
    // noite: blocos de 6 px pela projeção inversa (recalcula só quando gira, aproxima ou muda o minuto)
    const [sl, so] = Globe.subsolar(new Date());
    g.drawImage(this.nightLayer(W, H, R, sl, so), 0, 0);
    // grade: paralelos (magenta) e meridianos (verde) pontilhados
    g.lineWidth = 1; g.setLineDash([1, 3]);
    for (let la = -75; la <= 75; la += 15) if (la) { g.strokeStyle = "rgba(200,60,200,0.55)"; this.path(g, Array.from({ length: 145 }, (_, i) => [la, -180 + i * 2.5])); }
    for (let lo = -180; lo < 180; lo += 15) { g.strokeStyle = lo === 0 ? "rgba(60,200,60,0.9)" : "rgba(60,180,60,0.45)"; this.path(g, Array.from({ length: 73 }, (_, i) => [-90 + i * 2.5, lo])); }
    g.setLineDash([]);
    // continentes
    g.strokeStyle = "rgba(120,220,140,0.75)"; g.lineWidth = 1;
    for (const ring of this.land) this.path(g, ring.map(([lo, la]) => [la, lo]));
    // terminador (dia/noite)
    g.strokeStyle = "rgba(255,200,60,0.5)"; g.setLineDash([4, 4]); this.path(g, Globe.circle(sl, so, 90, 180)); g.setLineDash([]);
    // equador branco com marcações (como na foto)
    g.strokeStyle = "#fff"; g.lineWidth = 1.5; this.path(g, Array.from({ length: 361 }, (_, i) => [0, -180 + i]));
    g.lineWidth = 1;
    for (let lo = -180; lo < 180; lo += 5) {
      const big = lo % 15 === 0, [x1, y1, v1] = this.proj(big ? 2.2 : 1, lo), [x2, y2, v2] = this.proj(big ? -2.2 : -1, lo);
      if (v1 && v2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    }
    // meridiano de Greenwich com marcações verdes
    g.strokeStyle = "#3c3";
    for (let la = -85; la <= 85; la += 5) { const [x1, y1, v1] = this.proj(la, -1.2), [x2, y2, v2] = this.proj(la, 1.2); if (v1 && v2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); } }
    this.onDraw?.(g, this);
    g.restore();
    // borda da esfera
    g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.stroke();
    this.onOverlay?.(g, this);
  }
}

export const dms = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60); return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"${v >= 0 ? pos : neg}`; };
