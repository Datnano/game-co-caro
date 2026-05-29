export const DEFAULT_BOARD_SIZE = 20;

export type CellValue = 0 | 1 | 2;
export type AIDifficulty = "easy" | "medium" | "hard";

export interface GameRoom {
  id: string;
  players: Player[];
  board: CellValue[][];
  currentTurn: 1 | 2;
  status: "waiting" | "playing" | "finished";
  winner: 0 | 1 | 2;
  winLine: [number, number][] | null;
  moveCount: number;
  lastLoser: 0 | 1 | 2;
  scores: { 1: number; 2: number };
  createdAt: number;
  turnTime: number;
  boardSize: number;
  winCount: number;
  aiPiece: 0 | 1 | 2;
  aiDifficulty: AIDifficulty;
}

export interface Player {
  id: string; name: string; piece: 1 | 2; sessionId: string;
}

const rooms = new Map<string, GameRoom>();

function makeBoard(size: number): CellValue[][] {
  return Array.from({ length: size }, () => Array(size).fill(0) as CellValue[]);
}
function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function clampBoardSize(n: number) { return Math.min(Math.max(n, 3), 30); }
function getWinCount(bs: number) { return bs <= 3 ? 3 : bs <= 4 ? 4 : 5; }
function clampTime(t: number)    { return Math.min(Math.max(t, 10), 300); }

export function createRoom(
  turnTime = 30, boardSize = DEFAULT_BOARD_SIZE,
  aiDifficulty?: AIDifficulty
): GameRoom {
  let id = randomCode();
  while (rooms.has(id)) id = randomCode();
  const bs = clampBoardSize(boardSize);
  const room: GameRoom = {
    id, players: [], board: makeBoard(bs),
    currentTurn: 1, status: "waiting", winner: 0, winLine: null,
    moveCount: 0, lastLoser: 0, scores: { 1: 0, 2: 0 },
    createdAt: Date.now(), turnTime: clampTime(turnTime),
    boardSize: bs, winCount: getWinCount(bs),
    aiPiece: aiDifficulty ? 2 : 0,
    aiDifficulty: aiDifficulty ?? "medium",
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string) { return rooms.get(id); }

export function joinRoom(
  roomId: string, playerId: string, playerName: string, sessionId: string
): { room: GameRoom; piece: 1 | 2 } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Phòng không tồn tại" };
  const existing = room.players.find(p => p.sessionId === sessionId || p.id === playerId);
  if (existing) { existing.id = playerId; return { room, piece: existing.piece }; }
  if (room.players.length >= 2) return { error: "Phòng đã đầy" };
  const piece: 1 | 2 = room.players.length === 0 ? 1 : 2;
  room.players.push({ id: playerId, name: playerName, piece, sessionId });
  if (room.players.length === 2) room.status = "playing";
  return { room, piece };
}

export function makeMove(
  roomId: string, playerId: string, row: number, col: number
): { success: boolean; room?: GameRoom; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "Phòng không tồn tại" };
  if (room.status !== "playing") return { success: false, error: "Trò chơi chưa bắt đầu" };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { success: false, error: "Không tìm thấy người chơi" };
  if (player.piece !== room.currentTurn) return { success: false, error: "Không phải lượt của bạn" };
  const bs = room.boardSize;
  if (row < 0 || row >= bs || col < 0 || col >= bs) return { success: false, error: "Vị trí không hợp lệ" };
  if (room.board[row][col] !== 0) return { success: false, error: "Ô đã có quân" };

  room.board[row][col] = player.piece;
  room.moveCount++;

  const winLine = checkWin(room.board, row, col, player.piece, bs, room.winCount);
  if (winLine) {
    room.winner = player.piece; room.winLine = winLine; room.status = "finished";
    room.scores[player.piece]++;
    room.lastLoser = player.piece === 1 ? 2 : 1;
  } else if (room.moveCount >= bs * bs) {
    room.status = "finished"; room.winner = 0;
  } else {
    room.currentTurn = room.currentTurn === 1 ? 2 : 1;
  }
  return { success: true, room };
}

export function resetGame(roomId: string, requestPiece?: 1 | 2, firstPiece?: 1 | 2): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.players.length < 2) return null;
  if (room.aiPiece === 0 && room.lastLoser !== 0 && requestPiece !== undefined) {
    if (requestPiece !== room.lastLoser) return null;
  }
  room.board = makeBoard(room.boardSize); room.winner = 0; room.winLine = null;
  room.moveCount = 0; room.status = "playing";
  if (firstPiece) room.currentTurn = firstPiece;
  else if (room.lastLoser !== 0) room.currentTurn = room.lastLoser as 1 | 2;
  else room.currentTurn = 1;
  return room;
}

export function skipTurn(roomId: string, piece: 1 | 2): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.status !== "playing") return null;
  if (room.currentTurn !== piece) return null;
  room.currentTurn = room.currentTurn === 1 ? 2 : 1;
  return room;
}

export function setTurnTime(roomId: string, seconds: number): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.turnTime = clampTime(seconds);
  return room;
}

export function checkWin(
  board: CellValue[][], row: number, col: number,
  piece: CellValue, boardSize: number, winCount: number
): [number, number][] | null {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[row, col]];
    for (let i = 1; i < winCount; i++) {
      const r = row+dr*i, c = col+dc*i;
      if (r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==piece) break;
      line.push([r, c]);
    }
    for (let i = 1; i < winCount; i++) {
      const r = row-dr*i, c = col-dc*i;
      if (r<0||r>=boardSize||c<0||c>=boardSize||board[r][c]!==piece) break;
      line.push([r, c]);
    }
    if (line.length >= winCount) return line.slice(0, winCount);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
//  SCORE TABLE  — LIVE = cả 2 đầu trống  /  DEAD = 1 đầu bị chặn
// ══════════════════════════════════════════════════════════════════
const SCORE = {
  WIN:    10_000_000,
  LIVE4:     500_000,   // 4 quân, cả 2 đầu trống → thắng 100%
  DEAD4:      50_000,   // 4 quân, 1 đầu bị chặn  → buộc đối thủ chặn
  LIVE3:      10_000,   // 3 quân, cả 2 đầu trống → nguy hiểm
  DEAD3:         500,   // 3 quân, 1 đầu bị chặn  → yếu, bỏ qua ưu tiên
  LIVE2:         200,
  DEAD2:          20,
};

const DIRS = [[0,1],[1,0],[1,1],[1,-1]] as const;

// ── Core: evaluate one direction from (r,c), phân biệt sống/chết ────────────
function evalDir(
  board: CellValue[][], r: number, c: number,
  dr: number, dc: number, piece: CellValue,
  bs: number, wc: number
): number {
  let cnt = 1, openA = 0, openB = 0;
  // Forward scan
  for (let i = 1; i <= wc; i++) {
    const nr = r + dr * i, nc = c + dc * i;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) break;
    if (board[nr][nc] === piece) cnt++;
    else if (board[nr][nc] === 0) { openA = 1; break; }
    else break;
  }
  // Backward scan
  for (let i = 1; i <= wc; i++) {
    const nr = r - dr * i, nc = c - dc * i;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) break;
    if (board[nr][nc] === piece) cnt++;
    else if (board[nr][nc] === 0) { openB = 1; break; }
    else break;
  }
  const opens = openA + openB;
  if (cnt >= wc)      return SCORE.WIN;
  if (cnt === wc - 1) return opens === 2 ? SCORE.LIVE4 : opens === 1 ? SCORE.DEAD4 : 0;
  if (cnt === wc - 2) return opens === 2 ? SCORE.LIVE3 : opens === 1 ? SCORE.DEAD3 : 0;
  if (cnt === 2)      return opens === 2 ? SCORE.LIVE2 : opens === 1 ? SCORE.DEAD2 : 0;
  return 0;
}

// Sum across all 4 directions
function evalCell(
  board: CellValue[][], r: number, c: number,
  piece: CellValue, bs: number, wc: number
): number {
  let s = 0;
  for (const [dr, dc] of DIRS) s += evalDir(board, r, c, dr, dc, piece, bs, wc);
  return s;
}

// ── Threat profile: count live4/dead4/live3 if piece placed at (r,c) ────────
interface ThreatProfile { win: boolean; live4: number; dead4: number; live3: number; dead3: number; }

function profileAt(
  board: CellValue[][], r: number, c: number,
  piece: CellValue, bs: number, wc: number
): ThreatProfile {
  board[r][c] = piece;
  let win = false, live4 = 0, dead4 = 0, live3 = 0, dead3 = 0;
  for (const [dr, dc] of DIRS) {
    const s = evalDir(board, r, c, dr, dc, piece, bs, wc);
    if (s >= SCORE.WIN)   { win = true; break; }
    if (s >= SCORE.LIVE4) live4++;
    else if (s >= SCORE.DEAD4) dead4++;
    else if (s >= SCORE.LIVE3) live3++;
    else if (s >= SCORE.DEAD3) dead3++;
  }
  board[r][c] = 0;
  return { win, live4, dead4, live3, dead3 };
}

// ── Candidate cells: all empty cells within radius 3 of any piece ────────────
function getCandidates(board: CellValue[][], bs: number, radius = 3): [number, number][] {
  const cands: [number, number][] = [];
  const visited = new Set<string>();
  let hasAny = false;
  for (let r = 0; r < bs; r++) for (let c = 0; c < bs; c++) {
    if (!board[r][c]) continue; hasAny = true;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr, nc = c + dc, key = `${nr},${nc}`;
      if (nr >= 0 && nr < bs && nc >= 0 && nc < bs && !board[nr][nc] && !visited.has(key)) {
        visited.add(key); cands.push([nr, nc]);
      }
    }
  }
  return hasAny ? cands : [[Math.floor(bs / 2), Math.floor(bs / 2)]];
}

// ── Board evaluation for minimax ─────────────────────────────────────────────
function evaluateBoard(
  board: CellValue[][], myPiece: CellValue, opp: CellValue, bs: number, wc: number
): number {
  let score = 0;
  const center = Math.floor(bs / 2);
  for (let r = 0; r < bs; r++) for (let c = 0; c < bs; c++) {
    if (!board[r][c]) continue;
    const isMe = board[r][c] === myPiece;
    // Direction scores — dead patterns count only 50% for opponent (to reflect they're less dangerous)
    for (const [dr, dc] of DIRS) {
      const s = evalDir(board, r, c, dr, dc, board[r][c] as CellValue, bs, wc);
      score += isMe ? s : -s * 1.1;
    }
    // Center proximity bonus (max 6 from center each side → up to +18)
    const dist = Math.max(Math.abs(r - center), Math.abs(c - center));
    const centerBonus = Math.max(0, (bs / 2 - dist)) * 2;
    score += isMe ? centerBonus : -centerBonus * 0.6;
    // Edge penalty: moves on edge have fewer winning paths
    const edgeDist = Math.min(r, bs - 1 - r, c, bs - 1 - c);
    if (edgeDist === 0) score += isMe ? -50 : 20;
  }
  return score;
}

// ── Minimax with alpha-beta pruning ──────────────────────────────────────────
function minimax(
  board: CellValue[][], depth: number, alpha: number, beta: number,
  isMax: boolean, myPiece: CellValue, opp: CellValue,
  bs: number, wc: number
): number {
  if (depth === 0) return evaluateBoard(board, myPiece, opp, bs, wc);
  // Use radius=2 inside minimax for speed; top-level uses radius=3
  const cands = getCandidates(board, bs, 2).slice(0, 12);
  if (!cands.length) return 0;

  if (isMax) {
    let best = -Infinity;
    for (const [r, c] of cands) {
      board[r][c] = myPiece;
      // Early terminal check
      if (checkWin(board, r, c, myPiece, bs, wc)) {
        board[r][c] = 0;
        return SCORE.WIN * 10 + depth;
      }
      best = Math.max(best, minimax(board, depth - 1, alpha, beta, false, myPiece, opp, bs, wc));
      board[r][c] = 0;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r, c] of cands) {
      board[r][c] = opp;
      if (checkWin(board, r, c, opp, bs, wc)) {
        board[r][c] = 0;
        return -(SCORE.WIN * 10 + depth);
      }
      best = Math.min(best, minimax(board, depth - 1, alpha, beta, true, myPiece, opp, bs, wc));
      board[r][c] = 0;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ══════════════════════════════════════════════════════════════════
//  EASY AI
// ══════════════════════════════════════════════════════════════════
function getAIMoveEasy(board: CellValue[][], myPiece: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  const cands = getCandidates(board, bs, 2);
  // Still block immediate win
  for (const [r, c] of cands) if (profileAt(board, r, c, myPiece, bs, wc).win) return [r, c];
  for (const [r, c] of cands) if (profileAt(board, r, c, opp, bs, wc).win) return [r, c];
  // Random from shuffled candidates
  return cands.sort(() => Math.random() - 0.5)[0] ?? [Math.floor(bs / 2), Math.floor(bs / 2)];
}

// ══════════════════════════════════════════════════════════════════
//  MEDIUM AI
// ══════════════════════════════════════════════════════════════════
function getAIMoveMedium(board: CellValue[][], myPiece: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  const cands = getCandidates(board, bs, 2);
  // Win/block
  for (const [r, c] of cands) if (profileAt(board, r, c, myPiece, bs, wc).win) return [r, c];
  for (const [r, c] of cands) if (profileAt(board, r, c, opp, bs, wc).win)    return [r, c];
  // Score with noise
  const center = Math.floor(bs / 2);
  let best = cands[0], bestScore = -Infinity;
  for (const [r, c] of cands.slice(0, 24)) {
    board[r][c] = myPiece; const atk = evalCell(board, r, c, myPiece, bs, wc); board[r][c] = 0;
    board[r][c] = opp;     const def = evalCell(board, r, c, opp,     bs, wc); board[r][c] = 0;
    const dist  = Math.max(Math.abs(r - center), Math.abs(c - center));
    const score = atk * 1.1 + def * 0.9 + (bs / 2 - dist) * 4 + Math.random() * 300;
    if (score > bestScore) { bestScore = score; best = [r, c]; }
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════
//  HARD AI  —  Priority: Win > Block > Live4 > Double4 > Fork > DefFork > Block-Live3 > Minimax
// ══════════════════════════════════════════════════════════════════
export function getAIMove(board: CellValue[][], myPiece: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  const cands = getCandidates(board, bs, 3);
  const center = Math.floor(bs / 2);

  // First move → center
  if (cands.length === 0 || (cands.length === 1 && board[center]?.[center] === 0))
    return [center, center];

  // Collect profiles once for efficiency
  const myProfiles = cands.map(([r, c]) => ({ rc: [r, c] as [number,number], p: profileAt(board, r, c, myPiece, bs, wc) }));
  const opProfiles = cands.map(([r, c]) => ({ rc: [r, c] as [number,number], p: profileAt(board, r, c, opp,     bs, wc) }));

  // ① Win immediately
  for (const { rc, p } of myProfiles) if (p.win) return rc;

  // ② Block opponent win
  for (const { rc, p } of opProfiles) if (p.win) return rc;

  // ③ Create live-4 (guaranteed win)
  for (const { rc, p } of myProfiles) if (p.live4 > 0) return rc;

  // ④ Block opponent live-4
  for (const { rc, p } of opProfiles) if (p.live4 > 0) return rc;

  // ⑤ Double-4 for me (2+ dead-4 simultaneously) — also forces a win
  //    But avoid this if it's also "double-4 forbidden" (only 2 dead-4, no live component)
  //    In Gomoku, double-4 is legal and winning; we play it unless a better fork exists
  let double4Move: [number,number] | null = null;
  for (const { rc, p } of myProfiles) {
    if (p.dead4 >= 2 || (p.dead4 >= 1 && p.live3 >= 1)) { double4Move = rc; break; }
  }

  // ⑥ Double live-3 fork (opponent can't block both)
  let forkMove: [number,number] | null = null;
  for (const { rc, p } of myProfiles) {
    if (p.live3 >= 2) { forkMove = rc; break; }
  }

  // Prefer fork over double-4 (live3 fork is more flexible)
  if (forkMove) return forkMove;
  if (double4Move) return double4Move;

  // ⑦ Block opponent double-4 or double-live3 fork
  let oppForkMove: [number,number] | null = null;
  for (const { rc, p } of opProfiles) {
    if (p.dead4 >= 2 || p.live3 >= 2 || (p.dead4 >= 1 && p.live3 >= 1)) {
      oppForkMove = rc; break;
    }
  }
  if (oppForkMove) return oppForkMove;

  // ⑧ Create dead-4 (force block)
  for (const { rc, p } of myProfiles) if (p.dead4 > 0) return rc;

  // ⑨ Block opponent live-3
  for (const { rc, p } of opProfiles) if (p.live3 > 0) {
    // Only block live3 if it's actually dangerous (DEAD3 is ignorable)
    return rc;
  }

  // ⑩ Minimax on top scored candidates
  const scored = cands.map(([r, c]): [[number,number], number] => {
    board[r][c] = myPiece; const atk = evalCell(board, r, c, myPiece, bs, wc); board[r][c] = 0;
    board[r][c] = opp;     const def = evalCell(board, r, c, opp,     bs, wc); board[r][c] = 0;
    const dist = Math.max(Math.abs(r - center), Math.abs(c - center));
    const edgePenalty = Math.min(r, bs - 1 - r, c, bs - 1 - c) <= 1 ? -200 : 0;
    return [[r, c], atk * 1.2 + def + (bs / 2 - dist) * 3 + edgePenalty];
  }).sort((a, b) => b[1] - a[1]);

  const top = scored.slice(0, 18);
  let best: [number,number] = top[0]?.[0] ?? cands[0];
  let bestScore = -Infinity;
  for (const [[r, c]] of top) {
    board[r][c] = myPiece;
    const mm = minimax(board, 4, -Infinity, Infinity, false, myPiece, opp, bs, wc);
    board[r][c] = 0;
    board[r][c] = myPiece; const atk = evalCell(board, r, c, myPiece, bs, wc); board[r][c] = 0;
    board[r][c] = opp;     const def = evalCell(board, r, c, opp,     bs, wc); board[r][c] = 0;
    const dist = Math.max(Math.abs(r - center), Math.abs(c - center));
    const edgePenalty = Math.min(r, bs - 1 - r, c, bs - 1 - c) <= 1 ? -300 : 0;
    const total = mm * 1.5 + atk * 1.2 + def + (bs / 2 - dist) * 3 + edgePenalty;
    if (total > bestScore) { bestScore = total; best = [r, c]; }
  }
  return best;
}

// ── Route by difficulty ───────────────────────────────────────────────────────
export function getAIMoveByDifficulty(
  board: CellValue[][], piece: 1 | 2, bs: number, wc: number, difficulty: AIDifficulty
): [number, number] {
  switch (difficulty) {
    case "easy":   return getAIMoveEasy(board, piece, bs, wc);
    case "medium": return getAIMoveMedium(board, piece, bs, wc);
    default:       return getAIMove(board, piece, bs, wc);
  }
}

export function cleanupOldRooms() {
  const now = Date.now();
  for (const [id, room] of rooms.entries())
    if (now - room.createdAt > 2 * 60 * 60 * 1000) rooms.delete(id);
}
