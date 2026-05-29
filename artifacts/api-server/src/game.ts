export const DEFAULT_BOARD_SIZE = 20;

export type CellValue = 0 | 1 | 2;

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
function getWinCount(boardSize: number) {
  if (boardSize <= 3) return 3;
  if (boardSize <= 4) return 4;
  return 5;
}
function clampTime(t: number) { return Math.min(Math.max(t, 10), 300); }

export function createRoom(turnTime = 30, boardSize = DEFAULT_BOARD_SIZE): GameRoom {
  let id = randomCode();
  while (rooms.has(id)) id = randomCode();
  const bs = clampBoardSize(boardSize);
  const room: GameRoom = {
    id, players: [], board: makeBoard(bs),
    currentTurn: 1, status: "waiting", winner: 0, winLine: null,
    moveCount: 0, lastLoser: 0, scores: { 1: 0, 2: 0 },
    createdAt: Date.now(), turnTime: clampTime(turnTime),
    boardSize: bs, winCount: getWinCount(bs),
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

export function resetGame(roomId: string, firstPiece?: 1 | 2): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.players.length < 2) return null;
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
//  ADVANCED AI — minimax + fork/trap detection + boundary awareness
// ══════════════════════════════════════════════════════════════════

const SCORE = {
  WIN:    1_000_000,
  LIVE4:     50_000,
  DEAD4:      8_000,
  LIVE3:      5_000,
  DEAD3:        800,
  LIVE2:        200,
  DEAD2:         30,
  LIVE1:          5,
};

const DIRS = [[0,1],[1,0],[1,1],[1,-1]] as const;

// How many potential winning windows pass through (r,c) for piece — boundary awareness
function winPathCount(board: CellValue[][], r: number, c: number,
                      piece: CellValue, boardSize: number, winCount: number): number {
  let count = 0;
  for (const [dr, dc] of DIRS) {
    for (let offset = 0; offset < winCount; offset++) {
      let ok = true;
      for (let i = 0; i < winCount; i++) {
        const nr = r + dr*(i-offset), nc = c + dc*(i-offset);
        if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) { ok = false; break; }
        if (board[nr][nc] !== 0 && board[nr][nc] !== piece) { ok = false; break; }
      }
      if (ok) count++;
    }
  }
  return count;
}

// Boundary / centrality bonus — being near edge limits future paths
function centerScore(r: number, c: number, boardSize: number): number {
  const dist = Math.min(r, boardSize-1-r, c, boardSize-1-c);
  return Math.min(dist, Math.floor(boardSize/4)) * 3;
}

// Evaluate a line through (row,col) in direction (dr,dc) for piece
function evalLineAt(board: CellValue[][], row: number, col: number,
                    dr: number, dc: number, piece: CellValue,
                    boardSize: number, winCount: number): number {
  let count = 1, openA = 0, openB = 0;
  for (let i = 1; i < winCount; i++) {
    const r = row+dr*i, c = col+dc*i;
    if (r<0||r>=boardSize||c<0||c>=boardSize) break;
    if (board[r][c]===piece) count++;
    else if (board[r][c]===0) { openA=1; break; } else break;
  }
  for (let i = 1; i < winCount; i++) {
    const r = row-dr*i, c = col-dc*i;
    if (r<0||r>=boardSize||c<0||c>=boardSize) break;
    if (board[r][c]===piece) count++;
    else if (board[r][c]===0) { openB=1; break; } else break;
  }
  const opens = openA + openB;
  if (count >= winCount)         return SCORE.WIN;
  if (count === winCount-1)      return opens>=1 ? SCORE.LIVE4 : SCORE.DEAD4;
  if (count === winCount-2)      return opens===2 ? SCORE.LIVE3 : opens===1 ? SCORE.DEAD3 : 0;
  if (count === 2)               return opens===2 ? SCORE.LIVE2 : opens===1 ? SCORE.DEAD2 : 0;
  return opens===2 ? SCORE.LIVE1 : 0;
}

// Full positional score for a placed piece at (row,col)
function evalPosition(board: CellValue[][], row: number, col: number,
                      piece: CellValue, boardSize: number, winCount: number): number {
  let score = 0;
  for (const [dr, dc] of DIRS)
    score += evalLineAt(board, row, col, dr, dc, piece, boardSize, winCount);
  return score;
}

// Count "live threats" (live4 or better) the piece has after placing at (r,c)
function countLiveThreats(board: CellValue[][], r: number, c: number,
                           piece: CellValue, boardSize: number, winCount: number): number {
  board[r][c] = piece;
  let threats = 0;
  for (const [dr, dc] of DIRS) {
    const s = evalLineAt(board, r, c, dr, dc, piece, boardSize, winCount);
    if (s >= SCORE.LIVE4) threats += 2;  // live four = two directions open = nearly guaranteed win
    else if (s >= SCORE.DEAD4) threats += 1;
    else if (s >= SCORE.LIVE3) threats += 0.5;
  }
  board[r][c] = 0;
  return threats;
}

// Comprehensive board evaluation from myPiece's perspective
function evaluateBoard(board: CellValue[][], myPiece: CellValue, opp: CellValue,
                       boardSize: number, winCount: number): number {
  let score = 0;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === 0) continue;
      const isMe = board[r][c] === myPiece;
      for (const [dr, dc] of DIRS) {
        const s = evalLineAt(board, r, c, dr, dc, board[r][c], boardSize, winCount);
        score += isMe ? s : -s * 1.2;
      }
      if (isMe) score += centerScore(r, c, boardSize);
      else score -= centerScore(r, c, boardSize) * 0.8;
    }
  }
  return score;
}

// Minimax with alpha-beta (depth limited)
function minimax(
  board: CellValue[][], depth: number, alpha: number, beta: number,
  isMax: boolean, myPiece: CellValue, opp: CellValue,
  boardSize: number, winCount: number, lastMove: [number,number] | null
): number {
  // Terminal check at last move
  if (lastMove) {
    const [lr, lc] = lastMove;
    const lastPiece = board[lr][lc];
    if (lastPiece !== 0 && checkWin(board, lr, lc, lastPiece, boardSize, winCount)) {
      return lastPiece === myPiece ? SCORE.WIN * 10 + depth : -SCORE.WIN * 10 - depth;
    }
  }
  if (depth === 0) return evaluateBoard(board, myPiece, opp, boardSize, winCount);

  const candidates = getCandidates(board, boardSize).slice(0, 12); // prune to top 12
  if (candidates.length === 0) return 0;

  if (isMax) {
    let best = -Infinity;
    for (const [r, c] of candidates) {
      board[r][c] = myPiece;
      const val = minimax(board, depth-1, alpha, beta, false, myPiece, opp, boardSize, winCount, [r,c]);
      board[r][c] = 0;
      best = Math.max(best, val);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r, c] of candidates) {
      board[r][c] = opp;
      const val = minimax(board, depth-1, alpha, beta, true, myPiece, opp, boardSize, winCount, [r,c]);
      board[r][c] = 0;
      best = Math.min(best, val);
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function getAIMove(board: CellValue[][], myPiece: 1 | 2,
                          boardSize: number, winCount: number): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  const candidates = getCandidates(board, boardSize);
  if (candidates.length === 0) return [Math.floor(boardSize/2), Math.floor(boardSize/2)];

  // ── STEP 1: Immediate win ──────────────────────────────────────────────────
  for (const [r, c] of candidates) {
    board[r][c] = myPiece;
    if (checkWin(board, r, c, myPiece, boardSize, winCount)) { board[r][c] = 0; return [r, c]; }
    board[r][c] = 0;
  }

  // ── STEP 2: Block opponent immediate win ───────────────────────────────────
  for (const [r, c] of candidates) {
    board[r][c] = opp;
    if (checkWin(board, r, c, opp, boardSize, winCount)) { board[r][c] = 0; return [r, c]; }
    board[r][c] = 0;
  }

  // ── STEP 3: Fork creation (double threat trap) ─────────────────────────────
  // Find cells where AI can create 2+ simultaneous threats (fork = unblockable)
  let bestFork: [number, number] | null = null;
  let bestForkVal = 1.5; // threshold for a real fork
  for (const [r, c] of candidates) {
    const myThreats = countLiveThreats(board, r, c, myPiece, boardSize, winCount);
    if (myThreats > bestForkVal) { bestForkVal = myThreats; bestFork = [r, c]; }
  }
  if (bestFork) return bestFork;

  // ── STEP 4: Block opponent fork ────────────────────────────────────────────
  let bestOppFork: [number, number] | null = null;
  let bestOppForkVal = 1.5;
  for (const [r, c] of candidates) {
    const oppThreats = countLiveThreats(board, r, c, opp, boardSize, winCount);
    if (oppThreats > bestOppForkVal) { bestOppForkVal = oppThreats; bestOppFork = [r, c]; }
  }
  if (bestOppFork) return bestOppFork;

  // ── STEP 5: Minimax search (depth 2) with comprehensive scoring ────────────
  const topCandidates = scoredCandidates(board, candidates, myPiece, opp, boardSize, winCount)
    .slice(0, 16); // top 16 for minimax

  let best: [number, number] = topCandidates[0]?.[0] ?? candidates[0];
  let bestScore = -Infinity;

  for (const [[r, c]] of topCandidates) {
    board[r][c] = myPiece;
    const mmScore = minimax(board, 2, -Infinity, Infinity, false, myPiece, opp, boardSize, winCount, [r,c]);
    board[r][c] = 0;

    // Additional local scoring
    const atk     = evalPosition(board, r, c, myPiece, boardSize, winCount);
    board[r][c] = opp;
    const def     = evalPosition(board, r, c, opp, boardSize, winCount);
    board[r][c] = 0;
    const paths   = winPathCount(board, r, c, myPiece, boardSize, winCount);
    const center  = centerScore(r, c, boardSize);

    const total = mmScore * 1.5 + atk * 1.2 + def * 1.0 + paths * 12 + center;
    if (total > bestScore) { bestScore = total; best = [r, c]; }
  }

  return best;
}

// Pre-score candidates to pick top ones for minimax
function scoredCandidates(
  board: CellValue[][], candidates: [number,number][],
  myPiece: CellValue, opp: CellValue, boardSize: number, winCount: number
): [[number,number], number][] {
  return candidates.map(([r,c]): [[number,number], number] => {
    board[r][c] = myPiece;
    const atk  = evalPosition(board, r, c, myPiece, boardSize, winCount);
    board[r][c] = 0;
    board[r][c] = opp;
    const def  = evalPosition(board, r, c, opp, boardSize, winCount);
    board[r][c] = 0;
    const paths = winPathCount(board, r, c, myPiece, boardSize, winCount);
    const center = centerScore(r, c, boardSize);
    return [[r,c], atk * 1.2 + def + paths * 10 + center];
  }).sort((a, b) => b[1] - a[1]);
}

function getCandidates(board: CellValue[][], boardSize: number): [number, number][] {
  const candidates: [number, number][] = [];
  const visited = new Set<string>();
  let hasAny = false;
  const range = boardSize <= 5 ? 1 : 2; // smaller boards: 1-cell radius
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === 0) continue;
      hasAny = true;
      for (let dr = -range; dr <= range; dr++) {
        for (let dc = -range; dc <= range; dc++) {
          const nr = r+dr, nc = c+dc, key = `${nr},${nc}`;
          if (nr>=0&&nr<boardSize&&nc>=0&&nc<boardSize&&board[nr][nc]===0&&!visited.has(key)) {
            visited.add(key); candidates.push([nr,nc]);
          }
        }
      }
    }
  }
  return hasAny ? candidates : [[Math.floor(boardSize/2), Math.floor(boardSize/2)]];
}

export function cleanupOldRooms() {
  const now = Date.now();
  for (const [id, room] of rooms.entries())
    if (now - room.createdAt > 2*60*60*1000) rooms.delete(id);
}
