// Minimal PNG read/write (RGBA8) using node's zlib.
const fs = require('fs');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0]; const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  // set with alpha blending (src-over)
  px(x, y, c, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    const sa = ((c[3] === undefined ? 255 : c[3]) * a) / 255 / 255;
    if (sa >= 1) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; return; }
    if (sa <= 0) return;
    const da = this.d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) this.d[i + k] = (c[k] * sa + this.d[i + k] * da * (1 - sa)) / oa;
    this.d[i + 3] = oa * 255;
  }
  setRaw(x, y, c) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = c[3] === undefined ? 255 : c[3]; }
  rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
  blit(src, sx, sy, sw, sh, dx, dy, opts = {}) {
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const xx = opts.flipX ? sx + sw - 1 - i : sx + i;
      const c = src.get(xx, sy + j);
      if (c[3]) this.px(dx + i, dy + j, c, opts.alpha === undefined ? 255 : opts.alpha);
    }
  }
  scaled(k, bg) {
    const o = new Img(this.w * k, this.h * k);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      if (bg) o.setRaw(x, y, bg);
      const c = this.get((x / k) | 0, (y / k) | 0); if (c[3]) o.px(x, y, c);
    }
    return o;
  }
  save(file) {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      for (let x = 0; x < this.w * 4; x++) raw[y * (this.w * 4 + 1) + 1 + x] = this.d[y * this.w * 4 + x];
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
    ]);
    fs.writeFileSync(file, png);
  }
}

function readPNG(file, transHex) {
  const b = fs.readFileSync(file);
  let p = 8, w, h, bd, ct, il, pal = null, trns = null; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p); const type = b.toString('ascii', p + 4, p + 8); const data = b.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === 'PLTE') pal = data; else if (type === 'tRNS') trns = data; else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (il) throw new Error('interlaced not supported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const bpp = Math.max(1, (ch * bd) >> 3);
  const stride = Math.ceil((w * ch * bd) / 8);
  const out = Buffer.alloc(stride * h); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)); const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[x] = v & 255;
    }
    cur.copy(out, y * stride); prev = cur;
  }
  const img = new Img(w, h);
  const tr = transHex ? [parseInt(transHex.slice(0, 2), 16), parseInt(transHex.slice(2, 4), 16), parseInt(transHex.slice(4, 6), 16)] : null;
  const sample = (row, idx) => {
    if (bd === 8) return out[row * stride + idx];
    const bit = idx * bd; const byte = out[row * stride + (bit >> 3)]; const sh = 8 - bd - (bit & 7); return (byte >> sh) & ((1 << bd) - 1);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r, g, bl, a = 255;
    if (ct === 6) { const i = y * stride + x * 4; r = out[i]; g = out[i + 1]; bl = out[i + 2]; a = out[i + 3]; }
    else if (ct === 2) { const i = y * stride + x * 3; r = out[i]; g = out[i + 1]; bl = out[i + 2]; }
    else if (ct === 3) { const k = sample(y, x); r = pal[k * 3]; g = pal[k * 3 + 1]; bl = pal[k * 3 + 2]; a = trns && k < trns.length ? trns[k] : 255; }
    else if (ct === 0) { r = g = bl = sample(y, x); }
    else if (ct === 4) { const i = y * stride + x * 2; r = g = bl = out[i]; a = out[i + 1]; }
    if (tr && r === tr[0] && g === tr[1] && bl === tr[2]) a = 0;
    img.setRaw(x, y, [r, g, bl, a]);
  }
  return img;
}

module.exports = { Img, readPNG };
