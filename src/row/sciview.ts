import { BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Shape, ShapeGeometry } from 'three';
import { BoxBank, PAVER_TILE, WindowBank, lambert, paverMap, worldUV } from './kit';
import { rng } from './noise';
import { SCI, SCI_NDOOR, SCI_NWALK, SCI_DOOR, SCI_GLASS, SCI_LAWN, SCI_LOBBY, SCI_PLAZA, SCI_WALK } from './southend';

// ─── The new science building: draws what southend.ts lays out ────────
// From the user's renders and photo (2026-10-08). Tan limestone panels in a stacked running bond; tall slot windows in
// deep reveals, paired up and down, a few wider ones set in deeper frames; at the west end, two storeys of glass
// cantilevered out over a recessed lobby of warm-lit glass; a stone screen round the rooftop plant, a few stacks.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const STONE = 0xcdbda3, STONE_DARK = 0xa99a83, FRAME = 0x2a2c2e;

/** CASPER LIFE SCIENCES BUILDING, in brushed steel capitals. */
function lettering(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 88;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 1024, 88);
  g.fillStyle = '#5d6266'; g.font = '600 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('CASPER LIFE SCIENCES BUILDING', 512, 46);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

let tex: CanvasTexture | null = null;
/** Pale tan limestone panels (the photo): big blocks in a loose stacked bond, each a slightly different shade, fine joints. One tile = 1.6 m. */
function limestone(): CanvasTexture {
  if (tex) return tex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#a99b86'; g.fillRect(0, 0, S, S);
  let id = 6100;
  for (let y = 0; y < S; y += 64) {
    let x = -Math.round(rng(id++) * 60);
    while (x < S) {
      const w = 70 + Math.round(rng(id++) * 70), v = 0.9 + rng(id++) * 0.14;
      g.fillStyle = `rgb(${Math.round(222 * v)},${Math.round(204 * v)},${Math.round(172 * v)})`;
      g.fillRect(x + 1, y + 1, w - 2, 62);
      x += w;
    }
  }
  tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function box3(g: Group, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: MeshLambertMaterial) {
  const m = new Mesh(worldUV(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0), 1.6), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return m;
}

export function buildSci(k: Kit) {
  const { g, box, win } = k, B = SCI, G = SCI_GLASS, L = SCI_LOBBY;
  const stone = new MeshLambertMaterial({ map: limestone(), color: 0xfff0d8 }); // (warmed: the photo's tan)
  // the stone block, east of the glass; under the glass, the lobby's back wall and the stone either side of it
  box3(g, G.x1, B.x1, 0, B.h, B.z0, B.z1, stone);
  box3(g, L.x1, G.x1, 0, G.y0, B.z0, B.z1, stone);
  for (const [z0, z1] of [[B.z0, L.z0], [L.z1, B.z1]]) box3(g, B.x0, L.x1, 0, G.y0, z0, z1, stone);
  box.add((B.x0 + G.x1) / 2, B.h + 0.3, (B.z0 + B.z1) / 2, G.x1 - B.x0, 0.6, B.z1 - B.z0, STONE_DARK); // a roof deck over the glass
  box.add((G.x1 + B.x1) / 2, B.h + 0.15, (B.z0 + B.z1) / 2, B.x1 - G.x1 + 0.3, 0.3, B.z1 - B.z0 + 0.3, STONE_DARK); // coping
  // the stone's windows, placed with care (the user: not a prison). Along each long side: a run of narrow slots, paired
  // up and down, on the upper floors in the middle; two big square-ish windows by the glass; a full-height glass strip
  // splitting off the narrower east block, with a few slots of its own; a handful of tall slender ones on the ground floor.
  const slot = (x: number, z: number, f: '+z' | '-z' | '+x', y: number, w: number, h: number, deep = 0.3) => {
    const n = f === '+z' ? 1 : f === '-z' ? -1 : 0, e = f === '+x' ? 1 : 0;
    box.add(x + e * 0.02, y, z + n * 0.02, e ? 0.06 : w + 0.2, h + 0.2, e ? w + 0.2 : 0.06, 0x1a1c1e); // the dark frame, flush
    win.add('rect', x + e * (0.04 + deep * 0), y, z + n * 0.04, w, h, f);
  };
  const strip = G.x1 + 22; // the glass strip's x: east of it, the narrower block
  for (const [z, f] of [[B.z1, '+z'], [B.z0, '-z']] as const) {
    for (let x = G.x1 + 7.5; x < strip - 1.5; x += 1.25) for (const y of [8.3, 12.5]) slot(x, z, f, y, 0.55, 2.9); // the run of slots
    for (const y of [8.3, 12.6]) slot(G.x1 + 3.2, z, f, y, 2.2, 3.0); // the big windows by the glass
    for (const x of [G.x1 + 3.2, G.x1 + 9, G.x1 + 14.5, strip - 3]) if (!(f === '-z' && Math.abs(x - SCI_NDOOR.x) < 4)) slot(x, z, f, 2.6, 0.7, 4.0); // tall slender ones below (not by the door)
    for (let x = strip + 2; x < B.x1 - 1.5; x += 2.6) for (const y of [8.3, 12.5]) slot(x, z, f, y, 0.55, 2.9); // the east block's
    // the glass strip, full height, a slim reveal
    box.add(strip, B.h / 2, z + (f === '+z' ? 0.04 : -0.04), 1.3, B.h - 0.6, 0.06, 0x1a1c1e);
    win.add('rect', strip, B.h / 2, z + (f === '+z' ? 0.08 : -0.08), 1.0, B.h - 1.0, f);
  }
  for (const zz of [B.z0 + 7, B.z1 - 7]) for (const y of [8.3, 12.6]) slot(B.x1, zz, '+x', y, 2.2, 3.0); // the east end: two big windows a floor
  // the north entrance (the user's photos): silver aluminium-framed glass doors and sidelights, a dark transom over them,
  // a bronze metal soffit, the dark-blue glass bay rising up the facade above; CASPER LIFE SCIENCES BUILDING in steel
  // letters on the stone beside it; interlocking pavers in from the sidewalk between beds of grey river rocks
  { const D = SCI_NDOOR, z = D.z - 0.02, AL = 0x9a9fa3;
    box.add(D.x, 2.3, z + 0.02, D.half * 2 - 0.1, 4.4, 0.04, 0x9a7a52); // the warm vestibule seen through (wood walls)
    for (const o of [-D.half + 0.06, -1.25, -0.02, 0.02, 1.25, D.half - 0.06]) box.add(D.x + o, 1.4, z - 0.08, 0.1, 2.8, 0.1, AL); // stiles
    for (const y of [0.06, 2.8]) box.add(D.x, y, z - 0.08, D.half * 2, 0.12, 0.1, AL); // sill and head
    win.add('rect', D.x, 3.6, z - 0.04, D.half * 2 - 0.1, 1.5, '-z'); // the transom
    box.add(D.x, 4.38, z - 0.08, D.half * 2 + 0.2, 0.1, 0.1, AL);
    for (const o of [-0.62, 0.62]) box.add(D.x + o, 1.15, z - 0.16, 0.04, 0.85, 0.05, 0xc8ccce); // the pulls
    box.add(D.x + D.half + 0.7, 1.35, z - 0.03, 0.16, 0.16, 0.03, 0x1c1e20); // the card reader
    box.add(D.x + D.half + 0.9, 2.8, z - 0.06, 0.28, 0.28, 0.08, 0xc8241f); // the fire alarm bell
    // the soffit: bronze panels, a downlight
    box.add(D.x, 4.9, z - 1.4, D.half * 2 + 1.4, 0.35, 2.8, 0x2c2a28);
    box.add(D.x, 4.71, z - 1.4, D.half * 2 + 1.3, 0.04, 2.7, 0x8f6e48);
    for (let x = D.x - D.half; x <= D.x + D.half + 0.1; x += 1.2) box.add(x, 4.69, z - 1.4, 0.02, 0.01, 2.7, 0x5e4930);
    box.add(D.x, 4.68, z - 1.4, 0.2, 0.02, 0.2, 0xfff2cc);
    // the projecting bay of dark-blue glass above it, up to the top
    const bx0 = D.x - 1.6, bx1 = D.x + 1.6, by0 = 5.1, by1 = B.h - 0.4;
    box.add(D.x, (by0 + by1) / 2, z - 0.7, bx1 - bx0 + 0.2, by1 - by0, 1.4, 0x1f2b3a);
    for (let y = by0 + 1.2; y < by1; y += 2.1) for (const x of [D.x - 0.8, D.x + 0.8]) win.add('rect', x, y, z - 1.42, 1.4, 1.95, '-z');
    for (const x of [bx0, D.x, bx1]) box.add(x, (by0 + by1) / 2, z - 1.42, 0.08, by1 - by0, 0.08, 0x2a3240);
    // the lettering, in steel, on the stone to the west of the doors
    const letters = new Mesh(new PlaneGeometry(4.2, 0.36), new MeshBasicMaterial({ map: lettering(), transparent: true }));
    letters.position.set(D.x - D.half - 2.7, 3.2, z - 0.03);
    letters.rotation.y = Math.PI;
    g.add(letters);
    // the walk in: interlocking pavers, a granite edge, river rocks either side
    const W = SCI_NWALK, t = paverMap().clone();
    t.needsUpdate = true;
    t.repeat.set((W.x1 - W.x0) / PAVER_TILE, (W.z1 - W.z0) / PAVER_TILE);
    const pv = new Mesh(new PlaneGeometry(W.x1 - W.x0, W.z1 - W.z0), new MeshLambertMaterial({ map: t, color: 0xb8b8b8 }));
    pv.rotation.x = -Math.PI / 2;
    pv.position.set((W.x0 + W.x1) / 2, 0.036, (W.z0 + W.z1) / 2);
    pv.receiveShadow = true;
    g.add(pv);
    for (const x of [W.x0 - 0.08, W.x1 + 0.08]) box.add(x, 0.05, (W.z0 + W.z1) / 2, 0.16, 0.1, W.z1 - W.z0, 0xb7b2a6);
    for (const [x0, x1] of [[W.x0 - 1.4, W.x0 - 0.16], [W.x1 + 0.16, W.x1 + 1.4]]) {
      box.add((x0 + x1) / 2, 0.03, (W.z0 + W.z1) / 2, x1 - x0, 0.04, W.z1 - W.z0, 0x6f7275); // the bed
      for (let i = 0; i < 70; i++) {
        const rx = x0 + 0.1 + rng(7300 + i + x0) * (x1 - x0 - 0.2), rz = W.z0 + 0.2 + rng(7500 + i + x0) * (W.z1 - W.z0 - 0.4), r = 0.08 + rng(7700 + i) * 0.07;
        box.add(rx, 0.06, rz, r * 2.2, r, r * 1.6, [0x8d9196, 0xa5a9ad, 0x6c7075, 0xb9bcbf][i % 4], rng(i) * 3);
      }
    }
  }
  // the glass volume: tinted see-through glass (darker than Zelnick's, the inside half-hidden), slim dark mullions, with
  // real rooms behind it: two floors, lab benches, lights, a back wall
  const gh = B.h - G.y0, tint = new MeshPhongMaterial({ color: 0x4f5f6a, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.62, depthWrite: false, side: DoubleSide });
  const pane = (x: number, y: number, z: number, w: number, h: number, ry: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), tint);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.userData.glass = true;
    g.add(m);
  };
  pane(G.x0, G.y0 + gh / 2, (G.z0 + G.z1) / 2, G.z1 - G.z0, gh, Math.PI / 2);
  pane((G.x0 + G.x1) / 2, G.y0 + gh / 2, G.z1, G.x1 - G.x0, gh, 0);
  pane((G.x0 + G.x1) / 2, G.y0 + gh / 2, G.z0, G.x1 - G.x0, gh, 0);
  for (let z = G.z0; z <= G.z1 + 0.01; z += (G.z1 - G.z0) / 18) box.add(G.x0 - 0.03, G.y0 + gh / 2, z, 0.05, gh, 0.05, FRAME);
  for (let x = G.x0; x <= G.x1 + 0.01; x += (G.x1 - G.x0) / 12) for (const z of [G.z0 - 0.03, G.z1 + 0.03]) box.add(x, G.y0 + gh / 2, z, 0.05, gh, 0.05, FRAME);
  for (const y of [G.y0, G.y0 + gh / 2, B.h]) { // floor lines and the top and bottom edges, dark
    box.add(G.x0 - 0.04, y, (G.z0 + G.z1) / 2, 0.08, 0.18, G.z1 - G.z0, FRAME);
    for (const z of [G.z0 - 0.04, G.z1 + 0.04]) box.add((G.x0 + G.x1) / 2, y, z, G.x1 - G.x0, 0.18, 0.08, FRAME);
  }
  box.add((G.x0 + G.x1) / 2, G.y0 - 0.25, (G.z0 + G.z1) / 2, G.x1 - G.x0, 0.5, G.z1 - G.z0, 0x2e3032); // its dark underside
  // the rooms (look-only, unlit-material so they read as lit): floors, ceilings with light strips, benches, a back wall
  const rooms = new BoxBank(), rx0 = G.x0 + 0.3, rx1 = G.x1, rz0 = G.z0 + 0.3, rz1 = G.z1 - 0.3, rcx = (rx0 + rx1) / 2, rcz = (rz0 + rz1) / 2;
  for (const fy of [G.y0, G.y0 + gh / 2]) {
    const h = gh / 2;
    rooms.add(rcx, fy + 0.02, rcz, rx1 - rx0, 0.04, rz1 - rz0, 0xb9b6b0); // floor
    rooms.add(rcx, fy + h - 0.15, rcz, rx1 - rx0, 0.04, rz1 - rz0, 0xeeeeea); // ceiling…
    for (let x = rx0 + 1.5; x < rx1 - 1; x += 2.5) rooms.add(x, fy + h - 0.2, rcz, 0.25, 0.03, rz1 - rz0 - 2, 0xfffbe8); // …its light strips
    for (let x = rx0 + 2; x < rx1 - 2; x += 4) for (const z of [rcz - 6, rcz, rcz + 6]) { // lab benches with shelves over them
      rooms.add(x, fy + 0.45, z, 1.4, 0.9, 3.4, 0xd9d6cf);
      rooms.add(x, fy + 0.92, z, 1.5, 0.04, 3.5, 0x2e3236);
      rooms.add(x, fy + 1.8, z, 0.4, 0.04, 3.2, 0xc8c8c4);
    }
    rooms.add(rx1 - 0.05, fy + h / 2, rcz, 0.1, h, rz1 - rz0, 0xe6e1d6); // the back wall
  }
  const rm = rooms.build(new MeshBasicMaterial({ color: 0xffffff }));
  rm.castShadow = rm.receiveShadow = false;
  rm.userData.glass = true;
  g.add(rm);
  // the recessed lobby: warm-lit glass, the doors in the middle of its west face
  const lit = new Mesh(new BoxGeometry(L.x1 - L.x0, G.y0 - 0.2, L.z1 - L.z0), new MeshLambertMaterial({ color: 0xf2dcb4, emissive: 0x6a4a20 }));
  lit.position.set((L.x0 + L.x1) / 2, (G.y0 - 0.2) / 2, (L.z0 + L.z1) / 2);
  g.add(lit);
  for (let z = L.z0; z <= L.z1; z += 1.8) box.add(L.x0 - 0.02, (G.y0 - 0.2) / 2, z, 0.08, G.y0 - 0.2, 0.08, FRAME);
  for (const o of [-1.2, 0, 1.2]) box.add(SCI_DOOR.x - 0.05, 1.3, SCI_DOOR.z + o, 0.06, 2.6, 0.06, FRAME);
  box.add(SCI_DOOR.x - 0.05, 2.6, SCI_DOOR.z, 0.06, 0.08, 2.4, FRAME);
  // the stone screen round the rooftop plant, stacks
  box3(g, G.x1 + 3, B.x1 - 4, B.h, B.h + 3.2, B.z0 + 4, B.z1 - 4, stone);
  for (let x = G.x1 + 8; x < B.x1 - 6; x += 2) { const m = new Mesh(new CylinderGeometry(0.3, 0.3, 2.4, 8), lambert(0x9da1a3)); m.position.set(x, B.h + 4.4, (B.z0 + B.z1) / 2 + 3); g.add(m); }
  plaza(k);
}

/** The plaza in front of the glass: interlocking pavers, a curved lawn with a sitting edge; the walk in from Church Street. */
function plaza({ g, box }: Kit) {
  const P = SCI_PLAZA, W = SCI_WALK, Ln = SCI_LAWN;
  const tex = paverMap().clone();
  tex.needsUpdate = true;
  tex.repeat.set(1 / PAVER_TILE, 1 / PAVER_TILE);
  const s = new Shape();
  s.moveTo(P.x0, -P.z0); s.lineTo(P.x1, -P.z0); s.lineTo(P.x1, -P.z1); s.lineTo(P.x0, -P.z1); s.closePath();
  const geo = new ShapeGeometry(s);
  geo.rotateX(-Math.PI / 2);
  const pav = new Mesh(geo, new MeshLambertMaterial({ map: tex }));
  pav.position.y = 0.035;
  pav.receiveShadow = true;
  g.add(pav);
  const walk = new Mesh(new PlaneGeometry(W.x1 - W.x0, W.z1 - W.z0), lambert(0xc8c2b8));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set((W.x0 + W.x1) / 2, 0.034, (W.z0 + W.z1) / 2);
  walk.receiveShadow = true;
  g.add(walk);
  // the curved lawn: a half-round of grass with a low stone edge you can sit on
  const lawn = new Mesh(new CylinderGeometry(Ln.r, Ln.r, 0.1, 24, 1, false, 0, Math.PI), lambert(0x6aa840));
  lawn.position.set(Ln.x, 0.06, Ln.z);
  lawn.rotation.y = -Math.PI / 2;
  g.add(lawn);
  const edge = new Mesh(new CylinderGeometry(Ln.r + 0.25, Ln.r + 0.25, 0.45, 24, 1, true, 0, Math.PI), lambert(STONE));
  edge.position.set(Ln.x, 0.22, Ln.z);
  edge.rotation.y = -Math.PI / 2;
  g.add(edge);
  for (let z = P.z0 + 2; z < P.z1; z += 6) box.add(P.x1 - 2.5, 0.45, z, 0.5, 0.45, 2.2, 0xb9b4aa); // benches along the glass
}
