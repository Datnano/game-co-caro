export const DEFAULT_BOARD_SIZE = 20;

export type CellValue = 0 | 1 | 2;
export type AIDifficulty = "easy" | "medium" | "hard";

export interface GameRoom {
  id: string; players: Player[]; board: CellValue[][];
  currentTurn: 1 | 2; status: "waiting" | "playing" | "finished";
  winner: 0 | 1 | 2; winLine: [number, number][] | null;
  moveCount: number; lastLoser: 0 | 1 | 2; scores: { 1: number; 2: number };
  createdAt: number; turnTime: number; boardSize: number; winCount: number;
  aiPiece: 0 | 1 | 2; aiDifficulty: AIDifficulty;
}
export interface Player { id: string; name: string; piece: 1 | 2; sessionId: string; }

const rooms = new Map<string, GameRoom>();
function makeBoard(n: number): CellValue[][] { return Array.from({ length: n }, () => Array(n).fill(0) as CellValue[]); }
function randCode(len = 6) { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: len }, () => c[Math.random() * c.length | 0]).join(""); }
function clampBS(n: number) { return Math.min(Math.max(n, 3), 30); }
function getWC(bs: number)  { return bs <= 3 ? 3 : bs <= 4 ? 4 : 5; }
function clampT(t: number)  { return Math.min(Math.max(t, 10), 300); }

export function createRoom(turnTime = 30, boardSize = DEFAULT_BOARD_SIZE, aiDifficulty?: AIDifficulty): GameRoom {
  let id = randCode(); while (rooms.has(id)) id = randCode();
  const bs = clampBS(boardSize);
  const room: GameRoom = {
    id, players: [], board: makeBoard(bs), currentTurn: 1, status: "waiting",
    winner: 0, winLine: null, moveCount: 0, lastLoser: 0, scores: { 1: 0, 2: 0 },
    createdAt: Date.now(), turnTime: clampT(turnTime), boardSize: bs, winCount: getWC(bs),
    aiPiece: aiDifficulty ? 2 : 0, aiDifficulty: aiDifficulty ?? "medium",
  };
  rooms.set(id, room); return room;
}
export function getRoom(id: string) { return rooms.get(id); }

export function joinRoom(roomId: string, playerId: string, playerName: string, sessionId: string): { room: GameRoom; piece: 1 | 2 } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Phòng không tồn tại" };
  const ex = room.players.find(p => p.sessionId === sessionId || p.id === playerId);
  if (ex) { ex.id = playerId; return { room, piece: ex.piece }; }
  if (room.players.length >= 2) return { error: "Phòng đã đầy" };
  const piece: 1 | 2 = room.players.length === 0 ? 1 : 2;
  room.players.push({ id: playerId, name: playerName, piece, sessionId });
  if (room.players.length === 2) room.status = "playing";
  return { room, piece };
}

export function makeMove(roomId: string, playerId: string, row: number, col: number): { success: boolean; room?: GameRoom; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "Phòng không tồn tại" };
  if (room.status !== "playing") return { success: false, error: "Trò chơi chưa bắt đầu" };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: "Không tìm thấy người chơi" };
  if (player.piece !== room.currentTurn) return { success: false, error: "Không phải lượt của bạn" };
  const bs = room.boardSize;
  if (row < 0 || row >= bs || col < 0 || col >= bs) return { success: false, error: "Vị trí không hợp lệ" };
  if (room.board[row][col] !== 0) return { success: false, error: "Ô đã có quân" };
  room.board[row][col] = player.piece; room.moveCount++;
  const wl = checkWin(room.board, row, col, player.piece, bs, room.winCount);
  if (wl) { room.winner = player.piece; room.winLine = wl; room.status = "finished"; room.scores[player.piece]++; room.lastLoser = player.piece === 1 ? 2 : 1; }
  else if (room.moveCount >= bs * bs) { room.status = "finished"; room.winner = 0; }
  else room.currentTurn = room.currentTurn === 1 ? 2 : 1;
  return { success: true, room };
}

export function resetGame(roomId: string, requestPiece?: 1 | 2, firstPiece?: 1 | 2): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.players.length < 2) return null;
  if (room.aiPiece === 0 && room.lastLoser !== 0 && requestPiece !== undefined && requestPiece !== room.lastLoser) return null;
  room.board = makeBoard(room.boardSize); room.winner = 0; room.winLine = null; room.moveCount = 0; room.status = "playing";
  room.currentTurn = firstPiece ?? (room.lastLoser !== 0 ? room.lastLoser as 1 | 2 : 1);
  return room;
}

export function skipTurn(roomId: string, piece: 1 | 2): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.status !== "playing" || room.currentTurn !== piece) return null;
  room.currentTurn = room.currentTurn === 1 ? 2 : 1; return room;
}

export function setTurnTime(roomId: string, seconds: number): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null; room.turnTime = clampT(seconds); return room;
}

// ── checkWin: scan 4 directions from last placed piece ────────────────────────
export function checkWin(
  board: CellValue[][], row: number, col: number,
  piece: CellValue, boardSize: number, winCount: number
): [number, number][] | null {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[row, col]];
    for (let i = 1; i < winCount; i++) { const r=row+dr*i,c=col+dc*i; if(r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==piece) break; line.push([r,c]); }
    for (let i = 1; i < winCount; i++) { const r=row-dr*i,c=col-dc*i; if(r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==piece) break; line.push([r,c]); }
    if (line.length >= winCount) return line.slice(0, winCount);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
//  AI ENGINE V4 — Pattern Dictionary + Minimax + Alpha-Beta
//
//  Phase 1: Dynamic sizing — ROWS = board.length, COLS = board[0].length
//  Phase 2: Waterfall pre-filter — Win → Block → Minimax (fixes Priority Inversion)
//  Phase 3: Exhaustive pattern dictionary (string matching, no double-count)
//  Phase 4: Fork detection — 4-4=5M, 4-3=2.5M, 3-3=1M
//  Phase 5: Minimax depth 4+ with Alpha-Beta pruning
// ══════════════════════════════════════════════════════════════════════════════

// ── Phase 3: Pattern dictionary ───────────────────────────────────────────────
// X = active player's piece, O = opponent's piece, _ = empty
// Patterns and their reverses are both included so direction of scan doesn't matter.

// Class 1 — "Step-to-Win" (filling one gap = immediate win): +1,000,000
// CRITICAL ZERO: OXXXXO, OXXXO, OXX_XO NOT listed → they score 0 automatically
const PAT_C1 = [
  '_XXXX_',             // open four (2 ways to win)
  'OXXXX_', '_XXXXO',   // blocked four, one end open (1 way)
  'X_XXX',  'XXX_X',    // broken four, 3+gap+1
  'XX_XX',              // broken four, 2+gap+2
  'X_X_XX', 'XX_X_X',   // deep broken (2 gaps, 4 pieces) — creates immediate C1 next
];

// Class 2 — "Lethal Threats" (open/broken three → one move creates C1): +100,000
const PAT_C2 = [
  '_XXX_',              // open three
  '_X_XX_', '_XX_X_',   // broken three (both ends open)
];

// Class 3 — "Aggressive Development" (two-piece threats): +10,000
const PAT_C3 = [
  '_XX_',               // open two
  '_X_X_', 'X_X_X',    // broken two
];

const SC_C1    = 1_000_000;
const SC_C2    = 100_000;
const SC_C3    = 10_000;
const FORK_44  = 5_000_000;   // Phase 4: 4-4 fork (two C1 threats, unstoppable)
const FORK_43  = 2_500_000;   // Phase 4: 4-3 fork
const FORK_33  = 1_000_000;   // Phase 4: 3-3 fork
const AI_WIN   = 100_000_000;
const AI_LOSE  = -100_000_000;

// Directions: (0,1)=horizontal, (1,0)=vertical, (1,1)=diag↘, (-1,1)=anti-diag↗
const DIRS4 = [[0,1],[1,0],[1,1],[-1,1]] as const;

// ── lineStr: convert cell array to pattern string for one player ─────────────
// me→'X', opp→'O', empty→'_'
function lineStr(cells: CellValue[], me: CellValue, opp: CellValue): string {
  let s = '';
  for (const v of cells) s += v === me ? 'X' : v === opp ? 'O' : '_';
  return s;
}

// ── countOcc: count all (possibly overlapping) occurrences of pat in str ─────
function countOcc(str: string, pat: string): number {
  let n = 0, pos = -1;
  while ((pos = str.indexOf(pat, pos + 1)) !== -1) n++;
  return n;
}

// ── scoreStr: apply pattern dictionary to a line string ───────────────────────
// Returns score + c1/c2 counts (used for fork detection per direction)
// CRITICAL: does NOT double-count because C1 patterns have 4 X's, C2 have 3 X's,
//           C3 have 2 X's — a 4-X pattern cannot be a substring of a 3-X pattern.
interface StrResult { score: number; c1: number; c2: number; isWin: boolean; }
function scoreStr(str: string): StrResult {
  // Win check first (5 in a row)
  if (str.indexOf('XXXXX') !== -1) return { score: AI_WIN, c1: 999, c2: 0, isWin: true };

  let score = 0, c1 = 0, c2 = 0;

  // Class 1 — Step-to-Win
  for (const p of PAT_C1) {
    const n = countOcc(str, p);
    if (n > 0) { score += n * SC_C1; c1 += n; }
  }

  // Class 2 — Lethal Threats
  for (const p of PAT_C2) {
    const n = countOcc(str, p);
    if (n > 0) { score += n * SC_C2; c2 += n; }
  }

  // Class 3 — Aggressive Development
  for (const p of PAT_C3) {
    score += countOcc(str, p) * SC_C3;
  }

  return { score, c1, c2, isWin: false };
}

// ── Phase 1: Extract all lines (no hardcoding — uses ROWS/COLS dynamically) ──
// Returns each line tagged with a direction index (0-3) for fork detection.
function extractAllLines(board: CellValue[][], rows: number, cols: number, wc: number): { cells: CellValue[]; dir: number }[] {
  const out: { cells: CellValue[]; dir: number }[] = [];

  // Horizontal — dir 0
  for (let r = 0; r < rows; r++) {
    if (cols >= wc) out.push({ cells: board[r].slice() as CellValue[], dir: 0 });
  }

  // Vertical — dir 1
  for (let c = 0; c < cols; c++) {
    if (rows >= wc) {
      const cells: CellValue[] = [];
      for (let r = 0; r < rows; r++) cells.push(board[r][c]);
      out.push({ cells, dir: 1 });
    }
  }

  // Diagonal ↘ (dr=1, dc=1) — dir 2
  for (let d = -(cols - 1); d <= rows - 1; d++) {
    const cells: CellValue[] = [];
    const r0 = Math.max(0, -d), c0 = Math.max(0, d);
    for (let s = 0; r0 + s < rows && c0 + s < cols; s++) cells.push(board[r0 + s][c0 + s]);
    if (cells.length >= wc) out.push({ cells, dir: 2 });
  }

  // Anti-diagonal ↙ (dr=1, dc=-1) — dir 3
  for (let d = 0; d <= rows + cols - 2; d++) {
    const cells: CellValue[] = [];
    const r0 = Math.max(0, d - cols + 1), c0 = Math.min(d, cols - 1);
    for (let s = 0; r0 + s < rows && c0 - s >= 0; s++) cells.push(board[r0 + s][c0 - s]);
    if (cells.length >= wc) out.push({ cells, dir: 3 });
  }

  return out;
}

// ── Phase 1: Proximity filter — only cells within radius 2 of any piece ──────
function getCandidates(board: CellValue[][], rows: number, cols: number, radius = 2): [number, number][] {
  const seen = new Set<number>();
  const cands: [number, number][] = [];
  let any = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!board[r][c]) continue;
    any = true;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const nr = r+dr, nc = c+dc, k = nr*64+nc;
      if (nr>=0&&nr<rows&&nc>=0&&nc<cols&&!board[nr][nc]&&!seen.has(k)) { seen.add(k); cands.push([nr,nc]); }
    }
  }
  return any ? cands : [[rows>>1, cols>>1]];
}

// ── Build the full line through point (r,c) along direction (dr,dc) ───────────
function lineThrough(board: CellValue[][], r: number, c: number, dr: number, dc: number, rows: number, cols: number): CellValue[] {
  // Walk backward to find start of line
  let sr = r, sc = c;
  for (;;) {
    const nr = sr - dr, nc = sc - dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
    sr = nr; sc = nc;
  }
  // Walk forward, collecting cells
  const cells: CellValue[] = [];
  for (let cr = sr, cc = sc; cr >= 0 && cr < rows && cc >= 0 && cc < cols; cr += dr, cc += dc) {
    cells.push(board[cr][cc]);
  }
  return cells;
}

// ── Phase 3+4: Full board evaluation ─────────────────────────────────────────
// Extracts all lines, scores them with pattern matching, then applies fork bonuses.
// Fork bonus uses direction-categorized C1/C2 counts to detect multi-line threats.
function evalBoard(board: CellValue[][], me: CellValue, opp: CellValue, rows: number, cols: number, wc: number): number {
  let myScore = 0, oppScore = 0;
  // Track per-direction C1/C2 presence (4 direction types)
  const myC1d  = [0, 0, 0, 0];
  const myC2d  = [0, 0, 0, 0];
  const oppC1d = [0, 0, 0, 0];
  const oppC2d = [0, 0, 0, 0];

  for (const { cells, dir } of extractAllLines(board, rows, cols, wc)) {
    const my = scoreStr(lineStr(cells, me, opp));
    if (my.isWin) return AI_WIN;
    const op = scoreStr(lineStr(cells, opp, me));
    if (op.isWin) return AI_LOSE;

    myScore  += my.score;
    oppScore += op.score;

    // Accumulate per-direction threat presence (for fork detection)
    if (my.c1 > 0) myC1d[dir]++;
    if (my.c2 > 0) myC2d[dir]++;
    if (op.c1 > 0) oppC1d[dir]++;
    if (op.c2 > 0) oppC2d[dir]++;
  }

  // Phase 4: Fork bonus — count DISTINCT direction types carrying each threat class
  // A 4-4 fork means C1 threats exist in 2+ different directions → unstoppable
  const myDC1  = myC1d.reduce((a, n) => a + (n > 0 ? 1 : 0), 0);
  const myDC2  = myC2d.reduce((a, n) => a + (n > 0 ? 1 : 0), 0);
  const oppDC1 = oppC1d.reduce((a, n) => a + (n > 0 ? 1 : 0), 0);
  const oppDC2 = oppC2d.reduce((a, n) => a + (n > 0 ? 1 : 0), 0);

  let myFork = 0;
  if      (myDC1 >= 2)               myFork = FORK_44;
  else if (myDC1 >= 1 && myDC2 >= 1) myFork = FORK_43;
  else if (myDC2 >= 2)               myFork = FORK_33;

  let oppFork = 0;
  if      (oppDC1 >= 2)                oppFork = FORK_44;
  else if (oppDC1 >= 1 && oppDC2 >= 1) oppFork = FORK_43;
  else if (oppDC2 >= 2)                oppFork = FORK_33;

  return (myScore + myFork) - (oppScore + oppFork);
}

// ── Fast candidate scorer for move ordering (4 directions through the cell) ──
// Much cheaper than full evalBoard; used to sort candidates before deep search.
function quickScore(board: CellValue[][], r: number, c: number, me: CellValue, opp: CellValue, rows: number, cols: number, wc: number): number {
  let myS = 0, oppS = 0;
  board[r][c] = me;
  for (const [dr, dc] of DIRS4) {
    const s = scoreStr(lineStr(lineThrough(board, r, c, dr, dc, rows, cols), me, opp));
    myS += s.isWin ? AI_WIN : s.score;
  }
  board[r][c] = opp;
  for (const [dr, dc] of DIRS4) {
    const s = scoreStr(lineStr(lineThrough(board, r, c, dr, dc, rows, cols), opp, me));
    oppS += s.isWin ? AI_WIN : s.score;
  }
  board[r][c] = 0;
  return myS - oppS;
}

// ── Phase 5: Minimax with Alpha-Beta pruning ──────────────────────────────────
function minimax(
  board: CellValue[][], depth: number, alpha: number, beta: number,
  isMax: boolean, me: CellValue, opp: CellValue, rows: number, cols: number, wc: number
): number {
  if (depth === 0) return evalBoard(board, me, opp, rows, cols, wc);

  // Proximity candidates, limited to 12 per node (ordered by quickScore)
  const raw = getCandidates(board, rows, cols, 2);
  if (!raw.length) return evalBoard(board, me, opp, rows, cols, wc);

  const cr = rows >> 1, cc = cols >> 1;
  const current = isMax ? me : opp;

  // Cheap ordering: use quickScore for alpha-beta efficiency
  const ordered = raw
    .map(([r, c]) => ({ r, c, s: quickScore(board, r, c, me, opp, rows, cols, wc) - (Math.abs(r-cr)+Math.abs(c-cc))*5 }))
    .sort((a, b) => isMax ? b.s - a.s : a.s - b.s)
    .slice(0, 12);

  if (isMax) {
    let best = -Infinity;
    for (const { r, c } of ordered) {
      board[r][c] = me;
      if (checkWin(board, r, c, me, rows, wc)) { board[r][c] = 0; return AI_WIN + depth; }
      const val = minimax(board, depth - 1, alpha, beta, false, me, opp, rows, cols, wc);
      board[r][c] = 0;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const { r, c } of ordered) {
      board[r][c] = opp;
      if (checkWin(board, r, c, opp, rows, wc)) { board[r][c] = 0; return AI_LOSE - depth; }
      const val = minimax(board, depth - 1, alpha, beta, true, me, opp, rows, cols, wc);
      board[r][c] = 0;
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ── Search depth based on board size ──────────────────────────────────────────
function searchDepth(bs: number): number {
  if (bs <= 5) return 6;
  if (bs <= 10) return 5;
  return 4;
}

// ══════════════════════════════════════════════════════════════════════════════
//  HARD AI: Phase 2 Waterfall → Phase 3-5 Strategic Engine
// ══════════════════════════════════════════════════════════════════════════════
export function getAIMove(board: CellValue[][], me: 1|2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  // Phase 1: Dynamic sizing — NEVER hardcoded
  const rows = board.length;
  const cols = board[0]?.length ?? bs;
  const cr = rows >> 1, cc = cols >> 1;

  // First move → center
  const cands = getCandidates(board, rows, cols, 2);
  if (cands.length <= 1) return [cr, cc];

  // ── Phase 2: Strict priority waterfall ──────────────────────────────────────
  // Priority 1: Can AI win immediately? Check BEFORE anything else.
  for (const [r, c] of cands) {
    board[r][c] = me;
    const win = checkWin(board, r, c, me, rows, wc);
    board[r][c] = 0;
    if (win) return [r, c];   // WIN IMMEDIATELY — absolute priority
  }

  // Priority 2: Must AI block opponent's immediate win?
  for (const [r, c] of cands) {
    board[r][c] = opp;
    const win = checkWin(board, r, c, opp, rows, wc);
    board[r][c] = 0;
    if (win) return [r, c];   // BLOCK IMMEDIATELY — second priority
  }

  // Priority 3: Strategic engine (Minimax)
  // Pre-score all candidates with quickScore (4-direction pattern scan)
  // to order them before deep search — critical for alpha-beta efficiency.
  const depth = searchDepth(bs);

  const prescored = cands
    .map(([r, c]) => ({
      rc: [r, c] as [number, number],
      s: quickScore(board, r, c, me, opp, rows, cols, wc) - (Math.abs(r-cr)+Math.abs(c-cc)) * 3,
    }))
    .sort((a, b) => b.s - a.s);

  // Early exit: if top candidate creates an unstoppable fork (C1 threat),
  // return it without spending time on deep minimax.
  const topS = prescored[0]?.s ?? 0;
  if (topS >= SC_C1 * 2) return prescored[0].rc;   // double C1 → fork → instant pick

  // Deep minimax on top 18 candidates
  const top = prescored.slice(0, 18);
  let bestMove: [number, number] = top[0].rc;
  let bestVal = -Infinity;
  let alpha = -Infinity, beta = Infinity;

  for (const { rc: [r, c] } of top) {
    board[r][c] = me;
    const val = minimax(board, depth - 1, alpha, beta, false, me, opp, rows, cols, wc);
    board[r][c] = 0;
    if (val > bestVal) { bestVal = val; bestMove = [r, c]; }
    if (val > alpha) alpha = val;
    if (bestVal >= AI_WIN) break;   // found a winning line → stop
  }

  return bestMove;
}

// ══════════════════════════════════════════════════════════════════════════════
//  EASY / MEDIUM AI (lightweight — no deep search)
// ══════════════════════════════════════════════════════════════════════════════
function getAIMoveEasy(board: CellValue[][], me: 1|2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const rows = board.length, cols = board[0]?.length ?? bs;
  const cands = getCandidates(board, rows, cols, 2);
  for (const [r,c] of cands) { board[r][c]=me; const w=checkWin(board,r,c,me,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  for (const [r,c] of cands) { board[r][c]=opp; const w=checkWin(board,r,c,opp,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  return cands.sort(()=>Math.random()-.5)[0] ?? [rows>>1, cols>>1];
}

function getAIMoveMedium(board: CellValue[][], me: 1|2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const rows = board.length, cols = board[0]?.length ?? bs;
  const cands = getCandidates(board, rows, cols, 2);
  for (const [r,c] of cands) { board[r][c]=me; const w=checkWin(board,r,c,me,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  for (const [r,c] of cands) { board[r][c]=opp; const w=checkWin(board,r,c,opp,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  const cr=rows>>1, cc=cols>>1;
  let best=cands[0], bestS=-Infinity;
  for (const [r,c] of cands.slice(0, 30)) {
    const s = quickScore(board, r, c, me, opp, rows, cols, wc)
            - (Math.abs(r-cr)+Math.abs(c-cc))
            + Math.random()*SC_C3;
    if (s > bestS) { bestS=s; best=[r,c]; }
  }
  return best;
}

export function getAIMoveByDifficulty(board: CellValue[][], piece: 1|2, bs: number, wc: number, diff: AIDifficulty): [number, number] {
  switch (diff) {
    case "easy":   return getAIMoveEasy(board, piece, bs, wc);
    case "medium": return getAIMoveMedium(board, piece, bs, wc);
    default:       return getAIMove(board, piece, bs, wc);
  }
}

export function cleanupOldRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) if (now - room.createdAt > 7_200_000) rooms.delete(id);
}
