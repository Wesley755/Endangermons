// Bamboo forest battle background (320x240) + ground platforms (128x64 / 256x32), PSDK naming.
const fs = require('fs');
const path = require('path');
const { Img } = require('./png');
const { rng, mix, leaf, culm, hash, PAL, ellipse } = require('./draw');
const OUT = process.argv[2] || 'out';
const dir = path.join(OUT, 'graphics/battlebacks'); fs.mkdirSync(dir, { recursive: true });

const W = 320, H = 240, R = rng(99);
const bg = new Img(W, H);
// misty jade sky-light gradient, banded like the stock PSDK backs
const top = [196, 232, 206], mid = [120, 186, 150], low = [70, 140, 104];
for (let y = 0; y < H; y++) {
  const t = y / H;
  const c = t < 0.5 ? mix(top, mid, t / 0.5) : mix(mid, low, (t - 0.5) / 0.5);
  for (let x = 0; x < W; x++) bg.setRaw(x, y, hash(x >> 2, y >> 2, 3) < 0.5 && (y & 3) === 0 ? mix(c, top, 0.05) : c);
}
// layers of culms: far (pale, thin) -> near (bright, thick)
const layers = [
  { n: 34, w: [2, 3], pal: { o: [126, 176, 146], d: [140, 190, 158], m: [156, 204, 170], l: [168, 212, 178], hl: [184, 222, 190], n: [132, 182, 150], nl: [176, 218, 186], base: [120, 160, 130] }, leafA: 90, fill: [[150, 200, 166], [162, 210, 176]], ground: 150 },
  { n: 22, w: [3, 4], pal: { o: [74, 128, 92], d: [96, 150, 104], m: [124, 176, 120], l: [144, 192, 132], hl: [176, 214, 156], n: [82, 134, 92], nl: [160, 204, 146], base: [90, 110, 80] }, leafA: 150, fill: [[96, 156, 110], [112, 170, 120]], ground: 160 },
  { n: 12, w: [5, 7], pal: PAL.culm, leafA: 255, fill: [PAL.leaf.m, PAL.leaf.m2, PAL.leaf.l], ground: 176 },
];
function floor() {
  for (let y = 164; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (y - 164) / (H - 164), h = hash(x >> 2, y >> 1, 8);
    const base = mix([132, 196, 150], PAL.floor.dark, Math.pow(t, 0.8));
    bg.px(x, y, h < 0.06 ? mix(base, PAL.floor.dark2, 0.5) : base, y < 170 ? (y - 163) * 36 : 255);
  }
  for (let k = 0; k < 55; k++) leaf(bg, R() * W, 180 + R() * 60, R() * 6.28, 5 + R() * 3, 2.4, PAL.litter[(R() * 4) | 0], PAL.litterDark);
}
for (const L of layers) {
  if (L === layers[2]) floor();
  for (let k = 0; k < L.n; k++) {
    const x0 = R() * W, w = L.w[0] + ((R() * (L.w[1] - L.w[0] + 1)) | 0), lean = (R() - 0.5) * 14;
    const pal = L === layers[2] && R() < 0.3 ? PAL.culmOld : L.pal;
    const xAt = (y) => x0 + (lean * (L.ground - y)) / L.ground;
    culm(bg, xAt, -2, L.ground + ((R() * 8) | 0), w, pal, { spacing: 18 + ((R() * 10) | 0), phase: (R() * 20) | 0 });
    for (let y = 8 + R() * 30; y < L.ground - 50; y += 22 + R() * 20) {
      const side = R() < 0.5 ? -1 : 1, x = xAt(y) + (side > 0 ? w + 4 : -4);
      for (let i = 0; i < 5; i++) {
        const f = L.fill[(R() * L.fill.length) | 0];
        leaf(bg, x, y, Math.PI / 2 + (i - 2) * 0.5 + side * -0.4, 10 + R() * 6 + w, 3 + w * 0.35, f, L === layers[2] ? PAL.leaf.dk : null, { alpha: L.leafA, hl: L === layers[2] && f === PAL.leaf.l ? PAL.leaf.hl : null });
      }
    }
  }
  // haze between layers
  if (L !== layers[2]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bg.px(x, y, [190, 228, 204], 40 + (y > 120 ? 20 : 0));
}
// canopy fringe across the top
for (let k = 0; k < 60; k++) { const f = [PAL.leaf.dk, PAL.leaf.m, PAL.leaf.m2][(R() * 3) | 0]; leaf(bg, R() * W, -4 + R() * 16, Math.PI / 2 + (R() - 0.5) * 1.6, 14 + R() * 10, 5, f, PAL.leaf.o); }

// light shafts
for (const [x0, wd] of [[60, 26], [170, 18], [250, 30]]) for (let y = 0; y < 200; y++) for (let x = 0; x < wd; x++) bg.px(x0 + x + y * 0.35, y, [255, 252, 220], 26 * (1 - y / 200));
bg.save(path.join(dir, 'back_bamboo.png'));

// ground platforms, matching the stock ground_* style (ellipse with a soft rim)
function platform(w, h, file, depthy) {
  const g = new Img(w, h); const cx = w / 2, cy = h / 2, rx = w / 2 - 1, ry = h / 2 - 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
    if (d > 1) continue;
    const hh = hash(x >> 1, y >> 1, 21);
    let c = d > 0.86 ? [64, 120, 80] : d > 0.7 ? PAL.floor.light : hh < 0.1 ? PAL.floor.dark : hh > 0.94 ? PAL.floor.light2 : PAL.floor.base;
    if (d <= 0.7 && dy > 0.2) c = mix(c, PAL.floor.dark, 0.25);
    g.setRaw(x, y, c);
  }
  const R2 = rng(w + h);
  for (let k = 0; k < w / 6; k++) { const a = R2() * 6.28, r = Math.sqrt(R2()) * 0.75; leaf(g, cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry, R2() * 6.28, 5 + R2() * 2, 2.2, PAL.litter[(R2() * 4) | 0], PAL.litterDark); }
  g.save(path.join(dir, file));
}
platform(128, 64, 'ground_bamboo.png');
platform(256, 32, 'ground_bamboo_back.png');
console.log('battleback ok');
