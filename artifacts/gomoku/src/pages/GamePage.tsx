import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { getSocket } from "@/lib/socket";
import GameCanvas from "@/components/GameCanvas";
import ChatPanel from "@/components/ChatPanel";
import { useSound } from "@/hooks/useSound";

export interface GameRoom {
  id: string;
  players: Array<{ id: string; name: string; piece: 1 | 2 }>;
  board: number[][];
  currentTurn: 1 | 2;
  status: "waiting" | "playing" | "finished";
  winner: 0 | 1 | 2;
  winLine: [number, number][] | null;
  moveCount: number;
  scores: { 1: number; 2: number };
}

export default function GamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId?.toUpperCase() || "";
  const [, navigate] = useLocation();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [myPiece, setMyPiece] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [aiHint, setAiHint] = useState<[number, number] | null>(null);
  const [cheatActive, setCheatActive] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [timer, setTimer] = useState(30);
  const [danmakuMessages, setDanmakuMessages] = useState<
    Array<{ id: string; text: string; color: string; y: number; startX: number }>
  >([]);

  const myName = localStorage.getItem("gomoku_name") || "";
  const skin = localStorage.getItem("gomoku_skin") || "classic";
  const sessionId = localStorage.getItem("gomoku_session") || "";
  const { playPlace, playWin, playLose, playChat, playTick } = useSound();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTurnRef = useRef<1 | 2 | null>(null);
  const prevStatusRef = useRef<string>("");
  const prevWinnerRef = useRef<number>(0);
  const isMyTurn = room?.status === "playing" && room.currentTurn === myPiece;

  useEffect(() => {
    const socket = getSocket();
    const piece = Number(localStorage.getItem("gomoku_piece")) as 1 | 2;
    setMyPiece(piece || 1);

    socket.emit(
      "join_room",
      { roomId, name: myName, sessionId },
      (res: any) => {
        if (res.error) {
          setError(res.error);
          return;
        }
        setRoom(res.room);
        setMyPiece(res.piece);
        localStorage.setItem("gomoku_piece", String(res.piece));
      }
    );

    socket.on("room_updated", (updatedRoom: GameRoom) => {
      setRoom((prev) => {
        if (
          prev &&
          prev.status === "playing" &&
          updatedRoom.status === "playing"
        ) {
          if (prev.moveCount !== updatedRoom.moveCount) {
            playPlace();
          }
        }
        return updatedRoom;
      });
    });

    socket.on(
      "chat_message",
      (data: { name: string; message: string; color: string }) => {
        playChat();
        const id = crypto.randomUUID();
        const y = 60 + Math.random() * 200;
        setDanmakuMessages((prev) => [
          ...prev,
          { id, text: `${data.name}: ${data.message}`, color: data.color, y, startX: window.innerWidth + 50 },
        ]);
        setTimeout(() => {
          setDanmakuMessages((prev) => prev.filter((m) => m.id !== id));
        }, 6000);
      }
    );

    return () => {
      socket.off("room_updated");
      socket.off("chat_message");
    };
  }, [roomId]);

  useEffect(() => {
    if (!room) return;
    if (room.status === "finished" && prevStatusRef.current !== "finished") {
      if (room.winner === myPiece) playWin();
      else if (room.winner !== 0) playLose();
    }
    prevStatusRef.current = room.status;
    prevWinnerRef.current = room.winner;
  }, [room?.status, room?.winner]);

  useEffect(() => {
    if (!room || room.status !== "playing") {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimer(30);
      return;
    }
    if (prevTurnRef.current !== room.currentTurn) {
      setTimer(30);
      prevTurnRef.current = room.currentTurn;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        if (t <= 6 && isMyTurn) playTick();
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [room?.currentTurn, room?.status]);

  const handleMove = useCallback(
    (row: number, col: number) => {
      if (!isMyTurn) return;
      const socket = getSocket();
      socket.emit("make_move", { roomId, row, col }, (res: any) => {
        if (res?.error) setError(res.error);
      });
      setAiHint(null);
    },
    [isMyTurn, roomId]
  );

  const handleCheat = useCallback(() => {
    if (!cheatActive && myName === "Thành Đạt") {
      setCheatActive(true);
      const socket = getSocket();
      socket.emit("get_ai_hint", { roomId, piece: myPiece }, (res: any) => {
        if (res?.move) setAiHint(res.move);
      });
    } else {
      setCheatActive(false);
      setAiHint(null);
    }
  }, [cheatActive, myName, roomId, myPiece]);

  useEffect(() => {
    if (cheatActive && room?.status === "playing" && isMyTurn) {
      const socket = getSocket();
      socket.emit("get_ai_hint", { roomId, piece: myPiece }, (res: any) => {
        if (res?.move) setAiHint(res.move);
      });
    }
  }, [room?.moveCount, cheatActive, isMyTurn]);

  function handleReset() {
    const socket = getSocket();
    socket.emit("reset_game", { roomId });
  }

  function handleSendChat(message: string, color: string) {
    const socket = getSocket();
    socket.emit("chat_message", { roomId, name: myName, message, color });
  }

  const myPlayer = room?.players.find((p) => p.piece === myPiece);
  const opponent = room?.players.find((p) => p.piece !== myPiece);
  const turnPlayer = room?.players.find((p) => p.piece === room?.currentTurn);

  if (error) {
    return (
      <div className="error-page">
        <div className="error-card">
          <h2>Lỗi</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={() => navigate("/")}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <p>Đang kết nối...</p>
      </div>
    );
  }

  return (
    <div className="game-page">
      <div className="stars" />

      {/* Header */}
      <header className="game-header">
        <div className="header-left">
          <div className="room-key-badge">
            <span className="badge-label">KEY:</span>
            <span className="badge-value">{room.id}</span>
          </div>
          <div className="player-badge piece-1">
            <span className="player-dot" />
            <span className="piece-icon x-icon">✕</span>
            <span className="player-name">{room.players.find((p) => p.piece === 1)?.name || "..."}</span>
            <span className="score-val">{room.scores[1]}</span>
          </div>
          <span className="vs-text">VS</span>
          <div className="player-badge piece-2">
            <span className="player-dot" />
            <span className="piece-icon o-icon">○</span>
            <span className="player-name">{room.players.find((p) => p.piece === 2)?.name || "..."}</span>
            <span className="score-val">{room.scores[2]}</span>
          </div>
        </div>

        <div className="header-center">
          {room.status === "waiting" && (
            <div className="status-waiting">
              ⏳ Đang chờ đối thủ...
            </div>
          )}
          {room.status === "playing" && (
            <div className={`status-turn ${isMyTurn ? "my-turn" : ""}`}>
              <span>{isMyTurn ? "⚡ Lượt của bạn" : `${turnPlayer?.name || "..."} đang đi...`}</span>
              <span className={`timer-badge ${timer <= 5 ? "urgent" : ""}`}>
                {timer}s
              </span>
            </div>
          )}
          {room.status === "finished" && (
            <div className="status-finished">
              {room.winner === 0
                ? "🤝 Hòa!"
                : room.winner === myPiece
                ? "🏆 Bạn thắng!"
                : "💀 Bạn thua!"}
              <button className="btn-reset" onClick={handleReset}>
                Chơi lại
              </button>
            </div>
          )}
        </div>

        <div className="header-right">
          <button
            className={`cheat-btn ${cheatActive ? "active" : ""}`}
            onClick={handleCheat}
            title="CHEAT"
          >
            ⚡ CHEAT
          </button>
        </div>
      </header>

      {/* Game Canvas */}
      <div className="canvas-area">
        <GameCanvas
          board={room.board}
          onMove={handleMove}
          myPiece={myPiece}
          currentTurn={room.currentTurn}
          winLine={room.winLine}
          status={room.status}
          skin={skin}
          aiHint={aiHint}
          danmakuMessages={danmakuMessages}
        />
      </div>

      {/* Chat Button */}
      <button
        className="chat-fab"
        onClick={() => setShowChat((v) => !v)}
        title="Chat"
      >
        💬
      </button>

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          myName={myName}
          myPiece={myPiece}
          onSend={handleSendChat}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
