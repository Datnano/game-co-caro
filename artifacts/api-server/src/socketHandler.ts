import { Server as SocketIOServer, Socket } from "socket.io";
import {
  createRoom, getRoom, joinRoom, makeMove,
  resetGame, getAIMoveByDifficulty, cleanupOldRooms,
  setTurnTime, skipTurn, AIDifficulty,
} from "./game";
import { logger } from "./lib/logger";

const AI_NAMES: Record<AIDifficulty, string> = {
  easy:   "🤖 AI (Dễ)",
  medium: "🤖 AI (TB)",
  hard:   "🤖 AI (Khó)",
};

function scheduleAIMove(io: SocketIOServer, roomId: string, delay = 400) {
  setTimeout(() => {
    const room = getRoom(roomId);
    if (!room || room.status !== "playing") return;
    if (room.aiPiece === 0 || room.currentTurn !== room.aiPiece) return;

    const move = getAIMoveByDifficulty(
      room.board, room.aiPiece as 1 | 2,
      room.boardSize, room.winCount, room.aiDifficulty
    );
    const result = makeMove(room.id, "AI_BOT", move[0], move[1]);
    if (result.success && result.room) {
      io.to(room.id).emit("room_updated", result.room);
    }
  }, delay);
}

export function setupSocketIO(io: SocketIOServer) {
  setInterval(cleanupOldRooms, 30 * 60 * 1000);

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    socket.on("create_room", (
      data: { name: string; sessionId: string; turnTime?: number; boardSize?: number; aiDifficulty?: AIDifficulty },
      cb: (r: any) => void
    ) => {
      try {
        const room = createRoom(data.turnTime ?? 30, data.boardSize ?? 20, data.aiDifficulty);
        const result = joinRoom(room.id, socket.id, data.name, data.sessionId);
        if ("error" in result) return cb({ error: result.error });
        socket.join(room.id);

        if (data.aiDifficulty) {
          const aiName = AI_NAMES[data.aiDifficulty];
          joinRoom(room.id, "AI_BOT", aiName, "AI_SESSION");
        }

        const fresh = getRoom(room.id)!;
        cb({ room: fresh, piece: result.piece });
      } catch (e) { logger.error(e, "create_room"); cb({ error: "Lỗi tạo phòng" }); }
    });

    socket.on("join_room", (
      data: { roomId: string; name: string; sessionId: string },
      cb: (r: any) => void
    ) => {
      try {
        const rid = data.roomId.toUpperCase();
        const result = joinRoom(rid, socket.id, data.name, data.sessionId);
        if ("error" in result) return cb({ error: result.error });
        socket.join(rid);
        io.to(rid).emit("room_updated", result.room);
        cb({ room: result.room, piece: result.piece });
      } catch (e) { logger.error(e, "join_room"); cb({ error: "Lỗi tham gia phòng" }); }
    });

    socket.on("make_move", (
      data: { roomId: string; row: number; col: number },
      cb?: (r: any) => void
    ) => {
      try {
        const result = makeMove(data.roomId, socket.id, data.row, data.col);
        if (!result.success) return cb?.({ error: result.error });
        io.to(data.roomId).emit("room_updated", result.room);
        cb?.({ success: true });

        const room = result.room;
        if (room && room.status === "playing" && room.aiPiece !== 0 && room.currentTurn === room.aiPiece) {
          const delay = room.aiDifficulty === "easy" ? 350
                      : room.aiDifficulty === "medium" ? 500 : 750;
          scheduleAIMove(io, data.roomId, delay);
        }
      } catch (e) { logger.error(e, "make_move"); cb?.({ error: "Lỗi đặt quân" }); }
    });

    socket.on("reset_game", (data: { roomId: string; requestPiece?: 1 | 2; firstPiece?: 1 | 2 }) => {
      try {
        const room = resetGame(data.roomId, data.requestPiece, data.firstPiece);
        if (!room) return;
        io.to(data.roomId).emit("room_updated", room);
        if (room.aiPiece !== 0 && room.currentTurn === room.aiPiece) {
          scheduleAIMove(io, data.roomId, 600);
        }
      } catch (e) { logger.error(e, "reset_game"); }
    });

    socket.on("skip_turn", (data: { roomId: string; piece: 1 | 2 }) => {
      try {
        const room = skipTurn(data.roomId, data.piece);
        if (!room) return;
        io.to(data.roomId).emit("room_updated", room);
        if (room.aiPiece !== 0 && room.currentTurn === room.aiPiece) {
          scheduleAIMove(io, data.roomId, 350);
        }
      } catch (e) { logger.error(e, "skip_turn"); }
    });

    socket.on("set_turn_time", (data: { roomId: string; seconds: number }) => {
      try {
        const room = setTurnTime(data.roomId, data.seconds);
        if (room) io.to(data.roomId).emit("room_updated", room);
      } catch (e) { logger.error(e, "set_turn_time"); }
    });

    socket.on("chat_message", (data: { roomId: string; name: string; message: string; color: string }) => {
      io.to(data.roomId).emit("chat_message", {
        name: data.name, message: data.message, color: data.color, timestamp: Date.now(),
      });
    });

    socket.on("get_ai_hint", (data: { roomId: string; piece: 1 | 2 }, cb: (r: any) => void) => {
      try {
        const room = getRoom(data.roomId);
        if (!room) return cb({ error: "Phòng không tồn tại" });
        const move = getAIMoveByDifficulty(room.board, data.piece, room.boardSize, room.winCount, "hard");
        cb({ move });
      } catch (e) { logger.error(e, "get_ai_hint"); cb({ error: "Lỗi AI" }); }
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected");
    });
  });
}
