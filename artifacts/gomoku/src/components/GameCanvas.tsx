import { useRef, useEffect, useCallback } from "react";

const BOARD_SIZE = 20;

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
  gridColor: string;
  bgColor: string;
  coordColor: string;
  winGlow: string;
}

function getSkin(skin: string): SkinConfig {
  switch (skin) {
    case "cyberpunk":
      return {
        xColor: "#ff00ff", xGlow: "#ff00ff",
        oColor: "#00ffff", oGlow: "#00ffff",
        gridColor: "rgba(0,255,255,0.18)",
        bgColor: "#0a001a",
        coordColor: "#ff00ff",
        winGlow: "#ffffff",
      };
    case "gold":
      return {
        xColor: "#ffd700", xGlow: "#ffd700",
        oColor: "#ffaa00", oGlow: "#ff8800",
        gridColor: "rgba(255,215,0,0.2)",
        bgColor: "#0d0900",
        coordColor: "#ffd700",
        winGlow: "#ffd700",
      };
    case "silver":
      return {
        xColor: "#d8d8d8", xGlow: "#ffffff",
        oColor: "#a0a0a0", oGlow: "#c0c0c0",
        gridColor: "rgba(200,200,200,0.18)",
        bgColor: "#0a0a0f",
        coordColor: "#c0c0c0",
        winGlow: "#ffffff",
      };
    default: // classic
      return {
        xColor: "#ff3333", xGlow: "#ff0000",
        oColor: "#3399ff", oGlow: "#0066ff",
        gridColor: "rgba(100,140,200,0.22)",
        bgColor: "#060b18",
        coordColor: "rgba(140,170,220,0.6)",
        winGlow: "#ffffff",
      };
  }
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  piece: 1 | 2,
  s: SkinConfig,
  skin: string,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (skin === "cyberpunk") {
    // Hexagonal cyberpunk style
    const sides = piece === 1 ? 6 : 8;
    ctx.shadowColor = piece === 1 ? s.xGlow : s.oGlow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = piece === 1 ? s.xColor : s.oColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
      const px = cx + r * 0.65 * Math.cos(angle);
      const py = cy + r * 0.65 * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner dot
    ctx.shadowBlur = 10;
    ctx.fillStyle = piece === 1 ? s.xColor : s.oColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (piece === 1) {
    // X piece
    const off = r * 0.55;
    ctx.shadowColor = s.xGlow;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = s.xColor;
    ctx.lineWidth = r * 0.32;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - off, cy - off);
    ctx.lineTo(cx + off, cy + off);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + off, cy - off);
    ctx.lineTo(cx - off, cy + off);
    ctx.stroke();
    // Double glow pass
    ctx.shadowBlur = 35;
    ctx.lineWidth = r * 0.12;
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = s.xGlow;
    ctx.beginPath();
    ctx.moveTo(cx - off, cy - off);
    ctx.lineTo(cx + off, cy + off);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + off, cy - off);
    ctx.lineTo(cx - off, cy + off);
    ctx.stroke();
  } else {
    // O piece
    ctx.shadowColor = s.oGlow;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = s.oColor;
    ctx.lineWidth = r * 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    // Double glow pass
    ctx.shadowBlur = 35;
    ctx.lineWidth = r * 0.1;
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = s.oGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export default function GameCanvas({
  board,
  onMove,
  myPiece,
  currentTurn,
  winLine,
  status,
  skin,
  aiHint,
  danmakuMessages,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const danmakuXRef = useRef<Map<string, number>>(new Map());
  const hoverRef = useRef<[number, number] | null>(null);
  const pulseRef = useRef(0);
  const lastBoardRef = useRef<number[][] | null>(null);

  const COORD_LETTERS = "ABCDEFGHJKLMNOPQRST";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PADDING = W * 0.042;
    const GRID_W = W - PADDING * 2;
    const GRID_H = H - PADDING * 2;
    const CELL_W = GRID_W / (BOARD_SIZE - 1);
    const CELL_H = GRID_H / (BOARD_SIZE - 1);
    const R = Math.min(CELL_W, CELL_H) * 0.44;

    pulseRef.current += 0.04;
    const pulse = Math.sin(pulseRef.current);

    const s = getSkin(skin);

    // Background
    ctx.fillStyle = s.bgColor;
    ctx.fillRect(0, 0, W, H);

    // Stars background dots
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    const starSeed = [3, 7, 11, 13, 17, 23, 29, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89];
    starSeed.forEach((n, i) => {
      const sx = (n * 137.508) % W;
      const sy = (i * 191.341 + n * 53) % H;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Grid lines
    ctx.strokeStyle = s.gridColor;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const x = PADDING + i * CELL_W;
      const y = PADDING + i * CELL_H;
      ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, PADDING + GRID_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(PADDING + GRID_W, y); ctx.stroke();
    }

    // Border
    ctx.strokeStyle = s.gridColor.replace("0.22", "0.5").replace("0.18", "0.4").replace("0.2", "0.4");
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PADDING, PADDING, GRID_W, GRID_H);

    // Coordinates - letters (top)
    ctx.fillStyle = s.coordColor;
    ctx.font = `bold ${CELL_W * 0.32}px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let c = 0; c < BOARD_SIZE; c++) {
      ctx.fillText(COORD_LETTERS[c], PADDING + c * CELL_W, PADDING - 3);
    }

    // Coordinates - numbers (left)
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let r = 0; r < BOARD_SIZE; r++) {
      ctx.fillText(String(r + 1), PADDING - 5, PADDING + r * CELL_H);
    }

    // Star points (like Go)
    const starPoints = [3, 9, 15];
    ctx.fillStyle = s.gridColor.replace("0.22", "0.6").replace("0.18", "0.5").replace("0.2", "0.5");
    starPoints.forEach(r => {
      starPoints.forEach(c => {
        ctx.beginPath();
        ctx.arc(PADDING + c * CELL_W, PADDING + r * CELL_H, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Win line highlight
    if (winLine && winLine.length > 0) {
      const [wr0, wc0] = winLine[0];
      const [wr1, wc1] = winLine[winLine.length - 1];
      const glow = Math.abs(pulse) * 0.5 + 0.5;
      ctx.save();
      ctx.shadowColor = s.winGlow;
      ctx.shadowBlur = 20 + glow * 15;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 + glow * 0.4})`;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(PADDING + wc0 * CELL_W, PADDING + wr0 * CELL_H);
      ctx.lineTo(PADDING + wc1 * CELL_W, PADDING + wr1 * CELL_H);
      ctx.stroke();
      ctx.restore();
    }

    // Pieces
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = board[r]?.[c];
        if (!cell) continue;
        const cx = PADDING + c * CELL_W;
        const cy = PADDING + r * CELL_H;
        drawPiece(ctx, cx, cy, R, cell as 1 | 2, s, skin);
      }
    }

    // AI hint
    if (aiHint && status === "playing") {
      const [hr, hc] = aiHint;
      const cx = PADDING + hc * CELL_W;
      const cy = PADDING + hr * CELL_H;
      const glowAlpha = (Math.sin(pulseRef.current * 2) + 1) / 2;
      ctx.save();
      ctx.shadowColor = "#ffff00";
      ctx.shadowBlur = 25 + glowAlpha * 20;
      ctx.strokeStyle = `rgba(255,255,0,${0.7 + glowAlpha * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Star burst
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 4) + (Math.PI / 2) * i;
        ctx.strokeStyle = `rgba(255,255,0,${0.5 + glowAlpha * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * R * 0.9, cy + Math.sin(angle) * R * 0.9);
        ctx.lineTo(cx + Math.cos(angle) * R * 1.2, cy + Math.sin(angle) * R * 1.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Hover hint
    const hover = hoverRef.current;
    if (hover && status === "playing" && currentTurn === myPiece) {
      const [hr, hc] = hover;
      if (board[hr]?.[hc] === 0) {
        const cx = PADDING + hc * CELL_W;
        const cy = PADDING + hr * CELL_H;
        drawPiece(ctx, cx, cy, R, myPiece, s, skin, 0.35);
      }
    }

    // Danmaku messages
    danmakuMessages.forEach(msg => {
      if (!danmakuXRef.current.has(msg.id)) {
        danmakuXRef.current.set(msg.id, msg.startX);
      }
      const curX = danmakuXRef.current.get(msg.id)! - 2.5;
      danmakuXRef.current.set(msg.id, curX);

      if (curX < -500) {
        danmakuXRef.current.delete(msg.id);
        return;
      }

      const elapsed = msg.startX - curX;
      const totalDist = msg.startX + 500;
      const alpha = elapsed < 100 ? elapsed / 100 : curX < 0 ? Math.max(0, (curX + 500) / 500) : 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.min(CELL_W * 0.45, 18)}px 'Courier New', monospace`;
      ctx.shadowColor = msg.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = msg.color;
      ctx.textBaseline = "middle";
      ctx.fillText(msg.text, curX, msg.y);
      ctx.restore();
    });

    rafRef.current = requestAnimationFrame(draw);
  }, [board, myPiece, currentTurn, winLine, status, skin, aiHint, danmakuMessages]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      const size = Math.min(container.clientWidth, container.clientHeight, 680);
      canvas.width = size;
      canvas.height = size;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getCellFromEvent(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const PADDING = canvas.width * 0.042;
    const GRID_W = canvas.width - PADDING * 2;
    const GRID_H = canvas.height - PADDING * 2;
    const CELL_W = GRID_W / (BOARD_SIZE - 1);
    const CELL_H = GRID_H / (BOARD_SIZE - 1);
    const col = Math.round((mx - PADDING) / CELL_W);
    const row = Math.round((my - PADDING) / CELL_H);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return [row, col] as [number, number];
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    onMove(cell[0], cell[1]);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    hoverRef.current = getCellFromEvent(e);
  }

  function handleMouseLeave() {
    hoverRef.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        cursor: status === "playing" && currentTurn === myPiece ? "crosshair" : "default",
      }}
    />
  );
}
