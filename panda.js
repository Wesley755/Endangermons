// Giant panda sprites: overworld walk sheet, sick/lying overworld sheet, encounter fronts, menu icon.
const fs = require('fs');
const path = require('path');
const { Img } = require('./png');
const { rng, mix, leaf, culm, PAL } = require('./draw');
const OUT = process.argv[2] || 'out';

const C = {
  K: [26, 24, 32], B: [46, 44, 54], b: [74, 72, 88], bb: [102, 100, 118],
  W: [244, 242, 232], w: [214, 210, 200], s: [178, 174, 170], ss: [146, 142, 142],
  pad: [92, 80, 88], padL: [128, 112, 118], nose: [30, 28, 36], eye: [16, 14, 20], shine: [255, 255, 255], tongue: [196, 108, 118],
};

// shape layer: each pixel stores {col: 'W'|'B', sh: shade value, id}; painter's order
class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  ell(cx, cy, rx, ry, col, opts = {}) {
    const ang = opts.ang || 0, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let y = Math.floor(cy - Math.max(rx, ry) - 1); y <= cy + Math.max(rx, ry) + 1; y++) for (let x = Math.floor(cx - Math.max(rx, ry) - 1); x <= cx + Math.max(rx, ry) + 1; x++) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
      const d = u * u + v * v;
      if (d > 1) continue;
      if (opts.clip && !opts.clip(x, y)) continue;
      // fake sphere normal for lighting from the top-left
      const nz = Math.sqrt(Math.max(0, 1 - d));
      const light = (-u * 0.55 - v * 0.75 + nz * 0.9) / 1.4;
      this.p[y * this.w + x] = { col, light: opts.flat !== undefined ? opts.flat : light, part: opts.part || col };
    }
  }
  capsule(x0, y0, x1, y1, r, col, opts = {}) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= n; i++) { const t = i / n; this.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, col, { ...opts, flat: opts.flat !== undefined ? opts.flat : 0.5 - t * 0.35 }); }
  }
  dot(x, y, col, light = 0.5) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = { col, light, part: col }; }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
  render(opts = {}) {
    const img = new Img(this.w, this.h);
    const ramps = { W: [C.ss, C.s, C.w, C.W], B: [C.K, C.B, C.B, C.b], pad: [C.pad, C.pad, C.padL, C.padL] };
    const lv = opts.levels || [0.12, 0.38, 0.62];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const q = this.get(x, y); if (!q) continue;
      const ramp = ramps[q.col];
      if (!ramp) { img.setRaw(x, y, q.col); continue; }
      const L = q.light; const i = L < lv[0] ? 0 : L < lv[1] ? 1 : L < lv[2] ? 2 : 3;
      img.setRaw(x, y, ramp[i]);
    }
    // outline the silhouette, and separate overlapping parts of the same colour
    const out = new Img(this.w, this.h); out.d.set(img.d);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const q = this.get(x, y);
      if (!q) { if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy))) out.setRaw(x, y, C.K); continue; }
      if (opts.inner && q.col === 'W') {
        const below = this.get(x, y + 1), right = this.get(x + 1, y), left = this.get(x - 1, y);
        for (const nb of [below, right, left]) if (nb && nb.col === 'W' && nb.part !== q.part && nb.z > q.z) out.setRaw(x, y, C.s);
      }
    }
    return out;
  }
}

// ======================= OVERWORLD (32x32 frames) =======================
function owFrame(dir, step) {
  const c = new Canvas(32, 32);
  const bob = step % 2 ? -1 : 0; // body lifts on step frames
  const legA = step === 1 ? -2 : step === 3 ? 1 : 0, legB = step === 3 ? -2 : step === 1 ? 1 : 0;
  if (dir === 'down') {
    c.ell(16, 14 + bob, 10.5, 7.5, 'W', { part: 'body' });
    c.ell(16, 13.5 + bob, 10.6, 3.2, 'B', { clip: (x, y) => c.get(x, y), part: 'band' }); // saddle across shoulders
    c.capsule(9.5, 18 + bob, 9.5, 26 + legA, 3, 'B');
    c.capsule(22.5, 18 + bob, 22.5, 26 + legB, 3, 'B');
    c.ell(16, 19 + bob, 8.2, 7, 'W', { part: 'head' });
    c.ell(9, 12.5 + bob, 2.8, 2.8, 'B'); c.ell(23, 12.5 + bob, 2.8, 2.8, 'B');
    c.ell(16, 19 + bob, 8.2, 7, 'W', { part: 'head', clip: (x, y) => y > 13 + bob });
    c.ell(12.2, 18.8 + bob, 2.1, 2.9, 'B', { ang: 0.5, flat: 0.5 }); c.ell(19.8, 18.8 + bob, 2.1, 2.9, 'B', { ang: -0.5, flat: 0.5 });
    c.dot(12, 18 + bob, C.shine); c.dot(19, 18 + bob, C.shine);
    c.ell(16, 21.8 + bob, 1.7, 1.1, 'B', { flat: 0.3 }); c.dot(16, 23 + bob, C.s, 0);
  } else if (dir === 'up') {
    c.capsule(10, 21 + bob, 10, 26.5 + legA, 3, 'B');
    c.capsule(22, 21 + bob, 22, 26.5 + legB, 3, 'B');
    c.ell(16, 16.5 + bob, 10.5, 8.2, 'W', { part: 'body' });
    c.ell(16, 11 + bob, 10.6, 3.4, 'B', { clip: (x, y) => c.get(x, y) && c.get(x, y).part === 'body' });
    c.ell(16, 23.5 + bob, 2, 1.6, 'W', { flat: 0.7 });
    c.ell(10.5, 4.5 + bob, 2.6, 2.6, 'B'); c.ell(21.5, 4.5 + bob, 2.6, 2.6, 'B');
    c.ell(16, 8 + bob, 6.8, 5, 'W', { part: 'head' });
  } else { // right; left is mirrored
    const onBody = (x, y) => c.get(x, y) && c.get(x, y).part === 'body';
    c.capsule(10, 22 + bob, 10.5, 26.5 + legB, 2.6, 'B', { flat: 0.1 });   // far hind leg
    c.capsule(21, 22 + bob, 21.5, 26.5 + legA, 2.6, 'B', { flat: 0.1 });   // far front leg
    c.ell(14.5, 19 + bob, 10.5, 7.2, 'W', { part: 'body' });
    c.ell(20, 18 + bob, 4.8, 8.5, 'B', { clip: onBody });  // shoulder band
    c.ell(7.5, 22.5 + bob, 4.2, 4.4, 'B', { clip: onBody }); // haunch
    c.capsule(7, 23 + bob, 6.5, 26.5 + legA, 3, 'B');   // near hind leg
    c.capsule(18.5, 23 + bob, 18, 26.5 + legB, 3, 'B'); // near front leg
    c.ell(4, 15.5 + bob, 1.8, 1.6, 'W', { flat: 0.8 }); // tail
    c.ell(22, 9.5 + bob, 2.6, 2.6, 'B');               // ear
    c.ell(24, 14.5 + bob, 6.4, 5.8, 'W', { part: 'head' });
    c.ell(28.8, 16.6 + bob, 2.6, 2.1, 'W', { part: 'snout', flat: 0.6 });
    c.ell(25.6, 14 + bob, 1.9, 2.5, 'B', { ang: -0.6, flat: 0.5 });
    c.dot(26, 13 + bob, C.shine);
    c.dot(31, 16 + bob, C.nose); c.dot(30, 16 + bob, C.nose); c.dot(30, 18 + bob, C.s, 0);
  }
  return c.render();
}
function sickFrame(step) {
  // lying on its side, head resting on the ground, eyes half closed; slow breathing
  const c = new Canvas(32, 32); const br = step % 2 ? 0.7 : 0;
  const onBody = (x, y) => c.get(x, y) && c.get(x, y).part === 'body';
  c.ell(30, 19.5 - br, 1.8, 1.6, 'W', { flat: 0.8 });                 // tail
  c.ell(19.5, 21.5 - br / 2, 11, 6.2 + br, 'W', { part: 'body' });
  c.ell(14.5, 21, 3.6, 7.5, 'B', { clip: onBody });                  // shoulder band
  c.ell(26, 24, 4.6, 4.6, 'B', { clip: onBody });                    // haunch
  c.capsule(25, 27, 30, 27.5, 2.2, 'B');                              // hind foot
  c.capsule(15, 27, 3, 27.5, 2.4, 'B');                               // front legs stretched forward
  c.ell(5.5, 15.5, 2.3, 2.3, 'B', { flat: 0.2 });                     // far ear
  c.ell(11, 15.8, 2.6, 2.6, 'B');                                     // near ear
  c.ell(9.5, 20.5, 6.4, 5.6, 'W', { part: 'head' });
  c.ell(4.2, 23, 3.2, 2.3, 'W', { part: 'snout', flat: 0.7 });
  c.ell(7.4, 20.4, 2, 2.5, 'B', { ang: 0.5, flat: 0.5 });             // eye patch
  c.dot(6, 21, C.ss); c.dot(7, 21, C.ss); c.dot(8, 20, C.ss);                             // eye closed
  c.dot(1, 22, C.nose); c.dot(2, 22, C.nose); c.dot(2, 21, C.nose);
  c.dot(4, 25, C.ss); c.dot(5, 25, C.ss);
  return c.render();
}
function sheet(frameFn, flipDir = 'left') {
  const s = new Img(128, 128);
  ['down', 'left', 'right', 'up'].forEach((d, row) => {
    for (let f = 0; f < 4; f++) {
      const fr = frameFn(d, f);
      // ground shadow (behind sprite)
      const sh = new Img(32, 32);
      for (let y = 26; y < 32; y++) for (let x = 0; x < 32; x++) { const dx = (x + 0.5 - 16) / (d === 'down' || d === 'up' ? 10 : 12.5), dy = (y + 0.5 - 28.5) / 2.6; if (dx * dx + dy * dy <= 1) sh.setRaw(x, y, [0, 0, 0, 60]); }
      s.blit(sh, 0, 0, 32, 32, f * 32, row * 32);
      s.blit(fr, 0, 0, 32, 32, f * 32, row * 32, { flipX: d === flipDir });
    }
  });
  return s;
}

// ======================= ENCOUNTER FRONT (96x96) =======================
function front(sick) {
  const c = new Canvas(96, 96);
  const hy = sick ? 4 : 0, tilt = sick ? 0.12 : -0.05; // sick: head drooped
  // back leg soles facing the viewer
  c.ell(30, 77, 13, 10, 'B', { part: 'legL' });
  c.ell(67, 77, 13, 10, 'B', { part: 'legR' });
  // body / belly
  c.ell(48, 61, 24, 25, 'W', { part: 'body' });
  // chest band (black vest across shoulders)
  c.ell(48, 43, 25, 10, 'B', { clip: (x, y) => c.get(x, y) && c.get(x, y).part === 'body' && y < 50 + Math.abs(x - 48) * 0.18 });
  // feet in front
  c.ell(27, 81, 10.5, 8, 'B', { part: 'footL' }); c.ell(70, 81, 10.5, 8, 'B', { part: 'footR' });
  c.ell(25.5, 82.5, 5.5, 4.2, 'pad', { flat: 0.3 }); c.ell(71.5, 82.5, 5.5, 4.2, 'pad', { flat: 0.3 });
  for (const [x, y] of [[19, 78], [22, 75.5], [27, 75], [31, 77]]) c.ell(x, y, 1.8, 1.6, 'pad', { flat: 0.6 });
  for (const [x, y] of [[66, 77], [70, 75], [75, 75.5], [78, 78]]) c.ell(x, y, 1.8, 1.6, 'pad', { flat: 0.6 });
  if (!sick) {
    // holding a bamboo culm with the right paw
    const bam = new Img(96, 96);
    culm(bam, (y) => 78 - (88 - y) * 0.08, 14, 88, 5, PAL.culm, { spacing: 12, phase: 4, base: false, taper: 4 });
    const R = rng(4);
    for (const [x, y, a] of [[73, 18, -2.3], [74, 16, -1.0], [75, 20, -0.4], [72, 24, -2.8], [76, 27, 0.1]]) leaf(bam, x, y, a + (R() - 0.5) * 0.3, 12, 3.4, R() < 0.5 ? PAL.leaf.l : PAL.leaf.m2, PAL.leaf.dk, { hl: PAL.leaf.hl });
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const q = bam.get(x, y); if (q[3]) c.dot(x, y, q.slice(0, 3)); }
    c.capsule(68, 46, 72, 56 + hy, 7, 'B', { flat: undefined }); // arm up to the stalk
    c.ell(73, 56, 6.5, 6, 'B', { part: 'pawR' });
  } else {
    c.capsule(68, 46, 63, 66, 7.5, 'B');
    c.ell(61, 68, 7, 6, 'B', { part: 'pawR' });
  }
  c.capsule(28, 46, 33, 66, 7.5, 'B');
  c.ell(35, 68, 7, 6, 'B', { part: 'pawL' });
  // head
  const hx = 46, hcy = 30 + hy;
  c.ell(hx - 18, hcy - 15, 8.5, 8, 'B', { part: 'earL' }); c.ell(hx + 17, hcy - 16, 8.5, 8, 'B', { part: 'earR' });
  c.ell(hx, hcy, 22, 18.5, 'W', { part: 'head', ang: tilt });
  c.ell(hx - 2, hcy + 9, 9.5, 6.5, 'W', { part: 'muzzle', flat: 0.7 });
  // eye patches (tilted teardrops)
  c.ell(hx - 10, hcy + 0.5, 5.2, 7.2, 'B', { ang: 0.55, flat: 0.45 }); c.ell(hx + 8, hcy - 0.5, 5.2, 7.2, 'B', { ang: -0.55, flat: 0.45 });
  if (sick) {
    for (const ex of [hx - 10, hx + 8]) { for (let i = -2; i <= 2; i++) c.dot(ex + i, hcy + 1 + (Math.abs(i) === 2 ? -1 : 0), C.eye); c.dot(ex - 1, hcy + 2, C.bb); }
  } else {
    for (const ex of [hx - 9, hx + 7]) { c.ell(ex, hcy, 2.2, 2.6, C.eye, { flat: 0 }); c.dot(ex - 1, hcy - 1, C.shine); }
  }
  // nose + mouth
  c.ell(hx - 2, hcy + 7, 4, 2.6, 'B', { flat: 0.55 }); c.dot(hx - 3, hcy + 6, C.bb);
  c.dot(hx - 2, hcy + 10, C.K); c.dot(hx - 2, hcy + 11, C.K);
  if (sick) { c.dot(hx - 4, hcy + 13, C.K); c.dot(hx - 3, hcy + 12, C.K); c.dot(hx - 1, hcy + 12, C.K); c.dot(hx, hcy + 13, C.K); }
  else { c.dot(hx - 4, hcy + 12, C.K); c.dot(hx - 3, hcy + 12, C.K); c.dot(hx - 1, hcy + 12, C.K); c.dot(hx, hcy + 12, C.K); c.dot(hx - 2, hcy + 13, C.tongue); }
  return c.render();
}

// ======================= write =======================
const dir = (p) => { fs.mkdirSync(path.join(OUT, p), { recursive: true }); return path.join(OUT, p); };
const walk = sheet((d, f) => owFrame(d, f));
walk.save(path.join(dir('graphics/characters'), 'panda.png'));
const sick = sheet((d, f) => sickFrame(f), 'right');
sick.save(path.join(dir('graphics/characters'), 'panda_sick.png'));
const fr = front(false), frS = front(true);
fr.save(path.join(dir('graphics/pokedex/pokefront'), 'panda.png'));
frS.save(path.join(dir('graphics/pokedex/pokefront'), 'panda_sick.png'));
// icon: 2 frames, 32x32 each (idle bob)
const icon = new Img(64, 32);
icon.blit(walk, 0, 0, 32, 32, 0, 0); icon.blit(walk, 0, 0, 32, 31, 32, 1);
icon.save(path.join(dir('graphics/pokedex/pokeicon'), 'panda.png'));
console.log('panda ok');
