// ─── Input ─────────────────────────────────────────────────────────────
// Built for one right thumb: press anywhere and drag to walk (a joystick
// appears under your thumb) — the camera follows you, so that's usually
// all you need. To look around on purpose:
//   • the round look button on the right edge: drag it to look, tap it to
//     look behind you;
//   • or drag along the top strip of the screen (two hands / other thumb);
//     double-tap there to snap the view back behind you.
// Desktop: WASD / ↑↓ to walk, ←→ or Q/E to turn, drag the top strip to look,
// F for the action button (ride / park / get off / drive / doors), Space to jump.
// Driving: the gas + brake pedal buttons (or W / S), and drag left/right (or A / D) to steer.

const RADIUS = 48; // px of drag for full speed
const DOUBLE_TAP_MS = 320;
const TAP_SLOP = 8; // px a tap may wander and still count as a tap
/** Fraction of the screen height, from the top, that is the look strip. */
export const LOOK_STRIP = 0.26;

export class Input {
  /** stick, in screen terms: x = right, y = up the screen, length 0..1 */
  x = 0;
  y = 0;
  /** −1 turn left … +1 turn right (keyboard) */
  turnDir = 0;
  onFirstMove: (() => void) | null = null;

  private moveId: number | null = null;
  private lookId: number | null = null;
  private ox = 0;
  private oy = 0;
  private lx = 0;
  private ly = 0;
  private lookDX = 0;
  private lookDY = 0;
  private lastTap = { t: -1e9, x: 0, y: 0 };
  private snap = false;
  private turnAround = false;
  private action = false;
  private jump = false;
  /** Pedal buttons held (driving). */
  gasHeld = false;
  brakeHeld = false;
  private pedalIds = new Map<number, 'gas' | 'brake'>();
  private lookFromButton = false;
  private lookTravel = 0;
  private lookBtn = document.getElementById('look');
  private keys = new Set<string>();
  private ui = document.getElementById('stick')!;
  private knob = this.ui.querySelector('i') as HTMLElement;

  /** A thumb or key is down for walking (locks the walking direction). */
  get held() {
    return this.moveId !== null || this.x !== 0 || this.y !== 0;
  }

  constructor() {
    window.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#act')) { this.action = true; return; }
      if (t.closest('#jump')) { this.jump = true; return; }
      const pedal = t.closest('#gas') ? 'gas' : t.closest('#brake') ? 'brake' : null;
      if (pedal) {
        this.pedalIds.set(e.pointerId, pedal);
        this.setPedal(pedal, true);
        (t.closest('button') as HTMLElement).setPointerCapture?.(e.pointerId);
        return;
      }
      if (this.lookBtn && t.closest('#look')) {
        if (this.lookId !== null) return;
        this.startLook(e, true);
        return;
      }
      if (t.closest('button, #card, .tap')) return;
      if (e.clientY > innerHeight * LOOK_STRIP) {
        if (this.moveId !== null) return;
        this.moveId = e.pointerId;
        this.ox = e.clientX;
        this.oy = e.clientY;
        this.ui.style.display = 'block';
        this.ui.style.left = `${e.clientX}px`;
        this.ui.style.top = `${e.clientY}px`;
        this.knob.style.transform = '';
      } else {
        if (this.lookId !== null) return;
        this.startLook(e, false);
        const now = performance.now();
        if (now - this.lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 40) {
          this.snap = true;
          this.lastTap.t = -1e9;
        } else {
          this.lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.lookId) {
        this.lookDX += e.clientX - this.lx;
        this.lookDY += e.clientY - this.ly;
        this.lookTravel += Math.hypot(e.clientX - this.lx, e.clientY - this.ly);
        this.lx = e.clientX;
        this.ly = e.clientY;
        return;
      }
      if (e.pointerId !== this.moveId) return;
      let dx = e.clientX - this.ox;
      let dy = e.clientY - this.oy;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = Math.min(d, RADIUS) / RADIUS < 0.12 ? 0 : 1;
      this.x = (dx / RADIUS) * dead;
      this.y = (-dy / RADIUS) * dead;
      if (dead) this.first();
    });
    const end = (e: PointerEvent) => {
      const pedal = this.pedalIds.get(e.pointerId);
      if (pedal) { this.pedalIds.delete(e.pointerId); this.setPedal(pedal, false); return; }
      if (e.pointerId === this.lookId) {
        this.lookId = null;
        this.lookBtn?.classList.remove('active');
        if (this.lookFromButton && this.lookTravel < TAP_SLOP && e.type === 'pointerup') this.turnAround = true;
        return;
      }
      if (e.pointerId !== this.moveId) return;
      this.moveId = null;
      this.x = this.y = 0;
      this.ui.style.display = 'none';
      this.fromKeys();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'f' && !e.repeat) { this.action = true; e.preventDefault(); }
      if (k === ' ' && !e.repeat) { this.jump = true; e.preventDefault(); }
      this.keys.add(k);
      this.fromKeys();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); this.fromKeys(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.fromKeys(); });
  }

  /** Pixels dragged on the look side since last asked. */
  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = this.lookDY = 0;
    return r;
  }

  private startLook(e: PointerEvent, fromButton: boolean) {
    this.lookId = e.pointerId;
    this.lx = e.clientX;
    this.ly = e.clientY;
    this.lookTravel = 0;
    this.lookFromButton = fromButton;
    if (fromButton) {
      this.lookBtn!.classList.add('active');
      this.lookBtn!.setPointerCapture?.(e.pointerId); // keep getting moves after the thumb leaves the button
      this.first();
    }
  }

  /** True once after the action button (or F / Space) was pressed. */
  consumeAction(): boolean {
    const r = this.action;
    this.action = false;
    return r;
  }

  /** True once after the jump button (or Space) was pressed. */
  consumeJump(): boolean {
    const r = this.jump;
    this.jump = false;
    return r;
  }

  private setPedal(p: 'gas' | 'brake', down: boolean) {
    if (p === 'gas') this.gasHeld = down; else this.brakeHeld = down;
    document.getElementById(p)?.classList.toggle('down', down);
  }

  /** Pedals from the buttons or the keyboard (W / ↑ gas, S / ↓ brake), and steering from the stick (−1 … +1). */
  get pedals() {
    const k = this.keys;
    return {
      gas: this.gasHeld || k.has('w') || k.has('arrowup') ? 1 : 0,
      brake: this.brakeHeld || k.has('s') || k.has('arrowdown') ? 1 : 0,
      steer: Math.max(-1, Math.min(1, this.x * 1.25)),
    };
  }

  /** True once after the look button was tapped (not dragged). */
  consumeTurnAround(): boolean {
    const r = this.turnAround;
    this.turnAround = false;
    return r;
  }

  /** True once after a double-tap on the look strip. */
  consumeSnap(): boolean {
    const s = this.snap;
    this.snap = false;
    return s;
  }

  private fromKeys() {
    const k = this.keys;
    this.turnDir = (k.has('arrowright') || k.has('e') ? 1 : 0) - (k.has('arrowleft') || k.has('q') ? 1 : 0);
    if (this.moveId !== null) return;
    const x = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const y = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const l = Math.hypot(x, y) || 1;
    this.x = x / l;
    this.y = y / l;
    if (x || y) this.first();
  }

  private first() {
    if (this.onFirstMove) { this.onFirstMove(); this.onFirstMove = null; }
  }
}
