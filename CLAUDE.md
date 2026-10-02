# Vora — handoff for the next session

## What this is
**Vora** is a live, social, ambient "campus that lives between sessions": a stylized Wesleyan University you can walk around on your phone. The long-term vision is in `campus_sim_brief (1).html`. It's marked "Confidential Draft", but the user said (2026-10-01) that nothing in this project is private, so it's committed to the repo. Its core ideas:

- **Presence over content.** The only metric that matters is whether people open it when nothing is planned.
- **Place is identity.**
- **Never feel optimized.** No streaks, XP or leaderboards.
- **Biggest risk: density collapse,** meaning the world feels empty.

The current direction (since 2026-09-30) was inspired by "Lagos Run" (danfo.horpey.dev): one small, very specific, beautiful place. It's web-based, works in portrait with one thumb, opens from a link, and is built from procedural Three.js geometry with no model files.

The user is a Wesleyan student, the founder and the designer. They make the product calls; you build, test, and give honest opinions. They play on an iPhone, mostly with their **right thumb**.

## How to run
- `npm run dev` → http://localhost:5173/row.html. This is the game. `/` is the old Pixi Foss Hill greybox, which is still working but parked.
- `npm test`: Vitest unit tests (235, about 8 s).
- Browser tests (Playwright, 58) run against a **built copy** (`vite build` into `dist-e2e/`, served by `vite preview` on port 5189), snapshotted when the run starts. So you **can keep editing source while they run**. They use the installed Google Chrome with SwiftShader WebGL, 2 workers (`-- --workers=1` when the machine is busy).
  - `npm run test:smoke`: 11 key tests tagged `@smoke`, about 3 min. Run after each feature.
  - `npm run test:e2e -- -g carjack`: just the tests whose names match.
  - `npm run test:e2e`: everything, 10+ min. Run it in the background.
- `npm run check:quick`: tsc + unit tests + smoke. `npm run check`: tsc + unit + all browser tests, before commits. **Keep it green.** The user asked for everything to be tested comprehensively. The agreed workflow (2026-10-01) is unit tests on every change, smoke after each feature, the full suite in the background before commits.
- URL debug params: `?t=17.3` freezes the game hour, `?x=&z=` sets the start position, `?yaw=` sets the camera direction, `?level=1` starts upstairs, `?intro=0` skips the camera swoop.
- `window.__vora` is a read-only debug hook (pos, level, where, mover, traffic, roommates, `sample()` pixel check, and more). The e2e tests rely on it.

### Testing gotchas
- The e2e suite tests a build, so edits during a run don't affect it. But a `vite.config.ts` change only takes effect on the next run.
- The `hold()` helper in the spec counts *rendered frames*, not wall time, before deciding you've stopped. Under load, SwiftShader can drop to 1–4 fps.
- `__vora.stats` gives draw calls and triangles for the last frame. Scenes run about 400–1500 draw calls, mostly from people (about 11 meshes each, plus shadows). Watch this on iPhone.
- The machine sometimes runs heavy background load (`routined`, `contactsd`), with load averages up to 100+. When that happens the e2e tests time out for reasons unrelated to the code. Check `uptime` before blaming the code.
- Screenshot/visual checks: launch Playwright with `channel: 'chrome'`, args `--use-angle=swiftshader --enable-unsafe-swiftshader`, viewport 390×844, and use the URL params above.

## The world (all in `src/row/`)
You **start the game outside your house**, on the sidewalk at the end of your front path (`HOME_SPAWN` in `house/plan.ts`), looking up High Street (+z, with −z as north). The opening camera swoop starts across the street, looking back at you and the house. The tests' `open()` helper starts at `ROW_ENTRY` (the north end of the walk, just short of **Boger**) unless told `home`. Walk **+z** along the High Street side of **College Row**:
- The **buildings are on your right (−x)**, in this order: Boger → South College (belfry) → North College (green-domed cupola) → Zelnick Pavilion (glass link) → Memorial Chapel (red-striped roof, spire) → Judd → Allbritton.
- **Usdan is not on the row.** Per the user's Google Maps screenshot and photos, it's a big triangle *behind and west of Boger*, north of the field, with a courtyard, brick, deep dark eaves and glass clerestories on top. It's `USDAN` (a polygon) in `layout.ts`, solid via `inUsdan`. Between Usdan's east face and Boger is a **wide plaza** (`PLAZA` / `PLAZA_GAP`, contents in `plaza.ts`). It has speckled concrete slabs, trees in red stone-chip pits, granite benches and an oval table, grey outdoor tables with people at them, mum planters, bollards and a blue-lidded bin. The back path runs north into it. The Boger–South walkway passes Usdan's south side. The **burrito truck** (white, 10:30–15:30, with a line of students and a cooler) parks there: `foodtruck.ts` + `campus.ts`.
- **High Street** (road, traffic, a far sidewalk, wood-frame houses) is on your left (+x).
- Behind the row there's a wide **coal-tar path** (`BACK_PATH`): no lines and no crosswalks (the user was specific). It has granite curbs, hosta beds on the building side, and teak benches, Bigbelly bins and a hydrant near Judd. A low chain-link fence runs round the football field, with gates, and Corwin Stadium's press box is black with a W sign. South College is brownstone. Students walk it, and **Physical Plant's golf cart** (`cart.ts`) drives up and down it. Then comes **Andrus Field** (football field with stands, ball diamond). You reach it through two walkways: Allbritton–Judd and South–Boger. Each building has its own `depth` in `layout.ts`, matching what's drawn.
- The user confirmed this layout matches the real campus.
- Planned next to the world: **Foss Hill** beyond Andrus Field.

**Architecture rule: rules are pure modules with unit tests, and rendering is separate.**

| Module | Role |
|---|---|
| `layout.ts` | Row order and sizes, walkways, road/sidewalk x-ranges, bounds (pure). |
| `collide.ts` | `resolveMove(prev, want, stops, extra?)`. Building slabs, plus `extra` solids, walkable areas and lots, axis sliding, and a safety net so you're never frozen inside something (pure). |
| `traffic.ts` / `vehicles.ts` | Four-lane sim (cars, trucks, bikes), signals at the walkways (green 16 s, yellow 3 s, red 11 s); vehicles stop for you. Pure sim / meshes. |
| `mobility.ts` / `rideables.ts` | Walk, then run after holding the stick 2 s (`RUN_AFTER`); bikes and scooters in racks or loose; ride, park in a rack, or leave anywhere. |
| `cars.ts` | Cars you own, drive, steal and carjack (pure). `owner` is `'you'`, a roommate id, or null (a stranger's). Driving uses **pedals** (`stepPedals`): the gas and brake glass buttons (or W/S), and steering by dragging left/right (or A/D). Brake slows you, then reverses once you're stopped. With no pedal down, turning the wheel **creeps** the car forward (`CREEP`) so it turns, and the front wheels visibly steer. (The older stick-direction `stepCar` is still there and still tested.) `jackable` lets you take a car in traffic going under 3 m/s within 3 m (step in front of one and it stops). A stranger's car left in the road rejoins traffic once you're 40 m away; owned cars get towed home. Your car's spot is saved in localStorage (`vora.row.car`). Meshes: `CarsView` in `vehicles.ts`, which reuses the jacked car's own mesh. `driveMove` checks 9 points round the car's outline: a move may never block a new point, and a car already in something may only move in ways that reduce its depth (so it can't get stuck in a building). Steering pivots on the back axle. |
| `camera.ts` / `controls.ts` | Camera rig: follows you, direction locks while your thumb is down, look via the eye button or top strip, ←/→ or Q/E, double-tap snaps behind you. Input: walk by dragging anywhere; action button (F); **jump** (Space or the jump button); pedals while driving. |
| `icons.ts` / `hud.ts` / `surface.ts` | HUD line icons (no emoji anywhere on buttons; the text lives in `aria-label`, which tests check), the dial `Speedometer`, and `surfaceAt` (tar, paving or grass) plus `leavesMark`: tyre marks always on grass, on hard ground only when skidding. `TireMarks` and `Exhaust` are in `vehicles.ts`. The user disliked the theft theme, so any car just shows a steering wheel and there are no 'stole' or 'carjacked' messages. |
| `clock.ts` / `sky.ts` | Game time runs about 60× real (1 real second = 1 game minute), nights 2× faster, starts at 15:30, saved in localStorage, tapping the clock skips to the next preset. `wakeFrom`: sleeping between 05:00 and 15:00 wakes you at 21:00, otherwise at 07:30. Sky, lighting and colour mood by hour. Nights are kept readable (the user asked): bright moon and hemisphere light, exposure lifted, and 4 real point lights that follow the nearest street lamps (`world.lightNear`). |
| `world.ts` / `buildings.ts` / `kit.ts` | Ground, field, walks, trees, lamps, benches, street and houses; building kits; instanced window and box banks. |
| `people.ts` / `traces.ts` | Blocky people with knees, elbows, hands and eyes. Each body segment is one merged vertex-coloured mesh (≤12 meshes per person). `gait(phase, speed)` is a pure walk↔run blend: knees fold and arms pump when running. Also sit/ride/scoot, idle breathing, blinking and glances, plus `flail`/`limp` for being hit. Traces: demo social traces (friend footstep trails, notes, labels). All social data is **demo/fake** for now. |
| `knock.ts` | Being hit by your car (pure): `hits`, `launch`, `stepKnock` (air → down → up → done). main.ts keeps a `bodies` registry of everyone hittable (walkers, sitters, frisbee players, carjacked drivers), each with how it recovers. |
| `soundscape.ts` / `audio.ts` | **Sound.** `mixAt` (pure, tested) sets the levels of the always-on sounds: birds by day, crickets at night, wind, the High Street hum (by distance and traffic), crowd murmur, indoor room tone, your engine (rpm), tyres (rougher on grass and paving) and skids. `honkNow` and the traffic's `waited` timer make held-up drivers honk. `audio.ts` synthesises everything with Web Audio **unless a recording exists**: drop `src/row/sounds/<name>.m4a` (the names are in `sounds/README.md`, and the user offered to record) and it's used automatically. Voices use recordings `yell_*`/`hey_*`, otherwise the phone's speech synthesis. Sound starts on the first touch (an iOS rule) and pauses when hidden. The mute button under the clock is remembered. `__vora.sound.log` lists what has played (tests use it). |
| `save.ts` | Where you were (`vora.row.spot` in localStorage): your place (outside, house or Usdan), position, heading and floor. Saved every 3 s and on pagehide or visibilitychange; restored on load (no intro swoop) unless older than 12 h or the URL has `?x=`/`?z=`. The dev server's reloads and iOS dropping background tabs were sending the user back to their house. |
| `main.ts` | Wiring, game loop, actions, the scenes. |

### Inside Usdan (`src/row/usdan/`)
The ground floor, built from the user's photos (2026-10-01). Like the house, it's its **own scene** (`usdanScene`; `where === 'usdan'`). It has **six doors** (`DOORS`, placed on the outline with `doorOn`): the walkway (south, into the lobby), the plaza (east, into the lounge), the north end of the plaza side (into the corridor), two on the field side (into Flex Dining) and one on the north side. The three main ones (walkway, plaza, north) have a **protruding glass vestibule** (`VESTIBULE`) with a canopy and the USDAN UNIVERSITY CENTER sign. Its glass sides are solid (`vestibuleSolids`), so you walk in through the front. The others are flush, with a canopy and lamp. Every door has lit glass doors, a mat and a path out. Walk into any doorway, or use "Go into Usdan" / "Go outside". There's a unit test that every door is reachable inside and works both ways. The user doesn't want a true floor plan (for security too), so keep the layout loose.
- **`plan.ts`** (pure, tested): doors and portals (`usdanPortalAt`, `arriveAt`), rooms, internal walls, furniture, seated students, staff and walking lanes. `usdanExtra()` gives collision via the new `Extra.interior` predicate, so you stay inside the outline.
- **Rooms:** the lobby (Information booth with an orange column, a TV niche with wood chairs on a rug, an iPad Pro banner); the lounge (black box sofas round a red column); the sage corridor north (hanging OSI/Meeting Room signs, the Navaratri 50-years display case, blue bins, the elevator); the double-height atrium (globe pendants, the curved red-walled stair, the W, round café tables, balcony boxes with plants, a pumpkin-carving screen); Flex Dining (yellow walls, tall windows, square tables on striped carpet); and the café (counter, coolers, chip rack, menu).
- **`view.ts`:** a terrazzo floor, a low ceiling with downlights, and the atrium's high ceiling. Walls between the camera and you hide (`crosses`), and so do the hanging signs. The indoor camera stays under the 4.4 m ceiling.
- Not built yet: the upstairs (balconies are just openings), the west wing, actually ordering at the café, and the mail room downstairs.

### Your house (`src/row/house/`)
A two-storey wood frame across High Street (local coordinates: `u` from the front, `v` across; `plan.ts` has an ASCII map).
- **`plan.ts`:** walls, doors, furniture, seats, stairs, 6 bedrooms (yours is R1), and 5 roommates: jules, kofi, ines, nico, ama. `DRIVEWAYS` has two: yours is on the left (−v) seen from the street, kofi's on the right. They're added to the walkable lots, and trees and lamps are kept out of them (there's a test).
- **`collide.ts`:** per-floor solids. Upstairs uses walkable areas. The stairs lane (`STAIRS_CHANNEL`) must stay identical on both floors; there's a regression test for the bug where you got stuck in the wall halfway down.
- **`portal.ts`:** the front door is a portal. Inside is its **own scene** (`homeScene` in main.ts, no street or sky). Walking out puts you at the foot of the porch steps facing the street. `cameraClearance` keeps the camera out of the house.
- **`routine.ts` / `roommates.ts`:** each roommate has a daily schedule on the game clock (kitchen, out at class, porch, couch, room). There's a waypoint graph for walking around, a who's-home card when you enter, and greeting speech bubbles.
- **`view.ts`:** a closed `exterior` (siding, porch, roof) and the `interior`, with a cut-away so walls between the camera and you hide. The TV and lamps light up at night.
- **Actions:** Sit (couch, dining chairs, porch bench), Sleep (skips to 07:30), Go inside/outside, Ride/Park/Get off, Drive/Steal car/Carjack/Get out. If you've taken kofi's car, he asks about it when you get home.

## Backlog (user's list, 2026-10-01; tick off as done)
- [ ] **Usdan upstairs and dining.** Up the stairs, someone sits at a glass desk with a computer on each side (two staff); students scan their Wes IDs to get into dining. From there, a path **left** leads to the loud side (an athletes' table, big friend groups, energetic) and a path **right** to the quiet side (indie film people; tables like the lobby's plus long rectangular tables in the centre, red pillars). Straight down the middle is the **food area**: stir-fry, self-serve, burgers, classic food and so on. Keep the inside *recognisable*: true where we can be, just not an exact floor plan.
- [ ] **Phone:** contacts, interactions (after the items below).
- [ ] **Recordings from the user** (voices, ambience, doors, horn) go in `src/row/sounds/`; see the README there.
- [x] Sound: ambience, horns, engine, doors, hits and voices.
- [x] Tire marks when driving on grass, and exhaust smoke.
- [x] Jump (game-feel actions).
- [x] Driving with gas and brake pedal buttons, plus a real dial speedometer (not the italic numbers).
- [x] Action buttons are translucent SVG icons, not emoji text. Any car just shows a steering wheel (no "steal" or "carjack" wording), and a door icon means in or out.
- [x] Bug: "Go outside" stayed on the button after you'd left.

## Open items / next ideas
- Git repo initialised 2026-10-01 (branch `main`). The remote is https://github.com/cudechukwu/vora. The user said nothing here is private, so the brief and photos are committed. Still ask before pushing.
- **Roadmap after the world (user, 2026-10-01):** interactive life. Showering, designing your room, money and buying things (including buying a car), making friends (real and NPC), conversations (NPC too), inviting people over, a phone with contacts, throwing a party that your contacts come to, a "Miami nights" real-world feel. Also a bigger map, so driving makes sense. Driving and biking already build speed with a mph speedometer; a fuel gauge isn't built yet.
- The user shared a Google Maps view: **Olin Memorial Library** and the **Public Affairs Center** are south of Judd (which confirms Olin), Fayerweather and Admissions are by Usdan on Wyllys Ave, and **Foss Hill** is west of Andrus Field. Use these when the map grows.
- Real presence is the strategic next step: a server, logins, real friends as roommates, real traces and notes. I recommended stopping world-building at some point to test with 15–20 Wes friends.
- Foss Hill beyond Andrus Field; the other bedrooms; personalising your room; Wes-specific details (ask the user for these).
- Fisk Hall is still unconfirmed, so ask before adding it.

## Working style the user likes
- Build first, show screenshots, explain plainly, and be honest about what's untested or fake.
- They give fast, concrete feedback while playtesting and love small, real-feeling details.
