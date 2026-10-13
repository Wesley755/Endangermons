// 4-frame twinkle used to mark examinable clues (RMXP character sheet, 4x4 frames of 32x32).
const { Img } = require('./png');
const out = process.argv[2];
const s = new Img(128, 128);
const star = (img, cx, cy, r, a) => {
  const core = [255, 255, 236], glow = [255, 240, 150], edge = [200, 170, 60];
  for (let i = -r; i <= r; i++) {
    const t = 1 - Math.abs(i) / (r + 1);
    const c = Math.abs(i) <= 1 ? core : Math.abs(i) < r * 0.6 ? glow : edge;
    img.px(cx + i, cy, c, a * t + 60); img.px(cx, cy + i, c, a * t + 60);
  }
  if (r >= 3) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) img.px(cx + dx, cy + dy, glow, a * 0.7);
};
const frames = [[2, 0], [3, 1], [5, 2], [3, 1]];
for (let row = 0; row < 4; row++) for (let f = 0; f < 4; f++) {
  const fr = new Img(32, 32);
  const [r, r2] = frames[f];
  star(fr, 16, 20, r, 220);
  if (r2) star(fr, 22, 15, r2, 180);
  if (f === 2) star(fr, 11, 24, 1, 160);
  s.blit(fr, 0, 0, 32, 32, f * 32, row * 32);
}
s.save(out);
console.log('sparkle ok');
