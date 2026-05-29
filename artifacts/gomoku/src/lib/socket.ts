import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || socket.disconnected) {
    socket = io({
      path: "/api/socket.io",
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 5000,
      forceNew: false,
    });

    socket.on("connect", () => {
      console.log("[socket] connected", socket?.id);
    });
    socket.on("disconnect", (reason) => {
      console.warn("[socket] disconnected", reason);
    });
    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error", err.message);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
