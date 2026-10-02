// ─── Speedometer: a real dial ──────────────────────────────────────────
// 240° sweep, a tick every 5 mph (labelled every 10), a red needle, the
// number and MPH under the hub, and a green arc showing how fast you're going.

const C = 60, R = 52; // centre + radius in the SVG's 120×120 box
const SWEEP = 240, START = -210; // degrees (0 = 3 o'clock, clockwise positive)

const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r];
};

/** The angle (deg) the needle points for `mph` on a dial reading 0…max. */
export const needleAngle = (mph: number, max: number) => START + (Math.min(Math.max(mph, 0), max) / max) * SWEEP;

export class Speedometer {
  private needle: SVGLineElement;
  private arc: SVGPathElement;
  private num: SVGTextElement;
  private max = -1;
  private shown = -1;

  constructor(private el: HTMLElement) {
    el.innerHTML = '<svg viewBox="0 0 120 120"><circle class="face" cx="60" cy="60" r="58"/><g class="ticks"></g>'
      + '<path class="arc" d=""/><line class="needle" x1="60" y1="60" x2="60" y2="60"/><circle class="hub" cx="60" cy="60" r="3.2"/>'
      + '<text class="n" x="60" y="88">0</text><text class="u" x="60" y="98">MPH</text></svg>';
    this.needle = el.querySelector('.needle')!;
    this.arc = el.querySelector('.arc')!;
    this.num = el.querySelector('.n')!;
  }

  /** Re-draw the ticks for a new top speed (rounded up to a nice number). */
  private scale(max: number) {
    this.max = max;
    const g = this.el.querySelector('.ticks')!;
    let html = '';
    for (let v = 0; v <= max; v += 5) {
      const a = needleAngle(v, max), major = v % 10 === 0;
      const [x1, y1] = pt(a, major ? R - 8 : R - 5), [x2, y2] = pt(a, R);
      html += `<line class="tick${major ? ' major' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      if (major) { const [lx, ly] = pt(a, R - 15); html += `<text class="lbl" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}">${v}</text>`; }
    }
    g.innerHTML = html;
  }

  /** Show the dial for a vehicle that tops out at `topMph` (null = hide). */
  set(mph: number, topMph: number | null) {
    this.el.classList.toggle('show', topMph !== null);
    if (topMph === null) return;
    const max = Math.max(20, Math.ceil(topMph / 10) * 10);
    if (max !== this.max) this.scale(max);
    const a = needleAngle(mph, max);
    const [x, y] = pt(a, R - 6);
    this.needle.setAttribute('x2', x.toFixed(1));
    this.needle.setAttribute('y2', y.toFixed(1));
    const [sx, sy] = pt(START, R + 2), [ex, ey] = pt(a, R + 2);
    this.arc.setAttribute('d', mph < 0.3 ? '' : `M${sx.toFixed(1)} ${sy.toFixed(1)} A${R + 2} ${R + 2} 0 ${a - START > 180 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    const n = Math.round(mph);
    if (n !== this.shown) { this.shown = n; this.num.textContent = String(n); }
  }

  get reading() { return this.shown; }
}
