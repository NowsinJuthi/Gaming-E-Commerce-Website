import { io, type Socket } from "socket.io-client";
import { getWsBase } from "@/lib/ws-base";

let _socket: Socket | null = null;

export function getLiveAnalyticsSocket(): Socket {
  if (_socket) return _socket;

  _socket = io(`${getWsBase()}/live-analytics`, {
    withCredentials: true,
    auth: {},
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
  });

  if (typeof window !== "undefined") {
    window.addEventListener("auth-change", () => {
      if (!_socket) return;
      _socket.auth = {};
      if (!_socket.connected) {
        _socket.connect();
      } else {
        _socket.disconnect().connect();
      }
    });
  }

  return _socket;
}
