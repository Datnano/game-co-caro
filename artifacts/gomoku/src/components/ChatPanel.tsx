import { useState } from "react";

const EMOJIS = ["😄", "😂", "🔥", "💪", "👏", "😈", "🤯", "💀", "🎉", "⚡"];
const COLORS = ["#ff4444", "#4488ff", "#44ff88", "#ffaa00", "#ff44ff", "#00ffff", "#ffffff", "#ff8800"];

interface Props {
  myName: string;
  myPiece: 1 | 2;
  onSend: (message: string, color: string) => void;
  onClose: () => void;
}

export default function ChatPanel({ myName, myPiece, onSend, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [color, setColor] = useState(myPiece === 1 ? "#ff4444" : "#4488ff");

  function send() {
    if (!message.trim()) return;
    onSend(message.trim(), color);
    setMessage("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>💬 Danmaku Chat</span>
        <button className="chat-close" onClick={onClose}>✕</button>
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
          <button
            key={e}
            className="emoji-btn"
            onClick={() => setMessage(prev => prev + e)}
          >
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
          maxLength={50}
          autoFocus
        />
        <button className="chat-send" onClick={send} style={{ color }}>
          ➤
        </button>
      </div>
    </div>
  );
}
