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

function makeBoard(size: number): CellValue[][] {
  return Array.from({ length: size }, () => Array(size).fill(0) as CellValue[]);
}
function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function clampBoardSize(n: number) { return Math.min(Math.max(n, 3), 30); }
function getWinCount(bs: number)   { return bs <= 3 ? 3 : bs <= 4 ? 4 : 5; }
function clampTime(t: number)      { return Math.min(Math.max(t, 10), 300); }

export function createRoom(turnTime = 30, boardSize = DEFAULT_BOARD_SIZE, aiDifficulty?: AIDifficulty): GameRoom {
  let id = randomCode();
  while (rooms.has(id)) id = randomCode();
  const bs = clampBoardSize(boardSize);
  const room: GameRoom = {
    id, players: [], board: makeBoard(bs),
    currentTurn: 1, status: "waiting", winner: 0, winLine: null,
    moveCount: 0, lastLoser: 0, scores: { 1: 0, 2: 0 },
    createdAt: Date.now(), turnTime: clampTime(turnTime),
    boardSize: bs, winCount: getWinCount(bs),
    aiPiece: aiDifficulty ? 2 : 0, aiDifficulty: aiDifficulty ?? "medium",
  };
  rooms.set(id, room);
  return room;
}
export function getRoom(id: string) { return rooms.get(id); }

export function joinRoom(roomId: string, playerId: string, playerName: string, sessionId: string): { room: GameRoom; piece: 1 | 2 } | { error: string } {
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
  if (room.aiPiece === 0 && room.lastLoser !== 0 && requestPiece !== undefined)
    if (requestPiece !== room.lastLoser) return null;
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
//  CHEAT AI V2.0 UNIVERSAL — áp dụng mọi kích thước NxN
//  Luật VN: cấm thế đôi 4 (2 hàng 4 cùng lúc → thua)
// ══════════════════════════════════════════════════════════════════

const DIRS = [[0,1],[1,0],[1,1],[1,-1]] as const;
const WIN_SCORE   = 9_999_999;
const BLOCK_SCORE = 9_998_000;   // chặn đối thủ thắng
const FORBIDDEN   = -9_999_000;  // thế cấm đôi 4 → không đi

// SCAN_RADIUS tự co giãn theo bàn: 20x20→4, 15x15→3, 10x10→3
function getScanRadius(bs: number): number {
  return Math.max(3, Math.floor(bs / 5));
}

// ══════════════════════════════════════════════════════════════════
//  BẢNG ĐIỂM TỰ CO GIÃN THEO WIN_CONDITION
//  count = số quân liên tiếp, block = số đầu bị chặn (0/1/2)
// ══════════════════════════════════════════════════════════════════
function getScore(count: number, block: number, wc: number): number {
  if (count >= wc)       return WIN_SCORE;   // 5 (hoặc wc) liên tiếp → thắng
  if (block >= 2)        return 0;           // 2 đầu đều bị chặn → vô dụng, bỏ qua
  const open = block === 0;                  // true = thế sống (2 đầu trống)

  if (count === wc - 1)  return open ? 100_000 : 5_000;   // 4 sống / 4 chết
  if (count === wc - 2)  return open ? 10_000  : 100;     // 3 sống / 3 chết
  if (count === wc - 3)  return open ? 500     : 0;       // 2 sống / 2 chết = bỏ qua
  return 0;
}

// ══════════════════════════════════════════════════════════════════
//  score_lines: quét 1 hướng, trả { count, block }
//  Thuật toán chính xác theo đặc tả:
//    - Đếm quân liên tiếp tới win-1 bước
//    - Nếu gặp OOB hoặc quân địch → block++, dừng
//    - Nếu gặp ô trống → dừng (KHÔNG tăng block = đầu mở)
// ══════════════════════════════════════════════════════════════════
function scanDir(
  board: CellValue[][], r: number, c: number,
  dr: number, dc: number, piece: CellValue, bs: number, wc: number
): { count: number; block: number } {
  let count = 1, block = 0;
  // Quét phía trước (tối đa wc-1 bước)
  for (let i = 1; i < wc; i++) {
    const nr = r + dr * i, nc = c + dc * i;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) { block++; break; }
    if (board[nr][nc] === piece) { count++; continue; }
    if (board[nr][nc] !== 0)    { block++; break; }  // quân địch
    break;                                            // ô trống → đầu mở, dừng
  }
  // Quét phía sau (tối đa wc-1 bước)
  for (let i = 1; i < wc; i++) {
    const nr = r - dr * i, nc = c - dc * i;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) { block++; break; }
    if (board[nr][nc] === piece) { count++; continue; }
    if (board[nr][nc] !== 0)    { block++; break; }  // quân địch
    break;                                            // ô trống → đầu mở, dừng
  }
  return { count, block };
}

// ── score_lines: tổng điểm tất cả 4 hướng cho quân piece tại (r,c) ──
// PHẢI đặt board[r][c] = piece TRƯỚC KHI gọi hàm này
function scoreLines(board: CellValue[][], r: number, c: number, piece: CellValue, bs: number, wc: number): number {
  let total = 0;
  for (const [dr, dc] of DIRS) {
    const { count, block } = scanDir(board, r, c, dr, dc, piece, bs, wc);
    total += getScore(count, block, wc);
  }
  return total;
}

// ── countFours: đếm số hướng có hàng 4 quân (sống hoặc chết) ────
// Dùng để kiểm tra thế cấm đôi 4
function countFours(board: CellValue[][], r: number, c: number, piece: CellValue, bs: number, wc: number): number {
  let fours = 0;
  for (const [dr, dc] of DIRS) {
    const { count, block } = scanDir(board, r, c, dr, dc, piece, bs, wc);
    if (count === wc - 1 && block < 2) fours++; // hàng 4 sống hoặc chết
  }
  return fours;
}

// ── count_fork: đếm số "thế" ≥ live3 tạo ra cùng lúc ────────────
// Mỗi hướng có 3 sống (hoặc 4) = 1 mối đe doạ độc lập
// fork_count = max(0, threats - 1) → 2 đe doạ = 1 nước đôi
function countFork(board: CellValue[][], r: number, c: number, piece: CellValue, bs: number, wc: number): number {
  board[r][c] = piece;
  let threats = 0;
  for (const [dr, dc] of DIRS) {
    const { count, block } = scanDir(board, r, c, dr, dc, piece, bs, wc);
    // Đe doạ = 3 sống trở lên, hoặc 4 bất kể
    if ((count >= wc - 2 && block === 0) || (count >= wc - 1 && block < 2)) threats++;
  }
  board[r][c] = 0;
  return Math.max(0, threats - 1);
}

// ══════════════════════════════════════════════════════════════════
//  evaluate_move: 3 lớp chấm điểm
//    Lớp 1: Thắng/thua ngay (±WIN_SCORE)
//    Lớp 2: Điểm tấn công + phòng thủ (DEF * 1.2)
//    Lớp 3: Nước đôi (fork * 50000)
//  + Luật cấm thế đôi: 2+ hàng 4 cùng lúc → FORBIDDEN
// ══════════════════════════════════════════════════════════════════
function evaluateMove(
  board: CellValue[][], r: number, c: number,
  me: CellValue, opp: CellValue, bs: number, wc: number
): number {
  const center = Math.floor(bs / 2);
  const dist   = Math.max(Math.abs(r - center), Math.abs(c - center));

  // ── Lớp 1: Thắng ngay ──────────────────────────────────────────
  board[r][c] = me;
  if (checkWin(board, r, c, me, bs, wc)) { board[r][c] = 0; return WIN_SCORE; }

  // Kiểm tra thế CẤM: tạo 2+ hàng 4 mà không thắng
  const foursCreated = countFours(board, r, c, me, bs, wc);
  if (foursCreated >= 2) { board[r][c] = 0; return FORBIDDEN; }

  // Điểm tấn công (đặt quân mình)
  const myScore = scoreLines(board, r, c, me, bs, wc);
  board[r][c] = 0;

  // ── Lớp 1b: Chặn đối thủ thắng ngay ───────────────────────────
  board[r][c] = opp;
  if (checkWin(board, r, c, opp, bs, wc)) { board[r][c] = 0; return BLOCK_SCORE; }

  // Điểm phòng thủ (đặt quân địch để đo giá trị chặn)
  const oppScore = scoreLines(board, r, c, opp, bs, wc);
  board[r][c] = 0;

  // ── Lớp 3: Bonus nước đôi (fork) ─────────────────────────────
  const forkBonus = countFork(board, r, c, me, bs, wc) * 50_000;

  // Bonus gần trung tâm (giảm dần khi xa)
  const centerBonus = Math.max(0, (bs / 2 - dist)) * 3;

  // Tổng: ATK + DEF*1.2 + fork + center
  return myScore + oppScore * 1.2 + forkBonus + centerBonus;
}

// ── Lấy ứng viên bán kính tự động ───────────────────────────────
function getCandidates(board: CellValue[][], bs: number, radius?: number): [number, number][] {
  const r = radius ?? getScanRadius(bs);
  const cands: [number, number][] = [];
  const visited = new Set<number>();
  let hasAny = false;
  for (let row = 0; row < bs; row++) for (let col = 0; col < bs; col++) {
    if (!board[row][col]) continue;
    hasAny = true;
    for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) {
      const nr = row + dr, nc = col + dc, key = nr * 64 + nc;
      if (nr >= 0 && nr < bs && nc >= 0 && nc < bs && !board[nr][nc] && !visited.has(key)) {
        visited.add(key); cands.push([nr, nc]);
      }
    }
  }
  return hasAny ? cands : [[Math.floor(bs / 2), Math.floor(bs / 2)]];
}

// ── Đánh giá toàn bàn (cho minimax) ─────────────────────────────
// Mình: cộng ATK; đối thủ: trừ theo DEF (chỉ trừ thế sống, bỏ thế chết)
function evaluateBoard(board: CellValue[][], me: CellValue, opp: CellValue, bs: number, wc: number): number {
  let score = 0;
  const center = Math.floor(bs / 2);
  for (let r = 0; r < bs; r++) for (let c = 0; c < bs; c++) {
    const p = board[r][c] as CellValue;
    if (!p) continue;
    const isMe = p === me;
    for (const [dr, dc] of DIRS) {
      const { count, block } = scanDir(board, r, c, dr, dc, p, bs, wc);
      const s = getScore(count, block, wc);
      if (isMe) {
        score += s;
      } else {
        // Phòng thủ: chỉ tính thế sống của địch (block===0), thế chết bỏ qua
        score -= block === 0 ? s * 1.1 : (count >= wc - 1 ? s * 0.5 : 0);
      }
    }
    const dist = Math.max(Math.abs(r - center), Math.abs(c - center));
    score += isMe ? (bs / 2 - dist) * 2 : -(bs / 2 - dist) * 1;
  }
  return score;
}

// ── Minimax alpha-beta depth 4 ───────────────────────────────────
function minimax(
  board: CellValue[][], depth: number, alpha: number, beta: number,
  isMax: boolean, me: CellValue, opp: CellValue, bs: number, wc: number
): number {
  if (depth === 0) return evaluateBoard(board, me, opp, bs, wc);
  // Dùng scan radius nhỏ hơn trong minimax để tiết kiệm CPU
  const cands = getCandidates(board, bs, Math.max(2, getScanRadius(bs) - 1)).slice(0, 12);
  if (!cands.length) return 0;

  if (isMax) {
    let best = -Infinity;
    for (const [r, c] of cands) {
      board[r][c] = me;
      if (checkWin(board, r, c, me, bs, wc)) { board[r][c] = 0; return WIN_SCORE * 10 + depth; }
      best = Math.max(best, minimax(board, depth - 1, alpha, beta, false, me, opp, bs, wc));
      board[r][c] = 0;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r, c] of cands) {
      board[r][c] = opp;
      if (checkWin(board, r, c, opp, bs, wc)) { board[r][c] = 0; return -(WIN_SCORE * 10 + depth); }
      best = Math.min(best, minimax(board, depth - 1, alpha, beta, true, me, opp, bs, wc));
      board[r][c] = 0;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ══════════════════════════════════════════════════════════════════
//  AI THEO ĐỘ KHÓ
// ══════════════════════════════════════════════════════════════════

function getAIMoveEasy(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const cands = getCandidates(board, bs, 2);
  for (const [r, c] of cands) {
    board[r][c] = me; const w = checkWin(board, r, c, me, bs, wc); board[r][c] = 0; if (w) return [r, c];
  }
  for (const [r, c] of cands) {
    board[r][c] = opp; const w = checkWin(board, r, c, opp, bs, wc); board[r][c] = 0; if (w) return [r, c];
  }
  return cands.sort(() => Math.random() - 0.5)[0] ?? [Math.floor(bs / 2), Math.floor(bs / 2)];
}

function getAIMoveMedium(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const cands = getCandidates(board, bs, 2);
  for (const [r, c] of cands) {
    board[r][c] = me; const w = checkWin(board, r, c, me, bs, wc); board[r][c] = 0; if (w) return [r, c];
  }
  for (const [r, c] of cands) {
    board[r][c] = opp; const w = checkWin(board, r, c, opp, bs, wc); board[r][c] = 0; if (w) return [r, c];
  }
  let best = cands[0], bestScore = -Infinity;
  for (const [r, c] of cands.slice(0, 24)) {
    const s = evaluateMove(board, r, c, me, opp, bs, wc);
    if (s === FORBIDDEN) continue;
    const total = s + Math.random() * 400;
    if (total > bestScore) { bestScore = total; best = [r, c]; }
  }
  return best;
}

// ── HARD (Cheat Mode): evaluate_move + minimax + thế cấm ─────────
export function getAIMove(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const center = Math.floor(bs / 2);
  const cands  = getCandidates(board, bs);

  // Nước đầu tiên → ô giữa
  if (cands.length <= 1) return [center, center];

  // Chấm điểm tất cả ứng viên bằng evaluate_move (3 lớp)
  const scored: [[number, number], number][] = [];
  for (const [r, c] of cands) {
    const s = evaluateMove(board, r, c, me, opp, bs, wc);
    if (s === FORBIDDEN) continue;  // loại thế cấm ngay
    scored.push([[r, c], s]);
  }

  // Nếu TẤT CẢ nước đều là thế cấm (hiếm) → fallback không kiểm tra
  if (!scored.length) return cands[0] ?? [center, center];

  // Sắp xếp điểm cao nhất trước
  scored.sort((a, b) => b[1] - a[1]);

  // Nếu nước cao nhất đã là WIN hoặc BLOCK → đi ngay, không cần minimax
  if (scored[0][1] >= BLOCK_SCORE) return scored[0][0];

  // Minimax top 18 ứng viên (bỏ thế cấm đã lọc rồi)
  const top = scored.slice(0, 18);
  let best: [number, number] = top[0][0];
  let bestTotal = -Infinity;

  for (const [[r, c], quickScore] of top) {
    board[r][c] = me;
    const mm = minimax(board, 4, -Infinity, Infinity, false, me, opp, bs, wc);
    board[r][c] = 0;
    // Kết hợp: minimax nhìn xa + quick score tức thì
    const total = mm * 1.4 + quickScore * 0.8;
    if (total > bestTotal) { bestTotal = total; best = [r, c]; }
  }
  return best;
}

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
