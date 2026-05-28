export const BOARD_SIZE = 20;
export const WIN_COUNT = 5;

export type CellValue = 0 | 1 | 2; // 0=empty, 1=X, 2=O

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
}

export interface Player {
  id: string;
  name: string;
  piece: 1 | 2;
  sessionId: string;
}

const rooms = new Map<string, GameRoom>();

function makeBoard(): CellValue[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(0) as CellValue[]
  );
}

function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export function createRoom(): GameRoom {
  let id = randomCode();
  while (rooms.has(id)) id = randomCode();

  const room: GameRoom = {
    id,
    players: [],
    board: makeBoard(),
    currentTurn: 1,
    status: "waiting",
    winner: 0,
    winLine: null,
    moveCount: 0,
    lastLoser: 0,
    scores: { 1: 0, 2: 0 },
    createdAt: Date.now(),
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): GameRoom | undefined {
  return rooms.get(id);
}

export function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string,
  sessionId: string
): { room: GameRoom; piece: 1 | 2 } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Phòng không tồn tại" };

  const existing = room.players.find(
    (p) => p.sessionId === sessionId || p.id === playerId
  );
  if (existing) {
    existing.id = playerId;
    return { room, piece: existing.piece };
  }

  if (room.players.length >= 2) return { error: "Phòng đã đầy" };

  const piece: 1 | 2 = room.players.length === 0 ? 1 : 2;
  room.players.push({ id: playerId, name: playerName, piece, sessionId });

  if (room.players.length === 2) {
    room.status = "playing";
  }

  return { room, piece };
}

export function makeMove(
  roomId: string,
  playerId: string,
  row: number,
  col: number
): { success: boolean; room?: GameRoom; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: "Phòng không tồn tại" };
  if (room.status !== "playing")
    return { success: false, error: "Trò chơi chưa bắt đầu hoặc đã kết thúc" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { success: false, error: "Không tìm thấy người chơi" };
  if (player.piece !== room.currentTurn)
    return { success: false, error: "Không phải lượt của bạn" };
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE)
    return { success: false, error: "Vị trí không hợp lệ" };
  if (room.board[row][col] !== 0)
    return { success: false, error: "Ô đã có quân" };

  room.board[row][col] = player.piece;
  room.moveCount++;

  const winLine = checkWin(room.board, row, col, player.piece);
  if (winLine) {
    room.winner = player.piece;
    room.winLine = winLine;
    room.status = "finished";
    room.scores[player.piece]++;
    const loserPiece: 1 | 2 = player.piece === 1 ? 2 : 1;
    room.lastLoser = loserPiece;
  } else if (room.moveCount >= BOARD_SIZE * BOARD_SIZE) {
    room.status = "finished";
    room.winner = 0;
  } else {
    room.currentTurn = room.currentTurn === 1 ? 2 : 1;
  }

  return { success: true, room };
}

export function resetGame(roomId: string): GameRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.players.length < 2) return null;

  room.board = makeBoard();
  room.winner = 0;
  room.winLine = null;
  room.moveCount = 0;
  room.status = "playing";

  if (room.lastLoser !== 0) {
    room.currentTurn = room.lastLoser as 1 | 2;
  } else {
    room.currentTurn = 1;
  }

  return room;
}

export function checkWin(
  board: CellValue[][],
  row: number,
  col: number,
  piece: CellValue
): [number, number][] | null {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    const line: [number, number][] = [[row, col]];

    for (let i = 1; i < WIN_COUNT; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== piece) break;
      line.push([r, c]);
    }
    for (let i = 1; i < WIN_COUNT; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== piece) break;
      line.push([r, c]);
    }

    if (line.length >= WIN_COUNT) return line.slice(0, WIN_COUNT);
  }
  return null;
}

export function getAIMove(
  board: CellValue[][],
  myPiece: 1 | 2
): [number, number] {
  const opponent: CellValue = myPiece === 1 ? 2 : 1;
  let bestScore = -Infinity;
  let bestMove: [number, number] = [9, 9];

  const candidates = getCandidates(board);
  if (candidates.length === 0) return [9, 9];

  for (const [r, c] of candidates) {
    board[r][c] = myPiece;
    const score = scoreBoard(board, myPiece, opponent);
    board[r][c] = 0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }

  return bestMove;
}

function getCandidates(board: CellValue[][]): [number, number][] {
  const candidates: [number, number][] = [];
  const visited = new Set<string>();
  let hasAny = false;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) {
        hasAny = true;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            const key = `${nr},${nc}`;
            if (
              nr >= 0 &&
              nr < BOARD_SIZE &&
              nc >= 0 &&
              nc < BOARD_SIZE &&
              board[nr][nc] === 0 &&
              !visited.has(key)
            ) {
              visited.add(key);
              candidates.push([nr, nc]);
            }
          }
        }
      }
    }
  }

  if (!hasAny) return [[9, 9]];
  return candidates;
}

function scoreBoard(
  board: CellValue[][],
  myPiece: 1 | 2,
  opponent: CellValue
): number {
  let score = 0;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) continue;
      const piece = board[r][c];
      const isMe = piece === myPiece;

      for (const [dr, dc] of directions) {
        const lineScore = evalLine(board, r, c, dr, dc, piece, myPiece);
        score += isMe ? lineScore : -lineScore * 1.1;
      }
    }
  }
  return score;
}

function evalLine(
  board: CellValue[][],
  r: number,
  c: number,
  dr: number,
  dc: number,
  piece: CellValue,
  myPiece: CellValue
): number {
  let count = 0;
  let openEnds = 0;

  for (let i = 0; i < WIN_COUNT; i++) {
    const nr = r + dr * i;
    const nc = c + dc * i;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
    if (board[nr][nc] === piece) count++;
    else if (board[nr][nc] === 0) {
      openEnds++;
      break;
    } else break;
  }

  const pr = r - dr;
  const pc = c - dc;
  if (
    pr >= 0 &&
    pr < BOARD_SIZE &&
    pc >= 0 &&
    pc < BOARD_SIZE &&
    board[pr][pc] === 0
  ) {
    openEnds++;
  }

  if (count >= 5) return 100000;
  if (count === 4 && openEnds >= 1) return 10000;
  if (count === 4 && openEnds === 0) return 1000;
  if (count === 3 && openEnds === 2) return 500;
  if (count === 3 && openEnds === 1) return 100;
  if (count === 2 && openEnds === 2) return 50;
  if (count === 2 && openEnds === 1) return 10;
  if (count === 1 && openEnds === 2) return 5;
  return 0;
}

export function cleanupOldRooms() {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000;
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > maxAge) rooms.delete(id);
  }
}
