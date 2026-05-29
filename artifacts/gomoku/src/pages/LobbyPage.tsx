import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getSocket } from "@/lib/socket";

const SKINS = [
  { id: "classic",
    label: "Cổ Điển",
    preview: (
      <><span style={{color:"#ff3333",textShadow:"0 0 10px #990000"}}>✕</span>
        <span style={{color:"#3399ff",textShadow:"0 0 10px #004499"}}> ○</span></>
    ),
  },
  { id: "cyberpunk",
    label: "Cyberpunk",
    preview: (
      <><span style={{color:"#ff00ff",textShadow:"0 0 10px #880088"}}>⬡</span>
        <span style={{color:"#00ffff",textShadow:"0 0 10px #007777"}}> ◈</span></>
    ),
  },
  { id: "gold",
    label: "Vàng VIP",
    preview: (
      <><span style={{color:"#ffd700",textShadow:"0 0 10px #997700"}}>✕</span>
        <span style={{color:"#e07800",textShadow:"0 0 10px #884400"}}> ○</span></>
    ),
  },
  { id: "silver",
    label: "Bạc VIP",
    preview: (
      <><span style={{color:"#d0d0d0",textShadow:"0 0 10px #888888"}}>✕</span>
        <span style={{color:"#6899cc",textShadow:"0 0 10px #334d77"}}> ○</span></>
    ),
  },
  { id: "element",
    label: "🔥 & 💧 Nguyên Tố",
    preview: <><span style={{fontSize:"1.1rem"}}>🔥</span><span style={{fontSize:"1.1rem"}}> 💧</span></>,
  },
];

const TIME_OPTIONS = [
  { value: 15,  label: "15s" },
  { value: 30,  label: "30s" },
  { value: 60,  label: "1 phút" },
  { value: 90,  label: "1.5 phút" },
  { value: 120, label: "2 phút" },
];

const BOARD_PRESETS = [
  { value: 3,  label: "3×3",   sub: "Tic-Tac-Toe" },
  { value: 5,  label: "5×5",   sub: "4 liên" },
  { value: 10, label: "10×10", sub: "5 liên" },
  { value: 20, label: "20×20", sub: "Classic" },
];

const AI_DIFFICULTIES = [
  { value: "easy",   label: "🟢 Dễ",        sub: "Người mới" },
  { value: "medium", label: "🟡 Trung Bình", sub: "Có suy nghĩ" },
  { value: "hard",   label: "🔴 Khó",        sub: "AI mạnh" },
] as const;

type AIDifficulty = "easy" | "medium" | "hard";

export default function LobbyPage() {
  const [, navigate] = useLocation();
  const [playerName, setPlayerName]   = useState(() => localStorage.getItem("gomoku_name") || "");
  const [roomCode, setRoomCode]       = useState("");
  const [skin, setSkin]               = useState(() => localStorage.getItem("gomoku_skin") || "classic");
  const [turnTime, setTurnTime]       = useState(() => Number(localStorage.getItem("gomoku_turnTime") || "30"));
  const [boardSize, setBoardSize]     = useState(() => Number(localStorage.getItem("gomoku_boardSize") || "20"));
  const [customSize, setCustomSize]   = useState("");
  const [showCustom, setShowCustom]   = useState(false);
  const [vsAI, setVsAI]               = useState(false);
  const [aiDiff, setAiDiff]           = useState<AIDifficulty>("medium");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gomoku_room");
    if (saved) setRoomCode(saved);
  }, []);

  function saveSkin(s: string) { setSkin(s); localStorage.setItem("gomoku_skin", s); }
  function saveTurnTime(t: number) { setTurnTime(t); localStorage.setItem("gomoku_turnTime", String(t)); }
  function saveBoardSize(n: number) {
    const v = Math.min(Math.max(n, 3), 30);
    setBoardSize(v); localStorage.setItem("gomoku_boardSize", String(v));
  }

  function handleCustomSize() {
    const match = customSize.trim().match(/^(\d+)[x,]?(\d*)$/i);
    if (!match) { setError("Nhập số ô hợp lệ, VD: 15 hoặc 15x15"); return; }
    const n = parseInt(match[1]);
    if (n < 3 || n > 30) { setError("Kích thước từ 3 đến 30"); return; }
    saveBoardSize(n); setShowCustom(false); setError("");
  }

  function getOrCreateSession() {
    let s = localStorage.getItem("gomoku_session");
    if (!s) { s = crypto.randomUUID(); localStorage.setItem("gomoku_session", s); }
    return s;
  }

  function createRoom() {
    if (!playerName.trim()) return setError("Vui lòng nhập tên của bạn");
    setLoading(true); setError("");
    localStorage.setItem("gomoku_name", playerName.trim());
    const socket = getSocket();
    socket.emit("create_room", {
      name: playerName.trim(),
      sessionId: getOrCreateSession(),
      turnTime, boardSize,
      aiDifficulty: vsAI ? aiDiff : undefined,
    }, (res: any) => {
      setLoading(false);
      if (res.error) return setError(res.error);
      localStorage.setItem("gomoku_room", res.room.id);
      localStorage.setItem("gomoku_piece", String(res.piece));
      navigate(`/game/${res.room.id}`);
    });
  }

  function joinRoom() {
    if (!playerName.trim()) return setError("Vui lòng nhập tên của bạn");
    if (!roomCode.trim()) return setError("Vui lòng nhập mã phòng");
    setLoading(true); setError("");
    localStorage.setItem("gomoku_name", playerName.trim());
    const socket = getSocket();
    socket.emit("join_room", {
      roomId: roomCode.trim().toUpperCase(),
      name: playerName.trim(),
      sessionId: getOrCreateSession(),
    }, (res: any) => {
      setLoading(false);
      if (res.error) return setError(res.error);
      localStorage.setItem("gomoku_room", res.room.id);
      localStorage.setItem("gomoku_piece", String(res.piece));
      navigate(`/game/${res.room.id}`);
    });
  }

  const winCount = boardSize <= 3 ? 3 : boardSize <= 4 ? 4 : 5;
  const selectedPreset = BOARD_PRESETS.find(p => p.value === boardSize);

  return (
    <div className="lobby-bg">
      <div className="stars" />
      <div className="lobby-scroll">
        <div className="lobby-card">

          <div className="lobby-title">
            <span className="title-x">✕</span>
            <span className="title-main">CỜ CARO ONLINE</span>
            <span className="title-o">○</span>
          </div>
          <p className="lobby-sub">Gomoku Multiplayer · Không Gian Tối</p>

          {/* Player name */}
          <div className="form-group">
            <label className="form-label">Tên của bạn</label>
            <input
              className="form-input"
              placeholder="Nhập tên người chơi..."
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createRoom()}
              maxLength={20}
            />
          </div>

          {/* Skin selector */}
          <div className="form-group">
            <label className="form-label">Skin</label>
            <div className="skin-grid">
              {SKINS.map(s => (
                <button key={s.id} className={`skin-btn ${skin === s.id ? "active" : ""}`}
                  onClick={() => saveSkin(s.id)}>
                  <span className="skin-preview">{s.preview}</span>
                  <span className="skin-name">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* VS AI toggle */}
          <div className="form-group">
            <label className="form-label">Chế độ chơi</label>
            <div className="mode-row">
              <button className={`mode-btn ${!vsAI ? "active" : ""}`} onClick={() => setVsAI(false)}>
                👥 Nhiều người
              </button>
              <button className={`mode-btn ${vsAI ? "active" : ""}`} onClick={() => setVsAI(true)}>
                🤖 Đấu với AI
              </button>
            </div>
            {vsAI && (
              <div className="ai-diff-grid">
                {AI_DIFFICULTIES.map(d => (
                  <button key={d.value}
                    className={`ai-diff-btn ${aiDiff === d.value ? "active" : ""}`}
                    onClick={() => setAiDiff(d.value)}>
                    <span className="ai-diff-label">{d.label}</span>
                    <span className="ai-diff-sub">{d.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Board size */}
          <div className="form-group">
            <label className="form-label">
              Kích thước bàn cờ
              <span className="label-hint">
                {` — ${boardSize}×${boardSize}${winCount < 5 ? `, thắng ${winCount} liên` : ", thắng 5 liên"}`}
              </span>
            </label>
            <div className="board-size-grid">
              {BOARD_PRESETS.map(p => (
                <button key={p.value}
                  className={`board-size-btn ${boardSize === p.value && !showCustom ? "active" : ""}`}
                  onClick={() => { saveBoardSize(p.value); setShowCustom(false); setError(""); }}>
                  <span className="bsz-label">{p.label}</span>
                  <span className="bsz-sub">{p.sub}</span>
                </button>
              ))}
              <button
                className={`board-size-btn custom-btn ${showCustom || !selectedPreset ? "active" : ""}`}
                onClick={() => setShowCustom(v => !v)}>
                <span className="bsz-label">Tùy chỉnh</span>
                <span className="bsz-sub">{!selectedPreset ? `${boardSize}×${boardSize}` : "x,x"}</span>
              </button>
            </div>
            {showCustom && (
              <div className="custom-size-row">
                <input className="form-input custom-size-input"
                  placeholder="VD: 15 hoặc 15x15"
                  value={customSize}
                  onChange={e => setCustomSize(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCustomSize()}
                  maxLength={8} autoFocus />
                <button className="btn-apply" onClick={handleCustomSize}>✓</button>
              </div>
            )}
          </div>

          {/* Turn time */}
          <div className="form-group">
            <label className="form-label">Thời gian mỗi lượt</label>
            <div className="time-grid">
              {TIME_OPTIONS.map(opt => (
                <button key={opt.value}
                  className={`time-btn ${turnTime === opt.value ? "active" : ""}`}
                  onClick={() => saveTurnTime(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={createRoom} disabled={loading}>
            {loading ? "Đang tạo..." : vsAI ? "🤖 CHƠI VỚI AI" : "⚡ TẠO PHÒNG MỚI"}
          </button>

          {!vsAI && (
            <>
              <div className="divider"><span>hoặc tham gia phòng có sẵn</span></div>
              <div className="form-group">
                <label className="form-label">Mã phòng</label>
                <input className="form-input code-input"
                  placeholder="VD: DUSSRE"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && joinRoom()}
                  maxLength={8} />
              </div>
              <button className="btn-secondary" onClick={joinRoom} disabled={loading}>
                {loading ? "Đang vào..." : "🚀 THAM GIA PHÒNG"}
              </button>
            </>
          )}

          {error && <div className="error-msg">⚠ {error}</div>}
        </div>
      </div>
    </div>
  );
}
