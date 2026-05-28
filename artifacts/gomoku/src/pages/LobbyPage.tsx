import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getSocket } from "@/lib/socket";

const SKINS = [
  { id: "classic",   label: "Classic Glow",
    preview: <><span style={{color:"#ff3333",textShadow:"0 0 8px #ff3333"}}>✕</span><span style={{color:"#3399ff",textShadow:"0 0 8px #3399ff"}}> ○</span></> },
  { id: "cyberpunk", label: "Cyberpunk",
    preview: <><span style={{color:"#ff00ff",textShadow:"0 0 8px #ff00ff"}}>⬡</span><span style={{color:"#00ffff",textShadow:"0 0 8px #00ffff"}}> ◈</span></> },
  { id: "gold",      label: "VIP Gold",
    preview: <><span style={{color:"#ffd700",textShadow:"0 0 8px #ffd700"}}>✕</span><span style={{color:"#ff8c00",textShadow:"0 0 8px #ff8c00"}}> ○</span></> },
  { id: "silver",    label: "VIP Silver",
    preview: <><span style={{color:"#e8e8e8",textShadow:"0 0 8px #c0c0c0"}}>✕</span><span style={{color:"#b0b8c8",textShadow:"0 0 8px #9098a8"}}> ○</span></> },
];

const TIME_OPTIONS = [
  { value: 15,  label: "15s" },
  { value: 30,  label: "30s" },
  { value: 60,  label: "1 phút" },
  { value: 90,  label: "1.5 phút" },
  { value: 120, label: "2 phút" },
];

const BOARD_PRESETS = [
  { value: 3,  label: "3×3",  sub: "Tic-Tac-Toe" },
  { value: 5,  label: "5×5",  sub: "4 liên" },
  { value: 10, label: "10×10",sub: "5 liên" },
  { value: 20, label: "20×20",sub: "Classic" },
];

export default function LobbyPage() {
  const [, navigate] = useLocation();
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("gomoku_name") || "");
  const [roomCode, setRoomCode] = useState("");
  const [skin, setSkin] = useState(() => localStorage.getItem("gomoku_skin") || "classic");
  const [turnTime, setTurnTime] = useState(() => Number(localStorage.getItem("gomoku_turnTime") || "30"));
  const [boardSize, setBoardSize] = useState(() => Number(localStorage.getItem("gomoku_boardSize") || "20"));
  const [customSize, setCustomSize] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedRoom = localStorage.getItem("gomoku_room");
    if (savedRoom) setRoomCode(savedRoom);
  }, []);

  function saveSkin(s: string) { setSkin(s); localStorage.setItem("gomoku_skin", s); }
  function saveTurnTime(t: number) { setTurnTime(t); localStorage.setItem("gomoku_turnTime", String(t)); }
  function saveBoardSize(n: number) {
    const clamped = Math.min(Math.max(n, 3), 30);
    setBoardSize(clamped); localStorage.setItem("gomoku_boardSize", String(clamped));
  }

  function handleCustomSize() {
    const raw = customSize.trim();
    // accept "N" or "N,N" or "NxN"
    const match = raw.match(/^(\d+)[x,]?(\d*)$/i);
    if (!match) { setError("Nhập số ô hợp lệ, VD: 15 hoặc 15x15"); return; }
    const n = parseInt(match[1]);
    if (n < 3 || n > 30) { setError("Kích thước bàn cờ từ 3 đến 30"); return; }
    saveBoardSize(n);
    setShowCustom(false);
    setError("");
  }

  function getOrCreateSession() {
    let s = localStorage.getItem("gomoku_session");
    if (!s) { s = crypto.randomUUID(); localStorage.setItem("gomoku_session", s); }
    return s;
  }

  function createRoom() {
    if (!playerName.trim()) return setError("Vui lòng nhập tên của bạn");
    setLoading(true); setError("");
    const sessionId = getOrCreateSession();
    localStorage.setItem("gomoku_name", playerName.trim());
    const socket = getSocket();
    socket.emit("create_room", { name: playerName.trim(), sessionId, turnTime, boardSize }, (res: any) => {
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
    const sessionId = getOrCreateSession();
    localStorage.setItem("gomoku_name", playerName.trim());
    const socket = getSocket();
    socket.emit("join_room", { roomId: roomCode.trim().toUpperCase(), name: playerName.trim(), sessionId }, (res: any) => {
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
                <button key={s.id} className={`skin-btn ${skin === s.id ? "active" : ""}`} onClick={() => saveSkin(s.id)}>
                  <span className="skin-preview">{s.preview}</span>
                  <span className="skin-name">{s.label}</span>
                </button>
              ))}
            </div>
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
                <button
                  key={p.value}
                  className={`board-size-btn ${boardSize === p.value && !showCustom ? "active" : ""}`}
                  onClick={() => { saveBoardSize(p.value); setShowCustom(false); setError(""); }}
                >
                  <span className="bsz-label">{p.label}</span>
                  <span className="bsz-sub">{p.sub}</span>
                </button>
              ))}
              <button
                className={`board-size-btn custom-btn ${showCustom || (!selectedPreset) ? "active" : ""}`}
                onClick={() => setShowCustom(v => !v)}
              >
                <span className="bsz-label">Tùy chỉnh</span>
                <span className="bsz-sub">{!selectedPreset ? `${boardSize}×${boardSize}` : "x,x"}</span>
              </button>
            </div>
            {showCustom && (
              <div className="custom-size-row">
                <input
                  className="form-input custom-size-input"
                  placeholder="VD: 15 hoặc 15x15"
                  value={customSize}
                  onChange={e => setCustomSize(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCustomSize()}
                  maxLength={8}
                  autoFocus
                />
                <button className="btn-apply" onClick={handleCustomSize}>✓</button>
              </div>
            )}
          </div>

          {/* Turn time */}
          <div className="form-group">
            <label className="form-label">Thời gian mỗi lượt (khi tạo phòng)</label>
            <div className="time-grid">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`time-btn ${turnTime === opt.value ? "active" : ""}`}
                  onClick={() => saveTurnTime(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={createRoom} disabled={loading}>
            {loading ? "Đang tạo..." : "⚡ TẠO PHÒNG MỚI"}
          </button>

          <div className="divider"><span>hoặc tham gia phòng có sẵn</span></div>

          <div className="form-group">
            <label className="form-label">Mã phòng</label>
            <input
              className="form-input code-input"
              placeholder="VD: DUSSRE"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinRoom()}
              maxLength={8}
            />
          </div>

          <button className="btn-secondary" onClick={joinRoom} disabled={loading}>
            {loading ? "Đang vào..." : "🚀 THAM GIA PHÒNG"}
          </button>

          {error && <div className="error-msg">⚠ {error}</div>}
        </div>
      </div>
    </div>
  );
}
