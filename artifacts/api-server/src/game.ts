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

  // Only the loser (or either in draw) can reset in multiplayer
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
//  AI — three difficulty levels + enhanced cheat AI
// ══════════════════════════════════════════════════════════════════

const SCORE = {
  WIN: 1_000_000, LIVE4: 50_000, DEAD4: 8_000,
  LIVE3: 5_000, DEAD3: 800, LIVE2: 200, DEAD2: 30, LIVE1: 5,
};

const DIRS = [[0,1],[1,0],[1,1],[1,-1]] as const;

// ── Easy: mostly random, light threat check ──────────────────────
function getAIMoveEasy(board: CellValue[][], myPiece: 1 | 2,
                       boardSize: number, winCount: number): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  const cands = getCandidates(board, boardSize, 2);
  for (const [r,c] of cands) {
    board[r][c] = myPiece; const w = checkWin(board,r,c,myPiece,boardSize,winCount);
    board[r][c] = 0; if (w) return [r,c];
  }
  for (const [r,c] of cands) {
    board[r][c] = opp; const w = checkWin(board,r,c,opp,boardSize,winCount);
    board[r][c] = 0; if (w) return [r,c];
  }
  const shuffled = cands.slice().sort(() => Math.random() - 0.5);
  return shuffled[0] ?? [Math.floor(boardSize/2), Math.floor(boardSize/2)];
}

// ── Medium: win/block + basic scoring, no minimax ────────────────
function getAIMoveMedium(board: CellValue[][], myPiece: 1 | 2,
                         boardSize: number, winCount: number): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  const cands = getCandidates(board, boardSize, 2);
  for (const [r,c] of cands) {
    board[r][c] = myPiece; const w = checkWin(board,r,c,myPiece,boardSize,winCount);
    board[r][c] = 0; if (w) return [r,c];
  }
  for (const [r,c] of cands) {
    board[r][c] = opp; const w = checkWin(board,r,c,opp,boardSize,winCount);
    board[r][c] = 0; if (w) return [r,c];
  }
  let best = cands[0];
  let bestScore = -Infinity;
  for (const [r,c] of cands.slice(0, 20)) {
    board[r][c] = myPiece;
    const atk = evalPosition(board,r,c,myPiece,boardSize,winCount);
    board[r][c] = 0;
    board[r][c] = opp;
    const def = evalPosition(board,r,c,opp,boardSize,winCount);
    board[r][c] = 0;
    const noise = Math.random() * 200;
    const score = atk * 1.1 + def * 0.9 + centerScore(r,c,boardSize) + noise;
    if (score > bestScore) { bestScore = score; best = [r,c]; }
  }
  return best;
}

// ── Hard: deep minimax + fork detection + comprehensive board scan ──
export function getAIMove(board: CellValue[][], myPiece: 1 | 2,
                          boardSize: number, winCount: number): [number, number] {
  const opp: CellValue = myPiece === 1 ? 2 : 1;
  // Use expanded candidate range for comprehensive scanning
  const cands = getCandidates(board, boardSize, 3);
  if (cands.length === 0) return [Math.floor(boardSize/2), Math.floor(boardSize/2)];

  // Immediate win check
  for (const [r,c] of cands) {
    board[r][c] = myPiece;
    if (checkWin(board,r,c,myPiece,boardSize,winCount)) { board[r][c]=0; return [r,c]; }
    board[r][c] = 0;
  }
  // Immediate block check
  for (const [r,c] of cands) {
    board[r][c] = opp;
    if (checkWin(board,r,c,opp,boardSize,winCount)) { board[r][c]=0; return [r,c]; }
    board[r][c] = 0;
  }

  // Fork creation — create double threats
  let bestFork: [number,number] | null = null; let bestForkVal = 1.5;
  for (const [r,c] of cands) {
    const t = countLiveThreats(board,r,c,myPiece,boardSize,winCount);
    if (t > bestForkVal) { bestForkVal = t; bestFork = [r,c]; }
  }
  if (bestFork) return bestFork;

  // Block opponent fork
  let bestOppFork: [number,number] | null = null; let bestOppForkVal = 1.5;
  for (const [r,c] of cands) {
    const t = countLiveThreats(board,r,c,opp,boardSize,winCount);
    if (t > bestOppForkVal) { bestOppForkVal = t; bestOppFork = [r,c]; }
  }
  if (bestOppFork) return bestOppFork;

  // Deeper minimax (depth 4) with scored candidates
  const top = scoredCandidates(board,cands,myPiece,opp,boardSize,winCount).slice(0,20);
  let best: [number,number] = top[0]?.[0] ?? cands[0];
  let bestScore = -Infinity;
  for (const [[r,c]] of top) {
    board[r][c] = myPiece;
    const mm = minimax(board,4,-Infinity,Infinity,false,myPiece,opp,boardSize,winCount,[r,c]);
    board[r][c] = 0;
    const atk  = evalPosition(board,r,c,myPiece,boardSize,winCount);
    board[r][c] = opp;
    const def  = evalPosition(board,r,c,opp,boardSize,winCount);
    board[r][c] = 0;
    // Factor in fastest win paths + boundary awareness
    const pathBonus = winPathCount(board,r,c,myPiece,boardSize,winCount) * 15;
    const boundaryPenalty = boundaryScore(r,c,boardSize);
    const total = mm*1.5 + atk*1.2 + def + pathBonus + centerScore(r,c,boardSize) - boundaryPenalty;
    if (total > bestScore) { bestScore = total; best = [r,c]; }
  }
  return best;
}

// Route by difficulty
export function getAIMoveByDifficulty(
  board: CellValue[][], piece: 1 | 2, boardSize: number, winCount: number,
  difficulty: AIDifficulty
): [number, number] {
  switch (difficulty) {
    case "easy":   return getAIMoveEasy(board, piece, boardSize, winCount);
    case "medium": return getAIMoveMedium(board, piece, boardSize, winCount);
    default:       return getAIMove(board, piece, boardSize, winCount);
  }
}

// ── helpers ──────────────────────────────────────────────────────

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
  if (count >= winCount)    return SCORE.WIN;
  if (count === winCount-1) return opens>=1 ? SCORE.LIVE4 : SCORE.DEAD4;
  if (count === winCount-2) return opens===2 ? SCORE.LIVE3 : opens===1 ? SCORE.DEAD3 : 0;
  if (count === 2)          return opens===2 ? SCORE.LIVE2 : opens===1 ? SCORE.DEAD2 : 0;
  return opens===2 ? SCORE.LIVE1 : 0;
}

function evalPosition(board: CellValue[][], row: number, col: number,
                      piece: CellValue, boardSize: number, winCount: number): number {
  let score = 0;
  for (const [dr,dc] of DIRS)
    score += evalLineAt(board,row,col,dr,dc,piece,boardSize,winCount);
  return score;
}

function countLiveThreats(board: CellValue[][], r: number, c: number,
                           piece: CellValue, boardSize: number, winCount: number): number {
  board[r][c] = piece;
  let threats = 0;
  for (const [dr,dc] of DIRS) {
    const s = evalLineAt(board,r,c,dr,dc,piece,boardSize,winCount);
    if (s >= SCORE.LIVE4) threats += 2;
    else if (s >= SCORE.DEAD4) threats += 1;
    else if (s >= SCORE.LIVE3) threats += 0.5;
  }
  board[r][c] = 0;
  return threats;
}

function winPathCount(board: CellValue[][], r: number, c: number,
                      piece: CellValue, boardSize: number, winCount: number): number {
  let count = 0;
  for (const [dr,dc] of DIRS)
    for (let offset = 0; offset < winCount; offset++) {
      let ok = true;
      for (let i = 0; i < winCount; i++) {
        const nr=r+dr*(i-offset), nc=c+dc*(i-offset);
        if (nr<0||nr>=boardSize||nc<0||nc>=boardSize) { ok=false; break; }
        if (board[nr][nc]!==0&&board[nr][nc]!==piece) { ok=false; break; }
      }
      if (ok) count++;
    }
  return count;
}

function centerScore(r: number, c: number, boardSize: number): number {
  return Math.min(Math.min(r,boardSize-1-r,c,boardSize-1-c), Math.floor(boardSize/4)) * 3;
}

// Penalty for moves too close to the boundary (limits future paths)
function boundaryScore(r: number, c: number, boardSize: number): number {
  const distToEdge = Math.min(r, boardSize-1-r, c, boardSize-1-c);
  if (distToEdge === 0) return 80;
  if (distToEdge === 1) return 30;
  if (distToEdge === 2) return 10;
  return 0;
}

function evaluateBoard(board: CellValue[][], myPiece: CellValue, opp: CellValue,
                       boardSize: number, winCount: number): number {
  let score = 0;
  for (let r=0;r<boardSize;r++) for (let c=0;c<boardSize;c++) {
    if (!board[r][c]) continue;
    const isMe = board[r][c]===myPiece;
    for (const [dr,dc] of DIRS) {
      const s = evalLineAt(board,r,c,dr,dc,board[r][c],boardSize,winCount);
      score += isMe ? s : -s*1.2;
    }
    score += isMe ? centerScore(r,c,boardSize) : -centerScore(r,c,boardSize)*0.8;
    score += isMe ? -boundaryScore(r,c,boardSize) : boundaryScore(r,c,boardSize)*0.5;
  }
  return score;
}

function minimax(board: CellValue[][], depth: number, alpha: number, beta: number,
                 isMax: boolean, myPiece: CellValue, opp: CellValue,
                 boardSize: number, winCount: number, lastMove: [number,number]|null): number {
  if (lastMove) {
    const [lr,lc] = lastMove;
    const lp = board[lr][lc];
    if (lp!==0&&checkWin(board,lr,lc,lp,boardSize,winCount))
      return lp===myPiece ? SCORE.WIN*10+depth : -SCORE.WIN*10-depth;
  }
  if (depth===0) return evaluateBoard(board,myPiece,opp,boardSize,winCount);
  // Use expanded scan at shallower depths, tighter at deeper
  const scanRange = depth >= 3 ? 3 : 2;
  const cands = getCandidates(board,boardSize,scanRange).slice(0,depth >= 3 ? 15 : 12);
  if (!cands.length) return 0;
  if (isMax) {
    let best=-Infinity;
    for (const [r,c] of cands) {
      board[r][c]=myPiece;
      best=Math.max(best,minimax(board,depth-1,alpha,beta,false,myPiece,opp,boardSize,winCount,[r,c]));
      board[r][c]=0; alpha=Math.max(alpha,best); if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for (const [r,c] of cands) {
      board[r][c]=opp;
      best=Math.min(best,minimax(board,depth-1,alpha,beta,true,myPiece,opp,boardSize,winCount,[r,c]));
      board[r][c]=0; beta=Math.min(beta,best); if(beta<=alpha) break;
    }
    return best;
  }
}

function scoredCandidates(board: CellValue[][], cands: [number,number][],
                           myPiece: CellValue, opp: CellValue,
                           boardSize: number, winCount: number): [[number,number],number][] {
  return cands.map(([r,c]): [[number,number],number] => {
    board[r][c]=myPiece; const atk=evalPosition(board,r,c,myPiece,boardSize,winCount); board[r][c]=0;
    board[r][c]=opp;     const def=evalPosition(board,r,c,opp,boardSize,winCount);     board[r][c]=0;
    const pathBonus = winPathCount(board,r,c,myPiece,boardSize,winCount)*12;
    return [[r,c], atk*1.2+def+pathBonus+centerScore(r,c,boardSize)-boundaryScore(r,c,boardSize)];
  }).sort((a,b)=>b[1]-a[1]);
}

// Comprehensive candidate scanning — range param controls how far around each piece we look
function getCandidates(board: CellValue[][], boardSize: number, range = 2): [number,number][] {
  const cands: [number,number][] = [];
  const visited = new Set<string>();
  let hasAny = false;
  const r = boardSize <= 5 ? 1 : range;
  for (let row=0;row<boardSize;row++) for (let col=0;col<boardSize;col++) {
    if (!board[row][col]) continue; hasAny = true;
    for (let dr=-r;dr<=r;dr++) for (let dc=-r;dc<=r;dc++) {
      const nr=row+dr, nc=col+dc, key=`${nr},${nc}`;
      if (nr>=0&&nr<boardSize&&nc>=0&&nc<boardSize&&!board[nr][nc]&&!visited.has(key)) {
        visited.add(key); cands.push([nr,nc]);
      }
    }
  }
  return hasAny ? cands : [[Math.floor(boardSize/2),Math.floor(boardSize/2)]];
}

export function cleanupOldRooms() {
  const now = Date.now();
  for (const [id,room] of rooms.entries())
    if (now-room.createdAt > 2*60*60*1000) rooms.delete(id);
}
