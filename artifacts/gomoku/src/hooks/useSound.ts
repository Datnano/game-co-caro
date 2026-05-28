import { useRef, useCallback } from "react";

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  function ctx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  const playPlace = useCallback(() => {
    try {
      const c = ctx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(700, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(380, c.currentTime + 0.09);
      g.gain.setValueAtTime(0.28, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.13);
      o.start(c.currentTime); o.stop(c.currentTime + 0.13);
    } catch {}
  }, []);

  // Two-click confirmation sound — higher pitched "click" on confirm
  const playConfirm = useCallback(() => {
    try {
      const c = ctx();
      // short double-beep
      [0, 0.07].forEach(delay => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(1100, c.currentTime + delay);
        o.frequency.exponentialRampToValueAtTime(900, c.currentTime + delay + 0.06);
        g.gain.setValueAtTime(0.22, c.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.08);
        o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 0.08);
      });
    } catch {}
  }, []);

  const playWin = useCallback(() => {
    try {
      const c = ctx();
      [523, 659, 784, 1047, 1318].forEach((freq, i) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = "triangle";
        const t = c.currentTime + i * 0.13;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        o.start(t); o.stop(t + 0.28);
      });
    } catch {}
  }, []);

  const playLose = useCallback(() => {
    try {
      const c = ctx();
      [392, 349, 294, 262].forEach((freq, i) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = "sawtooth";
        const t = c.currentTime + i * 0.18;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.start(t); o.stop(t + 0.32);
      });
    } catch {}
  }, []);

  const playChat = useCallback(() => {
    try {
      const c = ctx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(1300, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(1700, c.currentTime + 0.1);
      g.gain.setValueAtTime(0.13, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
      o.start(c.currentTime); o.stop(c.currentTime + 0.14);
    } catch {}
  }, []);

  const playTick = useCallback(() => {
    try {
      const c = ctx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "square";
      o.frequency.setValueAtTime(580, c.currentTime);
      g.gain.setValueAtTime(0.09, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
      o.start(c.currentTime); o.stop(c.currentTime + 0.05);
    } catch {}
  }, []);

  return { playPlace, playConfirm, playWin, playLose, playChat, playTick };
}
