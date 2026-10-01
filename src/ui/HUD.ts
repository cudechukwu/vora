// ─── HUD ───────────────────────────────────────────────────────────────
// Miami-Nights-coded overlay: location banner, in-world clock, soft
// currency. DOM (not canvas) so the type stays razor-crisp on phones.
// Purely cosmetic for now — wired to fake state — but it sells the world.

const css = `
.hud{position:fixed;inset:0;pointer-events:none;z-index:5;
  font-family:'JetBrains Mono',monospace;color:#fff;}
.hud-top{position:absolute;top:0;left:0;right:0;
  padding:max(14px,env(safe-area-inset-top)) 16px 12px;
  display:flex;align-items:center;justify-content:space-between;gap:10px;}
.hud-coin{font-size:13px;font-weight:700;color:#fff;
  text-shadow:0 1px 3px rgba(0,0,0,.55);letter-spacing:.04em;min-width:64px;}
.hud-coin b{color:#ffe08a;}
.hud-banner{flex:1;max-width:280px;margin:0 auto;text-align:center;
  background:linear-gradient(180deg,#c93026,#8e1810);
  border:1px solid #ffd9a0;border-radius:999px;
  padding:7px 16px;box-shadow:0 3px 0 rgba(0,0,0,.28),0 6px 16px rgba(0,0,0,.22);}
.hud-banner .loc{font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#fff;}
.hud-banner .sub{font-size:8px;letter-spacing:.22em;color:#ffd9c0;text-transform:uppercase;margin-top:1px;}
.hud-clock{font-size:13px;font-weight:700;text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.55);
  letter-spacing:.04em;min-width:64px;color:#fff;}
.hud-clock .pop{color:#ffe08a;}
.hud-hint{position:absolute;left:0;right:0;bottom:max(20px,env(safe-area-inset-bottom));
  text-align:center;font-size:10px;letter-spacing:.18em;text-transform:uppercase;
  color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5);transition:opacity .8s ease;}
.hud-hint.fade{opacity:0;}
.hud-net{position:absolute;left:16px;bottom:max(20px,env(safe-area-inset-bottom));
  font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#fff;
  text-shadow:0 1px 3px rgba(0,0,0,.5);display:flex;align-items:center;gap:6px;}
.hud-net .dot{width:7px;height:7px;border-radius:50%;background:#cfd8c0;}
.hud-net .dot.live{background:#5fd06a;box-shadow:0 0 8px #5fd06a;}
`;

export class HUD {
  private root: HTMLDivElement;
  private clockEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private locEl!: HTMLElement;
  private netDot!: HTMLElement;
  private netLabel!: HTMLElement;

  // fake in-world time, starts 9:10am like the Miami Nights shot
  private minutes = 9 * 60 + 10;

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-coin">$ <b id="coin">130</b></div>
        <div class="hud-banner">
          <div class="loc" id="loc">FOSS HILL</div>
          <div class="sub">Wesleyan · α</div>
        </div>
        <div class="hud-clock"><span id="clock">9:10</span> <span class="pop" id="ampm">AM</span></div>
      </div>
      <div class="hud-hint" id="hint">tap anywhere to walk</div>
      <div class="hud-net"><span class="dot" id="netdot"></span><span id="netlabel">solo</span></div>
    `;
    document.body.appendChild(this.root);

    this.clockEl = this.root.querySelector('#clock')!;
    this.hintEl = this.root.querySelector('#hint')!;
    this.locEl = this.root.querySelector('#loc')!;
    this.netDot = this.root.querySelector('#netdot')!;
    this.netLabel = this.root.querySelector('#netlabel')!;
  }

  setLocation(name: string) {
    this.locEl.textContent = name.toUpperCase();
  }

  dismissHint() {
    this.hintEl.classList.add('fade');
  }

  /** Reflect network presence: how many souls are in the room. */
  setPresence(count: number, live: boolean) {
    this.netDot.classList.toggle('live', live);
    this.netLabel.textContent = !live
      ? 'solo'
      : count <= 1
        ? 'you’re the only one here'
        : `${count} here now`;
  }

  // advance the world clock; ~1 in-world minute per real second.
  update(dt: number) {
    this.minutes = (this.minutes + (dt / 1000) * 1) % (24 * 60);
    const h24 = Math.floor(this.minutes / 60);
    const m = Math.floor(this.minutes % 60);
    const ampm = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    this.clockEl.textContent = `${h12}:${m.toString().padStart(2, '0')}`;
    (this.root.querySelector('#ampm') as HTMLElement).textContent = ampm;
  }

  /** 0..1 darkness for time-of-day tint (night = 1). */
  get nightFactor(): number {
    const h = this.minutes / 60;
    // brightest ~13:00, darkest ~01:00
    const t = Math.cos(((h - 13) / 24) * Math.PI * 2);
    return Math.max(0, Math.min(1, (t + 1) / 2)) * 0.6;
  }
}
