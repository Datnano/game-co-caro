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

// ── checkWin: scan 4 directions from last move ─────────────────────────────────
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
//  AI ENGINE V3 — Professional Minimax + Alpha-Beta
//  Strict scoring rules (user spec):
//    Win           =  +1,000,000  (terminate search)
//    Opp 4-ready   =  -1,000,000  (must block)
//    Open Four     =  +10,000     (_XXXX_)
//    Blocked Four  =  +1,000      (OXXXX_ or _XXXXO)
//    Both-blocked  =  0           (OXXXXO — CRITICAL: NEVER waste move)
//    Open Three    =  +1,000      (_XXX_)
//    Fork 4-4      =  +10,000
//    Fork 3-4      =  +9,000
//    Fork 3-3      =  +8,000
// ══════════════════════════════════════════════════════════════════════════════

const AI_WIN  =  1_000_000;
const AI_LOSE = -1_000_000;
const DIRS4   = [[0,1],[1,0],[1,1],[1,-1]] as const;

// ── Dynamic search depth by board size ───────────────────────────────────────
function searchDepth(bs: number): number {
  if (bs <= 5)  return 6;
  if (bs <= 10) return 5;
  return 4;
}

// ── Line evaluation: scan an array of cells for consecutive patterns ──────────
// Returns { score, open4, open3, blocked4 }
// CRITICAL: blocks=2 (both ends blocked) → score=0, completely useless
function evalLine(cells: CellValue[], piece: CellValue, opp: CellValue, wc: number): {
  score: number; open4: number; open3: number; blocked4: number; isWin: boolean;
} {
  const n = cells.length;
  let score = 0, open4 = 0, open3 = 0, blocked4 = 0;
  let i = 0;
  while (i < n) {
    if (cells[i] !== piece) { i++; continue; }
    const start = i;
    while (i < n && cells[i] === piece) i++;
    const count = i - start;

    // Check what lies immediately OUTSIDE the run (determines open/blocked)
    const leftBlocked  = (start === 0)  || cells[start - 1] === opp;
    const rightBlocked = (i    >= n)    || cells[i]         === opp;
    const blocks = (leftBlocked ? 1 : 0) + (rightBlocked ? 1 : 0);

    if (count >= wc) return { score: AI_WIN, open4, open3, blocked4, isWin: true };

    // CRITICAL: both ends blocked → completely useless, score = 0 (OXXXXO)
    if (blocks === 2) continue;

    const isOpen = (blocks === 0);

    if      (count === wc - 1) { if (isOpen) { score += 100_000; open4++;  } else { score += 10_000; blocked4++; } }
    else if (count === wc - 2) { if (isOpen) { score +=  50_000; open3++;  } else   score +=    500; }
    else if (count === wc - 3) { if (isOpen)   score +=     200; }
    else if (count === 1)      { if (isOpen)   score +=      10; }
  }
  return { score, open4, open3, blocked4, isWin: false };
}

// ── evalBrokenLine: window scan for non-consecutive "broken three" patterns ───
// Detects _X_XX_ / _XX_X_ / _X_X_X_ — gaps inside a 5-cell span
// These are just as dangerous as Open Three: filling the gap creates Open Four.
//
// Method: slide a wc-wide window across the line.
//   mine === wc-2 pieces in window + no opponent + pieces are NON-consecutive
//   → broken three. Score depends on what sits just outside the window edges.
//
// Open Broken Three (both flanks empty):  +50,000
// Half-open Broken Three (one flank):       +1,000
// Both flanks blocked:                          0  (useless)
//
// Consecutive patterns (e.g. plain _XXX_) are SKIPPED here — evalLine handles them.
function evalBrokenLine(cells: CellValue[], piece: CellValue, opp: CellValue, wc: number): number {
  if (wc < 5) return 0;  // broken-three concept only meaningful for wc ≥ 5
  const n = cells.length;
  let score = 0;

  for (let i = 0; i <= n - wc; i++) {
    let mine = 0, hasOpp = false, first = -1, last = -1;
    for (let j = 0; j < wc; j++) {
      const v = cells[i + j];
      if (v === opp) { hasOpp = true; break; }
      if (v === piece) { mine++; if (first === -1) first = j; last = j; }
    }
    if (hasOpp || mine !== wc - 2) continue;

    // Skip if consecutive (last−first+1 === mine means no gaps)
    if (last - first + 1 === mine) continue;

    // Flanks immediately outside the window
    const leftBlocked  = (i === 0)       || cells[i - 1]      === opp;
    const rightBlocked = (i + wc >= n)   || cells[i + wc]     === opp;
    if (leftBlocked && rightBlocked) continue;  // both blocked → useless

    score += (!leftBlocked && !rightBlocked) ? 50_000 : 1_000;
  }
  return score;
}

// ── Extract all scannable lines from board (rows, cols, diagonals) ────────────
// Supports any N×M board — NO hardcoded size
function extractLines(board: CellValue[][], rows: number, cols: number, wc: number): CellValue[][] {
  const lines: CellValue[][] = [];

  // Horizontal rows
  for (let r = 0; r < rows; r++) {
    if (cols >= wc) lines.push(board[r].slice() as CellValue[]);
  }

  // Vertical columns
  for (let c = 0; c < cols; c++) {
    if (rows >= wc) { const col: CellValue[] = []; for (let r = 0; r < rows; r++) col.push(board[r][c]); lines.push(col); }
  }

  // Diagonal ↘ (top-left to bottom-right) — d = startRow - startCol offset
  for (let d = -(cols - 1); d <= rows - 1; d++) {
    const diag: CellValue[] = [];
    const r0 = Math.max(0, -d), c0 = Math.max(0, d);
    for (let s = 0; r0 + s < rows && c0 + s < cols; s++) diag.push(board[r0 + s][c0 + s]);
    if (diag.length >= wc) lines.push(diag);
  }

  // Anti-diagonal ↙ (top-right to bottom-left) — d = startRow + startCol
  for (let d = 0; d <= rows + cols - 2; d++) {
    const anti: CellValue[] = [];
    const r0 = Math.max(0, d - cols + 1), c0 = Math.min(d, cols - 1);
    for (let s = 0; r0 + s < rows && c0 - s >= 0; s++) anti.push(board[r0 + s][c0 - s]);
    if (anti.length >= wc) lines.push(anti);
  }

  return lines;
}

// ── Full board static evaluation ──────────────────────────────────────────────
// Scans ALL lines, applies strict scoring + fork detection
function evalBoard(
  board: CellValue[][], me: CellValue, opp: CellValue,
  rows: number, cols: number, wc: number
): number {
  const lines = extractLines(board, rows, cols, wc);
  let myScore = 0, oppScore = 0;
  let myOpen4 = 0, myOpen3 = 0, myBlocked4 = 0;
  let oppOpen4 = 0, oppBlocked4 = 0;

  for (const line of lines) {
    const my = evalLine(line, me,  opp, wc);
    const op = evalLine(line, opp, me,  wc);
    if (my.isWin) return  AI_WIN;   // AI wins → terminal
    if (op.isWin) return  AI_LOSE;  // Opponent wins → terminal

    // Consecutive pattern scores
    myScore  += my.score;
    oppScore += op.score;
    myOpen4  += my.open4;   myOpen3  += my.open3;   myBlocked4  += my.blocked4;
    oppOpen4 += op.open4;   oppBlocked4 += op.blocked4;

    // Broken-three scores (treated identically to Open Three at +50,000)
    // Both my broken threes (attack) and opponent's (defense penalty ×1.2)
    myScore  += evalBrokenLine(line, me,  opp, wc);
    oppScore += evalBrokenLine(line, opp, me,  wc);
  }

  // Opponent has 4 ready to win → -1,000,000 (must block immediately)
  // Covers open four (_OOOO_) AND blocked four (XOOOO_) — both are win-in-one
  if (oppOpen4 + oppBlocked4 > 0) return AI_LOSE;

  // Fork bonus: flat +8,000 for any multi-threat situation
  // Kept deliberately BELOW the Open/Broken Three penalty (50k) so blocking
  // the opponent's three always outweighs building a fork
  const hasMultiThreat = myOpen4 >= 2 || (myOpen4 >= 1 && myOpen3 >= 1) || myOpen3 >= 2;
  const fork = hasMultiThreat ? 8_000 : 0;

  return myScore + fork - oppScore * 1.2;
}

// ── Candidate cells: empty cells within radius 2 (spec) of any piece ─────────
function getCandidates(board: CellValue[][], rows: number, cols: number, radius = 2): [number, number][] {
  const set = new Set<number>();
  const cands: [number, number][] = [];
  let any = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!board[r][c]) continue;
    any = true;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const nr = r+dr, nc = c+dc, k = nr*64+nc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc] && !set.has(k)) { set.add(k); cands.push([nr,nc]); }
    }
  }
  return any ? cands : [[rows >> 1, cols >> 1]];
}

// ── Cheap move scorer for minimax candidate ordering ────────────────────────
// Counts adjacent same/opp pieces from (r,c) in all directions
// O(4 * radius) — much cheaper than full evalBoard
function quickScore(board: CellValue[][], r: number, c: number, me: CellValue, opp: CellValue, rows: number, cols: number, wc: number): number {
  let score = 0;
  for (const [dr, dc] of DIRS4) {
    let mine = 0, theirs = 0;
    for (let i = 1; i < wc; i++) {
      const nr = r+dr*i, nc = c+dc*i;
      if (nr<0||nr>=rows||nc<0||nc>=cols) break;
      if (board[nr][nc] === me) mine++; else if (board[nr][nc] === opp) { theirs++; break; } else break;
    }
    for (let i = 1; i < wc; i++) {
      const nr = r-dr*i, nc = c-dc*i;
      if (nr<0||nr>=rows||nc<0||nc>=cols) break;
      if (board[nr][nc] === me) mine++; else if (board[nr][nc] === opp) { theirs++; break; } else break;
    }
    // Reward building own chain; reward blocking opponent chain slightly more
    score += mine * 10 + theirs * 12;
  }
  return score;
}

// ── Minimax with Alpha-Beta pruning (depth 4–6 per board size) ────────────────
function minimax(
  board: CellValue[][], depth: number, alpha: number, beta: number,
  isMax: boolean, me: CellValue, opp: CellValue, rows: number, cols: number, wc: number
): number {
  if (depth === 0) return evalBoard(board, me, opp, rows, cols, wc);

  // Candidate cells (radius 2) limited to 12 per node for performance
  const raw = getCandidates(board, rows, cols, 2);
  if (!raw.length) return 0;

  // Cheap ordering: sort by quickScore so best moves are tried first → better pruning
  const cr = rows >> 1, cc = cols >> 1;
  const cands = raw
    .map(([r, c]) => {
      const qs = quickScore(board, r, c, me, opp, rows, cols, wc);
      const dist = Math.abs(r - cr) + Math.abs(c - cc);
      return { r, c, s: qs - dist };
    })
    .sort((a, b) => isMax ? b.s - a.s : a.s - b.s)
    .slice(0, 12);

  if (isMax) {
    let best = -Infinity;
    for (const { r, c } of cands) {
      board[r][c] = me;
      // Terminal check (fast): did I just win?
      if (checkWin(board, r, c, me, rows, wc)) { board[r][c] = 0; return AI_WIN * 10 + depth; }
      const val = minimax(board, depth - 1, alpha, beta, false, me, opp, rows, cols, wc);
      board[r][c] = 0;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break; // α-β cutoff
    }
    return best;
  } else {
    let best = Infinity;
    for (const { r, c } of cands) {
      board[r][c] = opp;
      if (checkWin(board, r, c, opp, rows, wc)) { board[r][c] = 0; return AI_LOSE * 10 - depth; }
      const val = minimax(board, depth - 1, alpha, beta, true, me, opp, rows, cols, wc);
      board[r][c] = 0;
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  EASY / MEDIUM AI (lightweight, no deep minimax)
// ══════════════════════════════════════════════════════════════════════════════

function getAIMoveEasy(board: CellValue[][], me: 1|2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const rows = board.length, cols = board[0]?.length ?? bs;
  const cands = getCandidates(board, rows, cols, 2);
  // Block/win only, otherwise random
  for (const [r,c] of cands) { board[r][c]=me; const w=checkWin(board,r,c,me,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  for (const [r,c] of cands) { board[r][c]=opp; const w=checkWin(board,r,c,opp,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  return cands.sort(() => Math.random() - 0.5)[0] ?? [rows>>1, cols>>1];
}

function getAIMoveMedium(board: CellValue[][], me: 1|2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const rows = board.length, cols = board[0]?.length ?? bs;
  const cands = getCandidates(board, rows, cols, 2);
  for (const [r,c] of cands) { board[r][c]=me; const w=checkWin(board,r,c,me,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  for (const [r,c] of cands) { board[r][c]=opp; const w=checkWin(board,r,c,opp,rows,wc); board[r][c]=0; if(w) return [r,c]; }
  const cr=rows>>1, cc=cols>>1;
  let best=cands[0], bestScore=-Infinity;
  for (const [r,c] of cands.slice(0,28)) {
    board[r][c]=me; const atk=evalBoard(board,me,opp,rows,cols,wc); board[r][c]=0;
    board[r][c]=opp; const def=evalBoard(board,me,opp,rows,cols,wc); board[r][c]=0;
    const s = atk - def*0.9 - (Math.abs(r-cr)+Math.abs(c-cc))*0.5 + Math.random()*200;
    if (s > bestScore) { bestScore=s; best=[r,c]; }
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════════════════
//  HARD (CHEAT) AI — Full Minimax + Strict Spec Scoring
//  Supports any N×M board via board.length / board[0].length
// ══════════════════════════════════════════════════════════════════════════════
export function getAIMove(board: CellValue[][], me: 1|2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  // Dynamic board dimensions — NO hardcoding
  const rows = board.length;
  const cols = board[0]?.length ?? bs;
  const cr = rows >> 1, cc = cols >> 1;

  // First move: go to center
  const allCands = getCandidates(board, rows, cols, 2);
  if (allCands.length <= 1) return [cr, cc];

  const depth = searchDepth(bs);

  // Step 1: quick-score all candidates with evalBoard (1-ply)
  // This identifies immediate wins, blocks, and fork setups before deep search
  const prescored: [[number, number], number][] = [];
  for (const [r, c] of allCands) {
    // Immediate win?
    board[r][c] = me;
    if (checkWin(board, r, c, me, rows, wc)) { board[r][c] = 0; return [r, c]; }
    const atkScore = evalBoard(board, me, opp, rows, cols, wc);
    board[r][c] = 0;

    // Opponent win → must block
    board[r][c] = opp;
    if (checkWin(board, r, c, opp, rows, wc)) { board[r][c] = 0; return [r, c]; } // block immediately
    const defScore = evalBoard(board, me, opp, rows, cols, wc);
    board[r][c] = 0;

    const dist = Math.abs(r - cr) + Math.abs(c - cc);
    // Combined: attack + defense (defensive bias per spec) + center proximity
    const score = atkScore - defScore * 1.2 - dist;
    prescored.push([[r, c], score]);
  }

  // Sort and take top 18 candidates for deep minimax
  prescored.sort((a, b) => b[1] - a[1]);
  const top = prescored.slice(0, 18);

  // If top candidate is an emergency block (opponent has 4) return it immediately
  if (prescored[0][1] <= AI_LOSE * 0.5) return prescored[0][0];

  // Step 2: deep minimax on top candidates
  let bestMove: [number, number] = top[0][0];
  let bestVal = -Infinity;
  let alpha = -Infinity, beta = Infinity;

  for (const [[r, c], _] of top) {
    board[r][c] = me;
    const val = minimax(board, depth - 1, alpha, beta, false, me, opp, rows, cols, wc);
    board[r][c] = 0;
    if (val > bestVal) { bestVal = val; bestMove = [r, c]; }
    if (val > alpha) alpha = val;
    // Top-level pruning: if found a win, stop searching
    if (bestVal >= AI_WIN) break;
  }

  return bestMove;
}

// ── Route by difficulty ───────────────────────────────────────────────────────
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
