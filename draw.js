// Shared pixel-art drawing helpers for the Endangermon bamboo assets.
const { Img } = require('./png');

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [0, 1, 2].map((i) => Math.round(lerp(c1[i], c2[i], t)));

// ---------- palettes ----------
const PAL = {
  // jade bamboo-forest floor (sits next to HGSS teal grass without clashing)
  floor: { base: [88, 162, 116], dark: [70, 138, 98], dark2: [58, 118, 86], light: [112, 184, 132], light2: [136, 202, 146] },
  litter: [[206, 182, 104], [176, 148, 78], [150, 122, 60], [120, 168, 86], [222, 204, 132]],
  litterDark: [104, 84, 44],
  dirt: { base: [184, 156, 104], dark: [156, 128, 82], dark2: [128, 104, 66], light: [206, 182, 132], rim: [122, 112, 74] },
  culm: { o: [36, 70, 38], d: [72, 118, 50], m: [116, 166, 66], l: [150, 196, 84], hl: [198, 226, 126], n: [56, 92, 42], nl: [178, 214, 108], base: [92, 82, 46] },
  culmOld: { o: [78, 68, 30], d: [142, 128, 54], m: [186, 174, 84], l: [212, 202, 114], hl: [236, 230, 160], n: [112, 98, 42], nl: [226, 218, 140], base: [104, 86, 46] },
  culmDark: { o: [24, 50, 32], d: [46, 86, 44], m: [74, 122, 56], l: [98, 146, 64], hl: [134, 178, 88], n: [36, 66, 36], nl: [118, 160, 76], base: [64, 58, 36] },
  leaf: { o: [20, 50, 36], dk: [30, 76, 50], m: [44, 104, 60], m2: [62, 130, 66], l: [98, 162, 78], hl: [146, 200, 102] },
  gap: [20, 46, 34],
  shadow: [14, 38, 26],
};

// Lance-shaped bamboo leaf. ang in radians (0 = pointing right, PI/2 = pointing down).
function leaf(img, x0, y0, ang, len, wid, fill, under, opts = {}) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const r = Math.ceil(len + wid + 2);
  for (let y = Math.floor(y0 - r); y <= y0 + r; y++) for (let x = Math.floor(x0 - r); x <= x0 + r; x++) {
    const dx = x + 0.5 - x0, dy = y + 0.5 - y0;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (u < 0 || u > len) continue;
    const t = u / len;
    const hw = (wid / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.6) + 0.25;
    if (Math.abs(v) > hw) continue;
    let col = fill;
    if (under && v > hw - 0.9 && hw > 0.7) col = under;
    if (opts.hl && v < 0 && t > 0.15 && t < 0.55 && -v > hw - 0.9) col = opts.hl;
    if (opts.wrap) { for (const ox of [-opts.wrap, 0, opts.wrap]) for (const oy of [-opts.wrap, 0, opts.wrap]) { const xx = x + ox, yy = y + oy; if (xx >= 0 && yy >= 0 && xx < opts.wrap && yy < opts.wrap) img.px(xx, yy, col, opts.alpha); } }
    else img.px(x, y, col, opts.alpha);
  }
}

// Vertical bamboo culm. xAt(y) gives the left x for each row (allows leaning).
function culm(img, xAt, yTop, yBot, w, pal, opts = {}) {
  const spacing = opts.spacing || 10, phase = opts.phase || 0;
  for (let y = yTop; y <= yBot; y++) {
    const x = Math.round(xAt(y));
    let ww = w;
    if (opts.taper && y < yTop + opts.taper) ww = Math.max(2, w - Math.ceil(((yTop + opts.taper - y) / opts.taper) * (w - 2)));
    const rowsFromBase = yBot - y;
    const isNode = (y - phase) % spacing === 0 && rowsFromBase > 1 && y > yTop + 1;
    const below = (y - phase - 1) % spacing === 0 && rowsFromBase > 1 && y > yTop + 2;
    const cols = ww === 2 ? [pal.l, pal.d] : ww === 3 ? [pal.d, pal.hl, pal.d] : ww === 4 ? [pal.o, pal.hl, pal.m, pal.d] : ww === 5 ? [pal.o, pal.hl, pal.l, pal.m, pal.d] : [pal.o, pal.hl, pal.l, pal.m, pal.m, pal.d];
    const off = Math.floor((w - ww) / 2);
    for (let i = 0; i < ww; i++) {
      let col = cols[Math.min(i, cols.length - 1)];
      if (i === ww - 1 && ww >= 4 && opts.outlineR !== false) col = pal.o;
      if (isNode) col = i === 0 || i === ww - 1 ? pal.o : pal.n;
      else if (below && i > 0 && i < ww - 1) col = pal.nl;
      img.px(x + off + i, y, col, opts.alpha);
    }
    if (isNode && opts.bulge !== false) { img.px(x + off - 1, y, pal.o, opts.alpha); img.px(x + off + ww, y, pal.o, opts.alpha); }
  }
  if (opts.base) {
    const x = Math.round(xAt(yBot));
    for (let i = -1; i <= w; i++) img.px(x + i, yBot, pal.base);
    img.px(x - 1, yBot - 1, pal.base); img.px(x + w, yBot - 1, pal.base);
  }
}

// little spray of leaves from a twig point
function spray(img, x, y, dir, n, R, pal = PAL.leaf, opts = {}) {
  const fills = opts.fills || [pal.m, pal.m2, pal.l];
  for (let k = 0; k < n; k++) {
    const a = dir + (R() - 0.5) * 1.6;
    const len = (opts.len || 8) + R() * 3;
    const f = fills[Math.floor(R() * fills.length)];
    leaf(img, x, y, a, len, opts.wid || 2.6, f, pal.dk, { hl: f === pal.l ? pal.hl : null, alpha: opts.alpha });
  }
}

function line(img, x0, y0, x1, y1, col, a) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i++) img.px(Math.round(lerp(x0, x1, i / (n || 1))), Math.round(lerp(y0, y1, i / (n || 1))), col, a);
}
function ellipse(img, cx, cy, rx, ry, col, a) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) img.px(x, y, col, a);
  }
}
// adds a 1px outline around all opaque pixels (outside), only where transparent
function outline(img, col, test) {
  const add = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.get(x, y)[3] > 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = img.get(x + dx, y + dy); if (c[3] > 128 && (!test || test(c))) { add.push([x, y]); break; } }
  }
  for (const [x, y] of add) img.setRaw(x, y, col);
}

module.exports = { hash, rng, mix, lerp, PAL, leaf, culm, spray, line, ellipse, outline, Img };
