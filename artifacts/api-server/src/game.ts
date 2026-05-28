export const BOARD_SIZE = 20;
export const WIN_COUNT = 5;

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
}

export interface Player {
  id: string; name: string; piece: 1 | 2; sessionId: string;
}

const rooms = new Map<string, GameRoom>();

function makeBoard(): CellValue[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0) as CellValue[]);
}

function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function createRoom(turnTime = 30): GameRoom {
  let id = randomCode();
  while (rooms.has(id)) id = randomCode();
  const room: GameRoom = {
    id, players: [], board: makeBoard(),
    currentTurn: 1, status: "waiting", winner: 0, winLine: null,
    moveCount: 0, lastLoser: 0, scores: { 1: 0, 2: 0 },
    createdAt: Date.now(), turnTime: clampTime(turnTime),
  };
  rooms.set(id, room);
  return room;
}

function clampTime(t: number) { return Math.min(Math.max(t, 10), 300); }

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
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return { success: false, error: "Vị trí không hợp lệ" };
  if (room.board[row][col] !== 0) return { success: false, error: "Ô đã có quân" };

  room.board[row][col] = player.piece;
  room.moveCount++;

  const winLine = checkWin(room.board, row, col, player.piece);
  if (winLine) {
    room.winner = player.piece; room.winLine = winLine; room.status = "finished";
    room.scores[player.piece]++;
    room.lastLoser = player.piece === 1 ? 2 : 1;
  } else if (room.moveCount >= BOARD_SIZE * BOARD_SIZE) {
    room.status = "finished"; room.winner = 0;
  } else {
    room.currentTurn = room.currentTurn === 1 ? 2 : 1;
  }
  return { success: true, room };
}

export function resetGame(roomId: string, firstPiece?: 1 | 2): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.players.length < 2) return null;
  room.board = makeBoard(); room.winner = 0; room.winLine = null;
  room.moveCount = 0; room.status = "playing";
  // firstPiece explicitly chosen by the loser; fallback to lastLoser logic
  if (firstPiece) {
    room.currentTurn = firstPiece;
  } else if (room.lastLoser !== 0) {
    room.currentTurn = room.lastLoser as 1 | 2;
  } else {
    room.currentTurn = 1;
  }
  return room;
}

export function setTurnTime(roomId: string, seconds: number): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.turnTime = clampTime(seconds);
  return room;
}

export function checkWin(board: CellValue[][], row: number, col: number, piece: CellValue): [number, number][] | null {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[row, col]];
    for (let i = 1; i < WIN_COUNT; i++) {
      const r = row+dr*i, c = col+dc*i;
      if (r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE||board[r][c]!==piece) break;
      line.push([r, c]);
    }
    for (let i = 1; i < WIN_COUNT; i++) {
      const r = row-dr*i, c = col-dc*i;
      if (r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE||board[r][c]!==piece) break;
      line.push([r, c]);
    }
    if (line.length >= WIN_COUNT) return line.slice(0, WIN_COUNT);
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
//  STRONG AI — threat-based evaluation with depth-1 lookahead
// ══════════════════════════════════════════════════════════════════

const SCORE = {
  WIN5:  100_000,
  LIVE4:  10_000,
  DEAD4:   2_000,
  LIVE3:   1_000,
  DEAD3:     150,
  LIVE2:      50,
  DEAD2:      10,
  LIVE1:       3,
};

export function getAIMove(board: CellValue[][], myPiece: 1 | 2): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  const candidates = getCandidates(board);
  if (candidates.length === 0) return [9, 9];

  // 1. Immediate win
  for (const [r, c] of candidates) {
    board[r][c] = myPiece;
    if (checkWin(board, r, c, myPiece)) { board[r][c] = 0; return [r, c]; }
    board[r][c] = 0;
  }

  // 2. Block opponent's immediate win
  for (const [r, c] of candidates) {
    board[r][c] = opp;
    if (checkWin(board, r, c, opp)) { board[r][c] = 0; return [r, c]; }
    board[r][c] = 0;
  }

  // 3. Create live-four or block opponent live-four
  let best: [number, number] = candidates[0];
  let bestScore = -Infinity;

  for (const [r, c] of candidates) {
    board[r][c] = myPiece;
    const atk = evalPosition(board, r, c, myPiece);
    board[r][c] = 0;

    board[r][c] = opp;
    const def = evalPosition(board, r, c, opp);
    board[r][c] = 0;

    // Global board score after placing here
    board[r][c] = myPiece;
    const globalScore = scoreBoard(board, myPiece, opp);
    board[r][c] = 0;

    const score = globalScore + atk * 1.1 + def * 0.95;
    if (score > bestScore) { bestScore = score; best = [r, c]; }
  }

  return best;
}

function evalPosition(board: CellValue[][], row: number, col: number, piece: CellValue): number {
  let score = 0;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    score += evalLineAt(board, row, col, dr, dc, piece);
  }
  return score;
}

function evalLineAt(board: CellValue[][], row: number, col: number,
                    dr: number, dc: number, piece: CellValue): number {
  let count = 1;
  let openA = 0, openB = 0;

  // forward
  for (let i = 1; i < WIN_COUNT; i++) {
    const r = row + dr * i, c = col + dc * i;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
    if (board[r][c] === piece) count++;
    else if (board[r][c] === 0) { openA = 1; break; }
    else break;
  }
  // backward
  for (let i = 1; i < WIN_COUNT; i++) {
    const r = row - dr * i, c = col - dc * i;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
    if (board[r][c] === piece) count++;
    else if (board[r][c] === 0) { openB = 1; break; }
    else break;
  }

  const opens = openA + openB;
  if (count >= 5) return SCORE.WIN5;
  if (count === 4) return opens >= 1 ? SCORE.LIVE4 : SCORE.DEAD4;
  if (count === 3) return opens === 2 ? SCORE.LIVE3 : opens === 1 ? SCORE.DEAD3 : 0;
  if (count === 2) return opens === 2 ? SCORE.LIVE2 : opens === 1 ? SCORE.DEAD2 : 0;
  if (count === 1) return opens === 2 ? SCORE.LIVE1 : 0;
  return 0;
}

function scoreBoard(board: CellValue[][], me: CellValue, opp: CellValue): number {
  let score = 0;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) continue;
      const isMe = board[r][c] === me;
      for (const [dr, dc] of dirs) {
        const s = evalLineAt(board, r, c, dr, dc, board[r][c]);
        score += isMe ? s : -s * 1.15;
      }
    }
  }
  // center bonus
  const cr = BOARD_SIZE / 2, cc = BOARD_SIZE / 2;
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === me)
        score += Math.max(0, 3 - (Math.abs(r - cr) + Math.abs(c - cc)) * 0.15);
  return score;
}

function getCandidates(board: CellValue[][]): [number, number][] {
  const candidates: [number, number][] = [];
  const visited = new Set<string>();
  let hasAny = false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) continue;
      hasAny = true;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          const key = `${nr},${nc}`;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE &&
              board[nr][nc] === 0 && !visited.has(key)) {
            visited.add(key); candidates.push([nr, nc]);
          }
        }
      }
    }
  }
  return hasAny ? candidates : [[Math.floor(BOARD_SIZE/2), Math.floor(BOARD_SIZE/2)]];
}

export function cleanupOldRooms() {
  const now = Date.now();
  for (const [id, room] of rooms.entries())
    if (now - room.createdAt > 2 * 60 * 60 * 1000) rooms.delete(id);
}
