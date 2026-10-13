// Generates Endangermon-Bamboo.png (32x32 tiles, 16 columns) + tile index json + Tiled .tsx with wang sets.
const fs = require('fs');
const path = require('path');
const { Img } = require('./png');
const { hash, rng, mix, PAL, leaf, culm, spray, line, ellipse, outline } = require('./draw');

const OUT = process.argv[2] || 'out';
const T = 32, COLS = 16, ROWS = 11;
const sheet = new Img(COLS * T, ROWS * T);
const ids = {};
const put = (name, col, row, tile) => { sheet.blit(tile, 0, 0, T, T, col * T, row * T); ids[name] = row * COLS + col; };
const putBig = (name, col, row, img) => {
  const w = img.w / T, h = img.h / T; ids[name] = [];
  for (let j = 0; j < h; j++) { const r = []; for (let i = 0; i < w; i++) { sheet.blit(img, i * T, j * T, T, T, (col + i) * T, (row + j) * T); r.push((row + j) * COLS + col + i); } ids[name].push(r); }
};
const TAU = Math.PI * 2;
const per = (t, a, f, s) => a * Math.sin((t / 32) * TAU * f + s); // periodic over 32px

// ---------------- blob masks ----------------
const B = { N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128 };
function reduce(m) {
  if (!(m & B.N && m & B.E)) m &= ~B.NE;
  if (!(m & B.E && m & B.S)) m &= ~B.SE;
  if (!(m & B.S && m & B.W)) m &= ~B.SW;
  if (!(m & B.W && m & B.N)) m &= ~B.NW;
  return m;
}
const BLOB = [...new Set([...Array(256).keys()].map(reduce))].sort((a, b) => a - b);
if (BLOB.length !== 47) throw new Error('blob count ' + BLOB.length);
const wangid = (m) => [B.N, B.NE, B.E, B.SE, B.S, B.SW, B.W, B.NW].map((b) => (m & b ? 1 : 0)).join(',');

function shapeFn(m, o) {
  const N = m & B.N, E = m & B.E, S = m & B.S, W = m & B.W;
  const rag = (t, s) => Math.round(1 + per(t, 0.8, 2, s) + per(t, 0.6, 5, s * 2));
  const top = (x) => (N ? -99 : o.top + rag(x, 1));
  const left = (y) => (W ? -99 : o.side + rag(y, 2));
  const right = (y) => (E ? 99 : 31 - o.side - rag(y, 3));
  const bot = (x) => (S ? 99 : o.bottom === 'face' ? 30 : 31 - o.side - rag(x, 4));
  return (x, y) => {
    if (y < top(x) || x < left(y) || x > right(y) || y > bot(x)) return false;
    const ch = o.chamfer;
    if (!N && !W && x - left(y) + (y - top(x)) < ch) return false;
    if (!N && !E && right(y) - x + (y - top(x)) < ch) return false;
    if (o.bottom !== 'face') {
      if (!S && !W && x - left(y) + (bot(x) - y) < ch) return false;
      if (!S && !E && right(y) - x + (bot(x) - y) < ch) return false;
    }
    const n = o.notch;
    if (N && W && !(m & B.NW) && x + y < n) return false;
    if (N && E && !(m & B.NE) && 31 - x + y < n) return false;
    if (S && W && !(m & B.SW) && x + 31 - y < n) return false;
    if (S && E && !(m & B.SE) && 31 - x + 31 - y < n) return false;
    return true;
  };
}

// ---------------- canopy & face textures (seamless 32x32) ----------------
const L = PAL.leaf;
// a fan of drooping bamboo leaves hanging from one twig point (wraps for seamless textures)
function fan(t, x, y, n, fills, R, len = 8, wrap = 32) {
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.62 + (R() - 0.5) * 0.25;
    const f = fills[(R() * fills.length) | 0];
    leaf(t, x, y, a, len + R() * 3, 3, f, L.o, { hl: f === L.l ? L.hl : null, wrap });
  }
}
function canopyTexture() {
  const t = new Img(32, 32); t.rect(0, 0, 32, 32, [24, 62, 44]);
  const R = rng(77);
  for (let k = 0; k < 12; k++) fan(t, R() * 32, R() * 32, 4, [[32, 84, 54], [38, 96, 58]], R, 8);
  // culm segments seen between the sprays
  for (const [x, y0, y1, p] of [[5, 3, 13, PAL.culmDark], [21, 15, 25, PAL.culmDark], [13, 24, 31, PAL.culmDark]]) culm(t, () => x, y0, y1, 3, p, { spacing: 6, phase: y0 + 2, bulge: false });
  for (let k = 0; k < 9; k++) fan(t, R() * 32, R() * 32, 4, [L.m, L.m2], R, 8);
  for (let k = 0; k < 6; k++) fan(t, R() * 32, R() * 32, 3, [L.m2, L.l, L.l], R, 7);
  return t;
}
function faceTexture() {
  const t = new Img(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) t.setRaw(x, y, mix(PAL.gap, [34, 70, 46], y / 40));
  for (const [x, ph] of [[5, 3], [14, 7], [23, 1]]) culm(t, () => x, 0, 30, 3, PAL.culmDark, { spacing: 9, phase: ph, bulge: false });
  const front = [[0, 4, PAL.culm, 2], [9, 5, PAL.culm, 6], [18, 4, PAL.culmOld, 9], [26, 5, PAL.culm, 4]];
  for (const [x, w, p, ph] of front) culm(t, () => x, 0, 30, w, p, { spacing: 10, phase: ph, base: true });
  const R = rng(5);
  for (const x of [3, 11, 19, 27]) fan(t, x + R() * 3, 1 + R() * 3, 4, [[30, 80, 52], L.m, L.m2], R, 7);
  for (const [x, y, d] of [[13, 22, 0.5], [30, 19, 2.6], [22, 25, 0.3]]) for (let k = 0; k < 3; k++) {
    const f = [L.m2, L.l, L.m][k];
    leaf(t, x, y, d + (R() - 0.5) * 1.2, 6 + R() * 2, 2.4, f, L.dk, { hl: f === L.l ? L.hl : null, wrap: 32 });
  }
  return t;
}
const CAN = canopyTexture(), FACE = faceTexture();
// interior variants: identical to CAN near the borders (so they tile with every blob tile), different in the middle
function canopyVariant(seed) {
  const t = new Img(32, 32); t.blit(CAN, 0, 0, 32, 32, 0, 0);
  const extra = new Img(32, 32); const R = rng(seed);
  for (let k = 0; k < 4; k++) fan(extra, 9 + R() * 14, 7 + R() * 12, 3 + ((R() * 2) | 0), k < 2 ? [[32, 84, 54], L.m] : [L.m2, L.l], R, 6, 0);
  if (seed % 2) culm(extra, () => 10 + ((R() * 12) | 0), 6, 18, 3, PAL.culmDark, { spacing: 6, phase: 2, bulge: false });
  for (let y = 3; y < 29; y++) for (let x = 3; x < 29; x++) { const c = extra.get(x, y); if (c[3]) t.px(x, y, c); }
  return t;
}

function thicketTile(m) {
  const img = new Img(32, 32);
  const inside = shapeFn(m, { top: 3, side: 2, bottom: 'face', chamfer: 3, notch: 4 });
  const S = m & B.S, N = m & B.N;
  const edgeY = (x) => 7 + Math.round(2 + per(x, 1.6, 3, 0.7) + per(x, 1.2, 7, 2.1));
  const face = (x, y) => !S && y >= edgeY(x);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!inside(x, y)) continue;
    if (face(x, y)) {
      let c = FACE.get(x, y);
      if (!inside(x - 1, y) || !inside(x + 1, y)) c = mix(c, PAL.gap, 0.6);
      img.setRaw(x, y, c);
      continue;
    }
    let c = CAN.get(x, y);
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1) || face(x, y + 1);
    if (edge) c = L.o;
    else if (!N && !inside(x, y - 2)) c = mix(c, L.hl, 0.45);
    else if (!S && face(x, y + 2)) c = mix(c, L.o, 0.35);
    img.setRaw(x, y, c);
  }
  return img;
}

function dirtTexture() {
  const t = new Img(32, 32); const D = PAL.dirt;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const h = hash(x, y, 9);
    t.setRaw(x, y, h < 0.07 ? D.dark : h < 0.1 ? D.light : D.base);
  }
  const R = rng(31);
  for (let k = 0; k < 6; k++) { const x = (R() * 30) | 0, y = (R() * 30) | 0; t.setRaw(x, y, D.light); t.setRaw(x + 1, y, D.light); t.setRaw(x, y + 1, D.dark2); t.setRaw(x + 1, y + 1, D.dark); }
  for (let k = 0; k < 3; k++) { const x = R() * 32, y = R() * 32; leaf(t, x, y, R() * 6.28, 5, 2, PAL.litter[(R() * 3) | 0], PAL.litterDark, { wrap: 32 }); }
  return t;
}
const DIRT = dirtTexture();
function pathTile(m) {
  const img = new Img(32, 32);
  const inside = shapeFn(m, { top: 2, side: 2, bottom: 'round', chamfer: 4, notch: 4 });
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const ins = inside(x, y);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (ins) {
      const edge = nb.some(([dx, dy]) => !inside(x + dx, y + dy));
      const edge2 = !edge && nb.some(([dx, dy]) => !inside(x + 2 * dx, y + 2 * dy));
      let c = DIRT.get(x, y);
      if (edge) c = mix(c, PAL.dirt.rim, 0.75); else if (edge2) c = mix(c, PAL.dirt.dark, 0.5);
      img.setRaw(x, y, c);
    } else if (nb.some(([dx, dy]) => inside(x + dx, y + dy))) img.setRaw(x, y, [...PAL.floor.dark2, 150]);
  }
  return img;
}

// ---------------- ground ----------------
function floorTile(v) {
  const F = PAL.floor; const img = new Img(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const h = hash(x, y, 100 + v), h2 = hash(x >> 1, y >> 1, 300);
    img.setRaw(x, y, h < 0.05 ? F.dark : h > 0.97 ? F.light : h2 < 0.18 ? mix(F.base, F.dark, 0.35) : F.base);
  }
  const R = rng(500 + v * 17);
  // HGSS-like grass tufts
  for (let k = 0; k < 5; k++) {
    const x = 2 + ((R() * 26) | 0), y = 3 + ((R() * 25) | 0);
    img.setRaw(x, y, F.dark2); img.setRaw(x + 2, y, F.dark2); img.setRaw(x + 1, y + 1, F.dark2);
    img.setRaw(x, y - 1, F.light2); img.setRaw(x + 2, y - 1, F.light);
  }
  if (v >= 4) for (let k = 0; k < 2 + (v % 2); k++) { // fallen bamboo leaves
    const x = 5 + R() * 22, y = 5 + R() * 22;
    leaf(img, x, y, R() * 6.28, 5 + R() * 2, 2.2, PAL.litter[(R() * 4) | 0], PAL.litterDark);
  }
  return img;
}
function litterTile(v) {
  const img = new Img(32, 32); const R = rng(900 + v * 13);
  const n = [4, 6, 3, 8][v];
  for (let k = 0; k < n; k++) {
    const x = 4 + R() * 24, y = 4 + R() * 24;
    leaf(img, x + 0.6, y + 0.8, R() * 6.28, 6 + R() * 2, 2.4, [...PAL.floor.dark2, 120]);
    leaf(img, x, y, R() * 6.28, 6 + R() * 2.5, 2.4, PAL.litter[(R() * 5) | 0], PAL.litterDark);
  }
  return img;
}
function undergrowthTile(v) {
  // dwarf bamboo undergrowth (use with the "Grass" system tag for optional encounters)
  const img = new Img(32, 32); const R = rng(1200 + v);
  const tuft = (bx, by, fills, n, len) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42 + (R() - 0.5) * 0.2;
      const f = fills[(R() * fills.length) | 0];
      const lx = bx + Math.cos(a) * 1.5, ly = by;
      for (const ox of [-32, 0, 32]) leaf(img, lx + ox, ly, a, len + R() * 3, 3.2, f, L.dk, { hl: f === L.l ? L.hl : null });
    }
  };
  const off = v ? 5 : 0;
  for (const x of [0, 11, 22]) tuft(x + off + 5, 21, [[34, 88, 56], L.m], 5, 10);
  for (const x of [0, 11, 22]) tuft(x + off, 30, [L.m2, L.l, L.l], 5, 12);
  // dark base so the tile reads as dense growth
  for (let x = 0; x < 32; x++) for (let y = 27; y < 32; y++) if (img.get(x, y)[3]) img.setRaw(x, y, mix(img.get(x, y), L.dk, 0.35));
  outline(img, L.o);
  return img;
}
function fernTile(v) {
  const img = new Img(32, 32); const R = rng(1300 + v);
  const cx = 16, cy = 25;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.45 + (R() - 0.5) * 0.2;
    const len = 11 + R() * 3;
    for (let t = 2; t < len; t += 2) {
      const x = cx + Math.cos(a) * t, y = cy + Math.sin(a) * t * 0.9;
      const sz = 3.6 * (1 - t / len) + 1.4;
      leaf(img, x, y, a - 1.2, sz, 1.8, v ? L.l : L.m2, L.dk);
      leaf(img, x, y, a + 1.2, sz, 1.8, v ? L.m2 : L.l, L.dk);
    }
    line(img, cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.9, L.dk);
  }
  outline(img, L.o);
  return img;
}

// ---------------- clue tiles ----------------
const FIB = [236, 226, 172], FIB2 = [208, 194, 132];
function chewedStump(img, x, yTop, yBot, w, pal, R) {
  culm(img, () => x, yTop, yBot, w, pal, { spacing: 7, phase: yBot - 3, base: true });
  for (let i = 0; i < w; i++) { // jagged bitten top
    const d = (R() * 3) | 0;
    for (let k = 0; k < d; k++) img.setRaw(x + i, yTop + k, [0, 0, 0, 0]);
    img.setRaw(x + i, yTop + d, i === 0 || i === w - 1 ? FIB2 : FIB);
    if (R() < 0.4) img.setRaw(x + i, yTop + d - 1, FIB);
  }
  img.setRaw(x + (w >> 1), yTop + 2, [120, 110, 70]);
}
function chewed(v) {
  const img = new Img(32, 32); const R = rng(1500 + v);
  ellipse(img, 16, 27, 12, 3.5, [...PAL.shadow, 80]);
  if (v === 0) {
    chewedStump(img, 7, 13, 28, 4, PAL.culm, R);
    chewedStump(img, 14, 9, 29, 5, PAL.culm, R);
    chewedStump(img, 22, 16, 28, 4, PAL.culmOld, R);
  } else {
    chewedStump(img, 10, 15, 28, 5, PAL.culm, R);
    // snapped top lying on the ground, stripped of leaves
    culm(img, (y) => 30 - y, 20, 26, 3, PAL.culmOld, { spacing: 4, phase: 0 });
    for (let x = 17; x < 30; x++) { img.setRaw(x, 25 + ((x * 3) % 2), FIB2); }
    line(img, 16, 24, 29, 22, PAL.culm.m); line(img, 16, 25, 29, 23, PAL.culm.d); line(img, 16, 23, 29, 21, PAL.culm.hl);
    img.setRaw(16, 23, FIB); img.setRaw(16, 24, FIB); img.setRaw(16, 25, FIB2);
  }
  for (let k = 0; k < 5; k++) { // chewed fragments + spat-out bits
    const x = 3 + R() * 26, y = 26 + R() * 4;
    line(img, x, y, x + 2 + R() * 2, y, R() < 0.5 ? FIB : PAL.culm.l);
  }
  for (let k = 0; k < 3; k++) leaf(img, 4 + R() * 24, 25 + R() * 5, R() * 6.28, 5, 2, PAL.litter[(R() * 3) | 0], PAL.litterDark);
  return img;
}
function chewedPile() {
  const img = new Img(32, 32); const R = rng(1600);
  ellipse(img, 16, 20, 12, 7, [...PAL.shadow, 60]);
  for (let k = 0; k < 9; k++) {
    const x = 6 + R() * 18, y = 12 + R() * 12, len = 5 + R() * 4, a = (R() - 0.5) * 1.4;
    const p = R() < 0.6 ? PAL.culm : PAL.culmOld;
    for (let t = 0; t < len; t++) {
      const xx = Math.round(x + Math.cos(a) * t), yy = Math.round(y + Math.sin(a) * t);
      img.setRaw(xx, yy - 1, p.hl); img.setRaw(xx, yy, p.m); img.setRaw(xx, yy + 1, p.d); img.setRaw(xx, yy + 2, p.o);
    }
    img.setRaw(Math.round(x), Math.round(y), FIB); img.setRaw(Math.round(x), Math.round(y) + 1, FIB2);
    const ex = Math.round(x + Math.cos(a) * len), ey = Math.round(y + Math.sin(a) * len);
    img.setRaw(ex, ey, FIB); img.setRaw(ex, ey + 1, FIB2);
  }
  for (let k = 0; k < 5; k++) leaf(img, 5 + R() * 22, 10 + R() * 16, R() * 6.28, 6, 2.2, PAL.litter[(R() * 4) | 0], PAL.litterDark);
  return img;
}
function droppings(old) {
  const img = new Img(32, 32); const R = rng(old ? 1701 : 1700);
  const c = old ? { m: [138, 130, 104], d: [98, 92, 74], h: [172, 164, 136], f: [190, 182, 150] } : { m: [132, 142, 72], d: [88, 98, 48], h: [174, 182, 104], f: [206, 204, 140] };
  const pts = [[11, 15], [18, 13], [15, 20], [21, 19]];
  for (const [x, y] of pts) ellipse(img, x + 0.5, y + 2, 4, 2, [...PAL.shadow, 80]);
  for (const [x, y] of pts) {
    ellipse(img, x, y, 3.6, 2.6, c.d); ellipse(img, x - 0.3, y - 0.4, 2.8, 1.8, c.m);
    img.setRaw(x - 2, y - 1, c.h); img.setRaw(x - 1, y - 2, c.h);
    for (let k = 0; k < 3; k++) img.setRaw(x - 2 + ((R() * 4) | 0), y - 1 + ((R() * 3) | 0), c.f); // undigested bamboo fibre
  }
  if (old) for (let k = 0; k < 2; k++) leaf(img, 6 + R() * 20, 8 + R() * 18, R() * 6.28, 6, 2.2, PAL.litter[1], PAL.litterDark);
  return img;
}
function pawprints() {
  // two panda prints walking "up"
  const img = new Img(32, 32);
  const imp = [36, 82, 56], deep = [26, 62, 44], rim = [140, 206, 150];
  const print = (cx, cy) => {
    ellipse(img, cx, cy + 2.5, 4, 3, imp, 235);
    ellipse(img, cx + 0.5, cy + 3.2, 2.4, 1.6, deep, 235);
    for (const [dx, dy] of [[-4.5, -1.5], [-2.6, -4], [0, -5], [2.6, -4], [4.5, -1.5]]) ellipse(img, cx + dx, cy + dy, 1.2, 1.2, imp, 235);
    for (let i = -3; i <= 3; i++) img.px(Math.round(cx + i), Math.round(cy + 6), rim, 170);
  };
  print(10, 21); print(21, 9);
  return img;
}
const rot = (src, q) => { const o = new Img(32, 32); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { let sx = x, sy = y; for (let i = 0; i < q; i++) { const t = sx; sx = sy; sy = 31 - t; } o.setRaw(x, y, src.get(sx, sy)); } return o; };
function shoots(v) {
  const img = new Img(32, 32); const R = rng(1800 + v);
  const sh = { o: [70, 48, 26], d: [118, 82, 44], m: [156, 116, 64], l: [192, 156, 96], tip: [134, 184, 84] };
  const list = v ? [[9, 26, 9], [19, 28, 13], [25, 24, 7]] : [[12, 27, 12], [21, 25, 8]];
  for (const [cx, by, h] of list) ellipse(img, cx, by, 5, 2, [...PAL.shadow, 90]);
  for (const [cx, by, h] of list) {
    for (let y = 0; y < h; y++) {
      const hw = Math.max(0.6, 3.2 * (y / h));
      const yy = by - h + y;
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        let c = x <= cx - hw + 1 ? sh.l : x >= cx + hw - 1 ? sh.d : sh.m;
        if ((yy + (x > cx ? 1 : 0)) % 4 === 0) c = sh.d; // sheath bands
        img.setRaw(x, yy, c);
      }
    }
    img.setRaw(cx, by - h - 1, sh.tip); img.setRaw(cx, by - h - 2, sh.tip); img.setRaw(cx + 1, by - h - 1, L.l);
  }
  outline(img, sh.o, (c) => c[0] > 100 && c[2] < 120);
  return img;
}
function sign() {
  const img = new Img(32, 32);
  const W = { o: [70, 44, 24], d: [118, 78, 42], m: [164, 116, 66], l: [200, 156, 98] };
  ellipse(img, 16, 29, 7, 2, [...PAL.shadow, 90]);
  img.rect(14, 16, 4, 13, W.d); img.rect(14, 16, 1, 13, W.l);
  img.rect(4, 5, 24, 13, W.o); img.rect(5, 6, 22, 11, W.m); img.rect(5, 6, 22, 1, W.l); img.rect(5, 16, 22, 1, W.d);
  // tiny panda face pictogram + text lines
  ellipse(img, 10, 11.5, 3.2, 3, [240, 236, 224]); img.setRaw(8, 8, [30, 30, 34]); img.setRaw(12, 8, [30, 30, 34]); img.setRaw(9, 11, [30, 30, 34]); img.setRaw(11, 11, [30, 30, 34]); img.setRaw(10, 13, [30, 30, 34]);
  img.rect(15, 9, 10, 1, W.o); img.rect(15, 12, 8, 1, W.o); img.rect(15, 14, 9, 1, W.o);
  return img;
}
function fence(kind) {
  const img = new Img(32, 32);
  const rail = (y, x0, x1) => { for (let x = x0; x <= x1; x++) { const node = x % 11 === 3; img.setRaw(x, y, node ? PAL.culmOld.n : PAL.culmOld.hl); img.setRaw(x, y + 1, node ? PAL.culmOld.n : PAL.culmOld.m); img.setRaw(x, y + 2, PAL.culmOld.o); } };
  const post = (x) => { culm(img, () => x, 8, 29, 5, PAL.culmOld, { spacing: 8, phase: 3, base: true }); for (let i = 0; i < 5; i++) img.setRaw(x + i, 8, PAL.culmOld.o); img.rect(x + 1, 9, 3, 1, FIB2); };
  if (kind === 'M') { for (let x = 0; x < 32; x++) img.setRaw(x, 30, [...PAL.shadow, 70]); rail(13, 0, 31); rail(21, 0, 31); post(14); }
  if (kind === 'L') { rail(13, 16, 31); rail(21, 16, 31); post(13); }
  if (kind === 'R') { rail(13, 0, 15); rail(21, 0, 15); post(14); }
  // rope ties
  for (const x of kind === 'M' ? [14] : kind === 'L' ? [13] : [14]) for (const y of [13, 21]) { img.setRaw(x + 1, y + 1, [150, 110, 70]); img.setRaw(x + 3, y + 1, [150, 110, 70]); img.setRaw(x + 2, y, [190, 150, 100]); }
  return img;
}
function shadowTile(s, e) {
  const img = new Img(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    let a = 0;
    if (s) a = Math.max(a, [150, 118, 84, 52, 24][y + Math.round(per(x, 0.7, 3, 1))] || 0);
    if (e) a = Math.max(a, [110, 70, 34][x + Math.round(per(y, 0.6, 3, 2))] || 0);
    if (a) img.setRaw(x, y, [...PAL.shadow, a]);
  }
  return img;
}

// ---------------- multi-tile objects ----------------
function clump(seed, culms, w = 64, h = 96) {
  const img = new Img(w, h); const R = rng(seed); const base = h - 6;
  ellipse(img, w / 2, base + 1, w / 2 - 4, 4.5, [...PAL.shadow, 85]);
  ellipse(img, w / 2, base, w / 2 - 14, 3, [86, 76, 46]);
  // back leaf sprays (darker) first
  for (const c of culms) for (let y = c.top + 4; y < base - 26; y += 7) {
    const xa = c.x + (c.lean * (base - y)) / (base - c.top);
    const side = R() < 0.5 ? -1 : 1;
    fan(img, xa + c.w / 2 + side * 5, y, 5, [[30, 80, 52], [36, 92, 56], L.m], R, 9, 0);
  }
  for (const c of culms) {
    const xAt = (y) => c.x + (c.lean * (base - y)) / (base - c.top);
    culm(img, xAt, c.top, base, c.w, c.pal || PAL.culm, { spacing: c.sp || 11, phase: c.ph || 2, taper: 6, base: true });
  }
  // twigs and front leaf sprays along the upper part
  for (const c of culms) {
    const xAt = (y) => c.x + (c.lean * (base - y)) / (base - c.top);
    for (let y = c.top + 2; y < base - 32; y += c.sp || 11) {
      const side = R() < 0.5 ? -1 : 1, x0 = xAt(y) + (side > 0 ? c.w : -1);
      const tx = x0 + side * (4 + R() * 4), ty = y - 1 - R() * 3;
      line(img, x0, y, tx, ty, PAL.culm.d);
      fan(img, tx, ty, 4 + ((R() * 2) | 0), [L.m, L.m2, L.l], R, 9, 0);
    }
    fan(img, xAt(c.top) + c.w / 2, c.top + 1, 5, [L.m2, L.l, L.l], R, 8, 0);
  }
  // little shoot and fallen leaves at the base
  for (let k = 0; k < 4; k++) leaf(img, 10 + R() * (w - 20), base - 1 + R() * 4, R() * 6.28, 5, 2, PAL.litter[(R() * 3) | 0], PAL.litterDark);
  return img;
}
function boulder() {
  const img = new Img(64, 64); const R = rng(2100);
  const st = { o: [52, 60, 62], d: [92, 102, 104], m: [128, 138, 136], l: [164, 172, 168], hl: [196, 202, 196] };
  ellipse(img, 33, 56, 27, 6, [...PAL.shadow, 95]);
  const r = (x, y) => { const dx = (x - 32) / 26, dy = (y - 36) / 22; return dx * dx + dy * dy * (y > 36 ? 1.6 : 1) + 0.12 * Math.sin(x * 0.5) * Math.cos(y * 0.4); };
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = r(x, y); if (d > 1) continue;
    const light = (32 - x) * 0.6 + (36 - y) * 0.9 + (hash(x >> 1, y >> 1, 4) - 0.5) * 10;
    img.setRaw(x, y, light > 14 ? st.l : light > 2 ? st.m : light > -12 ? st.d : st.o);
    if (d > 0.86) img.setRaw(x, y, st.o);
  }
  for (const [x0, y0, x1, y1] of [[22, 30, 30, 40], [30, 40, 28, 50], [40, 26, 46, 38]]) line(img, x0, y0, x1, y1, st.o);
  // moss cap with bamboo leaves dropped on top
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (r(x, y) > 0.82 || !img.get(x, y)[3]) continue;
    const mossy = y < 26 + 3 * Math.sin(x * 0.45) + 2 * Math.sin(x * 1.3);
    if (mossy) img.setRaw(x, y, hash(x, y, 7) < 0.25 ? [120, 176, 88] : y < 20 + 2 * Math.sin(x) ? [96, 158, 78] : [72, 132, 66]);
  }
  for (let k = 0; k < 5; k++) leaf(img, 18 + R() * 28, 14 + R() * 12, R() * 6.28, 6, 2.2, PAL.litter[(R() * 4) | 0], PAL.litterDark);
  return img;
}
function nest() {
  // flattened resting spot: a bed of chewed culms and leaves where the panda lies
  const img = new Img(64, 64); const R = rng(2200);
  ellipse(img, 32, 34, 28, 20, [64, 124, 82, 200]);
  for (let k = 0; k < 120; k++) {
    const a = R() * 6.28, rr = Math.sqrt(R());
    const x = 32 + Math.cos(a) * rr * 25, y = 34 + Math.sin(a) * rr * 17;
    leaf(img, x, y, R() * 6.28, 6 + R() * 2, 2.4, PAL.litter[(R() * 5) | 0], PAL.litterDark);
  }
  for (let k = 0; k < 14; k++) { // broken culm pieces around the rim
    const a = R() * 6.28, x = 32 + Math.cos(a) * 24, y = 34 + Math.sin(a) * 16, b = a + Math.PI / 2 + (R() - 0.5);
    const len = 6 + R() * 5, p = R() < 0.5 ? PAL.culm : PAL.culmOld;
    for (let t = 0; t < len; t++) { const xx = Math.round(x + Math.cos(b) * t), yy = Math.round(y + Math.sin(b) * t * 0.6); img.setRaw(xx, yy, p.hl); img.setRaw(xx, yy + 1, p.m); img.setRaw(xx, yy + 2, p.o); }
    img.setRaw(Math.round(x), Math.round(y), FIB);
  }
  return img;
}
function fallen() {
  const img = new Img(64, 32); const R = rng(2300);
  for (let x = 4; x < 62; x++) img.px(x, 25 + (x > 30 ? 1 : 0), PAL.shadow, 70);
  const yAt = (x) => 18 + (x - 4) * 0.08;
  for (let x = 4; x < 60; x++) {
    const y = Math.round(yAt(x)); const node = (x - 6) % 12 === 0;
    const col = node ? [PAL.culmOld.o, PAL.culmOld.n, PAL.culmOld.n, PAL.culmOld.n, PAL.culmOld.o] : [PAL.culmOld.o, PAL.culmOld.hl, PAL.culmOld.l, PAL.culmOld.m, PAL.culmOld.o];
    col.forEach((c, i) => img.setRaw(x, y - 2 + i, c));
  }
  // cut end showing the hollow culm
  const ex = 3, ey = Math.round(yAt(4));
  for (let j = -2; j <= 2; j++) img.setRaw(ex, ey + j, FIB2);
  img.setRaw(ex, ey, [96, 84, 46]); img.setRaw(ex + 1, ey - 2, FIB); img.setRaw(ex + 1, ey + 2, PAL.culmOld.o);
  for (let k = 0; k < 2; k++) spray(img, 46 + k * 10, yAt(50) - 2, -Math.PI / 2 + (k ? 0.6 : -0.6), 3, R, L, { fills: [PAL.litter[0], PAL.litter[1], L.l], len: 7 });
  return img;
}

// ---------------- assemble ----------------
BLOB.forEach((m, i) => put('thicket_' + m, i % 16, (i / 16) | 0, thicketTile(m)));
put('shadowS', 15, 2, shadowTile(1, 0));
for (let v = 1; v <= 3; v++) put('thicketFill' + v, 7 + v, 8, canopyVariant(600 + v));
BLOB.forEach((m, i) => put('path_' + m, i % 16, 3 + ((i / 16) | 0), pathTile(m)));
put('shadowE', 15, 5, shadowTile(0, 1));
for (let v = 0; v < 8; v++) put('floor' + v, v, 6, floorTile(v));
for (let v = 0; v < 4; v++) put('litter' + v, 8 + v, 6, litterTile(v));
put('undergrowth0', 12, 6, undergrowthTile(0)); put('undergrowth1', 13, 6, undergrowthTile(1));
put('fern0', 14, 6, fernTile(0)); put('fern1', 15, 6, fernTile(1));
put('chewedA', 0, 7, chewed(0)); put('chewedB', 1, 7, chewed(1)); put('chewedPile', 2, 7, chewedPile());
put('dropFresh', 3, 7, droppings(false)); put('dropOld', 4, 7, droppings(true));
const pp = pawprints();
put('printU', 5, 7, pp); put('printR', 6, 7, rot(pp, 1)); put('printD', 7, 7, rot(pp, 2)); put('printL', 8, 7, rot(pp, 3));
put('shootsA', 9, 7, shoots(0)); put('shootsB', 10, 7, shoots(1)); put('sign', 11, 7, sign());
put('fenceL', 12, 7, fence('L')); put('fenceM', 13, 7, fence('M')); put('fenceR', 14, 7, fence('R'));
put('shadowSE', 15, 7, shadowTile(1, 1));
putBig('clumpA', 0, 8, clump(11, [{ x: 13, w: 4, top: 12, lean: -7 }, { x: 21, w: 5, top: 2, lean: -3, ph: 5 }, { x: 29, w: 5, top: 0, lean: 1, pal: PAL.culmOld, ph: 8 }, { x: 37, w: 5, top: 5, lean: 4 }, { x: 45, w: 4, top: 16, lean: 8, ph: 6 }]));
putBig('clumpB', 2, 8, clump(23, [{ x: 16, w: 5, top: 4, lean: -5, ph: 3 }, { x: 25, w: 4, top: 14, lean: -1 }, { x: 32, w: 5, top: 1, lean: 2, ph: 7 }, { x: 41, w: 4, top: 10, lean: 7, pal: PAL.culmOld }]));
putBig('clumpC', 4, 8, clump(37, [{ x: 18, w: 4, top: 8, lean: -4, pal: PAL.culmOld }, { x: 26, w: 5, top: 0, lean: 0, ph: 4 }, { x: 35, w: 5, top: 6, lean: 3 }, { x: 43, w: 4, top: 18, lean: 9, ph: 5 }]));
putBig('thinA', 6, 8, clump(41, [{ x: 9, w: 4, top: 3, lean: -2 }, { x: 17, w: 4, top: 10, lean: 3, pal: PAL.culmOld }], 32, 96));
putBig('thinB', 7, 8, clump(43, [{ x: 13, w: 5, top: 1, lean: 1, ph: 6 }], 32, 96));
putBig('boulder', 8, 9, boulder());
putBig('nest', 10, 9, nest());
putBig('fallen', 12, 10, fallen());

fs.mkdirSync(path.join(OUT, 'Data/Tiled/Assets'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'Data/Tiled/Tilesets'), { recursive: true });
sheet.save(path.join(OUT, 'Data/Tiled/Assets/Endangermon-Bamboo.png'));
fs.writeFileSync(path.join(__dirname, 'tile_ids.json'), JSON.stringify({ ids, blob: BLOB }, null, 1));

// ---------------- .tsx with terrain (wang) sets ----------------
const wt = (prefix) => BLOB.filter((m) => m).map((m) => `   <wangtile tileid="${ids[prefix + m]}" wangid="${wangid(m)}"/>`).join('\n');
const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.0" name="Endangermon Bamboo" tilewidth="32" tileheight="32" tilecount="${COLS * ROWS}" columns="${COLS}">
 <image source="../Assets/Endangermon-Bamboo.png" width="${COLS * T}" height="${ROWS * T}"/>
 <wangsets>
  <wangset name="Bamboo thicket (walls)" type="mixed" tile="${ids['thicket_255']}">
   <wangcolor name="Bamboo thicket" color="#2e6b35" tile="${ids['thicket_255']}" probability="1"/>
${wt('thicket_')}
${[1, 2, 3].map((v) => `   <wangtile tileid="${ids['thicketFill' + v]}" wangid="1,1,1,1,1,1,1,1"/>`).join('\n')}
  </wangset>
  <wangset name="Forest trail (dirt)" type="mixed" tile="${ids['path_255']}">
   <wangcolor name="Dirt trail" color="#b89c68" tile="${ids['path_255']}" probability="1"/>
${wt('path_')}
  </wangset>
 </wangsets>
</tileset>
`;
fs.writeFileSync(path.join(OUT, 'Data/Tiled/Tilesets/Endangermon-Bamboo.tsx'), tsx);
console.log('tiles ok', Object.keys(ids).length);
