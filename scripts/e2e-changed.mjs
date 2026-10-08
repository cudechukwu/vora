// Run only the browser tests for what you've changed since the last commit (npm run test:changed).
//
// Each source file maps to the browser test files (tests/e2e/<area>.spec.ts) that exercise it. Pure modules are
// covered by their unit tests; this picks the in-browser checks on top. Anything that touches everything (main.ts, the
// shared test helpers, the build config) runs the @smoke tests across all areas instead.
//
//   npm run test:changed            what changed since the last commit
//   npm run test:changed -- --dry   just print what it would run
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const AREAS = {
  basics: [/camera\.ts$/, /clock\.ts$/, /sky\.ts$/, /traces\.ts$/, /controls\.ts$/, /traffic\.ts$/, /people\.ts$/, /noise\.ts$/],
  mobility: [/mobility\.ts$/, /rideables\.ts$/],
  house: [/\/house\//],
  cars: [/cars\.ts$/, /vehicles\.ts$/, /knock\.ts$/, /traffic\.ts$/, /surface\.ts$/],
  campus: [/\/usdan\//, /\/casper\//, /campus\.ts$/, /foodtruck\.ts$/, /cart\.ts$/, /southend\.ts$/, /southview\.ts$/, /pruzanview\.ts$/, /olinview\.ts$/, /churchview\.ts$/, /allbview\.ts$/, /clarkview\.ts$/, /exleyview\.ts$/, /shanklinview\.ts$/, /sciview\.ts$/, /plaza\.ts$/],
  hud: [/hud\.ts$/, /icons\.ts$/, /controls\.ts$/, /save\.ts$/, /surface\.ts$/],
  sound: [/audio\.ts$/, /soundscape\.ts$/, /\/sounds\//],
  map: [/map\.ts$/, /mapview\.ts$/],
  // the shape of the world: you walk into it, so the walking and back-path checks
  'basics+campus': [/layout\.ts$/, /frontlawn\.ts$/, /collide\.ts$/, /world\.ts$/, /buildings\.ts$/, /kit\.ts$/, /backlawn\.ts$/, /zelnick\.ts$/],
};
const EVERYTHING = [/src\/row\/main\.ts$/, /tests\/e2e\/helpers\.ts$/, /playwright\.config\.ts$/, /vite\.config\.ts$/, /index\.html$/, /package\.json$/];

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = [...new Set([...sh('git diff --name-only HEAD'), ...sh('git ls-files --others --exclude-standard')])];

const files = new Set();
let smokeAll = false;
for (const f of changed) {
  if (EVERYTHING.some((re) => re.test(f))) smokeAll = true;
  const spec = f.match(/^tests\/e2e\/(\w+)\.spec\.ts$/);
  if (spec) files.add(spec[1]);
  for (const [areas, res] of Object.entries(AREAS)) if (res.some((re) => re.test(f))) for (const a of areas.split('+')) files.add(a);
}

const dry = process.argv.includes('--dry');
const extra = process.argv.slice(2).filter((a) => a !== '--dry');
console.log(`changed: ${changed.length ? changed.join(', ') : '(nothing)'}`);
const runs = [];
const specs = [...files].sort().map((a) => `tests/e2e/${a}.spec.ts`).filter((f) => existsSync(f));
if (specs.length) runs.push(specs); // the areas you touched: every test in them
if (smokeAll) { // touches everything: the key test from every other area too
  const others = readdirSync('tests/e2e').filter((f) => f.endsWith('.spec.ts')).map((f) => `tests/e2e/${f}`).filter((f) => !specs.includes(f));
  if (others.length) runs.push(['--grep', '@smoke', ...others]);
}
if (!runs.length) { console.log('no browser tests to run for these changes (unit tests cover them: npm test)'); process.exit(0); }
let status = 0;
for (const args of runs) {
  console.log(`→ playwright test ${args.join(' ')}`);
  if (dry) continue;
  const r = spawnSync('npx', ['playwright', 'test', ...args, ...extra], { stdio: 'inherit' });
  status ||= r.status ?? 1;
}
process.exit(status);
