import { useRef, useEffect, useCallback } from "react";

const ALPHA = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

interface DanmakuMsg {
  id: string; text: string; color: string; y: number; startX: number;
}

interface Props {
  board: number[][];
  boardSize: number;
  onMove: (row: number, col: number) => void;
  myPiece: 1 | 2;
  currentTurn: 1 | 2;
  winLine: [number, number][] | null;
  status: string;
  skin: string;
  aiHint: [number, number] | null;
  danmakuMessages: DanmakuMsg[];
  boardBg?: string;
  boardBorder?: string;
}

interface SkinConfig {
  xColor: string; xGlow: string;
  oColor: string; oGlow: string;
  gridLine: string; gridBorder: string;
  bgColor: string; coordColor: string;
}

function getSkin(skin: string): SkinConfig {
  switch (skin) {
    case "cyberpunk": return {
      xColor:"#ff00ff", xGlow:"#880088",
      oColor:"#00ffff", oGlow:"#007777",
      gridLine:"rgba(0,255,255,0.20)", gridBorder:"rgba(0,255,255,0.52)",
      bgColor:"#050010", coordColor:"rgba(0,255,255,0.62)",
    };
    case "gold": return {
      xColor:"#ffd700", xGlow:"#997700",
      oColor:"#e07800", oGlow:"#884400",
      gridLine:"rgba(255,215,0,0.20)", gridBorder:"rgba(255,215,0,0.52)",
      bgColor:"#080500", coordColor:"rgba(255,200,0,0.68)",
    };
    case "silver": return {
      xColor:"#d0d0d0", xGlow:"#888888",
      oColor:"#6899cc", oGlow:"#334d77",
      gridLine:"rgba(200,210,230,0.18)", gridBorder:"rgba(200,210,230,0.46)",
      bgColor:"#07080f", coordColor:"rgba(180,190,210,0.58)",
    };
    case "element": return {
      xColor:"#ff5500", xGlow:"#cc2200",
      oColor:"#0077ff", oGlow:"#003399",
      gridLine:"rgba(140,80,220,0.20)", gridBorder:"rgba(140,80,220,0.48)",
      bgColor:"#060410", coordColor:"rgba(180,130,240,0.65)",
    };
    default: return {
      xColor:"#ff3333", xGlow:"#990000",
      oColor:"#3399ff", oGlow:"#004499",
      gridLine:"rgba(70,120,210,0.24)", gridBorder:"rgba(70,120,210,0.56)",
      bgColor:"#06091a", coordColor:"rgba(130,170,230,0.60)",
    };
  }
}

// Board background presets
const BG_PRESETS: Record<string, string> = {
  default:    "",
  navy:       "#04071a",
  midnight:   "#020510",
  pitch:      "#010108",
  darkgreen:  "#020a06",
  darkmaroon: "#0a0204",
};

// Border color presets — { border, gridLine } pair so grid matches border
const BORDER_PRESETS: Record<string, { border: string; gridLine: string }> = {
  default: { border: "",                        gridLine: "" },
  white:   { border: "rgba(220,230,255,0.55)",  gridLine: "rgba(220,230,255,0.18)" },
  gold:    { border: "rgba(255,210,0,0.62)",    gridLine: "rgba(255,210,0,0.18)"   },
  teal:    { border: "rgba(0,212,192,0.60)",    gridLine: "rgba(0,212,192,0.18)"   },
  purple:  { border: "rgba(160,80,255,0.60)",   gridLine: "rgba(160,80,255,0.18)"  },
  red:     { border: "rgba(255,60,60,0.58)",    gridLine: "rgba(255,60,60,0.18)"   },
};

// ── Perfect square layout — cells always square, grid centered ───────────────
function getLayout(W: number, H: number, boardSize: number) {
  // Font size for coordinate labels
  const fontSize = Math.max(8, Math.min(Math.floor(W * 0.038), 14));
  // Coord label area — left column (row numbers) and top row (col letters)
  const coordPx = Math.ceil(fontSize * 2.8);

  // Available space after coord labels
  const availW = W - coordPx;
  const availH = H - coordPx;

  // Uniform square cell size
  const cellSize = Math.min(availW, availH) / boardSize;
  const GW = cellSize * boardSize;
  const GH = cellSize * boardSize; // always equal

  // Center the grid in available space
  const PL = coordPx + (availW - GW) / 2;
  const PT = coordPx + (availH - GH) / 2;

  const R = cellSize * 0.44;
  return { PL, PT, GW, GH, CW: cellSize, CH: cellSize, R, fontSize };
}

function cellCenter(row: number, col: number, L: ReturnType<typeof getLayout>) {
  return { cx: L.PL + col * L.CW + L.CW / 2, cy: L.PT + row * L.CH + L.CH / 2 };
}

function hitCell(mx: number, my: number, W: number, H: number, boardSize: number): [number, number] | null {
  const L = getLayout(W, H, boardSize);
  const col = Math.floor((mx - L.PL) / L.CW);
  const row = Math.floor((my - L.PT) / L.CH);
  if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return null;
  return [row, col];
}

// ── element skin: emoji icons ────────────────────────────────────────────────
function drawElement(ctx: CanvasRenderingContext2D, cx: number, cy: number,
                     R: number, piece: 1 | 2, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const emoji = piece === 1 ? "🔥" : "💧";
  const sz = Math.floor(R * 1.9);
  ctx.font = `${sz}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = piece === 1 ? "#ff4400" : "#0044cc";
  ctx.shadowBlur = R * 0.7;
  ctx.fillText(emoji, cx, cy + sz * 0.04);
  ctx.restore();
}

// ── cyberpunk shapes ─────────────────────────────────────────────────────────
function drawCyberpunkX(ctx: CanvasRenderingContext2D, cx: number, cy: number,
                         R: number, s: SkinConfig, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = "round";
  const off = R * 0.48;
  ctx.shadowColor = s.xGlow; ctx.shadowBlur = 14;
  ctx.strokeStyle = s.xColor; ctx.lineWidth = Math.max(1.5, R * 0.11);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 2 * i / 6 - Math.PI / 6;
    const px = cx + R * 0.68 * Math.cos(a), py = cy + R * 0.68 * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();
  ctx.lineWidth = Math.max(2, R * 0.15);
  ctx.beginPath(); ctx.moveTo(cx - off * 0.5, cy - off * 0.5); ctx.lineTo(cx + off * 0.5, cy + off * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + off * 0.5, cy - off * 0.5); ctx.lineTo(cx - off * 0.5, cy + off * 0.5); ctx.stroke();
  ctx.restore();
}

function drawCyberpunkO(ctx: CanvasRenderingContext2D, cx: number, cy: number,
                         R: number, s: SkinConfig, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.shadowColor = s.oGlow; ctx.shadowBlur = 14;
  ctx.strokeStyle = s.oColor; ctx.lineWidth = Math.max(1.5, R * 0.11);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8;
    const px = cx + R * 0.68 * Math.cos(a), py = cy + R * 0.68 * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle = s.oColor; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── standard X and O ─────────────────────────────────────────────────────────
function drawStandardX(ctx: CanvasRenderingContext2D, cx: number, cy: number,
                        R: number, s: SkinConfig, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = "round";
  const off = R * 0.52;
  const lw  = R * 0.28;
  ctx.shadowColor = s.xGlow; ctx.shadowBlur = 22;
  ctx.strokeStyle = s.xColor; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(cx - off, cy - off); ctx.lineTo(cx + off, cy + off); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + off, cy - off); ctx.lineTo(cx - off, cy + off); ctx.stroke();
  ctx.shadowBlur = 6; ctx.strokeStyle = "rgba(255,255,255,0.42)"; ctx.lineWidth = lw * 0.28;
  ctx.beginPath(); ctx.moveTo(cx - off, cy - off); ctx.lineTo(cx + off, cy + off); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + off, cy - off); ctx.lineTo(cx - off, cy + off); ctx.stroke();
  ctx.restore();
}

function drawStandardO(ctx: CanvasRenderingContext2D, cx: number, cy: number,
                        R: number, s: SkinConfig, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const radius = R * 0.52;
  const lw     = R * 0.28;
  ctx.shadowColor = s.oGlow; ctx.shadowBlur = 22;
  ctx.strokeStyle = s.oColor; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 6; ctx.strokeStyle = "rgba(255,255,255,0.42)"; ctx.lineWidth = lw * 0.28;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawPiece(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number,
                   piece: 1 | 2, s: SkinConfig, skin: string, alpha = 1) {
  if (skin === "element") { drawElement(ctx, cx, cy, R, piece, alpha); return; }
  if (skin === "cyberpunk") {
    if (piece === 1) drawCyberpunkX(ctx, cx, cy, R, s, alpha);
    else             drawCyberpunkO(ctx, cx, cy, R, s, alpha);
    return;
  }
  if (piece === 1) drawStandardX(ctx, cx, cy, R, s, alpha);
  else             drawStandardO(ctx, cx, cy, R, s, alpha);
}

// ── component ────────────────────────────────────────────────────────────────

export default function GameCanvas({ board, boardSize, onMove, myPiece, currentTurn,
  winLine, status, skin, aiHint, danmakuMessages, boardBg, boardBorder }: Props) {

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const danmakuXRef = useRef<Map<string, number>>(new Map());
  const hoverRef    = useRef<[number, number] | null>(null);
  const pendingRef  = useRef<[number, number] | null>(null);
  const pulseRef    = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const L = getLayout(W, H, boardSize);
    const { PL, PT, GW, GH, CW, CH, R, fontSize } = L;
    pulseRef.current += 0.045;
    const pulse = Math.sin(pulseRef.current);
    const s = getSkin(skin);

    // Effective background + border (custom overrides skin default)
    const effectiveBg       = (boardBg && BG_PRESETS[boardBg])           || s.bgColor;
    const borderPreset      = boardBorder ? BORDER_PRESETS[boardBorder]  : null;
    const effectiveBorder   = (borderPreset?.border)   || s.gridBorder;
    const effectiveGridLine = (borderPreset?.gridLine)  || s.gridLine;

    // Background
    ctx.fillStyle = effectiveBg; ctx.fillRect(0, 0, W, H);
    if (skin === "element") {
      const gl = ctx.createRadialGradient(W*0.25, H*0.65, 0, W*0.25, H*0.65, W*0.5);
      gl.addColorStop(0, "rgba(120,30,0,0.14)"); gl.addColorStop(1, "transparent");
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
      const gr2 = ctx.createRadialGradient(W*0.75, H*0.35, 0, W*0.75, H*0.35, W*0.5);
      gr2.addColorStop(0, "rgba(0,30,120,0.14)"); gr2.addColorStop(1, "transparent");
      ctx.fillStyle = gr2; ctx.fillRect(0, 0, W, H);
    } else {
      const gr = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.6);
      gr.addColorStop(0, "rgba(30,60,140,0.06)"); gr.addColorStop(1, "transparent");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }

    // Coordinate labels — precisely aligned to grid
    const fs = fontSize;
    ctx.font = `600 ${fs}px 'Orbitron','Share Tech Mono',monospace`;
    ctx.fillStyle = s.coordColor;

    // Column letters — centered on each cell column, vertically centered in top coord area
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const colLabelY = PT / 2; // vertical center of top coord strip
    for (let c = 0; c < boardSize; c++) {
      ctx.fillText(ALPHA[c] ?? String(c + 1), PL + c * CW + CW / 2, colLabelY);
    }

    // Row numbers — centered on each row, horizontally centered in left coord area
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const rowLabelX = PL / 2; // horizontal center of left coord strip
    for (let r = 0; r < boardSize; r++) {
      ctx.fillText(String(r + 1), rowLabelX, PT + r * CH + CH / 2);
    }

    // Grid interior lines (follow effectiveGridLine so color matches border)
    ctx.strokeStyle = effectiveGridLine; ctx.lineWidth = 0.7;
    for (let i = 0; i <= boardSize; i++) {
      const x = PL + i * CW;
      const y = PT + i * CH;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + GH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + GW, y); ctx.stroke();
    }

    // Outer border frame — exactly matching the grid extent
    ctx.strokeStyle = effectiveBorder; ctx.lineWidth = 2;
    ctx.strokeRect(PL, PT, GW, GH);

    // Corner accents for the border frame
    const accentLen = Math.min(CW * 1.5, 18);
    const accentW = 3;
    ctx.strokeStyle = effectiveBorder; ctx.lineWidth = accentW;
    const corners = [
      [PL, PT, 1, 1], [PL + GW, PT, -1, 1],
      [PL, PT + GH, 1, -1], [PL + GW, PT + GH, -1, -1],
    ] as const;
    for (const [cx2, cy2, dx, dy] of corners) {
      ctx.beginPath(); ctx.moveTo(cx2 + dx * accentLen, cy2); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2 + dy * accentLen); ctx.stroke();
    }

    // Win line
    if (winLine && winLine.length >= 2) {
      const { cx: x0, cy: y0 } = cellCenter(winLine[0][0], winLine[0][1], L);
      const { cx: x1, cy: y1 } = cellCenter(winLine[winLine.length-1][0], winLine[winLine.length-1][1], L);
      const gA = 0.55 + Math.abs(pulse) * 0.45;
      ctx.save();
      ctx.shadowColor = "#fff"; ctx.shadowBlur = 18 + Math.abs(pulse)*14;
      ctx.strokeStyle = `rgba(255,255,255,${gA})`; ctx.lineWidth = Math.max(CW*0.22,4);
      ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
      ctx.restore();
    }

    // Placed pieces
    for (let r = 0; r < boardSize; r++)
      for (let c = 0; c < boardSize; c++) {
        const cell = board[r]?.[c];
        if (!cell) continue;
        const { cx, cy } = cellCenter(r, c, L);
        drawPiece(ctx, cx, cy, R, cell as 1|2, s, skin);
      }

    // AI hint ring
    if (aiHint && status === "playing") {
      const [hr, hc] = aiHint;
      const { cx, cy } = cellCenter(hr, hc, L);
      const gA = (Math.sin(pulseRef.current * 2.8) + 1) / 2;
      ctx.save();
      ctx.shadowColor = "#ffee00"; ctx.shadowBlur = 22 + gA*16;
      ctx.strokeStyle = `rgba(255,230,0,${0.6+gA*0.4})`; ctx.lineWidth = 2;
      ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.arc(cx, cy, R*0.78, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,240,0,${0.4+gA*0.45})`;
      ctx.beginPath(); ctx.arc(cx, cy, R*0.18, 0, Math.PI*2); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI/4 + Math.PI/2*i;
        ctx.strokeStyle = `rgba(255,240,0,${0.45+gA*0.4})`; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a)*R*0.88, cy + Math.sin(a)*R*0.88);
        ctx.lineTo(cx + Math.cos(a)*R*1.20, cy + Math.sin(a)*R*1.20);
        ctx.stroke();
      }
      ctx.restore();
    }

    const canAct = status === "playing" && currentTurn === myPiece;
    const pending = pendingRef.current;

    // Pending ghost + ring
    if (pending && canAct && board[pending[0]]?.[pending[1]] === 0) {
      const { cx, cy } = cellCenter(pending[0], pending[1], L);
      drawPiece(ctx, cx, cy, R, myPiece, s, skin, 0.60);
      const ringA = 0.55 + Math.abs(pulse) * 0.45;
      ctx.save();
      ctx.shadowColor = myPiece===1 ? s.xGlow : s.oGlow; ctx.shadowBlur = 14;
      ctx.strokeStyle = myPiece===1
        ? `rgba(255,100,100,${ringA})` : `rgba(80,160,255,${ringA})`;
      ctx.lineWidth = 1.8; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.arc(cx, cy, R*0.90, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI/4 + Math.PI/2*i;
        ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${0.40+ringA*0.32})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a)*R*0.94, cy + Math.sin(a)*R*0.94);
        ctx.lineTo(cx + Math.cos(a)*R*1.18, cy + Math.sin(a)*R*1.18);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Hover ghost
    const hover = hoverRef.current;
    if (hover && canAct && board[hover[0]]?.[hover[1]] === 0) {
      const isPending = pending && pending[0]===hover[0] && pending[1]===hover[1];
      if (!isPending) {
        const { cx, cy } = cellCenter(hover[0], hover[1], L);
        drawPiece(ctx, cx, cy, R, myPiece, s, skin, 0.20);
      }
    }

    // Danmaku
    danmakuMessages.forEach(msg => {
      if (!danmakuXRef.current.has(msg.id))
        danmakuXRef.current.set(msg.id, W + 60);
      const curX = (danmakuXRef.current.get(msg.id) ?? W+60) - 2.2;
      danmakuXRef.current.set(msg.id, curX);
      if (curX < -600) { danmakuXRef.current.delete(msg.id); return; }
      const alpha = curX > W-100 ? Math.min(1,(W+60-curX)/80)
                  : curX < 0    ? Math.max(0,(curX+300)/300) : 1;
      const fz = Math.min(CH*0.52, 15);
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.font = `700 ${fz}px 'Orbitron','Share Tech Mono',monospace`;
      ctx.shadowColor = msg.color; ctx.shadowBlur = 10;
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 3;
      ctx.strokeText(msg.text, curX, msg.y);
      ctx.fillStyle = msg.color; ctx.textBaseline = "middle";
      ctx.fillText(msg.text, curX, msg.y);
      ctx.restore();
    });

    rafRef.current = requestAnimationFrame(draw);
  }, [board, boardSize, myPiece, currentTurn, winLine, status, skin, aiHint, danmakuMessages, boardBg, boardBorder]);

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
      const size = Math.floor(Math.min(container.clientWidth, container.clientHeight));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size; canvas.height = size;
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    const container = canvasRef.current?.parentElement;
    if (container) ro.observe(container);
    window.addEventListener("resize", resize);
    return () => { ro.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  function getCell(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX; clientY = e.clientY;
    }
    return hitCell((clientX-rect.left)*scaleX, (clientY-rect.top)*scaleY,
                   canvas.width, canvas.height, boardSize);
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (status !== "playing" || currentTurn !== myPiece) return;
    const cell = getCell(e);
    if (!cell) return;
    const [r, c] = cell;
    if (board[r]?.[c] !== 0) return;
    const pending = pendingRef.current;
    if (pending && pending[0]===r && pending[1]===c) {
      pendingRef.current = null; onMove(r, c);
    } else { pendingRef.current = [r, c]; }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (status !== "playing" || currentTurn !== myPiece) return;
    const canvas = canvasRef.current;
    if (!canvas || e.changedTouches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.changedTouches[0];
    const cell = hitCell(
      (t.clientX-rect.left)*(canvas.width/rect.width),
      (t.clientY-rect.top)*(canvas.height/rect.height),
      canvas.width, canvas.height, boardSize
    );
    if (!cell) return;
    const [r, c] = cell;
    if (board[r]?.[c] !== 0) return;
    const pending = pendingRef.current;
    if (pending && pending[0]===r && pending[1]===c) {
      pendingRef.current = null; onMove(r, c);
    } else { pendingRef.current = [r, c]; }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) { hoverRef.current = getCell(e); }
  function handleMouseLeave() { hoverRef.current = null; }

  useEffect(() => { pendingRef.current = null; }, [currentTurn, status]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: status==="playing" && currentTurn===myPiece ? "crosshair" : "default" }}
    />
  );
}

