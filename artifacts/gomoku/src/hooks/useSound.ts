import { useRef, useCallback } from "react";

type SkinId = string;

// Each skin has its own sound profile
const SKIN_PROFILES: Record<string, {
  placeType: OscillatorType; placeFreq: number; placeFreqEnd: number;
  winType: OscillatorType; winFreqs: number[];
  loseType: OscillatorType; loseFreqs: number[];
  chatType: OscillatorType; chatFreq: number; chatFreqEnd: number;
  tickType: OscillatorType; tickFreq: number;
  vol: number;
}> = {
  classic: {
    placeType: "sine", placeFreq: 700, placeFreqEnd: 380,
    winType: "triangle", winFreqs: [523, 659, 784, 1047, 1318],
    loseType: "sawtooth", loseFreqs: [392, 349, 294, 262],
    chatType: "sine", chatFreq: 1300, chatFreqEnd: 1700,
    tickType: "square", tickFreq: 580,
    vol: 1,
  },
  cyberpunk: {
    placeType: "square", placeFreq: 900, placeFreqEnd: 200,
    winType: "sawtooth", winFreqs: [440, 660, 880, 1100, 1760],
    loseType: "square", loseFreqs: [300, 220, 160, 110],
    chatType: "sawtooth", chatFreq: 800, chatFreqEnd: 1600,
    tickType: "square", tickFreq: 440,
    vol: 0.7,
  },
  gold: {
    placeType: "sine", placeFreq: 1200, placeFreqEnd: 700,
    winType: "triangle", winFreqs: [659, 784, 988, 1175, 1568],
    loseType: "triangle", loseFreqs: [440, 392, 330, 294],
    chatType: "sine", chatFreq: 1500, chatFreqEnd: 2000,
    tickType: "sine", tickFreq: 880,
    vol: 0.9,
  },
  silver: {
    placeType: "sine", placeFreq: 1000, placeFreqEnd: 500,
    winType: "triangle", winFreqs: [587, 698, 880, 1047, 1397],
    loseType: "sawtooth", loseFreqs: [370, 330, 277, 247],
    chatType: "sine", chatFreq: 1200, chatFreqEnd: 1600,
    tickType: "sine", tickFreq: 660,
    vol: 0.85,
  },
  element: {
    placeType: "sine", placeFreq: 500, placeFreqEnd: 150,
    winType: "triangle", winFreqs: [440, 550, 660, 880, 1100],
    loseType: "sawtooth", loseFreqs: [350, 280, 220, 180],
    chatType: "sine", chatFreq: 1000, chatFreqEnd: 1400,
    tickType: "square", tickFreq: 500,
    vol: 1,
  },
};

function getProfile(skin: SkinId) {
  return SKIN_PROFILES[skin] ?? SKIN_PROFILES.classic;
}

export function useSound(skin: SkinId = "classic") {
  const ctxRef = useRef<AudioContext | null>(null);

  function ctx() {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }

  const playPlace = useCallback(() => {
    try {
      const p = getProfile(skin);
      const c = ctx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = p.placeType;
      o.frequency.setValueAtTime(p.placeFreq, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(p.placeFreqEnd, c.currentTime + 0.09);
      g.gain.setValueAtTime(0.28 * p.vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.13);
      o.start(c.currentTime); o.stop(c.currentTime + 0.13);

      // Cyberpunk: add a distortion crunch layer
      if (skin === "cyberpunk") {
        const o2 = c.createOscillator(); const g2 = c.createGain();
        o2.connect(g2); g2.connect(c.destination);
        o2.type = "sawtooth";
        o2.frequency.setValueAtTime(p.placeFreq * 1.5, c.currentTime);
        o2.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.08);
        g2.gain.setValueAtTime(0.12, c.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.10);
        o2.start(c.currentTime); o2.stop(c.currentTime + 0.10);
      }
      // Element: natural thud
      if (skin === "element") {
        const o2 = c.createOscillator(); const g2 = c.createGain();
        o2.connect(g2); g2.connect(c.destination);
        o2.type = "triangle";
        o2.frequency.setValueAtTime(200, c.currentTime);
        o2.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.15);
        g2.gain.setValueAtTime(0.3, c.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
        o2.start(c.currentTime); o2.stop(c.currentTime + 0.18);
      }
      // Gold: bell overtone
      if (skin === "gold") {
        const o2 = c.createOscillator(); const g2 = c.createGain();
        o2.connect(g2); g2.connect(c.destination);
        o2.type = "sine";
        o2.frequency.setValueAtTime(p.placeFreq * 2.76, c.currentTime);
        g2.gain.setValueAtTime(0.08, c.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
        o2.start(c.currentTime); o2.stop(c.currentTime + 0.4);
      }
    } catch {}
  }, [skin]);

  const playConfirm = useCallback(() => {
    try {
      const p = getProfile(skin);
      const c = ctx();
      [0, 0.07].forEach(delay => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = "sine";
        o.frequency.setValueAtTime(1100, c.currentTime + delay);
        o.frequency.exponentialRampToValueAtTime(900, c.currentTime + delay + 0.06);
        g.gain.setValueAtTime(0.22 * p.vol, c.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.08);
        o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 0.08);
      });
    } catch {}
  }, [skin]);

  const playWin = useCallback(() => {
    try {
      const p = getProfile(skin);
      const c = ctx();
      p.winFreqs.forEach((freq, i) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = p.winType;
        const t = c.currentTime + i * 0.13;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.35 * p.vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        o.start(t); o.stop(t + 0.28);
      });
    } catch {}
  }, [skin]);

  const playLose = useCallback(() => {
    try {
      const p = getProfile(skin);
      const c = ctx();
      p.loseFreqs.forEach((freq, i) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = p.loseType;
        const t = c.currentTime + i * 0.18;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.25 * p.vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o.start(t); o.stop(t + 0.32);
      });
    } catch {}
  }, [skin]);

  const playChat = useCallback(() => {
    try {
      const p = getProfile(skin);
      const c = ctx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = p.chatType;
      o.frequency.setValueAtTime(p.chatFreq, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(p.chatFreqEnd, c.currentTime + 0.1);
      g.gain.setValueAtTime(0.13 * p.vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
      o.start(c.currentTime); o.stop(c.currentTime + 0.14);
    } catch {}
  }, [skin]);

  const playTick = useCallback(() => {
    try {
      const p = getProfile(skin);
      const c = ctx();
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = p.tickType;
      o.frequency.setValueAtTime(p.tickFreq, c.currentTime);
      g.gain.setValueAtTime(0.09 * p.vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
      o.start(c.currentTime); o.stop(c.currentTime + 0.05);
    } catch {}
  }, [skin]);

  return { playPlace, playConfirm, playWin, playLose, playChat, playTick };
}
