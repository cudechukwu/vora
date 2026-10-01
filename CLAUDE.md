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
- `npm test`: Vitest unit tests (108, about 6 s).
- `npm run test:e2e`: Playwright browser tests (33, about 5 min). They use the installed Google Chrome with SwiftShader WebGL and their own Vite on port 5188.
- `npm run check`: tsc, then the unit tests, then the browser tests. **Keep it green.** The user asked for everything to be tested comprehensively.
- URL debug params: `?t=17.3` freezes the game hour, `?x=&z=` sets the start position, `?yaw=` sets the camera direction, `?level=1` starts upstairs, `?intro=0` skips the camera swoop.
- `window.__vora` is a read-only debug hook (pos, level, where, mover, traffic, roommates, `sample()` pixel check, and more). The e2e tests rely on it.

### Testing gotchas
- **Never edit source files while the e2e suite is running.** Vite hot-reloads the pages mid-test and the results become meaningless.
- The machine sometimes runs heavy background load (`routined`, `contactsd`), with load averages up to 100+. When that happens the e2e tests time out for reasons unrelated to the code. Check `uptime` before blaming the code.
- Screenshot/visual checks: launch Playwright with `channel: 'chrome'`, args `--use-angle=swiftshader --enable-unsafe-swiftshader`, viewport 390×844, and use the URL params above.

## The world (all in `src/row/`)
You spawn at the south end by **Usdan** and walk **+z** along the High Street side of **College Row**:
- The **buildings are on your right (−x)**, in this order: Usdan (curved front) → Boger → South College (belfry) → North College (green-domed cupola) → Zelnick Pavilion (glass link) → Memorial Chapel (red-striped roof, spire) → Judd → Allbritton.
- **High Street** (road, traffic, a far sidewalk, wood-frame houses) is on your left (+x).
- **Andrus Field** (football field with stands, ball diamond) is *behind* the row. You reach it through two walkways: Allbritton–Judd and South–Boger.
- The user confirmed this layout matches the real campus.
- Planned next to the world: **Foss Hill** beyond Andrus Field.

**Architecture rule: rules are pure modules with unit tests, and rendering is separate.**

| Module | Role |
|---|---|
| `layout.ts` | Row order and sizes, walkways, road/sidewalk x-ranges, bounds (pure). |
| `collide.ts` | `resolveMove(prev, want, stops, extra?)`. Building slabs, plus `extra` solids, walkable areas and lots, axis sliding, and a safety net so you're never frozen inside something (pure). |
| `traffic.ts` / `vehicles.ts` | Four-lane sim (cars, trucks, bikes), signals at the walkways (green 16 s, yellow 3 s, red 11 s); vehicles stop for you. Pure sim / meshes. |
| `mobility.ts` / `rideables.ts` | Walk, then run after holding the stick 2 s (`RUN_AFTER`); bikes and scooters in racks or loose; ride, park in a rack, or leave anywhere. |
| `camera.ts` / `controls.ts` | Camera rig: follows you, direction locks while your thumb is down, look via the eye button or top strip, ←/→ or Q/E, double-tap snaps behind you. Input: walk by dragging anywhere; action button (F/Space). |
| `clock.ts` / `sky.ts` | Game time runs about 60× real (1 real second = 1 game minute), nights 2× faster, starts at 15:30, saved in localStorage, tapping the clock skips to the next preset. Sky, lighting and colour mood by hour. |
| `world.ts` / `buildings.ts` / `kit.ts` | Ground, field, walks, trees, lamps, benches, street and houses; building kits; instanced window and box banks. |
| `people.ts` / `traces.ts` | Blocky people (walk, run, sit, ride, scoot poses); demo social traces (friend footstep trails, notes, labels). All social data is **demo/fake** for now. |
| `main.ts` | Wiring, game loop, actions, the two scenes. |

### Your house (`src/row/house/`)
A two-storey wood frame across High Street (local coordinates: `u` from the front, `v` across; `plan.ts` has an ASCII map).
- **`plan.ts`:** walls, doors, furniture, seats, stairs, 6 bedrooms (yours is R1), and 5 roommates: jules, kofi, ines, nico, ama.
- **`collide.ts`:** per-floor solids. Upstairs uses walkable areas. The stairs lane (`STAIRS_CHANNEL`) must stay identical on both floors; there's a regression test for the bug where you got stuck in the wall halfway down.
- **`portal.ts`:** the front door is a portal. Inside is its **own scene** (`homeScene` in main.ts, no street or sky). Walking out puts you at the foot of the porch steps facing the street. `cameraClearance` keeps the camera out of the house.
- **`routine.ts` / `roommates.ts`:** each roommate has a daily schedule on the game clock (kitchen, out at class, porch, couch, room). There's a waypoint graph for walking around, a who's-home card when you enter, and greeting speech bubbles.
- **`view.ts`:** a closed `exterior` (siding, porch, roof) and the `interior`, with a cut-away so walls between the camera and you hide. The TV and lamps light up at night.
- **Actions:** Sit (couch, dining chairs, porch bench), Sleep (skips to 07:30), Go inside/outside, Ride/Park/Get off.

## Open items / next ideas
- Git repo initialised 2026-10-01 (branch `main`). The remote is https://github.com/cudechukwu/vora. The user said nothing here is private, so the brief and photos are committed. Still ask before pushing.
- Real presence is the strategic next step: a server, logins, real friends as roommates, real traces and notes. I recommended stopping world-building at some point to test with 15–20 Wes friends.
- Foss Hill beyond Andrus Field; the other bedrooms; personalising your room; Wes-specific details (ask the user for these).
- Olin Library and Fisk Hall were dropped from the row. They're unconfirmed, so ask before adding them back.

## Working style the user likes
- Build first, show screenshots, explain plainly, and be honest about what's untested or fake.
- They give fast, concrete feedback while playtesting and love small, real-feeling details.
