import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, Mesh, PCFSoftShadowMap,
  PerspectiveCamera, PointLight, Scene, Vector3, WebGLRenderer,
} from 'three';
import { Sky, moodAt } from './sky';
import { BoxBank, WindowBank, lambert } from './kit';
import { buildRow } from './buildings';
import { pruzanNight, pruzanTick } from './pruzanview';
import { BACK_PATH, FIELD_X, FRONT_X, PATH_HALF, ROW_ENTRY, USDAN, USDAN_NAME, WALK_MAX_Z, WALK_MIN_Z, distToPoly, inPoly } from './layout';
import { World } from './world';
import { along, quadX } from './backlawn';
import { CLASS_TAKEN, FIELD_ROAD, FRANK_ROOMS, GALLERY_SITTERS, GALLERY_VISITORS, GRAND_STAIR, LOUNGE_SEATS, NCOURT_SITTERS, NCOURT_TABLES, POOL_SITTERS, PLAZA_SITTERS, TERRACE_Y, classroom, PLAZA_TABLES, ROAD_LANES, ROAD_WALK, STAIRS, groundY, plazaChairs, southEndNear } from './southend';
import { resolveMove } from './collide';
import {
  SPEED, actionAt, airborne, carry, createMobility, dismount, isRunning, mount, newJump, newMover, startJump, stepJump, stepMover,
} from './mobility';
import { RideView } from './rideables';
import { HouseView } from './house/view';
import { Roommates } from './house/roommates';
import { homecoming, listNames } from './house/routine';
import { floorY, houseExtra, levelAt } from './house/collide';
import { BED_SPOT, FRONT_DOOR, HOME_SPAWN, Level, SEATS, Seat, insideHouse, toLocal, toWorld } from './house/plan';
import { ENTER_AT, EXIT_AT, Where, cameraClearance, nearDoor as byTheDoor, portalAt } from './house/portal';
import { LANES, Obstacle, createTraffic, lightAt, stepTraffic } from './traffic';
import { CarsView, Exhaust, TireMarks, Traffic } from './vehicles';
import { cartBox, createCart, stepCart } from './cart';
import { isOpen, newOrder, stepOrder } from './foodtruck';
import { FoodTruckView, GolfCartView } from './campus';
import {
  Car, asCar, carAt, carjack, distToCar, clearRoad, createGarage, driveMove, driven, footprint, getIn, getOut, jackable,
  SPEC, loadMine, missing, mph, onRoad, roadBlocks, saveMine, stepPedals,
} from './cars';
import { START_HOUR, advance, formatHour, nextPreset, periodOf, wakeFrom, wrapHour } from './clock';
import { Person, discGeometry, randomLook } from './people';
import { Knock, OUCH, hits, launch, stepKnock } from './knock';
import { ICON, IconName } from './icons';
import { Speedometer } from './hud';
import { SPOT_KEY, loadSpot, saveSpot } from './save';
import { FullMap, MiniMap } from './mapview';
import type { Place } from './map';
import { Sound } from './audio';
import { falloff, honkNow, mixAt } from './soundscape';
import { leavesMark, surfaceAt } from './surface';
import { ITEMS, SITTERS, chairs } from './plaza';
import { UsdanView } from './usdan/view';
import {
  AT_DESK, Door, ITEMS as U_ITEMS, SITTERS as U_SITTERS, SOFA_SITTERS, STAFF, WALK_LANES, arriveAt, chairsAt as uChairs,
  insideUsdan, nearUsdanDoor, usdanExtra, usdanPortalAt,
} from './usdan/plan';
import { Labels, Note, Trail, buildTrails } from './traces';
import { Input } from './controls';
import { CameraRig, wrap } from './camera';
import { ROAD } from './layout';
import { rng } from './noise';

// ─── College Row — vibe test ───────────────────────────────────────────
// One place, done well: portrait, one thumb, opens from a link. Walk the
// row, watch the light change, see who's been here. Everything social on
// screen is demo data until there's a server.

const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// ── renderer / scene ──
const canvas = document.getElementById('scene') as HTMLCanvasElement;
// ?lite=1 (the browser tests use it): no shadows, no antialiasing, 1× pixels. The game plays the same, it just draws far
// less, which matters on SwiftShader (software WebGL), where a loaded laptop can manage only a few frames a second.
const lite = params.has('lite');
const renderer = new WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !lite;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new Scene();
scene.fog = new Fog(0xffffff, 45, 330);
const camera = new PerspectiveCamera(55, 1, 0.3, 1200);

const sky = new Sky();
scene.add(sky.dome, sky.stars);

const hemi = new HemisphereLight(0xffffff, 0x444444, 1);
const sun = new DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);

// ── the place ──
const windows = new WindowBank();
const details = new BoxBank();
const { group: row, stops, crossings } = buildRow(windows, details);
const world = new World(stops, crossings, details);
const S = (name: string) => stops.find((s) => s.name.startsWith(name))!;
const traffic = createTraffic(crossings);
const trafficView = new Traffic(traffic);
const house = new HouseView(windows); // your wood frame across High Street (adds its windows to the bank)
scene.add(row, world.group, house.exterior, details.build(), ...windows.build(), trafficView.group);

// inside your house is its own little world: its own scene, its own light, no street or sky
const homeScene = new Scene();
homeScene.background = new Color(0x0e0c0b);
const homeHemi = new HemisphereLight(0xfff4e6, 0x3a3026, 1.6);
const homeDay = new DirectionalLight(0xfff2dd, 1.2); // daylight through the front windows
const hd = toWorld(-8, -6), hc = toWorld(8, 0);
homeDay.position.set(hd.x, 14, hd.z);
homeDay.target.position.set(hc.x, 0, hc.z);
homeScene.add(homeHemi, homeDay, homeDay.target, house.interior);

// inside Usdan: its own world too — warm light, the atrium's pendants, people about
const usdanScene = new Scene();
usdanScene.background = new Color(0x1a1714);
const usdan = new UsdanView();
const usdanHemi = new HemisphereLight(0xfff3e0, 0x8a7a66, 1.6);
const usdanSun = new DirectionalLight(0xfff0dc, 0.9);
usdanSun.position.set(-70, 30, -170);
usdanSun.target.position.set(-80, 0, -205);
const pendants = [new PointLight(0xffe9c8, 30, 22, 1.3), new PointLight(0xffe9c8, 30, 22, 1.3)];
pendants[0].position.set(-86, 6.4, -202); pendants[1].position.set(-76, 6.4, -202);
usdanScene.add(usdanHemi, usdanSun, usdanSun.target, ...pendants, usdan.group);
interface Inside { p: Person; lane?: [number, number, number]; z?: number; dir?: 1 | -1; speed?: number; sit?: boolean }
const insiders: Inside[] = [];
{
  let seed = 950;
  const add = (x: number, z: number, heading: number, extra: Partial<Inside> = {}, look = randomLook(seed++)) => {
    const p = new Person(look);
    p.root.position.set(x, 0, z);
    p.face(heading);
    usdanScene.add(p.root);
    insiders.push({ p, ...extra });
    return p;
  };
  for (const [t, c] of U_SITTERS) { const at = uChairs(U_ITEMS[t])[c]; add(at.x, at.z, at.heading, { sit: true }).sit(0.46); }
  for (const s of SOFA_SITTERS) add(s.x, s.z, s.heading, { sit: true }).sit(0.42);
  for (const s of STAFF) add(s.x, s.z, s.heading, {}, { ...randomLook(seed++), top: s.role === 'cafe' ? 0x1e1e22 : 0xc8302a });
  for (const s of AT_DESK) add(s.x, s.z, s.heading);
  WALK_LANES.forEach((lane, i) => {
    for (let k = 0; k < 2; k++) {
      const z = lane[1] + ((k + 0.3 + i * 0.2) / 2) * (lane[2] - lane[1]);
      add(lane[0], z, 0, { lane, z, dir: k ? 1 : -1, speed: 1.1 + k * 0.3 });
    }
  });
}

// ── people ──
const me = new Person({ skin: 0x6b3e26, hair: 0x121212, hairStyle: 'short', top: 0xc8302a, legs: 0x2b2b30, pack: 0x2b3a66 });
// where you are: back where you were if the page reloaded (saved on your phone); otherwise you start the
// day outside your house, on the sidewalk. ?x= / ?z= (screenshots, tests) override both.
const urlSpot = params.has('x') || params.has('z');
const resumed = urlSpot ? null : (() => {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SPOT_KEY); } catch { /* storage unavailable */ }
  return loadSpot(raw, Date.now(), (sp) => {
    if (sp.where === 'in') return insideHouse(toLocal(sp.x, sp.z).u, toLocal(sp.x, sp.z).v);
    if (sp.where === 'usdan') return insideUsdan(sp);
    const ok = resolveMove(sp, sp, stops, houseExtra(0, false));
    return ok.x === sp.x && ok.z === sp.z && !insideUsdan(sp);
  });
})();
const atHomeStart = !urlSpot && !resumed;
const pos = resumed ? new Vector3(resumed.x, 0, resumed.z)
  : new Vector3(parseFloat(params.get('x') ?? String(HOME_SPAWN.x)), 0, parseFloat(params.get('z') ?? String(HOME_SPAWN.z)));
let level: Level = resumed ? resumed.level : params.get('level') === '1' ? 1 : 0; // which floor you're on (only matters in your house)
pos.y = floorY(level, pos.x, pos.z);
me.root.position.copy(pos);
me.face(resumed ? resumed.heading : HOME_SPAWN.heading); // facing +z, up High Street
scene.add(me.root);
let sittingOn: Seat | null = null;
// which world you're in: the street, or inside your house (?x/?z can start you inside)
let where: Where = resumed ? resumed.where
  : insideHouse(toLocal(pos.x, pos.z).u, toLocal(pos.x, pos.z).v) ? 'in' : insideUsdan(pos) ? 'usdan' : 'out';
const sceneFor = (w: Where) => (w === 'in' ? homeScene : w === 'usdan' ? usdanScene : scene);

// ── getting around: walk → run, bikes + scooters in racks and loose on the walk ──
const mob = createMobility(stops, crossings, ROW_ENTRY);
const mover = newMover();
const rideView = new RideView(mob);
scene.add(rideView.group);

// ── cars: yours + kofi's in the driveways, and whatever you take off High Street ──
const CAR_KEY = 'vora.row.car';
let savedCar: string | null = null;
try { savedCar = localStorage.getItem(CAR_KEY); } catch { /* storage unavailable */ }
const garage = createGarage(loadMine(savedCar));
const carsView = new CarsView(trafficView);
scene.add(carsView.group);
const saveCar = () => { try { localStorage.setItem(CAR_KEY, saveMine(garage)); } catch { /* ignore */ } };
addEventListener('pagehide', saveCar);

/** Note where you are, so a reload (or iOS dropping the tab) puts you back here. In a car, you'll be beside it. */
function saveWhere() {
  let x = pos.x, z = pos.z;
  const c = driven(garage);
  if (c) { const s = SPEC[c.kind].halfW + 0.7; x = c.x + Math.cos(c.heading) * s; z = c.z - Math.sin(c.heading) * s; }
  if (sittingOn) { const a = toWorld(sittingOn.approach[0], sittingOn.approach[1]); x = a.x; z = a.z; }
  try { localStorage.setItem(SPOT_KEY, saveSpot({ where, x, z, heading: me.heading, level, at: Date.now() })); } catch { /* ignore */ }
}
addEventListener('pagehide', () => saveWhere());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { saveWhere(); saveCar(); } });

/** Drivers you've pulled out of their cars: knocked down, up again, then off down the sidewalk, yelling. */
interface Fleer { p: Person; x: number; z: number; out: { x: number; z: number }; t: number; bubble: HTMLElement; body: Body }
const fleers: Fleer[] = [];
const YELLS = ['hey!! that\'s my car!', 'are you serious?!', 'somebody stop them!', 'my groceries are in there!', 'i just got that washed!'];
let jacks = 0;

const actBtn = document.getElementById('act')!;
let actKey = '';
const lastDir = new Vector3(0, 0, 1);

/**
 * Anyone outside a car can hit. While they're flying / lying there / walking back to where they were,
 * their usual animation is paused. `land` says what they do once they're back on their feet
 * (default: walk back to `back` and pick up where they left off).
 */
interface Body {
  p: Person;
  knock: Knock | null;
  returning: boolean;
  back: { x: number; z: number; heading: number; settle: () => void } | null;
  land?: (x: number, z: number) => void;
  idle?: (dt: number) => void; // what they do each frame when nothing's happened to them
  bubble?: HTMLElement;
  sayUntil: number;
}
const bodies: Body[] = [];
const hittable = (p: Person, back: Body['back'] = null, extra: Partial<Body> = {}): Body => {
  const b: Body = { p, knock: null, returning: false, back, sayUntil: 0, ...extra };
  bodies.push(b);
  return b;
};
const busy = (b: Body) => b.knock !== null || b.returning;

interface Walker { p: Person; x: number; z: number; dir: number; speed: number; off: number; body: Body }
const walkers: Walker[] = [];
for (let i = 0; i < 26; i++) {
  const p = new Person(randomLook(i + 3));
  const dir = rng(i * 3 + 1) < 0.5 ? 1 : -1;
  const w: Walker = {
    p, dir,
    x: dir > 0 ? 0.4 + rng(i + 9) * 1.6 : -0.4 - rng(i + 9) * 1.6, // keep right, mostly
    z: WALK_MAX_Z + rng(i * 5 + 2) * (WALK_MIN_Z - WALK_MAX_Z),
    speed: 1.05 + rng(i * 7) * 0.5, off: 0, body: null!,
  };
  // every fourth walker brings a friend
  walkers.push(w);
  scene.add(p.root);
  if (i % 4 === 0) {
    const q = new Person(randomLook(i + 101));
    walkers.push({ ...w, p: q, x: w.x + 0.75 * Math.sign(w.x) * -1 });
    scene.add(q.root);
  }
}
// knocked off the walk: get up, and carry on from where you landed, drifting back to your side of the walk
for (const w of walkers) w.body = hittable(w.p, null, { land: (x, z) => { w.z = z; w.off = x - w.x; } });

let seated = 0;
const sitAt = (p: Person, x: number, z: number, heading: number, seatY: number) => {
  p.root.position.set(x, 0, z);
  p.face(heading);
  p.sit(seatY);
  scene.add(p.root);
  seated++;
  hittable(p, { x, z, heading, settle: () => p.sit(seatY) }, { idle: (dt) => p.sitIdle(dt) });
};
// benches: a few taken
world.benches.slice(0, 6).forEach((b, i) => {
  if (i % 2 === 0) sitAt(new Person(randomLook(300 + i)), b.x + 0.05, b.z - 0.45, Math.PI / 2, 0.5);
  if (i % 3 === 0) sitAt(new Person(randomLook(320 + i)), b.x + 0.05, b.z + 0.5, Math.PI / 2, 0.5);
});
// out on the plaza between Usdan and Boger: a few people at the tables
SITTERS.forEach(([t, c], i) => {
  const at = chairs(ITEMS[t])[c];
  sitAt(new Person(randomLook(760 + i * 3)), at.x, at.z, at.heading, 0.46);
});
// up by the Frank Center: two on the stairs, three on the grass at the top of the bank
for (const [x, z, h, k] of [[STAIRS.x0 + 0.8, 6.9, Math.PI, 0], [STAIRS.x0 + 1.5, 7.3, Math.PI - 0.3, 1]] as const) {
  const p = new Person(randomLook(720 + k));
  sitAt(p, x, z, h, 0.06);
  p.root.position.y = groundY(x, z);
}
// inside the Frank Center, seen through its glass: a class in session behind the windows across from Judd, people on
// the grand stair behind the entry, and the lounge in the glass connector
const indoors = (p: Person, x: number, y: number, z: number, heading: number) => {
  p.root.position.set(x, y, z);
  p.face(heading);
  scene.add(p.root);
};
{
  const cls = classroom();
  CLASS_TAKEN.forEach((i, k) => {
    const s = cls.seats[i];
    if (!s) return;
    const person = new Person(randomLook(800 + k));
    sitAt(person, s.x, s.z, s.heading, 0.46);
    person.root.position.y = s.y;
  });
  indoors(new Person(randomLook(830)), cls.teacher.x, FRANK_ROOMS.floor, cls.teacher.z, cls.teacher.heading);
  const G = GRAND_STAIR, stepY = (z: number) => FRANK_ROOMS.floor + G.rise * Math.min(1, Math.max(0, (G.zBottom - z) / (G.zBottom - G.zTop)));
  for (const [z, k] of [[35.6, 0], [34.2, 1], [33.4, 2]] as const) indoors(new Person(randomLook(840 + k)), (G.x0 + G.x1) / 2, stepY(z), z, Math.PI);
  indoors(new Person(randomLook(845)), FRANK_ROOMS.x1 - 2.5, FRANK_ROOMS.floor, 36, -Math.PI / 2); // just inside, heading in
  LOUNGE_SEATS.forEach((p, k) => {
    const person = new Person(randomLook(790 + k));
    sitAt(person, p.x, p.z, p.heading, p.chair === 'stool' ? 0.72 : 0.44);
    person.root.position.y = p.y;
  });
  indoors(new Person(randomLook(850)), -78.6, TERRACE_Y, 21.4, Math.PI * 0.8); // standing, chatting
  // in the Pruzan Art Center, behind its glass: two on the sofas, two looking at the show
  GALLERY_SITTERS.forEach((p, k) => {
    const person = new Person(randomLook(860 + k));
    sitAt(person, p.x, p.z, p.heading, 0.42);
    person.root.position.y = p.y;
  });
  GALLERY_VISITORS.forEach((p, k) => indoors(new Person(randomLook(865 + k)), p.x, p.y, p.z, p.heading));
}
// out at the teak tables in the courtyard on its field side
NCOURT_SITTERS.forEach(([t, c], k) => {
  const at = plazaChairs(NCOURT_TABLES[t])[c];
  const person = new Person(randomLook(880 + k));
  sitAt(person, at.x, at.z, at.heading, 0.46);
  person.root.position.y = TERRACE_Y;
});
// and two on the rim of its fountain, facing out
POOL_SITTERS.forEach((p, k) => {
  const person = new Person(randomLook(870 + k));
  sitAt(person, p.x, p.z, p.heading, p.y - TERRACE_Y);
  person.root.position.y = TERRACE_Y;
});
// and out at the tables on the plaza by the Frank Center's main entry
PLAZA_SITTERS.forEach(([t, c], k) => {
  const at = plazaChairs(PLAZA_TABLES[t])[c];
  sitAt(new Person(randomLook(730 + k)), at.x, at.z, at.heading, 0.46);
});
// hangs on the grass
const circles: [number, number, number][] = [
  [-7, S('Judd').doorZ + 8, 3], [-7, S('South').doorZ - 6, 3], [-7, S('Boger').z0 - 12, 3], [5.5, S('North').doorZ, 3],
];
circles.forEach(([cx, cz, n], ci) => {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + ci;
    const x = cx + Math.sin(a) * 1.2, z = cz + Math.cos(a) * 1.2;
    sitAt(new Person(randomLook(400 + ci * 10 + k)), x, z, Math.atan2(cx - x, cz - z), 0.12);
  }
});
// a frisbee going back and forth on the lawn by the Allbritton–Judd walkway
const cross0 = crossings[0], cross1 = crossings[crossings.length - 1];
const fa = new Person(randomLook(500)), fb = new Person(randomLook(501));
const FA = new Vector3(-12, 0, cross0.z + 7), FB = new Vector3(-27, 0, cross0.z - 6);
fa.root.position.copy(FA); fb.root.position.copy(FB);
fa.face(Math.atan2(FB.x - FA.x, FB.z - FA.z)); fb.face(Math.atan2(FA.x - FB.x, FA.z - FB.z));
const disc = new Mesh(discGeometry, lambert(0xf2f2f2));
disc.castShadow = true;
scene.add(fa.root, fb.root, disc);

// students walking the coal-tar path behind the row, back from class (keeping to its edges; the cart has the middle)
const backZ = World.backPathZ(crossings);
interface BackWalker { p: Person; x: number; z: number; dir: 1 | -1; speed: number; body: Body }
const backWalkers: BackWalker[] = [];
for (let i = 0; i < 12; i++) {
  const dir = rng(i * 11 + 5) < 0.5 ? 1 : -1;
  const edge = rng(i * 13 + 2) < 0.5 ? BACK_PATH.x0 + 0.9 + rng(i) * 0.7 : BACK_PATH.x1 - 0.9 - rng(i) * 0.7;
  const bw: BackWalker = {
    p: new Person(randomLook(600 + i)), x: edge, dir, speed: 1.1 + rng(i * 7 + 1) * 0.5,
    z: backZ.z0 + 3 + rng(i * 17 + 3) * (backZ.z1 - backZ.z0 - 6), body: null!,
  };
  bw.body = hittable(bw.p, null, { land: (x, z) => { bw.x = Math.min(BACK_PATH.x1 - 0.8, Math.max(BACK_PATH.x0 + 0.8, x)); bw.z = z; } });
  scene.add(bw.p.root);
  backWalkers.push(bw);
}

// and cutting across the lawn between South and North College on the X of walks, between the row's walk and the back path
const xSegs = quadX(stops);
interface XWalker { p: Person; seg: number; t: number; dir: 1 | -1; speed: number; side: number; body: Body }
const xWalkers: XWalker[] = [];
for (let i = 0; i < 4; i++) {
  const xw: XWalker = {
    p: new Person(randomLook(660 + i)), seg: i % 2, t: rng(i * 29 + 4), dir: i < 2 ? 1 : -1,
    speed: 1.05 + rng(i * 31 + 2) * 0.4, side: (rng(i * 37 + 1) - 0.5) * 1.2, body: null!,
  };
  xw.body = hittable(xw.p, null, { land: (x, z) => { xw.t = along(xSegs[xw.seg], { x, z }).t; } });
  scene.add(xw.p.root);
  xWalkers.push(xw);
}

// and along the field road, past the Frank Center and Olin (keeping right: eastbound on the bank side)
interface RoadWalker { p: Person; x: number; z: number; dir: 1 | -1; speed: number; body: Body }
const roadLane = (dir: 1 | -1, i: number) => ROAD_LANES[dir > 0 ? 1 : 0] + (rng(i * 5 + 3) - 0.5) * 0.6;
const roadWalkers: RoadWalker[] = [];
for (let i = 0; i < 6; i++) {
  const dir = i % 2 ? 1 : -1;
  const rw: RoadWalker = {
    p: new Person(randomLook(680 + i)), dir, z: roadLane(dir, i), speed: 1.0 + rng(i * 23 + 1) * 0.5, body: null!,
    x: ROAD_WALK.x0 + 4 + rng(i * 19 + 7) * (ROAD_WALK.x1 - ROAD_WALK.x0 - 8),
  };
  rw.body = hittable(rw.p, null, { land: (x, z) => { rw.x = x; rw.z = Math.min(FIELD_ROAD.z1 - 0.6, Math.max(FIELD_ROAD.z0 + 0.6, z)); } });
  scene.add(rw.p.root);
  roadWalkers.push(rw);
}

// Physical Plant's golf cart, up and down the back path
const cart = createCart(backZ.z0, backZ.z1);
const cartView = new GolfCartView();
scene.add(cartView.root);

// what your car leaves behind: tyre marks (always on grass, on tar when you skid) and exhaust
const tyres = new TireMarks();
const exhaust = new Exhaust();
scene.add(tyres.mesh, exhaust.group);

// the burrito truck by the Boger–South walkway, beside Usdan (daytime)
const busyPeople = new Map<Person, Body>();
const truck = new FoodTruckView(crossings[crossings.length - 1], (p) => { const b = busyPeople.get(p); return !!b && busy(b); });
for (const p of truck.people) busyPeople.set(p, hittable(p));
scene.add(truck.group);
const order = newOrder();
const faBody = hittable(fa, { x: FA.x, z: FA.z, heading: fa.heading, settle: () => fa.face(Math.atan2(FB.x - FA.x, FB.z - FA.z)) });
const fbBody = hittable(fb, { x: FB.x, z: FB.z, heading: fb.heading, settle: () => fb.face(Math.atan2(FA.x - FB.x, FA.z - FB.z)) });

// a friend who is actually here right now
const devon = new Person({ skin: 0xc68642, hair: 0x2b1d14, hairStyle: 'puff', top: 0xe8b33a, legs: 0x3b4a6b, pack: null });
const devonBench = world.benches[1];
sitAt(devon, devonBench.x + 0.05, devonBench.z, Math.PI / 2, 0.5);

// ── traces (DEMO data) ──
const labels = new Labels();
const trails: Trail[] = [
  { who: 'mara', color: 0xff6b9a, ago: '2h', pts: [[-1.2, S('Boger').doorZ], [-0.9, S('South').z1], [-0.6, S('North').doorZ - 6], [-4, S('North').doorZ], [FRONT_X + 1.5, S('North').doorZ]] },
  { who: 'theo', color: 0x5ad1ff, ago: '40m', pts: [[-60, cross1.z], [-25, cross1.z], [-5, cross1.z + 0.5], [-1.2, cross1.z + 6], [-1, S('South').doorZ]] },
  { who: 'imani', color: 0xffd23d, ago: '5h', pts: [[-1.2, S('South').doorZ], [-0.8, S('Boger').doorZ + 8], [-5, S('Boger').doorZ], [FRONT_X + 1.5, S('Boger').doorZ]] },
];
scene.add(buildTrails(trails, labels));

const card = document.getElementById('card')!;
const openNote = (n: Note) => {
  card.querySelector('.who')!.textContent = `note from ${n.who} · ${n.ago} ago`;
  card.querySelector('.txt')!.textContent = n.text;
  card.classList.add('show');
};
card.querySelector('button')!.addEventListener('click', () => card.classList.remove('show'));
const notes: Note[] = [
  { who: 'priya', ago: '3h', text: 'the light on the chapel right before 6 is unreal this week. sit here.', x: world.benches[3].x, z: world.benches[3].z },
  { who: 'kai', ago: '1d', text: 'whoever keeps leaving a frisbee out here — it is mine. i want it back.', x: -19, z: cross0.z + 2 },
];
for (const n of notes) labels.add(`📌 ${n.who}<em>left a note</em>`, new Vector3(n.x, 1.6, n.z), 26, () => openNote(n));
labels.add(`3 sat here today<em>amara, kai +1</em>`, new Vector3(world.benches[0].x, 1.4, world.benches[0].z), 22);
labels.add(`<span class="sw" style="background:#00ff88"></span>devon<em>here now</em>`, new Vector3(), 45, undefined,
  () => devon.root.position.clone().setY(2.3));

// ── HUD ──
const hud = document.getElementById('hud')!;
const hint = document.getElementById('hint')!;
const passing = document.getElementById('passing')!;
const passingName = passing.querySelector('.v')!;
const clockBtn = document.getElementById('clock')!;
document.getElementById('presence')!.textContent = `${walkers.length + seated + 2} on the row · 1 friend`;

// game time: flows ~60× real time; ?t= freezes it (screenshots, tests)
const HOUR_KEY = 'vora.row.hour';
const forced = params.get('t');
const frozen = forced !== null;
let hour = frozen ? wrapHour(parseFloat(forced)) : START_HOUR;
if (!frozen) {
  try {
    const saved = parseFloat(localStorage.getItem(HOUR_KEY) ?? '');
    if (Number.isFinite(saved)) hour = wrapHour(saved); // pick the day up where you left it
  } catch { /* storage unavailable: start fresh */ }
}
let savedAt = 0;
const saveHour = () => { try { localStorage.setItem(HOUR_KEY, hour.toFixed(3)); } catch { /* ignore */ } };
addEventListener('pagehide', saveHour);
clockBtn.addEventListener('click', () => {
  hour = nextPreset(hour).h; // skip ahead; time keeps flowing from here
  lastHour = hour;
  applyMood(hour); // respond on the tap, not a frame later
  saveHour();
});

// ── your roommates (on the game clock) ──
const roommates = new Roommates(hour, labels, () => {
  const l = toLocal(pos.x, pos.z);
  return { level, indoors: insideHouse(l.u, l.v) };
});
scene.add(roommates.outdoor);
homeScene.add(roommates.indoor);
const porchSign = toWorld(-0.6, FRONT_DOOR.v1 + 0.6);
labels.add('🏠 your house<em>High St · 5 roommates</em>', new Vector3(porchSign.x, 3.6, porchSign.z), 45, undefined, undefined,
  () => !insideHouse(toLocal(pos.x, pos.z).u, toLocal(pos.x, pos.z).v));
const fade = document.getElementById('fade')!;
const toastEl = document.getElementById('toast')!;
const speedo = new Speedometer(document.getElementById('speedo')!);
/** Speedometer: shown while you're on wheels. */
function updateSpeedo(speed: number) {
  const car = driven(garage);
  const top = car ? SPEC[car.kind].top : mover.mode === 'foot' ? 0 : SPEED[mover.mode];
  speedo.set(mph(speed), top > 0 ? mph(top) : null);
}
// the other glass buttons: jump (on foot), and the pedals (driving)
const jumpBtn = document.getElementById('jump')!, gasBtn = document.getElementById('gas')!, brakeBtn = document.getElementById('brake')!;
jumpBtn.innerHTML = ICON.jump; gasBtn.innerHTML = ICON.gas; brakeBtn.innerHTML = ICON.brake;
const jump = newJump();
let toastTimer = 0;
function toast(text: string, secs = 2.6) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), secs * 1000);
}
// whose car is whose
for (const c of garage.cars) {
  if (!c.owner) continue;
  const label = c.owner === 'you' ? 'your car' : `${c.owner}'s car`;
  labels.add(label, new Vector3(), 24, undefined, () => new Vector3(c.x, 2.2, c.z), () => garage.driving !== c.id);
}

// ── mood ──
let lastHour = -1;
let night = 0;
const glass = new Color();
// a soft light that walks with you, so you're not a silhouette after dark
const fill = new PointLight(0xffe4c4, 0, 15, 1.4);
scene.add(fill);
function applyMood(h: number) {
  const m = moodAt(h);
  night = m.night;
  fill.intensity = m.night * 22;
  renderer.toneMappingExposure = 1.05 + m.night * 0.3; // let your eyes adjust
  trafficView.setNight(m.night);
  house.setNight(m.night);
  sky.apply(m);
  (scene.fog as Fog).color.copy(m.horizon);
  hemi.color.copy(m.hemiSky);
  hemi.groundColor.copy(m.hemiGround);
  hemi.intensity = m.hemiI;
  homeHemi.intensity = 1.7 - m.night * 1.0;
  usdan.setDaylight(m.horizon, m.night);
  usdanSun.intensity = (1 - m.night) * 0.9;
  usdanHemi.intensity = 1.7 - m.night * 0.5; // Usdan stays lit at night
  homeDay.intensity = (1 - m.night) * 1.3;
  sun.color.copy(m.sun);
  sun.intensity = m.sunI;
  glass.copy(m.top).lerp(m.horizon, 0.45).multiplyScalar(0.55);
  windows.paint(glass, m.night);
  world.setNight(m.night);
  pruzanNight(m.night);
  sun.userData.dir = m.sunDir;
  clockBtn.innerHTML = `${formatHour(h)}<small>${periodOf(h)}</small>`;
}

// ── input + camera ──
const input = new Input();
// sound: starts on the first touch / key (browsers only allow audio after one); paused while the page is hidden
const sound = new Sound();
const unlock = () => sound.start();
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) addEventListener(ev, unlock, { capture: true });
document.addEventListener('visibilitychange', () => sound.suspend(document.visibilityState === 'hidden'));
const muteBtn = document.getElementById('mute')!;
const showMute = () => { muteBtn.innerHTML = sound.muted ? ICON.muted : ICON.sound; muteBtn.setAttribute('aria-label', sound.muted ? 'Sound off' : 'Sound on'); };
muteBtn.addEventListener('click', () => {
  sound.start();
  sound.setMuted(!sound.muted);
  showMute();
  toast(sound.muted ? 'sound off' : `sound on · audio ${sound.state}`); // (the state helps if a phone stays silent)
});
showMute();
/** Where a sound at (x, z) sits for your ears: loudness by distance, left/right by where it is on screen. */
const ears = (x: number, z: number, range = 60) => {
  const dx = x - pos.x, dz = z - pos.z, d = Math.hypot(dx, dz) || 1;
  return { vol: falloff(d, range), pan: (dx * right.x + dz * right.z) / d };
};
const honkedAt = new Map<number, number>();
let mixT = 0;
let wasAirborne = false;
input.onFirstMove = () => setTimeout(() => hint.classList.add('gone'), 2500);
const rig = new CameraRig(params.has('yaw') ? parseFloat(params.get('yaw')!) : resumed ? resumed.heading + Math.PI : Math.PI); // π = looking +z, up High Street / down the row; ?yaw= for screenshots
// the opening swoop: at home, from across the street looking back at you in front of your house; else from high over the row
const camPos = atHomeStart ? new Vector3(pos.x - 24, 11, pos.z + 6) : new Vector3(pos.x + 60, 70, pos.z - 90);
const HOUSE_LOOK = new Vector3(toWorld(3, 0).x, 4, toWorld(3, 0).z); // the front of your house
const lookAt = new Vector3();
const fwd = new Vector3(), right = new Vector3(), move = new Vector3(), want = new Vector3();
let snapCamera = false; // jump the camera (after going through a door) instead of gliding
let introT = params.get('intro') === '0' || resumed ? 1 : 0; // ?intro=0 (or picking up where you left off) skips the opening swoop
const introRunning = () => introT < 1;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 58 : 46;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ── actions ──
/** Something the action button can do: an icon on the button, words for screen readers (and tests). */
interface Act { key: string; icon: IconName; label: string; dist: number; run: () => void }

function sitDown(seat: Seat) {
  sittingOn = seat;
  mover.speed = 0;
  const w = toWorld(seat.u, seat.v);
  pos.set(w.x, 0, w.z);
  me.face(seat.heading);
  me.sit(seat.y);
}
function standUp() {
  if (!sittingOn) return;
  const w = toWorld(sittingOn.approach[0], sittingOn.approach[1]);
  pos.set(w.x, 0, w.z);
  sittingOn = null;
}
function sleep() {
  const wake = wakeFrom(hour); // a nap in the day runs into the night; otherwise, the next morning
  fade.textContent = `zzz… ${wake.tag}`;
  fade.classList.add('show');
  setTimeout(() => {
    hour = wake.h;
    lastHour = hour;
    applyMood(hour);
    saveHour();
    fade.classList.remove('show');
  }, 900);
}

/** Everything you can bump into right now: the house (by floor), and outside, nearby trunks, posts, benches and traffic. */
const VEHICLE_HALF_W = { car: 0.95, truck: 1.2, bike: 0.35 } as const;
function collisions() {
  if (where === 'usdan') return usdanExtra();
  const base = houseExtra(level, mover.riding !== null || garage.driving !== null);
  if (where === 'in') return base;
  const near = (b: { x0: number; x1: number; z0: number; z1: number }) =>
    b.x1 > pos.x - 12 && b.x0 < pos.x + 12 && b.z1 > pos.z - 12 && b.z0 < pos.z + 12;
  const solids = [...(base.solids ?? []), ...world.obstacles.filter(near)];
  for (const v of traffic.vehicles) {
    const x = LANES[v.lane].x, hw = VEHICLE_HALF_W[v.kind] + 0.3, hl = v.len / 2 + 0.3;
    const b = { x0: x - hw, x1: x + hw, z0: v.z - hl, z1: v.z + hl };
    if (near(b)) solids.push(b);
  }
  for (const c of garage.cars) {
    if (c.id === garage.driving) continue;
    const b = footprint(c, 0.3);
    if (near(b)) solids.push(b);
  }
  if (near(cartBox(cart))) solids.push(cartBox(cart, 0.3));
  if (truck.group.visible) {
    const t = truck.spot.box, c = truck.spot.cooler;
    solids.push({ x0: t.x0 - 0.3, x1: t.x1 + 0.3, z0: t.z0 - 0.3, z1: t.z1 + 0.3 }, { x0: c.x - 0.7, x1: c.x + 0.7, z0: c.z - 0.55, z1: c.z + 0.55 });
  }
  return { ...base, solids };
}

/** Through the front door: a quick fade, and you're in the other world, facing the right way. */
function goThrough(kind: 'enter' | 'exit') {
  sound.play('houseDoor', 0.8);
  const at = kind === 'enter' ? ENTER_AT : EXIT_AT;
  const w = toWorld(at.u, at.v);
  pos.set(w.x, 0, w.z);
  level = 0;
  where = kind === 'enter' ? 'in' : 'out';
  sceneFor(where).add(me.root, fill);
  me.face(at.heading);
  lastDir.set(Math.sin(at.heading), 0, Math.cos(at.heading));
  mover.speed = 0;
  rig.snapBehind(at.heading);
  snapCamera = true;
  fade.classList.add('blink');
  setTimeout(() => fade.classList.remove('blink'), 260);
  if (where === 'in') welcomeHome();
}

// ── the map: a mini map top-right; tap it for the whole campus, pick a place and jump there ──
const fieldZ = S('Memorial').doorZ;
const miniMap = new MiniMap(document.querySelector('#minimap canvas') as HTMLCanvasElement, stops, fieldZ);
const fullMap = new FullMap(document.getElementById('mapfull')!, stops, fieldZ);
document.getElementById('minimap')!.addEventListener('click', () => fullMap.open(pos, me.heading));
fullMap.onGo = (p) => travelTo(p);

/** Jump straight to a place on the map: out of whatever you're in or on, a blink, and you're there. */
function travelTo(p: Place) {
  if (sittingOn) standUp();
  if (garage.driving !== null) leaveCar(); // your car stays where you left it
  if (mover.riding !== null) dismount(mob, mover, pos, me.heading);
  if (where !== 'out') { where = 'out'; scene.add(me.root, fill); }
  level = 0;
  pos.set(p.spawn.x, 0, p.spawn.z);
  me.face(p.spawn.heading);
  lastDir.set(Math.sin(p.spawn.heading), 0, Math.cos(p.spawn.heading));
  mover.speed = 0;
  rig.snapBehind(p.spawn.heading);
  snapCamera = true;
  fade.classList.add('blink');
  setTimeout(() => fade.classList.remove('blink'), 260);
  toast(p.name);
  saveWhere();
}

/** Through one of Usdan's doors: a blink, and you're inside (or back out, facing away from the building). */
function goUsdan(door: Door, kind: 'enter' | 'exit') {
  sound.play('glassDoor', 0.8);
  const at = arriveAt(door, kind);
  pos.set(at.x, 0, at.z);
  level = 0;
  where = kind === 'enter' ? 'usdan' : 'out';
  sceneFor(where).add(me.root, fill);
  me.face(at.heading);
  lastDir.set(Math.sin(at.heading), 0, Math.cos(at.heading));
  mover.speed = 0;
  rig.snapBehind(at.heading);
  snapCamera = true;
  fade.classList.add('blink');
  setTimeout(() => fade.classList.remove('blink'), 260);
  if (kind === 'enter') toast('Usdan University Center');
}

/** Walking in: who's home, who's out, and a hello from whoever you'd see first. */
const welcome = document.getElementById('welcome')!;
let welcomeTimer = 0;
function welcomeHome() {
  const h = homecoming(hour, Math.floor(performance.now() / 1000));
  const s = welcome.querySelector('.s')!;
  const ins = h.home.length ? `${listNames(h.home)} ${h.home.length === 1 ? 'is' : 'are'} home` : 'nobody\'s home';
  const outs = h.out.length ? `${listNames(h.out)} ${h.out.length === 1 ? 'is' : 'are'} out` : 'everyone\'s in';
  s.innerHTML = `${ins}<br>${outs}`;
  welcome.classList.add('show');
  clearTimeout(welcomeTimer);
  welcomeTimer = window.setTimeout(() => welcome.classList.remove('show'), 3600);
  if (h.greeter) setTimeout(() => { roommates.say(h.greeter!, h.line); sound.say(h.line, 'greet', 0.8); }, 700);
  // took kofi's car? he's noticed
  if (h.home.includes('kofi') && missing(garage, 'kofi')) {
    const line = pick(['wait… where\'s my car??', 'did you take my car?', 'bro. my car. where is it.']);
    setTimeout(() => { roommates.say('kofi', line); sound.say(line, 'greet', 0.9); }, h.greeter === 'kofi' ? 3200 : 1800);
  }
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function enterCar(c: Car) {
  const wasMine = c.owner === 'you';
  sound.play('carDoor', 0.9);
  getIn(garage, c.id);
  mover.speed = 0;
  pos.set(c.x, 0, c.z);
  me.face(c.heading);
  me.root.visible = false;
  if (!wasMine) carsView.soundAlarm(c.id); // someone else's: its lights flash
}

function leaveCar() {
  const at = getOut(garage);
  if (!at) return;
  sound.play('carDoor', 0.9);
  const r = resolveMove(pos, at, stops, collisions());
  pos.set(r.x, 0, r.z);
  mover.speed = 0;
  me.root.visible = true;
}

function jack(vehicleId: number) {
  const r = carjack(traffic, garage, vehicleId);
  if (!r) return;
  const mesh = trafficView.release(vehicleId);
  if (mesh) carsView.take(r.car.id, mesh);
  pos.set(r.car.x, 0, r.car.z);
  me.face(r.car.heading);
  me.root.visible = false;
  mover.speed = 0;
  // the driver goes flying
  const p = new Person(randomLook(800 + jacks++));
  p.root.rotation.order = 'YXZ';
  p.face(r.driver.heading + Math.PI); // looking back at their car as they land
  const out = { x: Math.sin(r.driver.heading), z: Math.cos(r.driver.heading) };
  const f: Fleer = { p, x: r.driver.x - out.x * 0.8, z: r.driver.z - out.z * 0.8, out, t: 0, bubble: null!, body: null! };
  // hit them as well, and they get up and keep running
  f.body = hittable(p, null, { land: (x, z) => { f.x = x; f.z = z; f.t = Math.max(f.t, 1.7); } });
  const yell = pick(YELLS);
  sound.play('carDoor', 1);
  setTimeout(() => sound.say(yell, 'yell'), 450);
  f.bubble = labels.add(yell, new Vector3(), 22, undefined,
    () => p.root.position.clone().setY(2.5), () => f.t > 0.5 && f.t < 4.5);
  f.bubble.classList.add('say');
  scene.add(p.root);
  fleers.push(f);
}

function updateFleers(dt: number) {
  for (const f of [...fleers]) {
    f.t += dt;
    const p = f.p;
    if (busy(f.body)) { /* you hit them (again) */ } else if (f.t < 0.35) { // thrown: flies out and tips over backwards
      const k = f.t / 0.35;
      f.x += f.out.x * dt * 4.5; f.z += f.out.z * dt * 4.5;
      p.flail(dt, -Math.PI / 2 * k);
      p.root.position.set(f.x, Math.sin(k * Math.PI) * 0.5, f.z);
    } else if (f.t < 1.7) { // down… then back up
      const k = f.t < 1.2 ? 1 : 1 - (f.t - 1.2) / 0.5;
      p.limp(-Math.PI / 2 * k);
      p.root.position.set(f.x, 0, f.z);
    } else { // run: off the road to the nearest sidewalk, then away down it
      const curb = f.x > (ROAD.x0 + ROAD.x1) / 2 ? 21.9 : 3;
      const away = Math.sign(f.z - pos.z) || 1;
      const dx = curb - f.x, dirX = Math.abs(dx) > 0.3 ? Math.sign(dx) : 0;
      const dirZ = dirX ? away * 0.35 : away;
      const n = Math.hypot(dirX, dirZ);
      f.x += (dirX / n) * 6 * dt; f.z += (dirZ / n) * 6 * dt;
      p.face(Math.atan2(dirX, dirZ));
      p.root.position.set(f.x, 0, f.z);
      p.walk(dt, 6);
    }
    if (f.t > 16 && !busy(f.body)) {
      scene.remove(p.root);
      labels.remove(f.bubble);
      if (f.body.bubble) labels.remove(f.body.bubble);
      bodies.splice(bodies.indexOf(f.body), 1);
      fleers.splice(fleers.indexOf(f), 1);
    }
  }
}

let shake = 0; // camera shake after a hit

function say(b: Body, text: string, secs = 3) {
  if (!b.bubble) {
    b.bubble = labels.add('', new Vector3(), 24, undefined,
      () => b.p.root.position.clone().setY(b.knock && b.knock.phase !== 'air' ? 1.1 : b.p.root.position.y + 2.5),
      () => performance.now() < b.sayUntil);
    b.bubble.classList.add('say');
  }
  b.bubble.querySelector('.b')!.textContent = text;
  b.sayUntil = performance.now() + secs * 1000;
}

/** Your car vs everyone out on the row: knock them flying, then let them pick themselves up. */
function updateBodies(dt: number) {
  const car = driven(garage);
  for (const b of bodies) {
    if (!b.p.root.visible) continue; // (not out right now)
    const at = b.p.root.position;
    if (car && !(b.knock && b.knock.phase === 'air') && hits(car, at)) {
      b.knock = launch(car, at);
      b.returning = false;
      car.speed *= 0.8; // you feel it
      shake = Math.min(0.6, shake + 0.12 + Math.abs(car.speed) * 0.02);
      const line = pick(OUCH);
      say(b, line, 3.2);
      sound.play('thud', 1);
      setTimeout(() => sound.say(line, 'yell'), 250);
    }
    if (b.knock) {
      const k = b.knock;
      stepKnock(k, dt);
      b.p.root.position.set(k.x, k.y, k.z);
      b.p.face(k.heading);
      if (k.phase === 'air') b.p.flail(dt, k.tilt);
      else b.p.limp(k.tilt);
      if (k.phase === 'done') {
        b.knock = null;
        b.p.walk(dt, 0);
        if (b.land) b.land(k.x, k.z);
        else if (b.back) b.returning = true;
      }
    } else if (b.returning && b.back) {
      // walk back to where you were (a bench, the grass, your frisbee spot) and settle in again
      const dx = b.back.x - at.x, dz = b.back.z - at.z, d = Math.hypot(dx, dz);
      if (d < 0.08) {
        b.returning = false;
        b.p.root.position.set(b.back.x, 0, b.back.z);
        b.p.face(b.back.heading);
        b.back.settle();
      } else {
        const step = Math.min(d, 1.5 * dt);
        b.p.root.position.set(at.x + (dx / d) * step, 0, at.z + (dz / d) * step);
        b.p.face(Math.atan2(dx, dz));
        b.p.walk(dt, 1.5);
      }
    } else b.idle?.(dt);
  }
}

/** What the action button does right now — the closest thing you can do. */
function currentAction(): Act | null {
  if (sittingOn) return { key: 'getup', icon: 'up', label: 'Get up', dist: 0, run: standUp };
  if (garage.driving !== null) return { key: 'getout', icon: 'door', label: 'Get out', dist: 0, run: leaveCar };
  const ride = actionAt(mob, mover, pos);
  if (mover.riding !== null && ride) {
    return {
      key: ride.kind, icon: ride.kind === 'park' ? 'park' : 'off', label: ride.kind === 'park' ? 'Park in rack' : 'Get off', dist: 0,
      run: () => {
        const off = dismount(mob, mover, pos, me.heading)!;
        const at = resolveMove(pos, off.standAt, stops, houseExtra(level, false));
        pos.set(at.x, 0, at.z);
      },
    };
  }
  const options: Act[] = [];
  const lp = toLocal(pos.x, pos.z);
  const ud = mover.riding === null && garage.driving === null ? nearUsdanDoor(where, pos) : null;
  if (ud) {
    const d = Math.hypot(pos.x - ud.x, pos.z - ud.z);
    options.push(where === 'out'
      ? { key: `usdan-in-${ud.id}`, icon: 'door', label: 'Go into Usdan', dist: d, run: () => goUsdan(ud, 'enter') }
      : { key: `usdan-out-${ud.id}`, icon: 'door', label: 'Go outside', dist: d, run: () => goUsdan(ud, 'exit') });
  }
  if (byTheDoor(where, lp.u, lp.v)) {
    const d = Math.abs(lp.u);
    options.push(where === 'out'
      ? { key: 'enter', icon: 'door', label: 'Go inside', dist: d, run: () => goThrough('enter') }
      : { key: 'exit', icon: 'door', label: 'Go outside', dist: d, run: () => goThrough('exit') });
  }
  if (ride?.kind === 'ride') {
    const t = ride.target;
    options.push({
      key: `ride-${t.kind}`, icon: t.kind, label: t.kind === 'bike' ? 'Ride bike' : 'Ride scooter', dist: Math.hypot(t.x - pos.x, t.z - pos.z),
      run: () => {
        mount(mob, mover, t.id);
        pos.set(t.x, 0, t.z);
        me.face(t.heading);
        lastDir.set(Math.sin(t.heading), 0, Math.cos(t.heading));
      },
    });
  }
  if (where === 'out' && mover.riding === null) {
    const c = carAt(garage, pos);
    if (c) {
      options.push({ key: `car-${c.id}`, icon: 'wheel', label: 'Drive', dist: distToCar(c, pos), run: () => enterCar(c) });
    }
    const v = jackable(traffic, pos);
    if (v) options.push({ key: `jack-${v.id}`, icon: 'wheel', label: 'Drive', dist: distToCar(asCar(v), pos), run: () => jack(v.id) });
  }
  const taken = roommates.seatsTaken();
  for (const seat of SEATS) {
    if (seat.level !== level || taken.has(seat.id)) continue;
    const w = toWorld(seat.u, seat.v);
    const d = Math.hypot(w.x - pos.x, w.z - pos.z);
    if (d < 1.6) options.push({ key: `sit-${seat.id}`, icon: 'sit', label: 'Sit', dist: d, run: () => sitDown(seat) });
  }
  if (level === 1) {
    const b = toWorld(BED_SPOT.u, BED_SPOT.v);
    const d = Math.hypot(b.x - pos.x, b.z - pos.z);
    if (d < 1.7) options.push({ key: 'sleep', icon: 'bed', label: 'Sleep', dist: d, run: sleep });
  }
  options.sort((p, q) => p.dist - q.dist);
  return options[0] ?? null;
}

// ── loop ──
let t0 = performance.now();
let frames = 0;
function frame(now: number) {
  frames++;
  // rAF's timestamp can be earlier than the performance.now() we started from — never step backwards
  const dt = Math.min(0.05, Math.max(0, (now - t0) / 1000));
  t0 = now;

  if (!frozen) hour = advance(hour, dt);
  if (Math.abs(hour - lastHour) > 0.004) { applyMood(hour); lastHour = hour; }
  if (now - savedAt > 3000) { if (!frozen) saveHour(); saveCar(); if (!urlSpot) saveWhere(); savedAt = now; }

  // you
  const secs = now / 1000;
  const look = input.consumeLook();
  if (look.dx || look.dy) rig.look(look.dx, look.dy, secs);
  if (input.turnDir) rig.turn(input.turnDir, dt, secs);
  if (input.consumeSnap()) rig.snapBehind(me.heading);
  if (input.consumeTurnAround()) rig.turnAround(secs);
  const mv = rig.move(input.x, input.y, input.held);
  move.set(mv.x, 0, mv.z);
  const mag = Math.min(1, move.length());
  if (sittingOn && mag > 0.5) standUp(); // push the stick to get up
  const car = driven(garage);
  let speed: number;
  if (car) {
    // driving: gas + brake pedals (buttons or W/S), steer by dragging left/right (or A/D)
    const was = car.heading;
    const pedals = input.pedals;
    const r = driveMove(car, stepPedals(car, dt, pedals), stops, collisions(), was);
    tyres.drive(car, dt, pedals, surfaceAt(car, crossings));
    exhaust.emit(car, dt, pedals.gas);
    if (r.hit) car.speed = 0;
    else if (r.scrape) car.speed *= Math.pow(0.4, dt); // scraping along a wall drags you down
    car.x = r.x; car.z = r.z;
    pos.set(car.x, 0, car.z);
    me.face(car.heading);
    lastDir.set(Math.sin(car.heading), 0, Math.cos(car.heading));
    speed = mover.speed = Math.abs(car.speed);
  } else speed = sittingOn ? 0 : stepMover(mover, dt, mag);
  if (!car && mag > 0.01) lastDir.copy(move).normalize();
  if (!car && speed > 0.01) {
    // keep rolling along your last direction as you slow down
    const step = speed * dt;
    const next = resolveMove(pos, { x: pos.x + lastDir.x * step, z: pos.z + lastDir.z * step }, stops, collisions());
    if (next.x === pos.x && next.z === pos.z) mover.speed = 0; // hit a wall
    pos.x = next.x;
    pos.z = next.z;
    level = levelAt(level, pos.x, pos.z);
    const target = Math.atan2(lastDir.x, lastDir.z);
    const turnRate = mover.mode === 'foot' ? 12 : 6; // bikes carve, feet pivot
    me.face(me.heading + wrap(target - me.heading) * Math.min(1, dt * turnRate));
  }
  rig.follow(dt, me.heading, speed > 0.3, secs);
  fwd.set(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw));
  right.set(Math.cos(rig.yaw), 0, -Math.sin(rig.yaw));
  if (input.consumeJump() && !car && !sittingOn && startJump(jump, mover)) { mover.held = Math.min(mover.held, 1); sound.play('jump', 0.6); } // a hop doesn't start a run
  stepJump(jump, dt);
  if (wasAirborne && !airborne(jump)) sound.play('land', 0.7);
  wasAirborne = airborne(jump);
  pos.y = floorY(level, pos.x, pos.z) + (where === 'out' ? groundY(pos.x, pos.z) : 0); // (up the bank and stairs by Olin)
  me.root.position.copy(pos);
  me.root.position.y += jump.y;
  if (sittingOn) me.sitIdle(dt);
  else if (car) { /* hidden in the car */ }
  else if (mover.mode === 'bike') me.ride(dt, speed);
  else if (mover.mode === 'scooter') me.scoot(dt, speed);
  else me.walk(dt, speed);
  if (airborne(jump)) me.airPose(jump.vy);

  // the action button: ride / park / get off / sit / get up / sleep
  if (input.consumeAction()) {
    const a = currentAction();
    if (a) a.run();
    actKey = '\u0000'; // force a relabel next (even if there's now nothing to do — the button must hide)
  }
  carry(mob, mover, pos, me.heading);
  rideView.update(mob, mover.riding, speed, dt);
  carsView.update(garage, dt, secs);
  updateSpeedo(speed);
  const driving = !!car;
  document.body.classList.toggle('driving', driving);
  gasBtn.classList.toggle('show', driving);
  brakeBtn.classList.toggle('show', driving);
  jumpBtn.classList.toggle('show', !driving && !sittingOn && mover.mode === 'foot' && !introRunning());
  if (!driving) input.gasHeld = input.brakeHeld = false;
  tyres.update(dt);
  exhaust.update(dt);
  pruzanTick(dt);
  updateFleers(dt);
  const act = currentAction();
  const key = act ? act.key : '';
  if (key !== actKey) {
    actKey = key;
    actBtn.innerHTML = act ? ICON[act.icon] : '';
    actBtn.setAttribute('aria-label', act ? act.label : '');
    actBtn.classList.toggle('show', !!act);
  }

  // your house: through the door, roommates, the cut-away
  let local = toLocal(pos.x, pos.z);
  const through = mover.riding === null && garage.driving === null ? portalAt(where, local.u, local.v) : null;
  if (through) { goThrough(through); local = toLocal(pos.x, pos.z); }
  const ut = mover.riding === null && garage.driving === null && !through ? usdanPortalAt(where, pos) : null;
  if (ut) goUsdan(ut.door, ut.kind);
  const indoors = where !== 'out';
  if (where === 'usdan') {
    usdan.update(camera.position, pos);
    for (const s of insiders) {
      if (s.lane) { // up and down the corridor
        s.z! += s.dir! * s.speed! * dt;
        if (s.z! > s.lane[2] || s.z! < s.lane[1]) s.dir = s.dir! > 0 ? -1 : 1;
        s.p.root.position.set(s.lane[0], 0, s.z!);
        s.p.face(s.dir! > 0 ? 0 : Math.PI);
        s.p.walk(dt, s.speed!);
      } else if (s.sit) s.p.sitIdle(dt);
      else s.p.walk(dt, 0);
    }
  }
  const door = toWorld(0, (FRONT_DOOR.v0 + FRONT_DOOR.v1) / 2);
  const doorOpens = Math.hypot(pos.x - door.x, pos.z - door.z) < 2.4 || roommates.near(door.x, door.z, 2.2);
  house.update(dt, camera.position, { x: pos.x, z: pos.z, level, inside: where === 'in' }, doorOpens);
  roommates.update(dt, hour, house.upstairs.visible);

  // passers-by
  for (const w of walkers) {
    if (busy(w.body)) continue;
    w.off -= Math.sign(w.off) * Math.min(Math.abs(w.off), 0.8 * dt); // drift back to your side of the walk
    w.z += w.dir * -w.speed * dt;
    if (w.z < WALK_MAX_Z - 30) w.z = WALK_MIN_Z + 30;
    if (w.z > WALK_MIN_Z + 30) w.z = WALK_MAX_Z - 30;
    // step aside for you
    // step aside for you on foot (a car, they don't see coming)
    const wx = w.x + w.off, dx = wx - pos.x, dz = w.z - pos.z;
    const near = garage.driving === null && Math.abs(dz) < 2.2 && Math.abs(dx) < 1.1 && Math.abs(pos.x) < PATH_HALF + 1;
    const x = near ? wx + Math.sign(dx || 1) * (1.1 - Math.abs(dx)) : wx;
    w.p.root.position.set(x, 0, w.z);
    w.p.face(w.dir > 0 ? Math.PI : 0);
    w.p.walk(dt, w.speed);
  }

  // High Street
  const inRoad: Obstacle[] = [...roadBlocks(garage), ...fleers.map((f) => ({ x: f.x, z: f.z }))];
  for (const b of bodies) if (busy(b) && onRoad(b.p.root.position)) inRoad.push(b.p.root.position); // someone lying in the road
  if (garage.driving === null) inRoad.push(pos);
  stepTraffic(traffic, dt, inRoad);
  // impatient drivers lean on the horn
  for (const v of traffic.vehicles) {
    const w = v.waited ?? 0;
    if (w === 0) { honkedAt.delete(v.id); continue; }
    if (honkNow(w, honkedAt.get(v.id) ?? -1)) {
      honkedAt.set(v.id, w);
      const e = ears(LANES[v.lane].x, v.z, 90);
      sound.play('horn', e.vol * (where === 'out' ? 1 : 0.2), e.pan);
    }
  }
  // the always-on sound, a few times a second
  mixT += dt;
  if (mixT > 0.15) {
    mixT = 0;
    let busy = 0, people = 0;
    for (const v of traffic.vehicles) { const d = Math.hypot(LANES[v.lane].x - pos.x, v.z - pos.z); if (d < 40) busy += (1 - d / 40) * 0.35; }
    if (where === 'usdan') people = insiders.length;
    else if (where === 'in') people = 3;
    else for (const b of bodies) if (Math.hypot(b.p.root.position.x - pos.x, b.p.root.position.z - pos.z) < 15) people++;
    const c = driven(garage), surf = c ? surfaceAt(c, crossings) : 'grass';
    const pd = input.pedals;
    sound.setMix(mixAt({
      hour, where, roadDist: Math.abs(pos.x - (ROAD.x0 + ROAD.x1) / 2), traffic: busy, people,
      car: c ? c.speed : null, gas: c ? pd.gas : 0, surface: surf,
      skidding: !!c && surf !== 'grass' && leavesMark(surf, c.speed, pd.steer, pd.brake > 0 && c.speed > 0.5),
    }), 0.15);
  }
  sound.tick();
  trafficView.update(dt);
  // cars left in the road get moved once you've walked off
  if (frames % 30 === 0) {
    for (const done of clearRoad(garage, traffic, pos)) {
      if (done.fate === 'towed') continue;
      const mesh = carsView.give(done.car.id);
      if (done.fate === 'traffic' && mesh) trafficView.adopt(done.vehicle!, mesh);
    }
  }

  // frisbee: 2.4s per throw, alternating
  const ft = (now / 1000) % 4.8;
  const aToB = ft < 2.4;
  const u = (ft % 2.4) / 2.4;
  const flight = Math.min(1, Math.max(0, (u - 0.2) / 0.65));
  const from = aToB ? FA : FB, to = aToB ? FB : FA;
  disc.position.lerpVectors(from, to, flight).setY(1.4 + Math.sin(flight * Math.PI) * 2.2);
  disc.rotation.y += dt * 14;
  const playing = !busy(faBody) && !busy(fbBody);
  disc.visible = playing;
  if (!busy(faBody)) fa.walk(dt, 0);
  if (!busy(fbBody)) fb.walk(dt, 0);
  if (playing) (aToB ? fa : fb).throwPose(u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) * 5));
  updateBodies(dt);

  // behind the row: students on the back path, the golf cart, the burrito truck
  for (const w of backWalkers) {
    if (busy(w.body)) continue;
    w.z += w.dir * w.speed * dt;
    if (w.z > backZ.z1 - 2 || w.z < backZ.z0 + 2) w.dir = w.dir > 0 ? -1 : 1; // turn back at the ends
    w.p.root.position.set(w.x, 0, w.z);
    w.p.face(w.dir > 0 ? 0 : Math.PI);
    w.p.walk(dt, w.speed);
  }
  for (const w of xWalkers) {
    const sg = xSegs[w.seg], dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z, L = Math.hypot(dx, dz);
    if (busy(w.body)) continue;
    w.t += (w.dir * w.speed * dt) / L;
    if (w.t > 1 || w.t < 0) { w.t = Math.min(1, Math.max(0, w.t)); w.dir = w.dir > 0 ? -1 : 1; } // and back again
    const ox = (-dz / L) * w.side, oz = (dx / L) * w.side; // a little to one side of the middle
    w.p.root.position.set(sg.a.x + dx * w.t + ox, 0, sg.a.z + dz * w.t + oz);
    w.p.face(Math.atan2(dx * w.dir, dz * w.dir));
    w.p.walk(dt, w.speed);
  }
  roadWalkers.forEach((w, i) => {
    if (busy(w.body)) return;
    w.x += w.dir * w.speed * dt;
    if (w.x > ROAD_WALK.x1 || w.x < ROAD_WALK.x0) { w.dir = w.dir > 0 ? -1 : 1; w.z = roadLane(w.dir, i); }
    w.p.root.position.set(w.x, 0, w.z);
    w.p.face(w.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    w.p.walk(dt, w.speed);
  });
  const drivenCar = driven(garage);
  stepCart(cart, dt, drivenCar ? [drivenCar] : [pos]);
  cartView.update(cart, dt);
  const open = isOpen(hour);
  if (stepOrder(order, dt, open)) truck.serve();
  truck.update(dt, open);

  // camera: intro swoop, then follow
  const portrait = innerWidth < innerHeight;
  // sit a little out over the field (+x) and look back across the facades
  const fast = (1 + Math.min(0.55, Math.max(0, mover.speed - 3) / 26)) * (car ? 1.3 : 1); // pull back a little when you're moving fast
  // indoors: closer and higher, looking down into the room (walls in the way are cut away)
  const dist = where === 'usdan' ? 6.8 : indoors ? 5.2 : (portrait ? 9 : 8.6) * fast;
  const up = where === 'usdan' ? Math.min(4.0, 3.3 * (1 + rig.pitch)) // stay under Usdan's ceiling
    : (indoors ? 7.4 : (portrait ? 6 : 4.4) * fast) * (1 + rig.pitch);
  const side = indoors ? 0 : right.x; // +1 when +x is screen-right, −1 when it's screen-left
  want.copy(pos).addScaledVector(fwd, -dist).addScaledVector(right, 2.2 * side).setY(pos.y + up);
  let clear = 1;
  if (!indoors) {
    // never let the camera end up inside your house: stop it in front of the wall, and lift it to look down at you
    const t = (clear = cameraClearance(pos, want));
    if (t < 1) {
      const lost = (1 - t) * Math.hypot(want.x - pos.x, want.z - pos.z);
      want.set(pos.x + (want.x - pos.x) * t * 0.92, want.y + lost * 0.6, pos.z + (want.z - pos.z) * t * 0.92);
    }
  }
  introT = Math.min(1, introT + dt / 2.6);
  const k = introT < 1 ? 1 - Math.pow(1 - introT, 3) : 1;
  camPos.lerp(want, snapCamera ? 1 : introT < 1 ? k * 0.12 + 0.02 : 1 - Math.exp(-dt * 7));
  snapCamera = false;
  camera.position.copy(camPos);
  if (shake > 0.002) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= Math.exp(-dt * 7);
  }
  // look ahead of you — less so when the camera's had to tuck in close, so you stay on screen
  const ahead = where === 'usdan' ? 5 : indoors ? 2.5 : 9 * Math.max(0.15, clear);
  lookAt.copy(pos).addScaledVector(fwd, ahead).addScaledVector(right, -1.8 * side * clear).setY(pos.y + 1.1 - rig.pitch * 1.5);
  // the opening shot at home: start on your house, then turn to the street as the camera comes round behind you
  if (atHomeStart && introT < 1) lookAt.lerpVectors(HOUSE_LOOK, lookAt, k);
  camera.lookAt(lookAt);

  // light + sky follow you
  const dir = (sun.userData.dir as Vector3) ?? new Vector3(0, 1, 0);
  sun.position.copy(pos).addScaledVector(dir, 120);
  sun.target.position.copy(pos).addScaledVector(fwd, 18);
  sky.follow(camera.position);
  fill.position.set(pos.x, pos.y + 2.6, pos.z).addScaledVector(fwd, -1.5);

  if (frames % 15 === 0 && where === 'out') world.lightNear(pos);
  if (frames % 6 === 0) miniMap.draw(pos, me.heading);

  // "now passing"
  const byUsdan = inPoly(pos, USDAN) || distToPoly(pos, USDAN) < 9;
  const stop = pos.x < 8 && !byUsdan ? stops.find((s) => pos.z <= s.z0 + 2 && pos.z >= s.z1 - 2) : undefined;
  const atHome = local.u > -8 && local.u < 18 && Math.abs(local.v) < 12; // (includes the sidewalk out front)
  const onField = pos.x < FIELD_X && pos.z < FIELD_ROAD.z0 && !byUsdan;
  const south = southEndNear(pos);
  const here = indoors ? null : byUsdan ? USDAN_NAME : south ?? (onField ? 'Andrus Field' : stop?.name ?? (atHome ? 'your house' : null)); // (inside, the welcome card says it)
  if (here) { passingName.textContent = here; passing.classList.add('show'); }
  else passing.classList.remove('show');

  labels.where = where === 'out' ? 'out' : 'in';
  labels.update(camera, pos, innerWidth, innerHeight);
  renderer.render(sceneFor(where), camera);
  requestAnimationFrame(frame);
}

// test / debug hook (read-only views + a few controls) — used by e2e tests
Object.assign(window, {
  __vora: {
    pos, stops, crossings, traffic, benches: world.benches,
    get yaw() { return rig.yaw; },
    mob, mover, roommates, garage, obstacles: world.obstacles,
    get driving() { return garage.driving; },
    get fleeing() { return fleers.length; },
    get knocked() { return bodies.filter((b) => b.knock !== null).length; },
    cart,
    get truckOpen() { return truck.group.visible; },
    get inLine() { return truck.inLine; },
    get served() { return order.served; },
    get bodies() { return bodies.map((b) => ({ x: b.p.root.position.x, z: b.p.root.position.z, busy: busy(b) })); },
    get level() { return level; },
    get indoors() { const l = toLocal(pos.x, pos.z); return insideHouse(l.u, l.v); },
    get sitting() { return sittingOn?.id ?? null; },
    get where() { return where; },
    get insiders() { return insiders.length; },
    get upstairsShown() { return house.upstairs.visible; },
    get running() { return isRunning(mover); },
    get action() { return actKey; },
    get actionLabel() { return actBtn.getAttribute('aria-label') ?? ''; },
    get jumpY() { return jump.y; },
    get speedo() { return speedo.reading; },
    get marks() { return tyres.count; },
    get mapOpen() { return fullMap.isOpen; },
    mapPick(id: string) { fullMap.pick(id); },
    get sound() { return { started: sound.started, state: sound.state, muted: sound.muted, log: sound.log.slice(-20) }; },
    get hour() { return hour; },
    get mode() { return periodOf(hour); },
    /** Render now and count distinct colours on a 12×12 grid — a blank/broken canvas gives ~1. */
    sample() {
      renderer.render(sceneFor(where), camera);
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4), seen = new Set<string>();
      for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
        gl.readPixels(Math.floor((w * (i + 0.5)) / 12), Math.floor((h * (j + 0.5)) / 12), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        seen.add(px.join());
      }
      return seen.size;
    },
    get night() { return night; },
    get light() { return lightAt(traffic.t); },
    get frames() { return frames; },
    /** Draw calls + triangles in the last frame (for chasing slow views). */
    get stats() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
  },
});

applyMood(hour);
lastHour = hour;
if (where !== 'out') sceneFor(where).add(me.root, fill);
if (introT === 1) camPos.set(pos.x + Math.sin(rig.yaw) * 9, 6, pos.z + Math.cos(rig.yaw) * 9); // already behind you
requestAnimationFrame(frame);
const boot = document.getElementById('boot')!;
setTimeout(() => { boot.classList.add('hide'); hud.classList.add('show'); }, 500);
setTimeout(() => boot.remove(), 1300);
