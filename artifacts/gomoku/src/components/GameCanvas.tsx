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
}

interface SkinConfig {
  xColor: string; xGlow: string; oColor: string; oGlow: string;
  xColor2: string; oColor2: string; // secondary / highlight color
  gridLine: string; gridBorder: string; bgColor: string; coordColor: string;
}

function getSkin(skin: string): SkinConfig {
  switch (skin) {
    case "cyberpunk": return {
      xColor:"#ff00ff", xGlow:"#aa00aa", xColor2:"#ff88ff",
      oColor:"#00ffff", oGlow:"#009999", oColor2:"#88ffff",
      gridLine:"rgba(0,255,255,0.22)", gridBorder:"rgba(0,255,255,0.55)",
      bgColor:"#050010", coordColor:"rgba(0,255,255,0.65)",
    };
    case "gold": return {
      xColor:"#ffd700", xGlow:"#bb8800", xColor2:"#fff3a0",
      oColor:"#ff8c00", oGlow:"#bb5500", oColor2:"#ffcc77",
      gridLine:"rgba(255,215,0,0.22)", gridBorder:"rgba(255,215,0,0.55)",
      bgColor:"#080500", coordColor:"rgba(255,215,0,0.7)",
    };
    case "silver": return {
      xColor:"#e0e0e0", xGlow:"#909090", xColor2:"#ffffff",
      oColor:"#b0b8c8", oGlow:"#707888", oColor2:"#d8e0f0",
      gridLine:"rgba(200,210,230,0.18)", gridBorder:"rgba(200,210,230,0.48)",
      bgColor:"#07080f", coordColor:"rgba(180,190,210,0.6)",
    };
    case "fire": return {
      xColor:"#ff5500", xGlow:"#cc1100", xColor2:"#ffcc00",
      oColor:"#ff8800", oGlow:"#cc4400", oColor2:"#ffee44",
      gridLine:"rgba(255,90,0,0.22)", gridBorder:"rgba(255,90,0,0.52)",
      bgColor:"#0d0100", coordColor:"rgba(255,110,20,0.68)",
    };
    case "water": return {
      xColor:"#00aaff", xGlow:"#003388", xColor2:"#88ddff",
      oColor:"#0055ff", oGlow:"#001166", oColor2:"#66ccff",
      gridLine:"rgba(0,160,255,0.22)", gridBorder:"rgba(0,180,255,0.52)",
      bgColor:"#00030f", coordColor:"rgba(0,185,255,0.68)",
    };
    default: return { // classic
      xColor:"#ff3333", xGlow:"#bb0000", xColor2:"#ff9999",
      oColor:"#3399ff", oGlow:"#0055bb", oColor2:"#99ccff",
      gridLine:"rgba(75,125,215,0.26)", gridBorder:"rgba(75,125,215,0.58)",
      bgColor:"#06091a", coordColor:"rgba(130,170,230,0.62)",
    };
  }
}

function getLayout(W: number, H: number, boardSize: number) {
  const coordScale = Math.max(0.032, Math.min(0.056, 1.1 / boardSize));
  const PL = W * coordScale * 1.6;
  const PT = W * coordScale * 1.3;
  const PR = W * 0.012;
  const PB = W * 0.010;
  const GW = W - PL - PR;
  const GH = H - PT - PB;
  const CW = GW / boardSize;
  const CH = GH / boardSize;
  const R  = Math.min(CW, CH) * 0.44;
  return { PL, PT, PR, PB, GW, GH, CW, CH, R };
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

// ── piece renderers ──────────────────────────────────────────────────────────

function drawX(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number,
               s: SkinConfig, skin: string, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = "round";
  const off = R * 0.57;

  if (skin === "cyberpunk") {
    ctx.shadowColor = s.xGlow; ctx.shadowBlur = 12;
    ctx.strokeStyle = s.xColor; ctx.lineWidth = Math.max(1.5, R * 0.12);
    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = Math.PI*2*i/sides - Math.PI/6;
      const px = cx + R*0.70*Math.cos(a), py = cy + R*0.70*Math.sin(a);
      i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.stroke();
    ctx.lineWidth = Math.max(1.8, R*0.14);
    const o2 = off * 0.48;
    ctx.beginPath(); ctx.moveTo(cx-o2,cy-o2); ctx.lineTo(cx+o2,cy+o2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+o2,cy-o2); ctx.lineTo(cx-o2,cy+o2); ctx.stroke();

  } else if (skin === "fire") {
    // Outer glow (red-orange)
    ctx.shadowColor = s.xGlow; ctx.shadowBlur = 32;
    ctx.strokeStyle = s.xColor; ctx.lineWidth = R * 0.34;
    ctx.beginPath(); ctx.moveTo(cx-off,cy-off); ctx.lineTo(cx+off,cy+off); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+off,cy-off); ctx.lineTo(cx-off,cy+off); ctx.stroke();
    // Inner flame highlight (yellow)
    ctx.shadowColor = s.xColor2; ctx.shadowBlur = 16;
    ctx.strokeStyle = s.xColor2; ctx.lineWidth = R * 0.13;
    ctx.beginPath(); ctx.moveTo(cx-off*0.7,cy-off*0.7); ctx.lineTo(cx+off*0.7,cy+off*0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+off*0.7,cy-off*0.7); ctx.lineTo(cx-off*0.7,cy+off*0.7); ctx.stroke();
    // Sparks at tips
    ctx.shadowBlur = 10;
    for (const [sx,sy] of [[-off,-off],[off,off],[off,-off],[-off,off]]) {
      ctx.fillStyle = s.xColor2;
      ctx.beginPath(); ctx.arc(cx+sx*0.95, cy+sy*0.95, R*0.07, 0, Math.PI*2); ctx.fill();
    }

  } else if (skin === "water") {
    // Deep blue outer
    ctx.shadowColor = s.xGlow; ctx.shadowBlur = 28;
    ctx.strokeStyle = s.xColor; ctx.lineWidth = R * 0.30;
    ctx.beginPath(); ctx.moveTo(cx-off,cy-off); ctx.lineTo(cx+off,cy+off); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+off,cy-off); ctx.lineTo(cx-off,cy+off); ctx.stroke();
    // Cyan inner ripple
    ctx.shadowColor = s.xColor2; ctx.shadowBlur = 14;
    ctx.strokeStyle = s.xColor2; ctx.lineWidth = R * 0.11;
    ctx.beginPath(); ctx.moveTo(cx-off*0.65,cy-off*0.65); ctx.lineTo(cx+off*0.65,cy+off*0.65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+off*0.65,cy-off*0.65); ctx.lineTo(cx-off*0.65,cy+off*0.65); ctx.stroke();
    // Water droplet dots at center
    ctx.fillStyle = s.xColor2; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(cx, cy, R*0.11, 0, Math.PI*2); ctx.fill();

  } else {
    // Classic, gold, silver
    ctx.shadowColor = s.xGlow; ctx.shadowBlur = 24;
    ctx.strokeStyle = s.xColor; ctx.lineWidth = R * 0.30;
    ctx.beginPath(); ctx.moveTo(cx-off,cy-off); ctx.lineTo(cx+off,cy+off); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+off,cy-off); ctx.lineTo(cx-off,cy+off); ctx.stroke();
    ctx.shadowBlur = 8; ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = R * 0.09;
    ctx.beginPath(); ctx.moveTo(cx-off,cy-off); ctx.lineTo(cx+off,cy+off); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+off,cy-off); ctx.lineTo(cx-off,cy+off); ctx.stroke();
  }
  ctx.restore();
}

function drawO(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number,
               s: SkinConfig, skin: string, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;

  if (skin === "cyberpunk") {
    const sides = 8;
    ctx.shadowColor = s.oGlow; ctx.shadowBlur = 12;
    ctx.strokeStyle = s.oColor; ctx.lineWidth = Math.max(1.5, R*0.12);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = Math.PI*2*i/sides;
      const px = cx + R*0.70*Math.cos(a), py = cy + R*0.70*Math.sin(a);
      i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = s.oColor; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(cx, cy, R*0.14, 0, Math.PI*2); ctx.fill();

  } else if (skin === "fire") {
    // Outer fire ring
    ctx.shadowColor = s.oGlow; ctx.shadowBlur = 32;
    ctx.strokeStyle = s.oColor; ctx.lineWidth = R * 0.30;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.57, 0, Math.PI*2); ctx.stroke();
    // Inner yellow ring
    ctx.shadowColor = s.oColor2; ctx.shadowBlur = 18;
    ctx.strokeStyle = s.oColor2; ctx.lineWidth = R * 0.12;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.36, 0, Math.PI*2); ctx.stroke();
    // Flame center dot
    ctx.fillStyle = s.oColor2; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.10, 0, Math.PI*2); ctx.fill();
    // Flame tips at 4 cardinal points
    for (let i = 0; i < 4; i++) {
      const a = Math.PI/2 * i;
      ctx.strokeStyle = s.oColor2; ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a)*R*0.60, cy + Math.sin(a)*R*0.60);
      ctx.lineTo(cx + Math.cos(a)*R*0.82, cy + Math.sin(a)*R*0.82);
      ctx.stroke();
    }

  } else if (skin === "water") {
    // Outer deep ring
    ctx.shadowColor = s.oGlow; ctx.shadowBlur = 28;
    ctx.strokeStyle = s.oColor; ctx.lineWidth = R * 0.28;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.57, 0, Math.PI*2); ctx.stroke();
    // Middle ripple ring
    ctx.shadowColor = s.oColor2; ctx.shadowBlur = 16;
    ctx.strokeStyle = s.oColor2; ctx.lineWidth = R * 0.14;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.38, 0, Math.PI*2); ctx.stroke();
    // Inner ripple
    ctx.strokeStyle = `rgba(150,230,255,0.55)`; ctx.lineWidth = R * 0.08; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.20, 0, Math.PI*2); ctx.stroke();
    // Drop center
    ctx.fillStyle = s.oColor2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.09, 0, Math.PI*2); ctx.fill();

  } else {
    ctx.shadowColor = s.oGlow; ctx.shadowBlur = 24;
    ctx.strokeStyle = s.oColor; ctx.lineWidth = R * 0.27;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.57, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 7; ctx.strokeStyle = "rgba(255,255,255,0.48)"; ctx.lineWidth = R * 0.08;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.57, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawPiece(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number,
                   piece: 1 | 2, s: SkinConfig, skin: string, alpha = 1) {
  if (piece === 1) drawX(ctx, cx, cy, R, s, skin, alpha);
  else             drawO(ctx, cx, cy, R, s, skin, alpha);
}

// ── component ────────────────────────────────────────────────────────────────

export default function GameCanvas({ board, boardSize, onMove, myPiece, currentTurn,
  winLine, status, skin, aiHint, danmakuMessages }: Props) {

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
    const { PL, PT, GW, GH, CW, CH, R } = L;
    pulseRef.current += 0.045;
    const pulse = Math.sin(pulseRef.current);
    const s = getSkin(skin);

    // Background
    ctx.fillStyle = s.bgColor; ctx.fillRect(0, 0, W, H);
    // Fire: subtle red radial glow; Water: subtle blue
    if (skin === "fire") {
      const fg = ctx.createRadialGradient(W/2, H*0.7, 0, W/2, H*0.7, W*0.7);
      fg.addColorStop(0, "rgba(100,20,0,0.18)"); fg.addColorStop(1, "transparent");
      ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    } else if (skin === "water") {
      const wg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.6);
      wg.addColorStop(0, "rgba(0,40,120,0.14)"); wg.addColorStop(1, "transparent");
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
    } else {
      const gr = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.65);
      gr.addColorStop(0, "rgba(30,60,140,0.07)"); gr.addColorStop(1, "transparent");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }

    // Coordinate labels
    const fs = Math.max(7, Math.min(CW * 0.38, 15));
    ctx.font = `600 ${fs}px 'Orbitron','Share Tech Mono',monospace`;
    ctx.fillStyle = s.coordColor;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    for (let c = 0; c < boardSize; c++)
      ctx.fillText(ALPHA[c] ?? String(c+1), PL + c*CW + CW/2, PT - 2);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let r = 0; r < boardSize; r++)
      ctx.fillText(String(r+1), PL - 3, PT + r*CH + CH/2);

    // Grid
    ctx.strokeStyle = s.gridLine; ctx.lineWidth = 0.7;
    for (let i = 0; i <= boardSize; i++) {
      const x = PL + i*CW, y = PT + i*CH;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT+GH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL+GW, y); ctx.stroke();
    }
    ctx.strokeStyle = s.gridBorder; ctx.lineWidth = 1.6;
    ctx.strokeRect(PL, PT, GW, GH);

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

    // AI hint
    if (aiHint && status === "playing") {
      const [hr, hc] = aiHint;
      const { cx, cy } = cellCenter(hr, hc, L);
      const gA = (Math.sin(pulseRef.current * 2.8) + 1) / 2;
      ctx.save();
      ctx.shadowColor = "#ffee00"; ctx.shadowBlur = 22 + gA*16;
      ctx.strokeStyle = `rgba(255,230,0,${0.6 + gA*0.4})`; ctx.lineWidth = 2;
      ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.arc(cx, cy, R*0.78, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,240,0,${0.4 + gA*0.45})`;
      ctx.beginPath(); ctx.arc(cx, cy, R*0.18, 0, Math.PI*2); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI/4 + Math.PI/2*i;
        ctx.strokeStyle = `rgba(255,240,0,${0.45 + gA*0.4})`; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a)*R*0.88, cy + Math.sin(a)*R*0.88);
        ctx.lineTo(cx + Math.cos(a)*R*1.20, cy + Math.sin(a)*R*1.20);
        ctx.stroke();
      }
      ctx.restore();
    }

    const canAct = status === "playing" && currentTurn === myPiece;
    const pending = pendingRef.current;

    // Pending (first-click) cell
    if (pending && canAct && board[pending[0]]?.[pending[1]] === 0) {
      const { cx, cy } = cellCenter(pending[0], pending[1], L);
      drawPiece(ctx, cx, cy, R, myPiece, s, skin, 0.65);
      const ringA = 0.55 + Math.abs(pulse) * 0.45;
      ctx.save();
      ctx.shadowColor = myPiece===1 ? s.xGlow : s.oGlow; ctx.shadowBlur = 14;
      ctx.strokeStyle = myPiece===1
        ? `rgba(255,100,100,${ringA})` : `rgba(80,160,255,${ringA})`;
      ctx.lineWidth = 1.8; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.arc(cx, cy, R*0.92, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI/4 + Math.PI/2*i;
        ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${0.45 + ringA*0.35})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a)*R*0.96, cy + Math.sin(a)*R*0.96);
        ctx.lineTo(cx + Math.cos(a)*R*1.20, cy + Math.sin(a)*R*1.20);
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
        drawPiece(ctx, cx, cy, R, myPiece, s, skin, 0.22);
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
  }, [board, boardSize, myPiece, currentTurn, winLine, status, skin, aiHint, danmakuMessages]);

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
    return hitCell((clientX-rect.left)*scaleX, (clientY-rect.top)*scaleY, canvas.width, canvas.height, boardSize);
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
    } else {
      pendingRef.current = [r, c];
    }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (status !== "playing" || currentTurn !== myPiece) return;
    const canvas = canvasRef.current;
    if (!canvas || e.changedTouches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const t = e.changedTouches[0];
    const cell = hitCell(
      (t.clientX-rect.left)*scaleX, (t.clientY-rect.top)*scaleY,
      canvas.width, canvas.height, boardSize
    );
    if (!cell) return;
    const [r, c] = cell;
    if (board[r]?.[c] !== 0) return;
    const pending = pendingRef.current;
    if (pending && pending[0]===r && pending[1]===c) {
      pendingRef.current = null; onMove(r, c);
    } else {
      pendingRef.current = [r, c];
    }
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
