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

export function checkWin(board: CellValue[][], row: number, col: number, piece: CellValue, boardSize: number, winCount: number): [number, number][] | null {
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
//  AI ENGINE — Phân biệt thế sống (2 đầu trống) / thế chết (1 đầu bị chặn)
// ══════════════════════════════════════════════════════════════════

const DIRS = [[0,1],[1,0],[1,1],[1,-1]] as const;
const WIN_SCORE    = 10_000_000;
const FORBIDDEN    = -999;        // thế cấm: tạo 2 hàng 4 cùng lúc

// ── Bảng điểm TẤN CÔNG (cho quân của mình) ──────────────────────
// Thế sống = 2 đầu trống; Thế chết = 1 đầu bị chặn
const ATK = {
  LIVE4: 100_000,   // 4 sống → thắng ngay nếu đi
  LIVE3:  10_000,   // 3 sống → tạo thế đôi nguy hiểm
  DEAD4:   5_000,   // 4 chết → ép đối thủ phải chặn
  DEAD3:     100,   // 3 chết → đi cho vui
  LIVE2:      50,   // 2 sống → xây dựng
  DEAD2:       0,   // 2 chết → bỏ qua
};

// ── Bảng điểm PHÒNG THỦ (chặn quân đối thủ) ────────────────────
// CHỈ CHẶN khi thực sự nguy hiểm; thế chết = vô dụng, KHÔNG CHẶN
const DEF = {
  LIVE4: 99_999,    // ← BẮT BUỘC chặn, không là thua
  LIVE3:  9_999,    // ← PHẢI chặn
  DEAD4:  4_999,    // ← nên chặn
  DEAD3:      0,    // ← KHÔNG chặn (thế chết vô dụng)
  LIVE2:      0,    // ← KHÔNG chặn (còn xa)
  DEAD2:      0,    // ← KHÔNG chặn
};

// ── Lấy thống kê 1 hướng: count liên tiếp + số đầu mở ──────────
// Trả về { cnt, opens } — KHÔNG đặt board[r][c] trước khi gọi
function lineStats(
  board: CellValue[][], r: number, c: number,
  dr: number, dc: number, piece: CellValue, bs: number, wc: number
): { cnt: number; opens: number } {
  let cnt = 1, openA = 0, openB = 0;
  // Quét về phía trước
  for (let i = 1; i <= wc; i++) {
    const nr = r + dr * i, nc = c + dc * i;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) break;
    if (board[nr][nc] === piece) cnt++;
    else if (board[nr][nc] === 0) { openA = 1; break; }
    else break;
  }
  // Quét về phía sau
  for (let i = 1; i <= wc; i++) {
    const nr = r - dr * i, nc = c - dc * i;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) break;
    if (board[nr][nc] === piece) cnt++;
    else if (board[nr][nc] === 0) { openB = 1; break; }
    else break;
  }
  return { cnt, opens: openA + openB };
}

// ── Chuyển thống kê → điểm ATK ──────────────────────────────────
function atkFromStats(cnt: number, opens: number, wc: number): number {
  if (cnt >= wc)      return WIN_SCORE;
  if (cnt === wc - 1) return opens === 2 ? ATK.LIVE4 : opens === 1 ? ATK.DEAD4 : 0;
  if (cnt === wc - 2) return opens === 2 ? ATK.LIVE3 : opens === 1 ? ATK.DEAD3 : 0;
  if (cnt === 2)      return opens === 2 ? ATK.LIVE2 : opens === 1 ? ATK.DEAD2 : 0;
  return 0;
}

// ── Chuyển thống kê → điểm DEF ──────────────────────────────────
function defFromStats(cnt: number, opens: number, wc: number): number {
  if (cnt >= wc)      return WIN_SCORE;     // đối thủ đã thắng, cần chặn gấp
  if (cnt === wc - 1) return opens === 2 ? DEF.LIVE4 : opens === 1 ? DEF.DEAD4 : 0;
  if (cnt === wc - 2) return opens === 2 ? DEF.LIVE3 : 0;  // dead3 = 0, không chặn
  return 0;                                  // 2 quân trở xuống = 0, không chặn
}

// ── is_live_threat: Kiểm tra ô (r,c) có phải là "thế sống" không ─
// Trả về true nếu có hướng nào: N quân liên tiếp CẢ 2 đầu đều trống
export function isLiveThreat(
  board: CellValue[][], r: number, c: number,
  piece: CellValue, bs: number, wc: number
): boolean {
  for (const [dr, dc] of DIRS) {
    const { cnt, opens } = lineStats(board, r, c, dr, dc, piece, bs, wc);
    if (cnt >= 2 && opens === 2) return true; // ít nhất 2 quân, 2 đầu trống
  }
  return false;
}

// ── Chấm điểm tổng của 1 nước đi tại (r,c) ────────────────────
// = điểm tấn công của mình + điểm phòng thủ chặn đối thủ
// Trả về FORBIDDEN nếu tạo thế cấm (2 hàng 4 cùng lúc không thắng)
function scoreMove(
  board: CellValue[][], r: number, c: number,
  me: CellValue, opp: CellValue, bs: number, wc: number
): number {
  // ── Tấn công: đặt quân mình vào ─────────────────────────────
  board[r][c] = me;
  let atkTotal = 0;
  let foursCreated = 0; // đếm hàng 4 tạo ra (để kiểm tra thế cấm)
  let isWin = false;
  for (const [dr, dc] of DIRS) {
    const { cnt, opens } = lineStats(board, r, c, dr, dc, me, bs, wc);
    if (cnt >= wc) { isWin = true; break; }
    if (cnt === wc - 1) foursCreated++; // bất kể sống/chết đều tính vào "hàng 4"
    atkTotal += atkFromStats(cnt, opens, wc);
  }
  board[r][c] = 0;

  if (isWin) return WIN_SCORE + 9_000_000; // thắng ngay → luôn ưu tiên số 1

  // ── Kiểm tra THỐN CẤM: tạo 2+ hàng 4 cùng lúc mà không thắng ─
  if (foursCreated >= 2) return FORBIDDEN;

  // ── Phòng thủ: chặn nước đối thủ sẽ đi vào ô này ────────────
  board[r][c] = opp;
  let defTotal = 0;
  for (const [dr, dc] of DIRS) {
    const { cnt, opens } = lineStats(board, r, c, dr, dc, opp, bs, wc);
    defTotal += defFromStats(cnt, opens, wc);
  }
  board[r][c] = 0;

  // Điểm tổng: ATK + DEF (DEF cao hơn ATK một chút → không bỏ lỡ chặn)
  return atkTotal + defTotal;
}

// ── Lấy danh sách ô ứng viên: bán kính 3 quanh quân đã đi ───────
function getCandidates(board: CellValue[][], bs: number, radius = 3): [number, number][] {
  const cands: [number, number][] = [];
  const visited = new Set<number>();
  let hasAny = false;
  for (let r = 0; r < bs; r++) for (let c = 0; c < bs; c++) {
    if (!board[r][c]) continue;
    hasAny = true;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr, nc = c + dc, key = nr * 64 + nc;
      if (nr >= 0 && nr < bs && nc >= 0 && nc < bs && !board[nr][nc] && !visited.has(key)) {
        visited.add(key); cands.push([nr, nc]);
      }
    }
  }
  return hasAny ? cands : [[Math.floor(bs / 2), Math.floor(bs / 2)]];
}

// ── Đánh giá toàn bàn (dùng trong minimax) ──────────────────────
// Mình dùng ATK, đối thủ dùng DEF (thế chết của đối thủ = 0, không tính)
function evaluateBoard(board: CellValue[][], me: CellValue, opp: CellValue, bs: number, wc: number): number {
  let score = 0;
  const center = Math.floor(bs / 2);
  for (let r = 0; r < bs; r++) for (let c = 0; c < bs; c++) {
    const p = board[r][c];
    if (!p) continue;
    const isMe = p === me;
    for (const [dr, dc] of DIRS) {
      const { cnt, opens } = lineStats(board, r, c, dr, dc, p as CellValue, bs, wc);
      if (isMe) {
        score += atkFromStats(cnt, opens, wc);
      } else {
        // Đối thủ: chỉ tính thế sống mới bị trừ điểm (thế chết = 0 → không ảnh hưởng)
        score -= defFromStats(cnt, opens, wc);
      }
    }
    // Bonus gần trung tâm
    const dist = Math.max(Math.abs(r - center), Math.abs(c - center));
    const bonus = Math.max(0, (bs / 2 - dist)) * 2;
    score += isMe ? bonus : -bonus * 0.5;
  }
  return score;
}

// ── Minimax với alpha-beta (depth 4) ────────────────────────────
function minimax(
  board: CellValue[][], depth: number, alpha: number, beta: number,
  isMax: boolean, me: CellValue, opp: CellValue, bs: number, wc: number
): number {
  if (depth === 0) return evaluateBoard(board, me, opp, bs, wc);
  const cands = getCandidates(board, bs, 2).slice(0, 12);
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
  // Chặn thắng ngay, còn lại random
  for (const [r, c] of cands) {
    board[r][c] = me; const w = checkWin(board, r, c, me, bs, wc); board[r][c] = 0;
    if (w) return [r, c];
  }
  for (const [r, c] of cands) {
    board[r][c] = opp; const w = checkWin(board, r, c, opp, bs, wc); board[r][c] = 0;
    if (w) return [r, c];
  }
  return cands.sort(() => Math.random() - 0.5)[0] ?? [Math.floor(bs / 2), Math.floor(bs / 2)];
}

function getAIMoveMedium(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const cands = getCandidates(board, bs, 2);
  // Win/block ngay
  for (const [r, c] of cands) {
    board[r][c] = me; const w = checkWin(board, r, c, me, bs, wc); board[r][c] = 0;
    if (w) return [r, c];
  }
  for (const [r, c] of cands) {
    board[r][c] = opp; const w = checkWin(board, r, c, opp, bs, wc); board[r][c] = 0;
    if (w) return [r, c];
  }
  // Chấm điểm đơn giản có nhiễu
  const center = Math.floor(bs / 2);
  let best = cands[0], bestScore = -Infinity;
  for (const [r, c] of cands.slice(0, 24)) {
    const s = scoreMove(board, r, c, me, opp, bs, wc);
    if (s === FORBIDDEN) continue;
    const dist = Math.max(Math.abs(r - center), Math.abs(c - center));
    const total = s + (bs / 2 - dist) * 3 + Math.random() * 400;
    if (total > bestScore) { bestScore = total; best = [r, c]; }
  }
  return best;
}

// ── HARD AI: Cheat Mode với thứ tự ưu tiên chính xác ────────────
export function getAIMove(board: CellValue[][], me: 1 | 2, bs: number, wc: number): [number, number] {
  const opp: CellValue = me === 1 ? 2 : 1;
  const center = Math.floor(bs / 2);

  // ① Nước đầu tiên: đi ô giữa
  const cands = getCandidates(board, bs, 3);
  if (cands.length === 0 || cands.length === 1 && !board[center]?.[center]) {
    return [center, center];
  }

  // ② Chấm điểm tất cả ứng viên (tích hợp ATK + DEF + thế cấm)
  const scored: [[number,number], number][] = [];
  for (const [r, c] of cands) {
    const s = scoreMove(board, r, c, me, opp, bs, wc);
    if (s === FORBIDDEN) continue;  // bỏ qua thế cấm
    const dist = Math.max(Math.abs(r - center), Math.abs(c - center));
    const edgeP = Math.min(r, bs - 1 - r, c, bs - 1 - c) <= 1 ? -200 : 0;
    scored.push([[r, c], s + (bs / 2 - dist) * 2 + edgeP]);
  }
  if (!scored.length) return cands[0] ?? [center, center]; // fallback nếu tất cả đều cấm

  // Sắp xếp điểm giảm dần
  scored.sort((a, b) => b[1] - a[1]);

  // ③ Nếu điểm cao nhất ≥ WIN → đi ngay (thắng hoặc chặn thắng)
  if (scored[0][1] >= WIN_SCORE) return scored[0][0];

  // ④ Minimax trên top 18 ứng viên để tìm nước hay nhất dài hạn
  const top = scored.slice(0, 18);
  let best: [number,number] = top[0][0];
  let bestScore = -Infinity;

  for (const [[r, c], quickScore] of top) {
    board[r][c] = me;
    const mm = minimax(board, 4, -Infinity, Infinity, false, me, opp, bs, wc);
    board[r][c] = 0;
    // Kết hợp quick score + minimax, ưu tiên nước có điểm tức thì cao
    const total = mm * 1.4 + quickScore * 0.8;
    if (total > bestScore) { bestScore = total; best = [r, c]; }
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
