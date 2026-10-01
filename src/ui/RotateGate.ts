// ─── RotateGate ────────────────────────────────────────────────────────
// Vora plays in landscape (Miami Nights style). On the web we can't force a
// phone to rotate, so we show a friendly "turn your phone" cover whenever
// we're in portrait, and clear it the instant the device goes landscape.
// The native (Capacitor) build will hard-lock landscape and skip this.

const css = `
.rotate-gate{position:fixed;inset:0;z-index:20;display:none;
  flex-direction:column;align-items:center;justify-content:center;gap:22px;
  background:radial-gradient(circle at 50% 35%,#13324a,#0a1622);
  color:#f6f1e6;font-family:'JetBrains Mono',monospace;text-align:center;padding:24px;}
.rotate-gate.show{display:flex;}
.rotate-gate .glyph{width:64px;height:104px;border:3px solid #f6f1e6;border-radius:12px;
  position:relative;animation:rg-turn 2.2s ease-in-out infinite;}
.rotate-gate .glyph::after{content:"";position:absolute;left:50%;bottom:7px;
  width:18px;height:3px;background:#f6f1e6;border-radius:2px;transform:translateX(-50%);}
@keyframes rg-turn{0%,30%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
.rotate-gate .ttl{font-size:14px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;}
.rotate-gate .sub{font-size:11px;letter-spacing:.12em;color:#9fb6c4;max-width:280px;line-height:1.6;}
.rotate-gate .brand{position:absolute;top:max(16px,env(safe-area-inset-top));
  font-size:11px;letter-spacing:.5em;font-weight:700;color:#b5231b;}
`;

export class RotateGate {
  private el: HTMLDivElement;

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.el = document.createElement('div');
    this.el.className = 'rotate-gate';
    this.el.innerHTML = `
      <div class="brand">V O R A</div>
      <div class="glyph"></div>
      <div class="ttl">Turn your phone</div>
      <div class="sub">Vora plays sideways — rotate to landscape to step onto Foss Hill.</div>
    `;
    document.body.appendChild(this.el);

    const onChange = () => this.evaluate();
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    this.tryLock();
    this.evaluate();
  }

  /** true while we're showing the gate (portrait) */
  get blocking(): boolean {
    return this.el.classList.contains('show');
  }

  private evaluate() {
    // treat narrow-and-tall as "needs rotation". Desktops are wide → never gated.
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 820;
    this.el.classList.toggle('show', portrait);
  }

  // best-effort lock (works in fullscreen / installed PWA / native shells)
  private async tryLock() {
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await orientation.lock?.('landscape');
    } catch {
      /* not permitted on web — the gate handles it */
    }
  }
}
