import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { getSocket } from "@/lib/socket";
import GameCanvas from "@/components/GameCanvas";
import ChatPanel from "@/components/ChatPanel";
import PostGameModal from "@/components/PostGameModal";
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
  turnTime: number;
}

const TIME_OPTIONS = [15, 30, 60, 90, 120];

export default function GamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = (params.roomId ?? "").toUpperCase();
  const [, navigate] = useLocation();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [myPiece, setMyPiece] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [aiHint, setAiHint] = useState<[number, number] | null>(null);
  const [cheatActive, setCheatActive] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [showPostGame, setShowPostGame] = useState(false);
  const [timer, setTimer] = useState(30);
  const [danmakuMessages, setDanmakuMessages] = useState<
    Array<{ id: string; text: string; color: string; y: number; startX: number }>
  >([]);

  const myName = localStorage.getItem("gomoku_name") || "";
  const isThanhDat = myName === "Thành Đạt";
  const skinRef = useRef(localStorage.getItem("gomoku_skin") || "classic");
  const [activeSkin, setActiveSkin] = useState(skinRef.current);
  const sessionId = localStorage.getItem("gomoku_session") || "";
  const { playPlace, playWin, playLose, playChat, playTick, playConfirm } = useSound();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTurnRef = useRef<1 | 2 | null>(null);
  const prevStatusRef = useRef<string>("");
  const joinedRef = useRef(false);
  const isMyTurn = room?.status === "playing" && room.currentTurn === myPiece;
  const amLoser = room?.status === "finished" && room.winner !== 0 && room.winner !== myPiece;

  // ── join room ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();

    socket.emit("join_room", { roomId, name: myName, sessionId }, (res: any) => {
      if (res.error) { setError(res.error); return; }
      setRoom(res.room);
      setMyPiece(res.piece);
      setTimer(res.room.turnTime ?? 30);
      localStorage.setItem("gomoku_piece", String(res.piece));
    });

    socket.on("room_updated", (updatedRoom: GameRoom) => {
      setRoom(prev => {
        if (prev?.status === "playing" && updatedRoom.status === "playing"
            && prev.moveCount !== updatedRoom.moveCount) {
          playPlace();
        }
        // Show post-game modal when game finishes
        if (prev?.status === "playing" && updatedRoom.status === "finished") {
          setTimeout(() => setShowPostGame(true), 800);
        }
        return updatedRoom;
      });
    });

    socket.on("chat_message", (data: { name: string; message: string; color: string }) => {
      playChat();
      const id = crypto.randomUUID();
      const canvasEl = document.querySelector(".game-canvas") as HTMLCanvasElement | null;
      const canvasH = canvasEl?.clientHeight ?? 400;
      const y = 55 + Math.random() * (canvasH - 110);
      setDanmakuMessages(prev => [...prev.slice(-10), {
        id, text: `${data.name}: ${data.message}`,
        color: data.color, y, startX: window.innerWidth + 80,
      }]);
      setTimeout(() => setDanmakuMessages(prev => prev.filter(m => m.id !== id)), 7000);
    });

    return () => { socket.off("room_updated"); socket.off("chat_message"); };
  }, [roomId]);

  // ── win/lose sound ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!room || room.status !== "finished") return;
    if (prevStatusRef.current === "finished") return;
    prevStatusRef.current = "finished";
    if (room.winner === myPiece) playWin();
    else if (room.winner !== 0) playLose();
  }, [room?.status, room?.winner]);

  useEffect(() => {
    if (room?.status !== "finished") prevStatusRef.current = room?.status ?? "";
  }, [room?.status]);

  // ── countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!room || room.status !== "playing") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    if (prevTurnRef.current !== room.currentTurn) {
      prevTurnRef.current = room.currentTurn;
      setTimer(room.turnTime ?? 30);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        if (t <= 6 && isMyTurn) playTick();
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [room?.currentTurn, room?.status, room?.turnTime]);

  // ── AI hint refresh after each move ───────────────────────────────────────
  useEffect(() => {
    if (cheatActive && room?.status === "playing" && isMyTurn) {
      getSocket().emit("get_ai_hint", { roomId, piece: myPiece }, (res: any) => {
        if (res?.move) setAiHint(res.move);
      });
    }
  }, [room?.moveCount, cheatActive, isMyTurn]);

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleMove = useCallback((row: number, col: number) => {
    if (!isMyTurn) return;
    playConfirm();
    getSocket().emit("make_move", { roomId, row, col }, (res: any) => {
      if (res?.error) setError(res.error);
    });
    setAiHint(null);
  }, [isMyTurn, roomId]);

  const handleCheat = useCallback(() => {
    if (!isThanhDat) return;
    if (!cheatActive) {
      setCheatActive(true);
      getSocket().emit("get_ai_hint", { roomId, piece: myPiece }, (res: any) => {
        if (res?.move) setAiHint(res.move);
      });
    } else {
      setCheatActive(false);
      setAiHint(null);
    }
  }, [cheatActive, isThanhDat, roomId, myPiece]);

  function handleReset(firstPiece?: 1 | 2, newSkin?: string) {
    if (newSkin) {
      localStorage.setItem("gomoku_skin", newSkin);
      setActiveSkin(newSkin);
    }
    setShowPostGame(false);
    setCheatActive(false);
    setAiHint(null);
    getSocket().emit("reset_game", { roomId, firstPiece });
  }

  function handleSetTime(seconds: number) {
    getSocket().emit("set_turn_time", { roomId, seconds });
    setShowTimeMenu(false);
  }

  function handleSendChat(message: string, color: string) {
    getSocket().emit("chat_message", { roomId, name: myName, message, color });
  }

  const p1 = room?.players.find(p => p.piece === 1);
  const p2 = room?.players.find(p => p.piece === 2);
  const turnPlayer = room?.players.find(p => p.piece === room?.currentTurn);

  if (error) return (
    <div className="error-page">
      <div className="error-card">
        <h2>Lỗi kết nối</h2>
        <p>{error}</p>
        <button className="btn-primary" onClick={() => navigate("/")}>← Quay lại</button>
      </div>
    </div>
  );

  if (!room) return (
    <div className="loading-page">
      <div className="loading-spinner" />
      <p>Đang kết nối...</p>
    </div>
  );

  return (
    <div className="game-page">
      <div className="stars" />

      {/* ═══ HEADER ═══ */}
      <header className="game-header">

        {/* Row 1 */}
        <div className="header-row1">
          <div className="room-key-badge">
            <span className="badge-label">KEY</span>
            <span className="badge-sep">:</span>
            <span className="badge-value">{room.id}</span>
          </div>

          <div className="header-spacer" />

          {/* status / timer */}
          <div className="turn-status">
            {room.status === "waiting" && <span className="waiting-text">⏳ Chờ đối thủ...</span>}
            {room.status === "playing" && (
              <>
                <span className={`turn-label ${isMyTurn ? "my-turn" : ""}`}>
                  {isMyTurn ? "⚡ Lượt bạn" : `${turnPlayer?.name ?? "..."}...`}
                </span>
                <span className={`timer-badge ${timer <= 5 ? "urgent" : ""}`}>{timer}s</span>
              </>
            )}
            {room.status === "finished" && (
              <span className="finished-text">
                {room.winner === 0 ? "🤝 Hòa!" : room.winner === myPiece ? "🏆 Bạn thắng!" : "💀 Bạn thua!"}
              </span>
            )}
          </div>

          <div className="header-spacer" />

          {/* actions */}
          <div className="header-actions">
            <div className="time-picker-wrap">
              <button className="icon-btn" onClick={() => setShowTimeMenu(v => !v)}>
                ⏱ {room.turnTime}s
              </button>
              {showTimeMenu && (
                <div className="time-dropdown">
                  {TIME_OPTIONS.map(t => (
                    <button key={t} className={`time-opt ${room.turnTime === t ? "active" : ""}`}
                      onClick={() => handleSetTime(t)}>
                      {t < 60 ? `${t}s` : `${t/60}p`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CHEAT — only visible to "Thành Đạt" */}
            {isThanhDat && (
              <button className={`cheat-btn ${cheatActive ? "active" : ""}`} onClick={handleCheat}>
                ⚡ CHEAT
              </button>
            )}

            {/* Chơi lại button after game ends (for winner / draw) */}
            {room.status === "finished" && !amLoser && (
              <button className="btn-reset" onClick={() => handleReset()}>↺ Chơi lại</button>
            )}
          </div>
        </div>

        {/* Row 2 — players */}
        <div className="header-row2">
          <div className="player-card p1-card">
            <span className="p-dot" />
            <span className="p-icon x-icon">✕</span>
            <span className="p-name">{p1?.name ?? "—"}</span>
            <span className="p-score">{room.scores[1]}</span>
          </div>
          <div className="vs-badge">VS</div>
          <div className="player-card p2-card">
            <span className="p-score">{room.scores[2]}</span>
            <span className="p-name">{p2?.name ?? "Chờ..."}</span>
            <span className="p-icon o-icon">○</span>
            <span className="p-dot" />
          </div>
        </div>
      </header>

      {/* ═══ CANVAS ═══ */}
      <div className="canvas-area">
        <GameCanvas
          board={room.board}
          onMove={handleMove}
          myPiece={myPiece}
          currentTurn={room.currentTurn}
          winLine={room.winLine}
          status={room.status}
          skin={activeSkin}
          aiHint={isThanhDat ? aiHint : null}
          danmakuMessages={danmakuMessages}
        />
      </div>

      {/* ═══ CHAT FAB ═══ */}
      <button className="chat-fab" onClick={() => setShowChat(v => !v)}>💬</button>
      {showChat && (
        <ChatPanel myName={myName} myPiece={myPiece}
          onSend={handleSendChat} onClose={() => setShowChat(false)} />
      )}

      {/* ═══ POST-GAME MODAL ═══ */}
      {showPostGame && room.status === "finished" && (
        <PostGameModal
          winner={room.winner}
          myPiece={myPiece}
          myName={myName}
          currentSkin={activeSkin}
          isLoser={amLoser}
          onPlayAgain={handleReset}
          onClose={() => setShowPostGame(false)}
        />
      )}
    </div>
  );
}
