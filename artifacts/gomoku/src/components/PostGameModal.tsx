import { useState } from "react";

const SKINS = [
  { id: "classic",  label: "Cổ Điển"         },
  { id: "cyberpunk",label: "Cyberpunk"        },
  { id: "gold",     label: "Vàng VIP"         },
  { id: "silver",   label: "Bạc VIP"          },
  { id: "element",  label: "🔥 & 💧 Nguyên Tố"},
];

const SKIN_COLORS: Record<string, { x: string; o: string; gx: string; go: string }> = {
  classic:  { x:"#ff3333", gx:"#990000",  o:"#3399ff", go:"#004499" },
  cyberpunk:{ x:"#ff00ff", gx:"#880088",  o:"#00ffff", go:"#007777" },
  gold:     { x:"#ffd700", gx:"#997700",  o:"#e07800", go:"#884400" },
  silver:   { x:"#d0d0d0", gx:"#888888",  o:"#6899cc", go:"#334d77" },
  element:  { x:"#ff5500", gx:"#cc2200",  o:"#0077ff", go:"#003399" },
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

export default function PostGameModal({ winner, myPiece, myName: _myName, currentSkin,
  isLoser, onPlayAgain, onClose }: Props) {
  const [selectedSkin, setSelectedSkin] = useState(currentSkin);
  const [goFirst, setGoFirst] = useState<boolean>(true);

  const isDraw   = winner === 0;
  const isWinner = !isDraw && winner === myPiece;

  function handlePlayAgain() {
    const firstPiece: 1|2|undefined = isLoser
      ? (goFirst ? myPiece : myPiece===1 ? 2 : 1)
      : undefined;
    onPlayAgain(firstPiece, selectedSkin);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-card">

        {/* Result */}
        <div className={`modal-result ${isDraw ? "draw" : isWinner ? "win" : "lose"}`}>
          <span className="result-emoji">{isDraw ? "🤝" : isWinner ? "🏆" : "💀"}</span>
          <span className="result-text">{isDraw ? "HOÀ!" : isWinner ? "BẠN THẮNG!" : "BẠN THUA!"}</span>
        </div>

        {/* Turn order choice (loser only) */}
        {isLoser && (
          <div className="modal-section">
            <div className="modal-section-title">Bạn muốn đi lượt nào?</div>
            <div className="order-choice">
              <button className={`order-btn ${goFirst ? "active" : ""}`} onClick={() => setGoFirst(true)}>
                <span className="order-icon">⚡</span>
                <span>Đi trước</span>
                <span className="order-sub">Giành lợi thế</span>
              </button>
              <button className={`order-btn ${!goFirst ? "active" : ""}`} onClick={() => setGoFirst(false)}>
                <span className="order-icon">🛡️</span>
                <span>Đi sau</span>
                <span className="order-sub">Phản công</span>
              </button>
            </div>
          </div>
        )}

        {/* Skin selector */}
        <div className="modal-section">
          <div className="modal-section-title">Chọn Skin ván mới</div>
          <div className="modal-skin-grid modal-skin-grid-5">
            {SKINS.map(s => {
              const c = SKIN_COLORS[s.id];
              const isElement = s.id === "element";
              return (
                <button key={s.id}
                  className={`modal-skin-btn ${selectedSkin===s.id ? "active" : ""}`}
                  onClick={() => setSelectedSkin(s.id)}>
                  <span className="modal-skin-preview">
                    {isElement ? (
                      <><span style={{fontSize:"1.0rem"}}>🔥</span>
                        <span style={{fontSize:"1.0rem"}}> 💧</span></>
                    ) : (
                      <><span style={{color:c.x, textShadow:`0 0 8px ${c.gx},0 0 16px ${c.gx}`}}>✕</span>
                        <span style={{color:c.o, textShadow:`0 0 8px ${c.go},0 0 16px ${c.go}`}}> ○</span></>
                    )}
                  </span>
                  <span className="modal-skin-name">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn-primary" onClick={handlePlayAgain}>↺ Chơi Ván Mới</button>
          <button className="btn-ghost" onClick={onClose}>Đóng</button>
        </div>

        {!isLoser && !isDraw && (
          <p className="modal-hint">Đang chờ người thua chọn...</p>
        )}
      </div>
    </div>
  );
}
