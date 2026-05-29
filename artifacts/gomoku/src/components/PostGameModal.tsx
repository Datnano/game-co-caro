import { useState, useEffect } from "react";

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
  isVsAI: boolean;
  loserPiece: 0 | 1 | 2;
  players: Array<{ id: string; name: string; piece: 1 | 2 }>;
  onPlayAgain: (firstPiece?: 1 | 2, newSkin?: string) => void;
  onClose: () => void;
}

export default function PostGameModal({
  winner, myPiece, myName: _myName, currentSkin,
  isLoser, isVsAI, loserPiece, players,
  onPlayAgain, onClose,
}: Props) {
  const [selectedSkin, setSelectedSkin] = useState(currentSkin);
  const [goFirst, setGoFirst] = useState<boolean>(true);

  const isDraw   = winner === 0;
  const isWinner = !isDraw && winner === myPiece;

  // Winner: save skin choice immediately so it's ready when loser triggers reset
  useEffect(() => {
    if (isWinner && selectedSkin !== currentSkin) {
      localStorage.setItem("gomoku_skin", selectedSkin);
    }
  }, [selectedSkin, isWinner]);

  function handlePlayAgain() {
    const firstPiece: 1|2|undefined = isLoser
      ? (goFirst ? myPiece : myPiece===1 ? 2 : 1)
      : undefined;
    onPlayAgain(firstPiece, selectedSkin);
  }

  // Get the name of the loser (the person who needs to continue)
  const loserPlayer = players.find(p => p.piece === loserPiece);
  const loserName = loserPlayer?.name ?? "Người thua";

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-card">

        {/* Result */}
        <div className={`modal-result ${isDraw ? "draw" : isWinner ? "win" : "lose"}`}>
          <span className="result-emoji">{isDraw ? "🤝" : isWinner ? "🏆" : "💀"}</span>
          <span className="result-text">{isDraw ? "HOÀ!" : isWinner ? "BẠN THẮNG!" : "BẠN THUA!"}</span>
        </div>

        {/* LOSER: choose turn order + skin + play again */}
        {(isLoser || isDraw || isVsAI) && (
          <>
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

            <div className="modal-actions">
              <button className="btn-primary" onClick={handlePlayAgain}>↺ Chơi Ván Mới</button>
              <button className="btn-ghost" onClick={onClose}>Đóng</button>
            </div>
          </>
        )}

        {/* WINNER (multiplayer only): choose skin and wait */}
        {isWinner && !isVsAI && (
          <>
            <div className="modal-section">
              <div className="modal-section-title">Chọn Skin cho ván tiếp theo</div>
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

            <div className="winner-waiting">
              <div className="waiting-pulse" />
              <p className="waiting-text-msg">
                ⏳ Đang chờ <strong>{loserName}</strong> tiếp tục ván đấu...
              </p>
              <p className="waiting-sub">Chỉ người thua mới có thể bắt đầu ván mới</p>
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose}>Đóng</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
