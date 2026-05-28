import { useState, useRef, useEffect } from "react";

const EMOJIS = ["😄", "😂", "🔥", "💪", "👏", "😈", "🤯", "💀", "🎉", "⚡"];
const COLORS = ["#ff4444", "#4488ff", "#44ff88", "#ffaa00", "#ff44ff", "#00ffff", "#ffffff", "#ff8800"];

export interface ChatMsg {
  id: string; name: string; text: string; color: string; ts: number;
}

interface Props {
  myName: string;
  myPiece: 1 | 2;
  history: ChatMsg[];
  onSend: (message: string, color: string) => void;
  onClose: () => void;
}

export default function ChatPanel({ myName, myPiece, history, onSend, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [color, setColor] = useState(myPiece === 1 ? "#ff4444" : "#4488ff");
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyRef.current)
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [history]);

  function send() {
    if (!message.trim()) return;
    onSend(message.trim(), color);
    setMessage("");
  }

  function fmt(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>💬 Chat</span>
        <button className="chat-close" onClick={onClose}>✕</button>
      </div>

      {/* History */}
      <div className="chat-history" ref={historyRef}>
        {history.length === 0
          ? <span className="chat-empty">Chưa có tin nhắn nào...</span>
          : history.map(msg => (
            <div key={msg.id} className={`chat-msg ${msg.name === myName ? "mine" : "theirs"}`}>
              <span className="chat-name" style={{ color: msg.color }}>{msg.name}</span>
              <span className="chat-bubble" style={{ borderColor: msg.color + "55" }}>
                {msg.text}
              </span>
              <span className="chat-time">{fmt(msg.ts)}</span>
            </div>
          ))}
      </div>

      <div className="color-row">
        {COLORS.map(c => (
          <button
            key={c}
            className={`color-dot ${color === c ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <div className="emoji-row">
        {EMOJIS.map(e => (
          <button key={e} className="emoji-btn" onClick={() => setMessage(prev => prev + e)}>
            {e}
          </button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="Nhập tin nhắn..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          maxLength={60}
          autoFocus
        />
        <button className="chat-send" onClick={send} style={{ color }}>➤</button>
      </div>
    </div>
  );
}
