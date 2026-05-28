import { Server as SocketIOServer, Socket } from "socket.io";
import {
  createRoom, getRoom, joinRoom, makeMove,
  resetGame, getAIMove, cleanupOldRooms, setTurnTime, skipTurn,
} from "./game";
import { logger } from "./lib/logger";

export function setupSocketIO(io: SocketIOServer) {
  setInterval(cleanupOldRooms, 30 * 60 * 1000);

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    socket.on("create_room", (data: { name: string; sessionId: string; turnTime?: number; boardSize?: number }, cb) => {
      try {
        const room = createRoom(data.turnTime ?? 30, data.boardSize ?? 20);
        const result = joinRoom(room.id, socket.id, data.name, data.sessionId);
        if ("error" in result) return cb({ error: result.error });
        socket.join(room.id);
        cb({ room: result.room, piece: result.piece });
      } catch (e) { logger.error(e, "create_room"); cb({ error: "Lỗi tạo phòng" }); }
    });

    socket.on("join_room", (data: { roomId: string; name: string; sessionId: string }, cb) => {
      try {
        const result = joinRoom(data.roomId.toUpperCase(), socket.id, data.name, data.sessionId);
        if ("error" in result) return cb({ error: result.error });
        socket.join(data.roomId.toUpperCase());
        io.to(data.roomId.toUpperCase()).emit("room_updated", result.room);
        cb({ room: result.room, piece: result.piece });
      } catch (e) { logger.error(e, "join_room"); cb({ error: "Lỗi tham gia phòng" }); }
    });

    socket.on("make_move", (data: { roomId: string; row: number; col: number }, cb) => {
      try {
        const result = makeMove(data.roomId, socket.id, data.row, data.col);
        if (!result.success) return cb?.({ error: result.error });
        io.to(data.roomId).emit("room_updated", result.room);
        cb?.({ success: true });
      } catch (e) { logger.error(e, "make_move"); cb?.({ error: "Lỗi đặt quân" }); }
    });

    socket.on("reset_game", (data: { roomId: string; firstPiece?: 1 | 2 }) => {
      try {
        const room = resetGame(data.roomId, data.firstPiece);
        if (room) io.to(data.roomId).emit("room_updated", room);
      } catch (e) { logger.error(e, "reset_game"); }
    });

    socket.on("skip_turn", (data: { roomId: string; piece: 1 | 2 }) => {
      try {
        const room = skipTurn(data.roomId, data.piece);
        if (room) io.to(data.roomId).emit("room_updated", room);
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

    socket.on("get_ai_hint", (data: { roomId: string; piece: 1 | 2 }, cb) => {
      try {
        const room = getRoom(data.roomId);
        if (!room) return cb({ error: "Phòng không tồn tại" });
        const move = getAIMove(room.board, data.piece, room.boardSize, room.winCount);
        cb({ move });
      } catch (e) { logger.error(e, "get_ai_hint"); cb({ error: "Lỗi AI" }); }
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected");
    });
  });
}
