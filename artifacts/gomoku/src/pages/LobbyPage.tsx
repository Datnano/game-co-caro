import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getSocket } from "@/lib/socket";

const SKINS = [
  { id: "classic", label: "Classic Glow" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "gold", label: "VIP Gold" },
  { id: "silver", label: "VIP Silver" },
];

export default function LobbyPage() {
  const [, navigate] = useLocation();
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("gomoku_name") || "");
  const [roomCode, setRoomCode] = useState("");
  const [skin, setSkin] = useState(() => localStorage.getItem("gomoku_skin") || "classic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedRoom = localStorage.getItem("gomoku_room");
    const savedSession = localStorage.getItem("gomoku_session");
    const savedName = localStorage.getItem("gomoku_name");
    if (savedRoom && savedSession && savedName) {
      setRoomCode(savedRoom);
    }
  }, []);

  function saveSkin(s: string) {
    setSkin(s);
    localStorage.setItem("gomoku_skin", s);
  }

  function createRoom() {
    if (!playerName.trim()) return setError("Vui lòng nhập tên của bạn");
    setLoading(true);
    setError("");

    const sessionId = localStorage.getItem("gomoku_session") || crypto.randomUUID();
    localStorage.setItem("gomoku_session", sessionId);
    localStorage.setItem("gomoku_name", playerName.trim());

    const socket = getSocket();
    socket.emit("create_room", { name: playerName.trim(), sessionId }, (res: any) => {
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
    setLoading(true);
    setError("");

    const sessionId = localStorage.getItem("gomoku_session") || crypto.randomUUID();
    localStorage.setItem("gomoku_session", sessionId);
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

  return (
    <div className="lobby-bg">
      <div className="stars" />
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-title">
            <span className="title-x">✕</span>
            <span className="title-main">CỜ CARO ONLINE</span>
            <span className="title-o">○</span>
          </div>
          <p className="lobby-sub">Gomoku Multiplayer · Không Gian Tối</p>

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

          <div className="form-group">
            <label className="form-label">Chọn Skin</label>
            <div className="skin-grid">
              {SKINS.map(s => (
                <button
                  key={s.id}
                  className={`skin-btn skin-${s.id} ${skin === s.id ? "active" : ""}`}
                  onClick={() => saveSkin(s.id)}
                >
                  <span className="skin-preview">
                    {s.id === "classic" && <><span style={{color:"#ff4444",textShadow:"0 0 8px #ff4444"}}>✕</span> <span style={{color:"#4488ff",textShadow:"0 0 8px #4488ff"}}>○</span></>}
                    {s.id === "cyberpunk" && <><span style={{color:"#ff00ff",textShadow:"0 0 8px #ff00ff"}}>⬡</span> <span style={{color:"#00ffff",textShadow:"0 0 8px #00ffff"}}>◈</span></>}
                    {s.id === "gold" && <><span style={{color:"#ffd700",textShadow:"0 0 8px #ffd700"}}>✕</span> <span style={{color:"#ffaa00",textShadow:"0 0 8px #ffaa00"}}>○</span></>}
                    {s.id === "silver" && <><span style={{color:"#c0c0c0",textShadow:"0 0 8px #ffffff"}}>✕</span> <span style={{color:"#a0a0a0",textShadow:"0 0 8px #d0d0d0"}}>○</span></>}
                  </span>
                  <span className="skin-name">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={createRoom}
            disabled={loading}
          >
            {loading ? "Đang tạo..." : "⚡ TẠO PHÒNG MỚI"}
          </button>

          <div className="divider"><span>hoặc tham gia</span></div>

          <div className="form-group">
            <label className="form-label">Mã phòng</label>
            <input
              className="form-input"
              placeholder="Nhập mã phòng (VD: DUSSRE)"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinRoom()}
              maxLength={8}
            />
          </div>

          <button
            className="btn-secondary"
            onClick={joinRoom}
            disabled={loading}
          >
            {loading ? "Đang vào..." : "🚀 THAM GIA PHÒNG"}
          </button>

          {error && <div className="error-msg">{error}</div>}
        </div>
      </div>
    </div>
  );
}
