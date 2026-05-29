import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { getSocket } from "@/lib/socket";
import GameCanvas from "@/components/GameCanvas";
import ChatPanel, { ChatMsg } from "@/components/ChatPanel";
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
  boardSize: number;
  winCount: number;
  aiPiece: 0 | 1 | 2;
}

const TIME_OPTIONS = [15, 30, 60, 90, 120];

export default function GamePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = (params.roomId ?? "").toUpperCase();
  const [, navigate] = useLocation();

  const [room, setRoom]               = useState<GameRoom | null>(null);
  const [myPiece, setMyPiece]         = useState<1 | 2>(1);
  const [error, setError]             = useState("");
  const [aiHint, setAiHint]           = useState<[number, number] | null>(null);
  const [cheatActive, setCheatActive] = useState(false);
  const [showChat, setShowChat]       = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [showPostGame, setShowPostGame] = useState(false);
  const [timer, setTimer]             = useState(30);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [danmakuMessages, setDanmakuMessages] = useState<
    Array<{ id: string; text: string; color: string; y: number; startX: number }>
  >([]);

  const myName     = localStorage.getItem("gomoku_name") || "";
  const isThanhDat = myName === "Thành Đạt";
  const [activeSkin, setActiveSkin] = useState(localStorage.getItem("gomoku_skin") || "classic");
  const sessionId  = localStorage.getItem("gomoku_session") || "";

  const { playPlace, playWin, playLose, playChat, playTick, playConfirm } = useSound();

  const timeoutFiredRef = useRef(false);
  const joinedRef       = useRef(false);
  const prevStatusRef   = useRef<string>("");

  const isMyTurn = room?.status === "playing" && room.currentTurn === myPiece;
  const amLoser  = room?.status === "finished" && room.winner !== 0 && room.winner !== myPiece;
  const isVsAI   = (room?.aiPiece ?? 0) !== 0;

  // ── join room ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();

    socket.emit("join_room", { roomId, name: myName, sessionId }, (res: any) => {
      if (res.error) { setError(res.error); return; }
      setRoom(res.room);
      setMyPiece(res.piece);
    });

    socket.on("room_updated", (updated: GameRoom) => {
      setRoom(prev => {
        if (prev?.status === "playing" && updated.status === "playing"
            && prev.moveCount !== updated.moveCount) playPlace();
        if (prev?.status === "playing" && updated.status === "finished")
          setTimeout(() => setShowPostGame(true), 800);
        return updated;
      });
    });

    socket.on("chat_message", (data: { name: string; message: string; color: string; timestamp: number }) => {
      playChat();
      const id = crypto.randomUUID();
      setChatHistory(prev => [...prev.slice(-99), {
        id, name: data.name, text: data.message, color: data.color, ts: data.timestamp,
      }]);
      const canvasEl = document.querySelector(".game-canvas") as HTMLCanvasElement | null;
      const canvasH  = canvasEl?.clientHeight ?? 400;
      const y = 55 + Math.random() * (canvasH - 110);
      setDanmakuMessages(prev => [...prev.slice(-10), {
        id, text: `${data.name}: ${data.message}`,
        color: data.color, y, startX: window.innerWidth + 80,
      }]);
      setTimeout(() => setDanmakuMessages(prev => prev.filter(m => m.id !== id)), 7000);
    });

    return () => { socket.off("room_updated"); socket.off("chat_message"); };
  }, [roomId]);

  // ── win/lose sound ──────────────────────────────────────────────────────────
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

  // ── TIMER: reset when turn changes ─────────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    setTimer(room.turnTime);
    timeoutFiredRef.current = false;
  }, [room?.currentTurn, room?.id, room?.turnTime]);

  // ── TIMER: countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!room || room.status !== "playing") return;
    const myTurnNow = room.currentTurn === myPiece;
    const id = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(id);
          if (myTurnNow && !timeoutFiredRef.current) {
            timeoutFiredRef.current = true;
            getSocket().emit("skip_turn", { roomId, piece: myPiece });
          }
          return 0;
        }
        if (t <= 5 && myTurnNow) playTick();
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [room?.currentTurn, room?.status]);

  // ── AI hint refresh ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (cheatActive && room?.status === "playing" && isMyTurn) {
      getSocket().emit("get_ai_hint", { roomId, piece: myPiece }, (res: any) => {
        if (res?.move) setAiHint(res.move);
      });
    }
  }, [room?.moveCount, cheatActive, isMyTurn]);

  // ── handlers ────────────────────────────────────────────────────────────────
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
    } else { setCheatActive(false); setAiHint(null); }
  }, [cheatActive, isThanhDat, roomId, myPiece]);

  function handleReset(firstPiece?: 1 | 2, newSkin?: string) {
    if (newSkin) { localStorage.setItem("gomoku_skin", newSkin); setActiveSkin(newSkin); }
    setShowPostGame(false); setCheatActive(false); setAiHint(null);
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
        <h2>Lỗi kết nối</h2><p>{error}</p>
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
          <button className="lobby-back-btn" onClick={() => navigate("/")} title="Quay lại sảnh">
            ← Sảnh
          </button>

          {/* Only show room key badge in multiplayer */}
          {!isVsAI && (
            <div className="room-key-badge">
              <span className="badge-label">KEY</span>
              <span className="badge-sep">:</span>
              <span className="badge-value">{room.id}</span>
            </div>
          )}
          {isVsAI && (
            <div className="room-key-badge ai-badge">
              <span className="badge-value">🤖 AI</span>
            </div>
          )}

          <div className="header-spacer" />

          {/* Timer + turn status */}
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
                {room.winner === 0 ? "🤝 Hòa!" : room.winner === myPiece ? "🏆 Thắng!" : "💀 Thua!"}
              </span>
            )}
          </div>

          <div className="header-spacer" />

          {/* Actions */}
          <div className="header-actions">
            <div className="time-picker-wrap">
              <button className="icon-btn" onClick={() => setShowTimeMenu(v => !v)}>
                ⏱{room.turnTime}s
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

            {isThanhDat && (
              <button className={`cheat-btn ${cheatActive ? "active" : ""}`} onClick={handleCheat}>
                ⚡ CHEAT
              </button>
            )}

            {room.status === "finished" && !amLoser && (
              <button className="btn-reset" onClick={() => handleReset()}>↺ Lại</button>
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
          <div className="vs-badge">
            <span>VS</span>
            <span className="board-size-badge">{room.boardSize}×{room.boardSize}</span>
          </div>
          <div className="player-card p2-card">
            <span className="p-score">{room.scores[2]}</span>
            <span className="p-name">{p2?.name ?? (room.status === "waiting" ? "Chờ..." : "—")}</span>
            <span className="p-icon o-icon">○</span>
            <span className="p-dot" />
          </div>
        </div>
      </header>

      {/* ═══ CANVAS ═══ */}
      <div className="canvas-area">
        <GameCanvas
          board={room.board}
          boardSize={room.boardSize}
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

      {/* Chat FAB — hidden in AI mode */}
      {!isVsAI && (
        <button
          className={`chat-fab ${chatHistory.length > 0 && !showChat ? "has-msgs" : ""}`}
          onClick={() => setShowChat(v => !v)}
        >
          💬
          {chatHistory.length > 0 && !showChat && (
            <span className="chat-fab-count">{Math.min(chatHistory.length, 99)}</span>
          )}
        </button>
      )}

      {showChat && !isVsAI && (
        <ChatPanel
          myName={myName}
          myPiece={myPiece}
          history={chatHistory}
          onSend={handleSendChat}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Post-game modal */}
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
