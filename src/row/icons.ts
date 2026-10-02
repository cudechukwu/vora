// ─── HUD icons ─────────────────────────────────────────────────────────
// Line icons drawn in currentColor on a translucent glass button. No emoji.

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  /** a door, ajar, with an arrow through it */
  door: svg('<path d="M6 21V4.5a1 1 0 0 1 .8-1l7-1.4a1 1 0 0 1 1.2 1V21"/><path d="M15 4h3a1 1 0 0 1 1 1v16"/><path d="M4 21h16"/><circle cx="12.2" cy="12.5" r=".9" fill="currentColor"/>'),
  /** a steering wheel */
  wheel: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 14.2v6.2M9.9 11.4 3.8 9.6M14.1 11.4l6.1-1.8"/>'),
  /** a bicycle */
  bike: svg('<circle cx="6" cy="16" r="3.6"/><circle cx="18" cy="16" r="3.6"/><path d="M6 16l4-7h5l3 7M10 9 8.5 6H7M15 9l-1.5-3h2.2M12 16l-2-7"/>'),
  /** a kick scooter */
  scooter: svg('<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.4 18h7.2M16.5 18 14 5h-2.5M12 5h4"/>'),
  /** a "P" in a rounded square: park */
  park: svg('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/>'),
  /** stepping off: an arrow down onto a line */
  off: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>'),
  /** a chair */
  sit: svg('<path d="M7 3.5v9h10M7 12.5V20M17 12.5V20M7 16.5h10M7 7.5h7"/>'),
  /** standing up: an arrow up off a line */
  up: svg('<path d="M12 18V7M7.5 11.5 12 7l4.5 4.5M5 20h14"/>'),
  /** a bed */
  bed: svg('<path d="M3 18V7M3 14h18v4M21 14v-2.5a2.5 2.5 0 0 0-2.5-2.5H11v5"/><circle cx="7" cy="11" r="1.8"/>'),
  /** jump: a figure with an arrow up */
  jump: svg('<path d="M12 3v6M9 6l3-3 3 3"/><circle cx="12" cy="12" r="1.6"/><path d="M12 14v3l-3 4M12 17l3 4M8.5 14.5 12 14l3.5.5"/>'),
  /** sound on / off */
  sound: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  muted: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  /** pedals */
  gas: svg('<rect x="7" y="2.5" width="10" height="19" rx="3"/><path d="M10 7h4M10 10.5h4M10 14h4M10 17.5h4"/>'),
  brake: svg('<rect x="3.5" y="7" width="17" height="10" rx="3"/><path d="M7.5 10.5v3M10.5 10.5v3M13.5 10.5v3M16.5 10.5v3"/>'),
} as const;

export type IconName = keyof typeof ICON;
