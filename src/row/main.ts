import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, Mesh, PCFSoftShadowMap,
  PerspectiveCamera, PointLight, Scene, Vector3, WebGLRenderer,
} from 'three';
import { Sky, moodAt } from './sky';
import { BoxBank, WindowBank, lambert } from './kit';
import { buildRow } from './buildings';
import { FRONT_X, PATH_HALF, WALK_MAX_Z, WALK_MIN_Z } from './layout';
import { World } from './world';
import { resolveMove } from './collide';
import {
  actionAt, carry, createMobility, dismount, isRunning, mount, newMover, stepMover,
} from './mobility';
import { RideView } from './rideables';
import { HouseView } from './house/view';
import { Roommates } from './house/roommates';
import { homecoming, listNames } from './house/routine';
import { floorY, houseExtra, levelAt } from './house/collide';
import { BED_SPOT, FRONT_DOOR, Level, SEATS, Seat, insideHouse, toLocal, toWorld } from './house/plan';
import { ENTER_AT, EXIT_AT, Where, cameraClearance, nearDoor as byTheDoor, portalAt } from './house/portal';
import { LANES, createTraffic, lightAt, stepTraffic } from './traffic';
import { Traffic } from './vehicles';
import { START_HOUR, advance, formatHour, nextPreset, periodOf, wrapHour } from './clock';
import { Person, discGeometry, randomLook } from './people';
import { Labels, Note, Trail, buildTrails } from './traces';
import { Input } from './controls';
import { CameraRig, wrap } from './camera';
import { rng } from '../noise';

// ─── College Row — vibe test ───────────────────────────────────────────
// One place, done well: portrait, one thumb, opens from a link. Walk the
// row, watch the light change, see who's been here. Everything social on
// screen is demo data until there's a server.

const isTouch = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// ── renderer / scene ──
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
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

// ── people ──
const me = new Person({ skin: 0x6b3e26, hair: 0x121212, hairStyle: 'short', top: 0xc8302a, legs: 0x2b2b30, pack: 0x2b3a66 });
// spawn just short of Usdan, the row ahead on your right; ?x= / ?z= to start elsewhere
const SPAWN = { x: -0.6, z: S('Usdan').z1 - 8 };
const pos = new Vector3(parseFloat(params.get('x') ?? String(SPAWN.x)), 0, parseFloat(params.get('z') ?? String(SPAWN.z)));
let level: Level = params.get('level') === '1' ? 1 : 0; // which floor you're on (only matters in your house)
pos.y = floorY(level, pos.x, pos.z);
me.root.position.copy(pos);
me.face(0); // facing +z, down the row
scene.add(me.root);
let sittingOn: Seat | null = null;
// which world you're in: the street, or inside your house (?x/?z can start you inside)
let where: Where = insideHouse(toLocal(pos.x, pos.z).u, toLocal(pos.x, pos.z).v) ? 'in' : 'out';

// ── getting around: walk → run, bikes + scooters in racks and loose on the walk ──
const mob = createMobility(stops, crossings, SPAWN);
const mover = newMover();
const rideView = new RideView(mob);
scene.add(rideView.group);
const actBtn = document.getElementById('act')!;
let actKey = '';
const lastDir = new Vector3(0, 0, 1);

interface Walker { p: Person; x: number; z: number; dir: number; speed: number }
const walkers: Walker[] = [];
for (let i = 0; i < 26; i++) {
  const p = new Person(randomLook(i + 3));
  const dir = rng(i * 3 + 1) < 0.5 ? 1 : -1;
  const w: Walker = {
    p, dir,
    x: dir > 0 ? 0.4 + rng(i + 9) * 1.6 : -0.4 - rng(i + 9) * 1.6, // keep right, mostly
    z: WALK_MAX_Z + rng(i * 5 + 2) * (WALK_MIN_Z - WALK_MAX_Z),
    speed: 1.05 + rng(i * 7) * 0.5,
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

let seated = 0;
const sitAt = (p: Person, x: number, z: number, heading: number, seatY: number) => {
  p.root.position.set(x, 0, z);
  p.face(heading);
  p.sit(seatY);
  scene.add(p.root);
  seated++;
};
// benches: a few taken
world.benches.slice(0, 6).forEach((b, i) => {
  if (i % 2 === 0) sitAt(new Person(randomLook(300 + i)), b.x + 0.05, b.z - 0.45, Math.PI / 2, 0.5);
  if (i % 3 === 0) sitAt(new Person(randomLook(320 + i)), b.x + 0.05, b.z + 0.5, Math.PI / 2, 0.5);
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

// ── mood ──
let lastHour = -1;
let night = 0;
const glass = new Color();
// a soft light that walks with you, so you're not a silhouette after dark
const fill = new PointLight(0xffe4c4, 0, 9, 1.6);
scene.add(fill);
function applyMood(h: number) {
  const m = moodAt(h);
  night = m.night;
  fill.intensity = m.night * 14;
  trafficView.setNight(m.night);
  house.setNight(m.night);
  sky.apply(m);
  (scene.fog as Fog).color.copy(m.horizon);
  hemi.color.copy(m.hemiSky);
  hemi.groundColor.copy(m.hemiGround);
  hemi.intensity = m.hemiI;
  homeHemi.intensity = 1.7 - m.night * 1.0;
  homeDay.intensity = (1 - m.night) * 1.3;
  sun.color.copy(m.sun);
  sun.intensity = m.sunI;
  glass.copy(m.top).lerp(m.horizon, 0.45).multiplyScalar(0.55);
  windows.paint(glass, m.night);
  world.setNight(m.night);
  sun.userData.dir = m.sunDir;
  clockBtn.innerHTML = `${formatHour(h)}<small>${periodOf(h)}</small>`;
}

// ── input + camera ──
const input = new Input();
input.onFirstMove = () => setTimeout(() => hint.classList.add('gone'), 2500);
const rig = new CameraRig(parseFloat(params.get('yaw') ?? String(Math.PI))); // π = looking +z, down the row from Usdan; ?yaw= for screenshots
const camPos = new Vector3(pos.x + 60, 70, pos.z - 90);
const lookAt = new Vector3();
const fwd = new Vector3(), right = new Vector3(), move = new Vector3(), want = new Vector3();
let snapCamera = false; // jump the camera (after going through a door) instead of gliding
let introT = params.get('intro') === '0' ? 1 : 0; // ?intro=0 skips the opening swoop

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
interface Act { key: string; label: string; dist: number; run: () => void }

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
  fade.classList.add('show');
  setTimeout(() => {
    hour = hour < 7.5 ? 7.5 : 7.5 + 24; // to the next morning
    hour %= 24;
    lastHour = hour;
    applyMood(hour);
    saveHour();
    fade.classList.remove('show');
  }, 900);
}

/** Everything you can bump into right now: the house (by floor), and outside, nearby trunks, posts, benches and traffic. */
const VEHICLE_HALF_W = { car: 0.95, truck: 1.2, bike: 0.35 } as const;
function collisions() {
  const base = houseExtra(level, mover.riding !== null);
  if (where === 'in') return base;
  const near = (b: { x0: number; x1: number; z0: number; z1: number }) =>
    b.x1 > pos.x - 12 && b.x0 < pos.x + 12 && b.z1 > pos.z - 12 && b.z0 < pos.z + 12;
  const solids = [...(base.solids ?? []), ...world.obstacles.filter(near)];
  for (const v of traffic.vehicles) {
    const x = LANES[v.lane].x, hw = VEHICLE_HALF_W[v.kind] + 0.3, hl = v.len / 2 + 0.3;
    const b = { x0: x - hw, x1: x + hw, z0: v.z - hl, z1: v.z + hl };
    if (near(b)) solids.push(b);
  }
  return { ...base, solids };
}

/** Through the front door: a quick fade, and you're in the other world, facing the right way. */
function goThrough(kind: 'enter' | 'exit') {
  const at = kind === 'enter' ? ENTER_AT : EXIT_AT;
  const w = toWorld(at.u, at.v);
  pos.set(w.x, 0, w.z);
  level = 0;
  where = kind === 'enter' ? 'in' : 'out';
  (where === 'in' ? homeScene : scene).add(me.root, fill);
  me.face(at.heading);
  lastDir.set(Math.sin(at.heading), 0, Math.cos(at.heading));
  mover.speed = 0;
  rig.snapBehind(at.heading);
  snapCamera = true;
  fade.classList.add('blink');
  setTimeout(() => fade.classList.remove('blink'), 260);
  if (where === 'in') welcomeHome();
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
  if (h.greeter) setTimeout(() => roommates.say(h.greeter!, h.line), 700);
}

/** What the action button does right now — the closest thing you can do. */
function currentAction(): Act | null {
  if (sittingOn) return { key: 'getup', label: 'Get up', dist: 0, run: standUp };
  const ride = actionAt(mob, mover, pos);
  if (mover.riding !== null && ride) {
    return {
      key: ride.kind, label: ride.kind === 'park' ? 'Park in rack' : 'Get off', dist: 0,
      run: () => {
        const off = dismount(mob, mover, pos, me.heading)!;
        const at = resolveMove(pos, off.standAt, stops, houseExtra(level, false));
        pos.set(at.x, 0, at.z);
      },
    };
  }
  const options: Act[] = [];
  const lp = toLocal(pos.x, pos.z);
  if (byTheDoor(where, lp.u, lp.v)) {
    const d = Math.abs(lp.u);
    options.push(where === 'out'
      ? { key: 'enter', label: '🚪  Go inside', dist: d, run: () => goThrough('enter') }
      : { key: 'exit', label: '🚪  Go outside', dist: d, run: () => goThrough('exit') });
  }
  if (ride?.kind === 'ride') {
    const t = ride.target;
    options.push({
      key: `ride-${t.kind}`, label: t.kind === 'bike' ? '🚲  Ride' : '🛴  Ride', dist: Math.hypot(t.x - pos.x, t.z - pos.z),
      run: () => {
        mount(mob, mover, t.id);
        pos.set(t.x, 0, t.z);
        me.face(t.heading);
        lastDir.set(Math.sin(t.heading), 0, Math.cos(t.heading));
      },
    });
  }
  const taken = roommates.seatsTaken();
  for (const seat of SEATS) {
    if (seat.level !== level || taken.has(seat.id)) continue;
    const w = toWorld(seat.u, seat.v);
    const d = Math.hypot(w.x - pos.x, w.z - pos.z);
    if (d < 1.6) options.push({ key: `sit-${seat.id}`, label: '🛋  Sit', dist: d, run: () => sitDown(seat) });
  }
  if (level === 1) {
    const b = toWorld(BED_SPOT.u, BED_SPOT.v);
    const d = Math.hypot(b.x - pos.x, b.z - pos.z);
    if (d < 1.7) options.push({ key: 'sleep', label: '🛏  Sleep', dist: d, run: sleep });
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
  if (!frozen && now - savedAt > 5000) { saveHour(); savedAt = now; }

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
  const speed = sittingOn ? 0 : stepMover(mover, dt, mag);
  if (mag > 0.01) lastDir.copy(move).normalize();
  if (speed > 0.01) {
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
  pos.y = floorY(level, pos.x, pos.z);
  me.root.position.copy(pos);
  if (sittingOn) { /* pose set when you sat down */ }
  else if (mover.mode === 'bike') me.ride(dt, speed);
  else if (mover.mode === 'scooter') me.scoot(dt, speed);
  else me.walk(dt, speed);

  // the action button: ride / park / get off / sit / get up / sleep
  if (input.consumeAction()) {
    const a = currentAction();
    if (a) a.run();
    actKey = ''; // relabel now
  }
  carry(mob, mover, pos, me.heading);
  rideView.update(mob, mover.riding, speed, dt);
  const act = currentAction();
  const key = act ? act.key : '';
  if (key !== actKey) {
    actKey = key;
    actBtn.textContent = act ? act.label : '';
    actBtn.classList.toggle('show', !!act);
  }

  // your house: through the door, roommates, the cut-away
  let local = toLocal(pos.x, pos.z);
  const through = mover.riding === null ? portalAt(where, local.u, local.v) : null;
  if (through) { goThrough(through); local = toLocal(pos.x, pos.z); }
  const indoors = where === 'in';
  const door = toWorld(0, (FRONT_DOOR.v0 + FRONT_DOOR.v1) / 2);
  const doorOpens = Math.hypot(pos.x - door.x, pos.z - door.z) < 2.4 || roommates.near(door.x, door.z, 2.2);
  house.update(dt, camera.position, { x: pos.x, z: pos.z, level, inside: indoors }, doorOpens);
  roommates.update(dt, hour, house.upstairs.visible);

  // passers-by
  for (const w of walkers) {
    w.z += w.dir * -w.speed * dt;
    if (w.z < WALK_MAX_Z - 30) w.z = WALK_MIN_Z + 30;
    if (w.z > WALK_MIN_Z + 30) w.z = WALK_MAX_Z - 30;
    // step aside for you
    const dx = w.x - pos.x, dz = w.z - pos.z;
    const near = Math.abs(dz) < 2.2 && Math.abs(dx) < 1.1 && Math.abs(pos.x) < PATH_HALF + 1;
    const x = near ? w.x + Math.sign(dx || 1) * (1.1 - Math.abs(dx)) : w.x;
    w.p.root.position.set(x, 0, w.z);
    w.p.face(w.dir > 0 ? Math.PI : 0);
    w.p.walk(dt, w.speed);
  }

  // High Street
  stepTraffic(traffic, dt, [pos]);
  trafficView.update(dt);

  // frisbee: 2.4s per throw, alternating
  const ft = (now / 1000) % 4.8;
  const aToB = ft < 2.4;
  const u = (ft % 2.4) / 2.4;
  const flight = Math.min(1, Math.max(0, (u - 0.2) / 0.65));
  const from = aToB ? FA : FB, to = aToB ? FB : FA;
  disc.position.lerpVectors(from, to, flight).setY(1.4 + Math.sin(flight * Math.PI) * 2.2);
  disc.rotation.y += dt * 14;
  (aToB ? fa : fb).throwPose(u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) * 5));
  fa.walk(dt, 0); fb.walk(dt, 0);

  // camera: intro swoop, then follow
  const portrait = innerWidth < innerHeight;
  // sit a little out over the field (+x) and look back across the facades
  const fast = 1 + Math.max(0, mover.speed - 3) / 22; // pull back a little when you're moving fast
  // indoors: closer and higher, looking down into the room (walls in the way are cut away)
  const dist = indoors ? 5.2 : (portrait ? 9 : 8.6) * fast;
  const up = (indoors ? 7.4 : (portrait ? 6 : 4.4) * fast) * (1 + rig.pitch);
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
  // look ahead of you — less so when the camera's had to tuck in close, so you stay on screen
  const ahead = indoors ? 2.5 : 9 * Math.max(0.15, clear);
  lookAt.copy(pos).addScaledVector(fwd, ahead).addScaledVector(right, -1.8 * side * clear).setY(pos.y + 1.1 - rig.pitch * 1.5);
  camera.lookAt(lookAt);

  // light + sky follow you
  const dir = (sun.userData.dir as Vector3) ?? new Vector3(0, 1, 0);
  sun.position.copy(pos).addScaledVector(dir, 120);
  sun.target.position.copy(pos).addScaledVector(fwd, 18);
  sky.follow(camera.position);
  fill.position.set(pos.x, pos.y + 2.6, pos.z).addScaledVector(fwd, -1.5);

  // "now passing"
  const stop = pos.x < 8 ? stops.find((s) => pos.z <= s.z0 + 2 && pos.z >= s.z1 - 2) : undefined;
  const atHome = local.u > -6 && local.u < 18 && Math.abs(local.v) < 12;
  const here = indoors ? null : stop?.name ?? (atHome ? 'your house' : null); // (inside, the welcome card says it)
  if (here) { passingName.textContent = here; passing.classList.add('show'); }
  else passing.classList.remove('show');

  labels.where = where;
  labels.update(camera, pos, innerWidth, innerHeight);
  renderer.render(where === 'in' ? homeScene : scene, camera);
  requestAnimationFrame(frame);
}

// test / debug hook (read-only views + a few controls) — used by e2e tests
Object.assign(window, {
  __vora: {
    pos, stops, crossings, traffic, benches: world.benches,
    get yaw() { return rig.yaw; },
    mob, mover, roommates,
    get level() { return level; },
    get indoors() { const l = toLocal(pos.x, pos.z); return insideHouse(l.u, l.v); },
    get sitting() { return sittingOn?.id ?? null; },
    get where() { return where; },
    get upstairsShown() { return house.upstairs.visible; },
    get running() { return isRunning(mover); },
    get action() { return actKey; },
    get hour() { return hour; },
    get mode() { return periodOf(hour); },
    /** Render now and count distinct colours on a 12×12 grid — a blank/broken canvas gives ~1. */
    sample() {
      renderer.render(scene, camera);
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
  },
});

applyMood(hour);
lastHour = hour;
if (where === 'in') homeScene.add(me.root, fill);
if (introT === 1) camPos.set(pos.x + 2.2, 6, pos.z - 9);
requestAnimationFrame(frame);
const boot = document.getElementById('boot')!;
setTimeout(() => { boot.classList.add('hide'); hud.classList.add('show'); }, 500);
setTimeout(() => boot.remove(), 1300);
