# Cờ Caro Online (Gomoku Multiplayer)

Game cờ caro online nhiều người chơi với chủ đề không gian tối, hiệu ứng neon phát sáng, chat danmaku và AI cheat bí mật.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API + Socket.io server (port 8080)
- `pnpm --filter @workspace/gomoku run dev` — run the React frontend (port 23990)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Socket.io (real-time multiplayer)
- Frontend: React + Vite + HTML5 Canvas
- DB: Not used (in-memory game state)
- Validation: Zod (`zod/v4`)

## Where things live

- `artifacts/api-server/src/game.ts` — game logic, room management, win detection, AI algorithm
- `artifacts/api-server/src/socketHandler.ts` — Socket.io event handlers
- `artifacts/gomoku/src/pages/LobbyPage.tsx` — room create/join lobby
- `artifacts/gomoku/src/pages/GamePage.tsx` — main game page, timer, cheat logic
- `artifacts/gomoku/src/components/GameCanvas.tsx` — HTML5 Canvas board renderer (60fps RAF loop)
- `artifacts/gomoku/src/components/ChatPanel.tsx` — danmaku chat UI
- `artifacts/gomoku/src/hooks/useSound.ts` — Web Audio API sound effects

## Architecture decisions

- Socket.io path: `/api/socket.io` (prefixed under /api so shared proxy routes correctly)
- Game state is in-memory on the server (Map of rooms); rooms auto-cleanup after 2 hours
- Canvas rendering uses requestAnimationFrame loop for smooth 60fps danmaku and pulsing effects
- AI cheat hint is only shown client-side to the requesting player (server just returns the move)
- Loser-goes-first logic tracks `lastLoser` per room to set `currentTurn` on reset

## Product

- Create or join a room with a 6-character code
- 20×20 board with coordinate labels (A–T, 1–20)
- 4 visual skins: Classic Glow, Cyberpunk, VIP Gold, VIP Silver
- Timer per turn with urgent countdown sound
- Danmaku chat: messages fly across the board canvas in real-time
- Secret AI cheat: player named "Thành Đạt" → CHEAT button → glowing AI hint appears
- Score tracking across rounds; loser goes first next round

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Socket.io path must be `/api/socket.io` — shared proxy only forwards /api/* paths
- Artifact.toml for api-server must list `/api/socket.io` in paths array for WS to work
- Do NOT use `pnpm run dev` at workspace root — use workflow restart instead
- Game rooms are in-memory only; server restart clears all rooms

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
