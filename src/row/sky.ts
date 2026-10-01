import {
  AdditiveBlending, BackSide, BufferGeometry, Color, Float32BufferAttribute, Mesh, Points,
  PointsMaterial, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';

// ─── Time of day ───────────────────────────────────────────────────────
// The whole mood of the row comes from one number: the hour. Keyframes are
// hand-picked for a Connecticut early-fall day. North is −z, east is +x
// (across Andrus Field), so the afternoon sun drops behind the buildings
// and throws their shadows over the walk.

interface Key {
  h: number;
  top: number; horizon: number;
  sun: number; sunI: number;
  hemiSky: number; hemiGround: number; hemiI: number;
}

const KEYS: Key[] = [
  { h: 0,    top: 0x070b1c, horizon: 0x1f2848, sun: 0x9fb4ff, sunI: 0.7, hemiSky: 0x5a6aa8, hemiGround: 0x1c2030, hemiI: 1.0 },
  { h: 5.2,  top: 0x0d1430, horizon: 0x2a2c4c, sun: 0x9fb4ff, sunI: 0.6,  hemiSky: 0x5a6aa8, hemiGround: 0x1c2030, hemiI: 0.95 },
  { h: 6.4,  top: 0x2f4f8f, horizon: 0xe8a78a, sun: 0xffb38a, sunI: 0.9,  hemiSky: 0x9fb4d8, hemiGround: 0x3a3226, hemiI: 0.9 },
  { h: 8,    top: 0x5c9ad8, horizon: 0xf3d6b4, sun: 0xffe0b8, sunI: 2.0,  hemiSky: 0xbfd6f0, hemiGround: 0x4a4430, hemiI: 1.1 },
  { h: 12,   top: 0x3f86d4, horizon: 0xc9e3f4, sun: 0xfff4e2, sunI: 2.6,  hemiSky: 0xc8e0f6, hemiGround: 0x55503a, hemiI: 1.2 },
  { h: 15.5, top: 0x4a8ad0, horizon: 0xdbe6ea, sun: 0xffe6c4, sunI: 2.4,  hemiSky: 0xc4d8ee, hemiGround: 0x55503a, hemiI: 1.15 },
  { h: 17.4, top: 0x5f84c0, horizon: 0xffc98e, sun: 0xffb060, sunI: 2.1,  hemiSky: 0xd0c4c0, hemiGround: 0x4f4030, hemiI: 1.0 },
  { h: 18.6, top: 0x34427e, horizon: 0xff8a58, sun: 0xff7040, sunI: 1.1,  hemiSky: 0xc0a0b8, hemiGround: 0x4a3426, hemiI: 1.15 },
  { h: 19.5, top: 0x161d44, horizon: 0x6a4468, sun: 0x9a78c0, sunI: 0.6, hemiSky: 0x65609a, hemiGround: 0x1e1a22, hemiI: 0.9 },
  { h: 21,   top: 0x070b1c, horizon: 0x1f2848, sun: 0x9fb4ff, sunI: 0.7, hemiSky: 0x5a6aa8, hemiGround: 0x1c2030, hemiI: 1.0 },
  { h: 24,   top: 0x070b1c, horizon: 0x1f2848, sun: 0x9fb4ff, sunI: 0.7, hemiSky: 0x5a6aa8, hemiGround: 0x1c2030, hemiI: 1.0 },
];

export interface Mood {
  top: Color; horizon: Color; sun: Color; sunI: number;
  hemiSky: Color; hemiGround: Color; hemiI: number;
  /** unit vector pointing toward the sun (or moon at night) */
  sunDir: Vector3;
  /** 0 = full day, 1 = full night */
  night: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function lerpColor(a: number, b: number, t: number) {
  return new Color(a).lerp(new Color(b), t);
}

export function moodAt(hour: number): Mood {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smoothstep(0, 1, (h - a.h) / (b.h - a.h));

  const day = smoothstep(5.6, 7.4, h) * (1 - smoothstep(18.4, 20.2, h));

  // sun sweeps east (+x) → south (+z) → west (−x); moon hangs high and south-east
  const arc = ((h - 6) / 12) * Math.PI;
  const sunDir = day > 0.02
    ? new Vector3(Math.cos(arc), Math.max(Math.sin(arc), 0.1) * 1.15, 0.55).normalize()
    : new Vector3(0.35, 1, 0.6).normalize();

  return {
    top: lerpColor(a.top, b.top, t),
    horizon: lerpColor(a.horizon, b.horizon, t),
    sun: lerpColor(a.sun, b.sun, t),
    sunI: a.sunI + (b.sunI - a.sunI) * t,
    hemiSky: lerpColor(a.hemiSky, b.hemiSky, t),
    hemiGround: lerpColor(a.hemiGround, b.hemiGround, t),
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
    sunDir,
    night: 1 - day,
  };
}

// ─── Sky dome + stars ──────────────────────────────────────────────────
export class Sky {
  readonly dome: Mesh;
  readonly stars: Points;
  private mat: ShaderMaterial;
  private starMat: PointsMaterial;

  constructor() {
    this.mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color() },
        uHorizon: { value: new Color() },
        uSunDir: { value: new Vector3() },
        uSun: { value: new Color() },
        uNight: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHorizon, uSun, uSunDir;
        uniform float uNight;
        varying vec3 vDir;
        void main() {
          float y = max(vDir.y, 0.0);
          vec3 col = mix(uHorizon, uTop, pow(y, 0.55));
          // warm glow around the sun, strongest when it's low
          float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          float low = 1.0 - clamp(uSunDir.y * 1.4, 0.0, 1.0);
          col += uSun * (pow(s, 12.0) * 0.35 * low + pow(s, 400.0) * 0.8) * (1.0 - uNight);
          // below the horizon, fade into the fog colour
          if (vDir.y < 0.0) col = uHorizon;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new Mesh(new SphereGeometry(900, 32, 16), this.mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;

    const pts: number[] = [];
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = 0.08 + Math.random() * 0.92;
      const r = 850;
      const c = Math.sqrt(1 - v * v);
      pts.push(Math.cos(u) * c * r, v * r, Math.sin(u) * c * r);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    this.starMat = new PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true,
      opacity: 0, depthWrite: false, fog: false, blending: AdditiveBlending,
    });
    this.stars = new Points(g, this.starMat);
    this.stars.frustumCulled = false;
  }

  apply(m: Mood) {
    const u = this.mat.uniforms;
    (u.uTop.value as Color).copy(m.top);
    (u.uHorizon.value as Color).copy(m.horizon);
    (u.uSun.value as Color).copy(m.sun);
    (u.uSunDir.value as Vector3).copy(m.sunDir);
    u.uNight.value = m.night;
    this.starMat.opacity = Math.max(0, m.night - 0.25) * 1.1;
  }

  follow(p: Vector3) {
    this.dome.position.copy(p);
    this.stars.position.copy(p);
  }
}
