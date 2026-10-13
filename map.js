// Builds "023 BambooForest.tmx" and a rendered preview.
const fs = require('fs');
const path = require('path');
const { Img, readPNG } = require('./png');
const { rng } = require('./draw');

const OUT = process.argv[2] || 'out';
const SRC = process.argv[3]; // Tech Demo/Data/Tiled
const { ids, blob } = JSON.parse(fs.readFileSync(path.join(__dirname, 'tile_ids.json'), 'utf8'));
const W = 40, H = 34;
const R = rng(2024);

// tileset first gids
const TS = { bamboo: 1, nature: 177, passages: 3628, systemtags: 3644 };
const BAM = (name) => TS.bamboo + ids[name];
const NAT = (localId) => TS.nature + localId;
const BLOCK = TS.passages + 15;
const TAG_GRASS = TS.systemtags + 5;

// ---------------- layout ----------------
const open = [...Array(H)].map(() => Array(W).fill(false));
const carve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) open[y][x] = true; };
carve(18, 29, 21, 33);                      // entrance from the rehabilitation centre (south edge)
carve(13, 25, 26, 30); carve(12, 26, 27, 29); // trailhead clearing
carve(6, 26, 11, 27);                       // west trail
carve(4, 15, 5, 27);                        // west side
carve(4, 15, 10, 16); carve(8, 15, 10, 17); // west dead end (false trail: old droppings)
carve(6, 20, 29, 21);                       // middle corridor
carve(19, 22, 20, 24);                      // north exit of the trailhead
carve(28, 12, 29, 21);                      // north-east corridor
carve(30, 20, 35, 21); carve(34, 22, 35, 25); carve(31, 24, 35, 28); // east dead end (boar wallow)
carve(12, 12, 35, 13); carve(12, 11, 14, 13); // upper corridor + shoot pocket (west end)
carve(34, 4, 35, 11); carve(31, 3, 35, 5);  // north-east dead end (pit viper)
carve(20, 9, 21, 11);                       // clearing entrance
carve(15, 2, 25, 8); carve(13, 4, 27, 7); carve(17, 1, 23, 1); // panda clearing
const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? (y >= H ? !open[H - 1][Math.max(0, Math.min(W - 1, x))] : true) : !open[y][x];

// ---------------- layers ----------------
const L = {};
const layerNames = ['ground_1', 'trail_1', 'shadow_1', 'decor_1', 'decor2_1', 'thicket_1', 'objA_1', 'objB_1', 'objA_2', 'objB_2', 'objA_3', 'objB_3', 'systemtags', 'passages'];
for (const n of layerNames) L[n] = [...Array(H)].map(() => Array(W).fill(0));
const set = (n, x, y, g) => { if (x >= 0 && y >= 0 && x < W && y < H) L[n][y][x] = g; };
const block = (x, y) => set('passages', x, y, BLOCK);

const reduce = (m) => { if (!(m & 1 && m & 4)) m &= ~2; if (!(m & 4 && m & 16)) m &= ~8; if (!(m & 16 && m & 64)) m &= ~32; if (!(m & 64 && m & 1)) m &= ~128; return m; };
const maskOf = (test, x, y) => { let m = 0; [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].forEach(([dx, dy], i) => { if (test(x + dx, y + dy)) m |= 1 << i; }); return reduce(m); };

// ground + thicket
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const r = R();
  set('ground_1', x, y, BAM('floor' + (r < 0.55 ? (r * 7.2) | 0 : 4 + ((R() * 4) | 0))));
  if (isWall(x, y)) {
    const m = maskOf(isWall, x, y), v = R();
    set('thicket_1', x, y, BAM(m === 255 && v < 0.6 ? 'thicketFill' + (1 + ((v * 5) | 0) % 3) : 'thicket_' + m));
    block(x, y);
  }
}
// dirt trail from the rehab centre gate into the trailhead
const trail = new Set();
const addTrail = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) trail.add(x + ',' + y); };
addTrail(19, 27, 20, 33); addTrail(17, 27, 22, 28); addTrail(16, 28, 17, 28);
const isTrail = (x, y) => trail.has(x + ',' + y) || (y >= H && (x === 19 || x === 20));
for (const k of trail) { const [x, y] = k.split(',').map(Number); set('trail_1', x, y, BAM('path_' + maskOf(isTrail, x, y))); }
// shadows cast by the thicket (light from the top-left)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (isWall(x, y)) continue;
  const s = isWall(x, y - 1), e = isWall(x - 1, y);
  if (s || e) set('shadow_1', x, y, BAM(s && e ? 'shadowSE' : s ? 'shadowS' : 'shadowE'));
}

// ---------------- objects ----------------
const used = { A: new Set(), B: new Set() };
function placeBig(name, x, y, rowsLayers, blockedRows, opts = {}) {
  // (x, y) = bottom-left cell. rowsLayers maps row-from-bottom -> layer z suffix
  const t = ids[name]; const h = t.length, w = t[0].length;
  for (const S of ['A', 'B']) {
    let ok = true;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (used[S].has(x + i + ',' + (y - j))) ok = false;
    if (!ok) continue;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const row = h - 1 - j; // row index inside the object image (0 = top)
      const z = rowsLayers[j] || 1;
      set(`obj${S}_${z}`, x + i, y - j, (opts.gid || ((id) => TS.bamboo + id))(t[row][i]));
      used[S].add(x + i + ',' + (y - j));
      if (j < blockedRows) block(x + i, y - j);
    }
    return true;
  }
  return false;
}
// natural (TECH-Nature) multi-tile objects use raw local ids
const natObj = (localRows) => localRows.map((r) => r.map((id) => id));
ids.rockGrey = natObj([[212], [260]]); ids.rockBrown = natObj([[211], [259]]);
ids.deadTree = natObj([[1603, 1604], [1651, 1652], [1699, 1700], [1747, 1748]]);
ids.mudHole = natObj([[1701, 1702], [1749, 1750]]);
const natGid = (id) => NAT(id);

const free = (x, y) => !isWall(x, y) && !L.decor_1[y][x] && !L.passages[y][x];
const clumps = ['clumpA', 'clumpB', 'clumpC'];
const thin = ['thinA', 'thinB'];

// hand-placed landmarks
placeBig('nest', 19, 5, [1, 1], 0);                                  // where the sick panda rests
placeBig('boulder', 22, 4, [1, 2], 2);
placeBig('rockBrown', 26, 7, [1, 2], 1, { gid: natGid });
placeBig('rockGrey', 13, 27, [1, 2], 1, { gid: natGid });
placeBig('rockGrey', 9, 21, [1, 2], 1, { gid: natGid });
placeBig('deadTree', 31, 5, [1, 2, 3, 3], 1, { gid: natGid });
placeBig('mudHole', 32, 27, [1, 1], 0, { gid: natGid });
placeBig('fallen', 23, 8, [1], 1);
for (const [x, y, n] of [[14, 6, 'clumpB'], [24, 30, 'clumpC'], [14, 30, 'clumpA'], [16, 4, 'thinB'], [26, 5, 'thinA'], [12, 29, 'thinA'], [27, 29, 'thinB']]) placeBig(n, x, y, [1, 2, 3], 1);

// clumps standing in front of the thicket faces
for (let y = 2; y < H; y++) for (let x = 0; x < W - 1; x++) {
  const face = (xx) => isWall(xx, y) && !isWall(xx, y + 1) && y + 1 < H;
  if (!face(x) || !face(x + 1)) continue;
  if (R() < 0.8) { placeBig(clumps[(R() * 3) | 0], x, y, [1, 2, 3], 1); x += 1; }
  else placeBig(thin[(R() * 2) | 0], x, y, [1, 2, 3], 1);
}
// tall single culms rising out of the interior of the thicket (adds height to the mass)


// clues along the correct route (events go on these cells, see events guide)
const deco = (n, x, y, g) => set(n, x, y, g);
deco('decor_1', 21, 25, BAM('chewedA'));       // C1 chewed stems at the trailhead
deco('decor_1', 19, 23, BAM('printU'));        // C2 tracks heading north...
deco('decor_1', 22, 21, BAM('printR'));        // ...then east
deco('decor_1', 25, 20, BAM('printR'));
deco('decor_1', 29, 17, BAM('dropFresh'));     // C3 fresh droppings
deco('decor_1', 28, 14, BAM('printU'));
deco('decor_1', 25, 13, BAM('chewedPile'));    // C4 fresh chewing + panda call
deco('decor_1', 23, 12, BAM('printL'));
deco('decor_1', 21, 10, BAM('printU'));
deco('decor_1', 17, 6, BAM('shootsB'));        // food near the resting spot
deco('decor_1', 21, 7, BAM('chewedPile'));
// false trail + dead-end flavour
deco('decor_1', 9, 16, BAM('dropOld'));
deco('decor_1', 10, 15, BAM('chewedB'));
deco('decor_1', 7, 16, BAM('printL'));
deco('decor_1', 13, 11, BAM('shootsA')); deco('decor_1', 14, 12, BAM('shootsB'));
// fence + sign at the gate
deco('decor_1', 15, 30, BAM('fenceL')); deco('decor_1', 16, 30, BAM('fenceM')); deco('decor_1', 17, 30, BAM('fenceR'));
deco('decor_1', 22, 30, BAM('fenceL')); deco('decor_1', 23, 30, BAM('fenceR'));
for (const x of [15, 16, 17, 22, 23]) block(x, 30);
deco('decor_1', 17, 29, BAM('sign')); block(17, 29);

// encounter undergrowth (optional bamboo rat / pit viper / wild boar)
const grassCells = [];
const patch = (x0, y0, x1, y1, p = 1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!isWall(x, y) && !L.passages[y][x] && !L.decor_1[y][x] && !L.objA_1[y][x] && R() < p) { deco('decor2_1', x, y, BAM('undergrowth' + ((x + y) % 2))); set('systemtags', x, y, TAG_GRASS); grassCells.push([x, y]); } };
patch(8, 17, 10, 17); patch(4, 22, 5, 25, 0.8);  // west: bamboo rat
patch(32, 3, 35, 4, 0.9);                         // north-east: pit viper
patch(31, 24, 35, 25, 0.9); patch(34, 22, 35, 23);// east: wild boar

// floor litter, ferns
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!free(x, y) || L.trail_1[y][x] || L.decor2_1[y][x] || L.objA_1[y][x]) continue;
  const r = R();
  if (r < 0.13) deco('decor_1', x, y, BAM('litter' + ((R() * 4) | 0)));
  else if (r < 0.17 && (isWall(x - 1, y) || isWall(x + 1, y))) deco('decor_1', x, y, BAM('fern' + ((R() * 2) | 0)));
}

// ---------------- write TMX ----------------
const csv = (g) => g.map((r) => r.join(',')).join(',\n');
let lid = 1;
const hidden = { systemtags: ' visible="0" opacity="0.5"', passages: ' visible="0" opacity="0.34"' };
const layerXml = (n) => ` <layer id="${lid++}" name="${n}" width="${W}" height="${H}"${hidden[n] || ''}>\n  <data encoding="csv">\n${csv(L[n])}\n</data>\n </layer>\n`;
let body = '';
for (const n of layerNames) {
  if (n === 'objA_2') body += ` <group id="${lid++}" name="z=2"/>\n`;
  if (n === 'objA_3') body += ` <group id="${lid++}" name="z=3"/>\n`;
  if (n === 'systemtags') body += ` <group id="${lid++}" name="infos"/>\n`;
  body += layerXml(n);
}
const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="32" tileheight="32" infinite="0" nextlayerid="${lid}" nextobjectid="1">
 <tileset firstgid="${TS.bamboo}" source="../Tilesets/Endangermon-Bamboo.tsx"/>
 <tileset firstgid="${TS.nature}" source="../Tilesets/TECH-Nature.tsx"/>
 <tileset firstgid="${TS.passages}" source="../Tilesets/passages.tsx"/>
 <tileset firstgid="${TS.systemtags}" source="../Tilesets/systemtags.tsx"/>
${body}</map>
`;
fs.mkdirSync(path.join(OUT, 'Data/Tiled/Maps'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'Data/Tiled/Maps/023 BambooForest.tmx'), tmx);

// ---------------- render preview ----------------
const bamboo = readPNG(path.join(OUT, 'Data/Tiled/Assets/Endangermon-Bamboo.png'));
const nature = readPNG(path.join(SRC, 'Assets/TECH-Nature.png'), 'f05ba1');
const img = new Img(W * 32, H * 32);
const drawGid = (g, x, y) => {
  if (!g || g >= TS.passages) return;
  const [sheet, cols, id] = g >= TS.nature ? [nature, 48, g - TS.nature] : [bamboo, 16, g - TS.bamboo];
  img.blit(sheet, (id % cols) * 32, ((id / cols) | 0) * 32, 32, 32, x * 32, y * 32);
};
const order = layerNames.filter((n) => n !== 'systemtags' && n !== 'passages');
for (const n of order) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawGid(L[n][y][x], x, y);
img.save(path.join(__dirname, 'preview_map.png'));
fs.writeFileSync(path.join(__dirname, 'map_state.json'), JSON.stringify({ W, H, grassCells, passages: L.passages }));
console.log('map ok');
