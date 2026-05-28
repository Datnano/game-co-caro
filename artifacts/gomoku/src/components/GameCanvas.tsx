import { useRef, useEffect, useCallback } from "react";

const BOARD_SIZE = 20;
const COORD_LETTERS = "ABCDEFGHJKLMNOPQRSTU"; // 20 letters, skip I

interface DanmakuMsg {
  id: string;
  text: string;
  color: string;
  y: number;
  startX: number;
}

interface Props {
  board: number[][];
  onMove: (row: number, col: number) => void;
  myPiece: 1 | 2;
  currentTurn: 1 | 2;
  winLine: [number, number][] | null;
  status: string;
  skin: string;
  aiHint: [number, number] | null;
  danmakuMessages: DanmakuMsg[];
}

interface SkinConfig {
  xColor: string;
  xGlow: string;
  oColor: string;
  oGlow: string;
  gridLine: string;
  gridBorder: string;
  bgColor: string;
  coordColor: string;
  cellBg: string;
}

function getSkin(skin: string): SkinConfig {
  switch (skin) {
    case "cyberpunk":
      return {
        xColor: "#ff00ff", xGlow: "#cc00cc",
        oColor: "#00ffff", oGlow: "#00aaaa",
        gridLine: "rgba(0,255,255,0.25)",
        gridBorder: "rgba(0,255,255,0.6)",
        bgColor: "#050010",
        coordColor: "rgba(0,255,255,0.7)",
        cellBg: "rgba(0,255,255,0.025)",
      };
    case "gold":
      return {
        xColor: "#ffd700", xGlow: "#cc9900",
        oColor: "#ff8c00", oGlow: "#cc5500",
        gridLine: "rgba(255,215,0,0.25)",
        gridBorder: "rgba(255,215,0,0.6)",
        bgColor: "#080500",
        coordColor: "rgba(255,215,0,0.75)",
        cellBg: "rgba(255,200,0,0.025)",
      };
    case "silver":
      return {
        xColor: "#e8e8e8", xGlow: "#a0a0a0",
        oColor: "#b0b8c8", oGlow: "#707888",
        gridLine: "rgba(200,210,230,0.2)",
        gridBorder: "rgba(200,210,230,0.5)",
        bgColor: "#070810",
        coordColor: "rgba(180,190,210,0.65)",
        cellBg: "rgba(200,210,230,0.02)",
      };
    default: // classic
      return {
        xColor: "#ff3333", xGlow: "#cc0000",
        oColor: "#3399ff", oGlow: "#0055cc",
        gridLine: "rgba(80,130,220,0.28)",
        gridBorder: "rgba(80,130,220,0.65)",
        bgColor: "#06091a",
        coordColor: "rgba(130,170,230,0.65)",
        cellBg: "rgba(60,100,200,0.025)",
      };
  }
}

function drawX(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  s: SkinConfig, skin: string, alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const off = r * 0.58;
  ctx.lineCap = "round";

  if (skin === "cyberpunk") {
    // Hexagonal outline
    ctx.shadowColor = s.xGlow;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = s.xColor;
    ctx.lineWidth = 1.5;
    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 6;
      const px = cx + r * 0.72 * Math.cos(angle);
      const py = cy + r * 0.72 * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    // Inner X
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - off * 0.5, cy - off * 0.5);
    ctx.lineTo(cx + off * 0.5, cy + off * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + off * 0.5, cy - off * 0.5);
    ctx.lineTo(cx - off * 0.5, cy + off * 0.5);
    ctx.stroke();
  } else {
    // Standard glowing X
    // Glow layer
    ctx.shadowColor = s.xGlow;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = s.xColor;
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx - off, cy - off);
    ctx.lineTo(cx + off, cy + off);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + off, cy - off);
    ctx.lineTo(cx - off, cy + off);
    ctx.stroke();
    // Bright core
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(cx - off, cy - off);
    ctx.lineTo(cx + off, cy + off);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + off, cy - off);
    ctx.lineTo(cx - off, cy + off);
    ctx.stroke();
  }
  ctx.restore();
}

function drawO(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  s: SkinConfig, skin: string, alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (skin === "cyberpunk") {
    // Octagonal outline
    const sides = 8;
    ctx.shadowColor = s.oGlow;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = s.oColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides;
      const px = cx + r * 0.72 * Math.cos(angle);
      const py = cy + r * 0.72 * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    // Inner dot
    ctx.fillStyle = s.oColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Standard glowing O
    ctx.shadowColor = s.oGlow;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = s.oColor;
    ctx.lineWidth = r * 0.26;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    // Bright core ring
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export default function GameCanvas({
  board, onMove, myPiece, currentTurn, winLine,
  status, skin, aiHint, danmakuMessages,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const danmakuXRef = useRef<Map<string, number>>(new Map());
  const hoverRef = useRef<[number, number] | null>(null);
  const pulseRef = useRef(0);

  // ─── layout helpers ─────────────────────────────────────────────────────────
  function getLayout(W: number, H: number) {
    const PAD_LEFT = W * 0.055;    // space for row numbers
    const PAD_TOP  = W * 0.045;    // space for column letters
    const PAD_RIGHT  = W * 0.02;
    const PAD_BOTTOM = W * 0.02;
    const GRID_W = W - PAD_LEFT - PAD_RIGHT;
    const GRID_H = H - PAD_TOP  - PAD_BOTTOM;
    const CW = GRID_W / BOARD_SIZE;
    const CH = GRID_H / BOARD_SIZE;
    const R  = Math.min(CW, CH) * 0.42;
    return { PAD_LEFT, PAD_TOP, PAD_RIGHT, PAD_BOTTOM, GRID_W, GRID_H, CW, CH, R };
  }

  function cellCenter(row: number, col: number, layout: ReturnType<typeof getLayout>) {
    const { PAD_LEFT, PAD_TOP, CW, CH } = layout;
    return {
      cx: PAD_LEFT + col * CW + CW / 2,
      cy: PAD_TOP  + row * CH + CH / 2,
    };
  }

  function getCellFromXY(mx: number, my: number, W: number, H: number) {
    const { PAD_LEFT, PAD_TOP, CW, CH } = getLayout(W, H);
    const col = Math.floor((mx - PAD_LEFT) / CW);
    const row = Math.floor((my - PAD_TOP)  / CH);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return [row, col] as [number, number];
  }

  // ─── draw loop ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const layout = getLayout(W, H);
    const { PAD_LEFT, PAD_TOP, GRID_W, GRID_H, CW, CH, R } = layout;

    pulseRef.current += 0.045;
    const pulse = Math.sin(pulseRef.current);

    const s = getSkin(skin);

    // ── background ──
    ctx.fillStyle = s.bgColor;
    ctx.fillRect(0, 0, W, H);

    // subtle nebula glow
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, "rgba(30,60,140,0.08)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── coordinate labels ──
    const fontSize = Math.max(9, Math.min(CW * 0.38, 14));
    ctx.font = `600 ${fontSize}px 'Orbitron','Share Tech Mono',monospace`;
    ctx.fillStyle = s.coordColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let c = 0; c < BOARD_SIZE; c++) {
      ctx.fillText(
        COORD_LETTERS[c],
        PAD_LEFT + c * CW + CW / 2,
        PAD_TOP - 3
      );
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let r = 0; r < BOARD_SIZE; r++) {
      ctx.fillText(
        String(r + 1),
        PAD_LEFT - 4,
        PAD_TOP + r * CH + CH / 2
      );
    }

    // ── grid cells (subtle bg tint per cell, alternating) ──
    // skip to avoid visual noise — just draw lines

    // ── grid lines ──
    ctx.strokeStyle = s.gridLine;
    ctx.lineWidth = 0.7;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      const x = PAD_LEFT + i * CW;
      const y = PAD_TOP  + i * CH;
      ctx.beginPath(); ctx.moveTo(x, PAD_TOP);            ctx.lineTo(x, PAD_TOP + GRID_H);  ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD_LEFT, y);           ctx.lineTo(PAD_LEFT + GRID_W, y); ctx.stroke();
    }

    // ── board border ──
    ctx.strokeStyle = s.gridBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PAD_LEFT, PAD_TOP, GRID_W, GRID_H);

    // ── win line highlight ──
    if (winLine && winLine.length >= 2) {
      const first = winLine[0];
      const last  = winLine[winLine.length - 1];
      const { cx: x0, cy: y0 } = cellCenter(first[0], first[1], layout);
      const { cx: x1, cy: y1 } = cellCenter(last[0],  last[1],  layout);
      const glowA = 0.6 + Math.abs(pulse) * 0.4;
      ctx.save();
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 20 + Math.abs(pulse) * 12;
      ctx.strokeStyle = `rgba(255,255,255,${glowA})`;
      ctx.lineWidth = Math.max(CW * 0.22, 4);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.restore();
    }

    // ── pieces ──
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = board[r]?.[c];
        if (!cell) continue;
        const { cx, cy } = cellCenter(r, c, layout);
        if (cell === 1) drawX(ctx, cx, cy, R, s, skin);
        else            drawO(ctx, cx, cy, R, s, skin);
      }
    }

    // ── AI hint (only visible to cheat user) ──
    if (aiHint && status === "playing") {
      const [hr, hc] = aiHint;
      const { cx, cy } = cellCenter(hr, hc, layout);
      const glowA = (Math.sin(pulseRef.current * 2.5) + 1) / 2;
      ctx.save();
      ctx.shadowColor = "#ffee00";
      ctx.shadowBlur = 24 + glowA * 18;
      // outer ring
      ctx.strokeStyle = `rgba(255,230,0,${0.65 + glowA * 0.35})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // inner dot
      ctx.fillStyle = `rgba(255,240,0,${0.45 + glowA * 0.4})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // corner rays
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + (Math.PI / 2) * i;
        ctx.strokeStyle = `rgba(255,240,0,${0.5 + glowA * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * R * 0.85, cy + Math.sin(angle) * R * 0.85);
        ctx.lineTo(cx + Math.cos(angle) * R * 1.15, cy + Math.sin(angle) * R * 1.15);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── hover preview ──
    const hover = hoverRef.current;
    if (hover && status === "playing" && currentTurn === myPiece) {
      const [hr, hc] = hover;
      if (board[hr]?.[hc] === 0) {
        const { cx, cy } = cellCenter(hr, hc, layout);
        if (myPiece === 1) drawX(ctx, cx, cy, R, s, skin, 0.3);
        else               drawO(ctx, cx, cy, R, s, skin, 0.3);
      }
    }

    // ── danmaku ──
    danmakuMessages.forEach(msg => {
      if (!danmakuXRef.current.has(msg.id)) {
        danmakuXRef.current.set(msg.id, W + 60);
      }
      const curX = (danmakuXRef.current.get(msg.id) ?? W + 60) - 2.2;
      danmakuXRef.current.set(msg.id, curX);

      if (curX < -600) { danmakuXRef.current.delete(msg.id); return; }

      const alpha = curX > W - 100 ? Math.min(1, (W + 60 - curX) / 80)
                  : curX < 0       ? Math.max(0, (curX + 300) / 300)
                  : 1;

      ctx.save();
      ctx.globalAlpha = alpha * 0.92;
      const fs = Math.min(CH * 0.55, 16);
      ctx.font = `700 ${fs}px 'Orbitron','Share Tech Mono',monospace`;
      ctx.shadowColor = msg.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = msg.color;
      ctx.textBaseline = "middle";
      // subtle dark outline for readability
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 3;
      ctx.strokeText(msg.text, curX, msg.y);
      ctx.fillText(msg.text, curX, msg.y);
      ctx.restore();
    });

    rafRef.current = requestAnimationFrame(draw);
  }, [board, myPiece, currentTurn, winLine, status, skin, aiHint, danmakuMessages]);

  // ─── RAF management ─────────────────────────────────────────────────────────
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ─── resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      // Fill as much of the container as possible (square)
      const available = Math.min(container.clientWidth, container.clientHeight);
      const size = Math.floor(available * 0.98);
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width  = size;
        canvas.height = size;
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    const container = canvasRef.current?.parentElement;
    if (container) ro.observe(container);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ─── event handlers ─────────────────────────────────────────────────────────
  function getCellFromEvent(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top)  * scaleY;
    return getCellFromXY(mx, my, canvas.width, canvas.height);
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cell = getCellFromEvent(e);
    if (cell) onMove(cell[0], cell[1]);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    hoverRef.current = getCellFromEvent(e);
  }

  function handleMouseLeave() { hoverRef.current = null; }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: status === "playing" && currentTurn === myPiece ? "crosshair" : "default" }}
    />
  );
}
