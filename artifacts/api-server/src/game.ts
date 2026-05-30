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
//  AI ENGINE V5 — Minimax + Alpha-Beta + Spec-Compliant Heuristic
//
//  Scoring (all values from AI's perspective):
//    WIN_SCORE      +1,000,000  — AI 5-in-a-row (terminate)
//    LOSE_SCORE     -1,000,000  — Opp 5-in-a-row (terminate)
//    OPEN_FOUR      +100,000    — _XXXX_
//    BLOCK_FOUR     +1,000      — OXXXX_ or _XXXXO (one open end)
//    BROKEN_FOUR    +1,000      — XX_XX / X_XXX / XXX_X
//    USELESS_FOUR   +0          — OXXXXO (both ends blocked) → explicitly ignored
//    OPP_FOUR       -1,000,000  — opponent any 4-threat → must block
//    OPEN_THREE     +50,000     — _XXX_
//    BROKEN_THREE   +50,000     — _X_XX_ / _XX_X_
//    OPP_THREE      -50,000     — opponent open/broken three (critical defense fix)
//    FORK_44        +10,000     — 4-4 fork bonus
//    FORK_34        +9,000      — 3-4 fork bonus
//    FORK_33        +8,000      — 3-3 fork bonus
// ══════════════════════════════════════════════════════════════════════════════

const V_WIN      =  1_000_000;   // 5-in-a-row → terminal
const V_LOSE     = -1_000_000;   // opponent 5-in-a-row → terminal
const V_OPEN4    =    100_000;   // _XXXX_
const V_BLOCK4   =      5_000;   // OXXXX_ / _XXXXO (one open end)
const V_BROKEN4  =     20_000;   // X_XXX / XXX_X / XX_XX (gap in 4-run)
const V_OPP4     = -1_000_000;   // opponent any 4-threat → must block
const V_OPEN3    =     50_000;   // _XXX_
const V_BROKEN3  =     40_000;   // _X_XX_ / _XX_X_ (both ends open)
const V_DBL_GAP3 =     25_000;   // X_X_X (double-gap hidden trap)
const V_HALF3    =     15_000;   // _X_XX / XX_X_ (one end open broken 3)
const V_OPP3     =    -50_000;   // opponent open/broken three
// Fork bonuses — GREATLY increased so AI actively hunts double-threats
const V_FORK44   =    200_000;   // 4-4 fork: essentially forced win
const V_FORK34   =     80_000;   // 3-4 fork: very dangerous
const V_FORK33   =     60_000;   // 3-3 fork: forces two-block dilemma

// Directions: horizontal, vertical, diagonal ↘, anti-diagonal ↗
const DIRS4 = [[0,1],[1,0],[1,1],[-1,1]] as const;

// ── lineStr: map board cells to X/O/_ string (me=X, opp=O, empty=_) ──────────
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

// ── hasViableWindow: dead-line guard ─────────────────────────────────────────
// Returns true if `str` contains at least one uninterrupted run of `wc` cells
// that contain no 'O'. If false → the line is a dead line (wall-blocked or
// fully surrounded), can never produce a win, score it as 0 immediately.
function hasViableWindow(str: string, wc: number): boolean {
  let run = 0;
  for (const ch of str) {
    if (ch === 'O') { run = 0; }
    else if (++run >= wc) return true;
  }
  return false;
}

// ── scoreLine: evaluate one line string from AI's perspective ─────────────────
// wc = win condition (pieces needed to win). Defaults to 5.
// Returns the score, and flags indicating presence of 4-threats and 3-threats
// (used by evalBoard for per-direction fork detection).
interface LineResult { score: number; has4: boolean; has3: boolean; terminal: boolean; }

function scoreLine(str: string, wc = 5): LineResult {
  // Terminal: wc-in-a-row for either side (aggressive override: AI win checked first)
  if (str.includes('XXXXX')) return { score: V_WIN,  has4: true,  has3: false, terminal: true };
  if (str.includes('OOOOO')) return { score: V_LOSE, has4: false, has3: false, terminal: true };

  // Dead-line guard: if no viable window of `wc` non-opponent cells exists,
  // this line can NEVER produce a win — boundary walls make it unreachable.
  // Score 0 immediately rather than wasting compute on useless patterns.
  if (!hasViableWindow(str, wc)) return { score: 0, has4: false, has3: false, terminal: false };

  let score = 0, has4 = false, has3 = false;

  // ── AI's offensive patterns (positive scores) ──────────────────────────────

  // Open four _XXXX_ → +100,000
  const nOf = countOcc(str, '_XXXX_');
  if (nOf > 0) { score += nOf * V_OPEN4; has4 = true; }

  // Blocked four one open end (OXXXXO excluded → 0) → +5,000
  const nBf = countOcc(str, 'OXXXX_') + countOcc(str, '_XXXXO');
  if (nBf > 0) { score += nBf * V_BLOCK4; has4 = true; }

  // Broken fours — gap inside 4-piece run → +20,000
  // (Nearly as dangerous as a blocked four; AI uses these as hidden forks)
  const nXf = countOcc(str, 'XX_XX')
            + countOcc(str, 'X_XXX')
            + countOcc(str, 'XXX_X');
  if (nXf > 0) { score += nXf * V_BROKEN4; has4 = true; }

  // Open three _XXX_ → +50,000
  const nOt = countOcc(str, '_XXX_');
  if (nOt > 0) { score += nOt * V_OPEN3; has3 = true; }

  // Broken threes — both ends open → +40,000
  const nBt = countOcc(str, '_X_XX_') + countOcc(str, '_XX_X_');
  if (nBt > 0) { score += nBt * V_BROKEN3; has3 = true; }

  // Double-gap three X_X_X → +25,000 (hidden trap; human rarely defends this)
  const nDg = countOcc(str, 'X_X_X');
  if (nDg > 0) { score += nDg * V_DBL_GAP3; has3 = true; }

  // Half-open broken threes _X_XX / XX_X_ → +15,000
  const nHb = countOcc(str, '_X_XX') + countOcc(str, 'XX_X_');
  if (nHb > 0) { score += nHb * V_HALF3; has3 = true; }

  // ── Opponent's dangerous patterns (negative — defense penalties) ─────────

  // Opponent 4-threats — any with at least one open end.
  // XOOOOX (both ends blocked, useless) explicitly excluded → 0.
  const nO4 = countOcc(str, '_OOOO_')              // open four
            + countOcc(str, 'XOOOO_')               // blocked one end (left)
            + countOcc(str, '_OOOOX')               // blocked one end (right)
            + countOcc(str, 'OO_OO')                // broken four center
            + countOcc(str, 'O_OOO')                // broken four left gap
            + countOcc(str, 'OOO_O');               // broken four right gap
  if (nO4 > 0) score += nO4 * V_OPP4;

  // Opponent open/broken threes → -50,000 each
  const nO3 = countOcc(str, '_OOO_')
            + countOcc(str, '_O_OO_')
            + countOcc(str, '_OO_O_');
  if (nO3 > 0) score += nO3 * V_OPP3;

  // Opponent double-gap three O_O_O → -25,000
  const nOdg = countOcc(str, 'O_O_O');
  if (nOdg > 0) score += nOdg * (-V_DBL_GAP3);

  return { score, has4, has3, terminal: false };
}

// ── extractAllLines: all rows / cols / diagonals of length >= wc ─────────────
// Dynamic sizing: uses ROWS = board.length, COLS = board[0].length.
// No hardcoded board dimension anywhere.
function extractAllLines(
  board: CellValue[][], rows: number, cols: number, wc: number
): { cells: CellValue[]; dir: number }[] {
  const out: { cells: CellValue[]; dir: number }[] = [];

  // Horizontal — dir 0
  for (let r = 0; r < rows; r++)
    if (cols >= wc) out.push({ cells: board[r].slice() as CellValue[], dir: 0 });

  // Vertical — dir 1
  for (let c = 0; c < cols; c++) {
    if (rows >= wc) {
      const cells: CellValue[] = [];
      for (let r = 0; r < rows; r++) cells.push(board[r][c]);
      out.push({ cells, dir: 1 });
    }
  }

  // Diagonal ↘ — dir 2
  for (let d = -(cols - 1); d <= rows - 1; d++) {
    const cells: CellValue[] = [];
    const r0 = Math.max(0, -d), c0 = Math.max(0, d);
    for (let s = 0; r0 + s < rows && c0 + s < cols; s++) cells.push(board[r0 + s][c0 + s]);
    if (cells.length >= wc) out.push({ cells, dir: 2 });
  }

  // Anti-diagonal ↗ — dir 3
  for (let d = 0; d <= rows + cols - 2; d++) {
    const cells: CellValue[] = [];
    const r0 = Math.max(0, d - cols + 1), c0 = Math.min(d, cols - 1);
    for (let s = 0; r0 + s < rows && c0 - s >= 0; s++) cells.push(board[r0 + s][c0 - s]);
    if (cells.length >= wc) out.push({ cells, dir: 3 });
  }

  return out;
}

// ── getCandidates: empty cells within radius of any placed piece ──────────────
// Only evaluates cells adjacent to existing pieces — critical optimization for
// large boards. Falls back to center if board is empty.
function getCandidates(board: CellValue[][], rows: number, cols: number, radius = 2): [number, number][] {
  const seen = new Set<number>();
  const cands: [number, number][] = [];
  let any = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!board[r][c]) continue;
    any = true;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr, nc = c + dc, k = nr * 64 + nc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !board[nr][nc] && !seen.has(k)) {
        seen.add(k); cands.push([nr, nc]);
      }
    }
  }
  return any ? cands : [[rows >> 1, cols >> 1]];
}

// ── lineThrough: extract full line through (r,c) in direction (dr,dc) ─────────
function lineThrough(
  board: CellValue[][], r: number, c: number,
  dr: number, dc: number, rows: number, cols: number
): CellValue[] {
  let sr = r, sc = c;
  for (;;) {
    const nr = sr - dr, nc = sc - dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
    sr = nr; sc = nc;
  }
  const cells: CellValue[] = [];
  for (let cr = sr, cc = sc; cr >= 0 && cr < rows && cc >= 0 && cc < cols; cr += dr, cc += dc)
    cells.push(board[cr][cc]);
  return cells;
}

// ── evalBoard: full-board heuristic from AI's perspective ─────────────────────
// Scans all four directions, applies scoreLine to each line, detects forks.
function evalBoard(
  board: CellValue[][], me: CellValue, opp: CellValue,
  rows: number, cols: number, wc: number
): number {
  let total = 0;
  // Track which directions contain AI 4-threats and 3-threats (for fork detection)
  const ai4d = [false, false, false, false];
  const ai3d = [false, false, false, false];

  for (const { cells, dir } of extractAllLines(board, rows, cols, wc)) {
    const ls = scoreLine(lineStr(cells, me, opp), wc);
    if (ls.terminal) return ls.score;          // WIN or LOSE — no need to continue
    total += ls.score;
    if (ls.has4) ai4d[dir] = true;
    if (ls.has3) ai3d[dir] = true;
  }

  // Fork detection: count distinct directions that carry each threat class.
  // Bonuses are large so the AI actively hunts double-threat intersections.
  const d4 = ai4d.filter(Boolean).length;
  const d3 = ai3d.filter(Boolean).length;

  if      (d4 >= 2)              total += V_FORK44;  // 4-4 fork: +200,000
  else if (d4 >= 1 && d3 >= 1)  total += V_FORK34;  // 3-4 fork: +80,000
  else if (d3 >= 2)              total += V_FORK33;  // 3-3 fork: +60,000

  return total;
}

// ── quickScore: fast 4-direction score for candidate move ordering ────────────
// Estimates value of placing AI at (r,c): attack gain + defensive value (what
// opponent would get). Used to sort candidates before deep Minimax search.
function quickScore(
  board: CellValue[][], r: number, c: number,
  me: CellValue, opp: CellValue, rows: number, cols: number, wc: number
): number {
  let atk = 0, def = 0;

  // Attack: score all 4 lines with AI's piece placed here
  board[r][c] = me;
  for (const [dr, dc] of DIRS4) {
    const ls = scoreLine(lineStr(lineThrough(board, r, c, dr, dc, rows, cols), me, opp), wc);
    atk += ls.score;
    if (ls.terminal) { atk = V_WIN * 2; break; }
  }

  // Defense: score all 4 lines as if opponent placed here (what AI must prevent)
  board[r][c] = opp;
  for (const [dr, dc] of DIRS4) {
    const ls = scoreLine(lineStr(lineThrough(board, r, c, dr, dc, rows, cols), opp, me), wc);
    def += ls.score;
    if (ls.terminal) { def = V_WIN * 2; break; }
  }

  board[r][c] = 0;
  return atk + def;  // both attack and defense contribute to candidate priority
}

// ── Minimax with Alpha-Beta pruning ──────────────────────────────────────────
// isMax=true → AI's turn (maximizing), isMax=false → opponent's turn (minimizing).
// Candidates are limited to proximity cells and sorted by quickScore for
// aggressive alpha-beta cutoffs.
function minimax(
  board: CellValue[][], depth: number, alpha: number, beta: number,
  isMax: boolean, me: CellValue, opp: CellValue,
  rows: number, cols: number, wc: number
): number {
  if (depth === 0) return evalBoard(board, me, opp, rows, cols, wc);

  const raw = getCandidates(board, rows, cols, 2);
  if (!raw.length) return evalBoard(board, me, opp, rows, cols, wc);

  const cr = rows >> 1, cc = cols >> 1;
  // Sort candidates and limit to top 12 per node for performance
  const ordered = raw
    .map(([r, c]) => ({
      r, c,
      s: quickScore(board, r, c, me, opp, rows, cols, wc) - (Math.abs(r - cr) + Math.abs(c - cc)) * 5,
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 12);

  if (isMax) {
    let best = -Infinity;
    for (const { r, c } of ordered) {
      board[r][c] = me;
      // Early terminal: winning move detected immediately
      if (checkWin(board, r, c, me, rows, wc)) { board[r][c] = 0; return V_WIN + depth; }
      const val = minimax(board, depth - 1, alpha, beta, false, me, opp, rows, cols, wc);
      board[r][c] = 0;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;  // alpha-beta cutoff
    }
    return best;
  } else {
    let best = Infinity;
    for (const { r, c } of ordered) {
      board[r][c] = opp;
      if (checkWin(board, r, c, opp, rows, wc)) { board[r][c] = 0; return V_LOSE - depth; }
      const val = minimax(board, depth - 1, alpha, beta, true, me, opp, rows, cols, wc);
      board[r][c] = 0;
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;  // alpha-beta cutoff
    }
    return best;
  }
}

// ── Search depth tuned by board size ─────────────────────────────────────────
function searchDepth(bs: number): number {
  if (bs <= 5)  return 6;
  if (bs <= 10) return 5;
  return 4;
}

// ══════════════════════════════════════════════════════════════════════════════
//  HARD AI: Priority waterfall → Strategic Minimax
// ══════════════════════════════════════════════════════════════════════════════
export function getAIMove(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  // Dynamic sizing — NEVER hardcoded, works for any N×M board
  const rows = board.length;
  const cols = board[0]?.length ?? bs;
  const cr = rows >> 1, cc = cols >> 1;

  // ══════════════════════════════════════════════════════════════════════════
  //  PHASE 0: Opening Book — "Hua Yue / Flower Moon" (花月)
  //  Structure mirrors the spec exactly. Full board scan — no early break.
  // ══════════════════════════════════════════════════════════════════════════
  {
    // 1. EXPLICITLY count every piece; track the last opponent piece found.
    //    (For 1-piece boards this is the only opponent piece; for 2-piece boards
    //     it is the single piece that is NOT the AI's piece.)
    let totalPieces = 0;
    let oppFR = -1, oppFC = -1;   // opponent's first (and only relevant) piece
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c] !== 0) {        // 0 = empty
          totalPieces++;
          if (board[r][c] !== me) {     // anything that is not the AI = opponent
            oppFR = r;
            oppFC = c;
          }
        }
      }
    }

    // Rule 1: Empty board — AI plays first → exact center, no search.
    if (totalPieces === 0) {
      return [cr, cc];
    }

    // Rule 2: AI plays second (exactly 1 piece on board = opponent's first move).
    // Step diagonally toward the center from the opponent's position.
    // This always produces a valid in-bounds cell.
    if (totalPieces === 1 && oppFR !== -1) {
      const dr = oppFR <= cr ? 1 : -1;    // step down if opp is at/above center row
      const dc = oppFC <= cc ? 1 : -1;    // step right if opp is at/left of center col
      const defR = Math.max(0, Math.min(rows - 1, oppFR + dr));
      const defC = Math.max(0, Math.min(cols - 1, oppFC + dc));
      if (board[defR][defC] === 0) return [defR, defC];
      return [cr, cc];   // extreme-edge fallback (opponent literally on corner)
    }

    // Rule 3: AI plays first, 2nd stone (exactly 2 pieces: AI at center + 1 opponent).
    // Respond with an L-shaped Hua Yue offset to begin the Flower Moon formation.
    if (totalPieces === 2 && oppFR !== -1) {
      const dr = Math.sign(oppFR - cr) as -1 | 0 | 1;
      const dc = Math.sign(oppFC - cc) as -1 | 0 | 1;

      // Offset table (applied from center). Each entry lists a primary and a
      // fallback cell so a blocked primary doesn't waste the turn.
      const HUA_YUE: Record<string, [number, number][]> = {
        '-1,0':  [[-1,  1], [-1, -1]],   // opp UP       → UP-RIGHT  or UP-LEFT
        '1,0':   [[ 1,  1], [ 1, -1]],   // opp DOWN     → DOWN-RIGHT or DOWN-LEFT
        '0,-1':  [[ 1, -1], [-1, -1]],   // opp LEFT     → DOWN-LEFT  or UP-LEFT
        '0,1':   [[ 1,  1], [-1,  1]],   // opp RIGHT    → DOWN-RIGHT or UP-RIGHT
        '-1,1':  [[-2,  1], [ 0,  1]],   // opp UP-RIGHT → 2-UP-RIGHT or RIGHT
        '-1,-1': [[-2, -1], [ 0, -1]],   // opp UP-LEFT  → 2-UP-LEFT  or LEFT
        '1,1':   [[ 2,  1], [ 0,  1]],   // opp DN-RIGHT → 2-DN-RIGHT or RIGHT
        '1,-1':  [[ 2, -1], [ 0, -1]],   // opp DN-LEFT  → 2-DN-LEFT  or LEFT
      };

      const offsets = HUA_YUE[`${dr},${dc}`];
      if (offsets) {
        for (const [ro, co] of offsets) {
          const nr = cr + ro, nc = cc + co;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === 0) return [nr, nc];
        }
      }
      // Fallback: nearest empty adjacent cell to center (handles any edge case)
      for (let ro = -1; ro <= 1; ro++) for (let co = -1; co <= 1; co++) {
        if (ro === 0 && co === 0) continue;
        const nr = cr + ro, nc = cc + co;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === 0) return [nr, nc];
      }
    }
  }
  // 3+ pieces on board → Opening Book exhausted; fall through to search.

  const cands = getCandidates(board, rows, cols, 2);
  if (cands.length <= 1) return [cr, cc];

  // ── PHASE 1: Instant Win / Block pre-check (1-depth scan, no Minimax) ───────
  // Priority 1: Can AI win immediately?
  for (const [r, c] of cands) {
    board[r][c] = me;
    const win = checkWin(board, r, c, me, rows, wc);
    board[r][c] = 0;
    if (win) return [r, c];  // WIN NOW — absolute priority
  }
  // Priority 2: Must AI block opponent's immediate win?
  for (const [r, c] of cands) {
    board[r][c] = opp;
    const win = checkWin(board, r, c, opp, rows, wc);
    board[r][c] = 0;
    if (win) return [r, c];  // BLOCK NOW — second priority
  }

  // ── PHASE 3: Strategic Minimax search ────────────────────────────────────────
  const depth = searchDepth(bs);

  // Pre-score all candidates for ordering; top candidates enter deep search
  const prescored = cands
    .map(([r, c]) => ({
      rc: [r, c] as [number, number],
      s: quickScore(board, r, c, me, opp, rows, cols, wc) - (Math.abs(r - cr) + Math.abs(c - cc)) * 3,
    }))
    .sort((a, b) => b.s - a.s);

  // Early exit: if the top candidate already creates an unstoppable win-threat,
  // return immediately without running deep Minimax.
  if ((prescored[0]?.s ?? 0) >= V_WIN) return prescored[0].rc;

  // Deep Minimax on top 18 candidates
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
    if (bestVal >= V_WIN) break;  // found a winning line → stop searching
  }

  return bestMove;
}

// ══════════════════════════════════════════════════════════════════════════════
//  EASY / MEDIUM AI (lightweight — no deep search)
// ══════════════════════════════════════════════════════════════════════════════
function getAIMoveEasy(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const rows = board.length, cols = board[0]?.length ?? bs;
  const cands = getCandidates(board, rows, cols, 2);
  for (const [r, c] of cands) { board[r][c] = me;  const w = checkWin(board, r, c, me,  rows, wc); board[r][c] = 0; if (w) return [r, c]; }
  for (const [r, c] of cands) { board[r][c] = opp; const w = checkWin(board, r, c, opp, rows, wc); board[r][c] = 0; if (w) return [r, c]; }
  return cands.sort(() => Math.random() - 0.5)[0] ?? [rows >> 1, cols >> 1];
}

function getAIMoveMedium(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const rows = board.length, cols = board[0]?.length ?? bs;
  const cands = getCandidates(board, rows, cols, 2);
  for (const [r, c] of cands) { board[r][c] = me;  const w = checkWin(board, r, c, me,  rows, wc); board[r][c] = 0; if (w) return [r, c]; }
  for (const [r, c] of cands) { board[r][c] = opp; const w = checkWin(board, r, c, opp, rows, wc); board[r][c] = 0; if (w) return [r, c]; }
  const cr = rows >> 1, cc = cols >> 1;
  let best = cands[0], bestS = -Infinity;
  for (const [r, c] of cands.slice(0, 30)) {
    const s = quickScore(board, r, c, me, opp, rows, cols, wc)
            - (Math.abs(r - cr) + Math.abs(c - cc))
            + Math.random() * V_FORK33;
    if (s > bestS) { bestS = s; best = [r, c]; }
  }
  return best;
}

export function getAIMoveByDifficulty(
  board: CellValue[][], piece: 1 | 2, bs: number, wc: number, diff: AIDifficulty
): [number, number] {
  switch (diff) {
    case "easy":   return getAIMoveEasy(board, piece, bs, wc);
    case "medium": return getAIMoveMedium(board, piece, bs, wc);
    default:       return getAIMove(board, piece, bs, wc);
  }
}

export function removePiece(
  roomId: string, row: number, col: number, requestingPiece: 1 | 2
): { success: boolean; room?: GameRoom; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "Phòng không tồn tại" };
  if (room.status !== "playing") return { success: false, error: "Trò chơi chưa bắt đầu" };
  const bs = room.boardSize;
  if (row < 0 || row >= bs || col < 0 || col >= bs)
    return { success: false, error: "Vị trí không hợp lệ" };
  const cell = room.board[row][col];
  if (cell === 0) return { success: false, error: "Ô này đang trống" };
  if (cell === requestingPiece) return { success: false, error: "Không thể xóa quân của mình" };
  room.board[row][col] = 0;
  room.moveCount = Math.max(0, room.moveCount - 1);
  return { success: true, room };
}

export function cleanupOldRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) if (now - room.createdAt > 7_200_000) rooms.delete(id);
}
