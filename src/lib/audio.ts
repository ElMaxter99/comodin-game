'use client';
// Sonido sintetizado con WebAudio: sin ficheros, sin dependencias (partykit-casero · juegos/comodin-game/design/DESIGN.md §8).
let ctx: AudioContext | null = null;
let on = false;

export function soundEnabled() { return on; }
export function enableSound(v: boolean) {
  on = v;
  if (v && !ctx) { try { ctx = new AudioContext(); } catch { on = false; } }
  if (v && ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(freq: number, dur = 0.15, type: OscillatorType = 'sine', vol = 0.15, at = 0, slideTo?: number) {
  if (!on || !ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  deal: () => [0, 0.07, 0.14].forEach((d) => tone(500 + d * 800, 0.08, 'triangle', 0.12, d)),
  card: () => tone(660, 0.07, 'triangle', 0.1),
  tick: () => tone(880, 0.05, 'square', 0.05),
  pulse: () => tone(90, 0.3, 'sine', 0.22),
  bell: () => tone(1175, 0.35, 'sine', 0.1),
  right: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.09)),
  wrong: () => tone(300, 0.5, 'sawtooth', 0.1, 0, 110),
  rise: () => [440, 554, 659].forEach((f, i) => tone(f, 0.12, 'triangle', 0.1, i * 0.08)),
  fanfare: () => [523, 523, 523, 698, 880, 698, 880, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.16)),
};
