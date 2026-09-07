import { io, type Socket } from "socket.io-client";
import { getWsBase } from "@/lib/ws-base";

let _socket: Socket | null = null;
let _holderCount = 0;
let _authListenerAttached = false;
let _lastToken: string | null = null;

function currentToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem("accessToken")
    : null;
}

function reconnectChatSocket(socket: Socket): void {
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
}

function attachAuthListener(): void {
  if (_authListenerAttached || typeof window === "undefined") return;
  _authListenerAttached = true;

  window.addEventListener("auth-change", () => {
    if (!_socket) return;
    const nextToken = currentToken();
    if (!nextToken) {
      _lastToken = null;
      _socket.disconnect();
      return;
    }
    const tokenChanged = _lastToken !== nextToken;
    _lastToken = nextToken;
    _socket.auth = { token: nextToken };
    if (tokenChanged || !_socket.connected) {
      reconnectChatSocket(_socket);
    }
  });
}

function createSocket(token: string): Socket {
  return io(`${getWsBase()}/chat`, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
}

/**
 * Shared /chat socket per tab. Multiple consumers (chat panel, staff alerts)
 * reuse one connection instead of opening duplicates.
 */
export function acquireChatSocket(): Socket | null {
  const token = currentToken();
  if (!token) return null;

  const tokenChanged = Boolean(_lastToken && _lastToken !== token);
  _lastToken = token;

  if (!_socket) {
    _socket = createSocket(token);
    attachAuthListener();
  } else {
    _socket.auth = { token };
    if (tokenChanged && _socket.connected) {
      reconnectChatSocket(_socket);
    } else if (!_socket.connected) {
      _socket.connect();
    }
  }

  _holderCount += 1;
  return _socket;
}

/** Release a prior acquireChatSocket() holder; disconnect when none remain. */
export function releaseChatSocket(): void {
  _holderCount = Math.max(0, _holderCount - 1);
  if (_holderCount === 0 && _socket) {
    _socket.disconnect();
    _socket = null;
    _lastToken = null;
  }
}

/** @deprecated Prefer acquireChatSocket / releaseChatSocket. */
export function createChatSocket(token: string): Socket {
  const socket = acquireChatSocket();
  if (!socket) {
    throw new Error("Chat socket requires an access token");
  }
  if (token) {
    socket.auth = { token };
  }
  return socket;
}

function waitForSocketConnected(
  socket: Socket,
  maxWaitMs: number,
): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      handler();
    };

    const timer = window.setTimeout(() => {
      finish(() => {
        reject(new Error("Chat socket connection timed out"));
      });
    }, maxWaitMs);

    const onConnect = () => {
      finish(resolve);
    };

    const onConnectError = () => {
      /* keep waiting until timeout — reconnection may retry */
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
    if (!socket.active) {
      socket.connect();
    }
  });
}

/** NestJS WebSocket acks work with callback-style emit, not emitWithAck. */
export async function socketEmitAck<T>(
  socket: Socket,
  event: string,
  payload?: unknown,
  timeoutMs = 12_000,
): Promise<T> {
  const connectWaitMs = Math.min(4_000, Math.max(1_000, timeoutMs - 2_000));
  try {
    await waitForSocketConnected(socket, connectWaitMs);
  } catch {
    throw new Error(`Chat socket is not connected (${event})`);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      socket.off("disconnect", onDisconnect);
      handler();
    };

    const timer = window.setTimeout(() => {
      finish(() => {
        reject(new Error(`Chat request timed out (${event})`));
      });
    }, timeoutMs);

    const onDisconnect = () => {
      finish(() => {
        reject(new Error(`Chat socket disconnected (${event})`));
      });
    };

    socket.once("disconnect", onDisconnect);
    socket.emit(event, payload ?? {}, (response: T) => {
      finish(() => {
        resolve(response);
      });
    });
  });
}
