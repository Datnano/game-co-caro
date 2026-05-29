import { useState } from "react";

const SKINS = [
  { id: "classic",   label: "Classic Glow"  },
  { id: "cyberpunk", label: "Cyberpunk"     },
  { id: "gold",      label: "VIP Gold"      },
  { id: "silver",    label: "VIP Silver"    },
  { id: "fire",      label: "🔥 Lửa"        },
  { id: "water",     label: "💧 Nước"       },
];

const SKIN_COLORS: Record<string, { x: string; o: string; gx?: string; go?: string }> = {
  classic:  { x: "#ff3333", o: "#3399ff" },
  cyberpunk:{ x: "#ff00ff", o: "#00ffff" },
  gold:     { x: "#ffd700", o: "#ff8c00" },
  silver:   { x: "#e0e0e0", o: "#b0b8c8" },
  fire:     { x: "#ff5500", o: "#ff8800", gx: "#ff3300", go: "#ffcc00" },
  water:    { x: "#00aaff", o: "#0055ff", gx: "#003388", go: "#66ccff" },
};

interface Props {
  winner: 0 | 1 | 2;
  myPiece: 1 | 2;
  myName: string;
  currentSkin: string;
  isLoser: boolean;
  onPlayAgain: (firstPiece?: 1 | 2, newSkin?: string) => void;
  onClose: () => void;
}

export default function PostGameModal({ winner, myPiece, myName, currentSkin, isLoser, onPlayAgain, onClose }: Props) {
  const [selectedSkin, setSelectedSkin] = useState(currentSkin);
  const [goFirst, setGoFirst] = useState<boolean>(true); // loser's choice

  const isDraw = winner === 0;
  const isWinner = !isDraw && winner === myPiece;

  function handlePlayAgain() {
    // loser sends their preference; winner just restarts normally
    const firstPiece: 1 | 2 | undefined = isLoser
      ? (goFirst ? myPiece : (myPiece === 1 ? 2 : 1))
      : undefined;
    onPlayAgain(firstPiece, selectedSkin);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        {/* Result banner */}
        <div className={`modal-result ${isDraw ? "draw" : isWinner ? "win" : "lose"}`}>
          <span className="result-emoji">
            {isDraw ? "🤝" : isWinner ? "🏆" : "💀"}
          </span>
          <span className="result-text">
            {isDraw ? "HOÀ!" : isWinner ? "BẠN THẮNG!" : "BẠN THUA!"}
          </span>
        </div>

        {/* Loser's turn order choice */}
        {isLoser && (
          <div className="modal-section">
            <div className="modal-section-title">Bạn muốn đi lượt nào?</div>
            <div className="order-choice">
              <button
                className={`order-btn ${goFirst ? "active" : ""}`}
                onClick={() => setGoFirst(true)}
              >
                <span className="order-icon">⚡</span>
                <span>Đi trước</span>
                <span className="order-sub">Giành lợi thế</span>
              </button>
              <button
                className={`order-btn ${!goFirst ? "active" : ""}`}
                onClick={() => setGoFirst(false)}
              >
                <span className="order-icon">🛡️</span>
                <span>Đi sau</span>
                <span className="order-sub">Phản công</span>
              </button>
            </div>
          </div>
        )}

        {/* Skin selector */}
        <div className="modal-section">
          <div className="modal-section-title">Chọn Skin</div>
          <div className="modal-skin-grid modal-skin-grid-6">
            {SKINS.map(s => {
              const c = SKIN_COLORS[s.id];
              const glowX = c.gx ?? c.x;
              const glowO = c.go ?? c.o;
              return (
                <button
                  key={s.id}
                  className={`modal-skin-btn ${selectedSkin === s.id ? "active" : ""}`}
                  onClick={() => setSelectedSkin(s.id)}
                >
                  <span className="modal-skin-preview">
                    <span style={{ color: c.x, textShadow: `0 0 8px ${glowX}, 0 0 16px ${glowX}` }}>✕</span>
                    <span style={{ color: c.o, textShadow: `0 0 8px ${glowO}, 0 0 16px ${glowO}` }}> ○</span>
                  </span>
                  <span className="modal-skin-name">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn-primary" onClick={handlePlayAgain}>
            ↺ Chơi Ván Mới
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Đóng
          </button>
        </div>

        {!isLoser && !isDraw && (
          <p className="modal-hint">Đang chờ người thua chọn...</p>
        )}
      </div>
    </div>
  );
}
