import { Application } from 'pixi.js';
import { COLORS } from './config';
import { Game } from './world/Game';
import { RotateGate } from './ui/RotateGate';

// ─── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  const app = new Application();
  await app.init({
    background: COLORS.skyMid,
    resizeTo: window,
    antialias: false, // crisp pixel edges
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    roundPixels: true,
  });

  const mount = document.getElementById('app')!;
  mount.appendChild(app.canvas);

  const game = new Game(app);
  window.addEventListener('resize', () => game.resize());

  // landscape-only: show a "turn your phone" cover in portrait
  new RotateGate();

  // dismiss the boot splash
  const splash = document.getElementById('boot');
  if (splash) {
    setTimeout(() => splash.classList.add('hide'), 650);
    setTimeout(() => splash.remove(), 1300);
  }
}

boot();
