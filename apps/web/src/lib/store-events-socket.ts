/**
 * Singleton Socket.IO connection for the /events namespace.
 *
 * Rules:
 * - One socket per browser tab — module-level variable ensures this.
 * - JWT is optional: unauthenticated clients still receive events (useful for
 *   the storefront).  If a token IS supplied and it is invalid the server
 *   disconnects the client immediately.
 * - Automatically syncs the token on `auth-change` events (login / logout).
 * - Never imported on the server — all callsites guard with "use client".
 */
import { io, type Socket } from "socket.io-client";
import { getWsBase } from "@/lib/ws-base";

// ── Module-level singleton ─────────────────────────────────────────────────

let _socket: Socket | null = null;
let _authChangeListenerAttached = false;

function currentToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem("accessToken")
    : null;
}

/**
 * Returns the singleton /events socket, creating it on first call.
 *
 * Safe to call multiple times — always returns the same instance within a
 * browser tab.  Do NOT call this during SSR.
 */
export function getStoreEventsSocket(): Socket {
  if (_socket) return _socket;

  const token = currentToken();

  _socket = io(`${getWsBase()}/events`, {
    // Pass token if available; omit key if anonymous so the server doesn't
    // attempt to validate an empty string.
    auth: token ? { token } : {},
    // websocket-only avoids the HTTP polling round-trip on every navigation.
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    // Exponential back-off factor.
    randomizationFactor: 0.5,
  });

  // Attach auth-change listener only once to avoid stacking on HMR.
  if (!_authChangeListenerAttached) {
    _authChangeListenerAttached = true;
    window.addEventListener("auth-change", () => {
      if (!_socket) return;
      const nextToken = currentToken();
      _socket.auth = nextToken ? { token: nextToken } : {};
      // Reconnect so the server validates the updated credentials.
      if (!_socket.connected) {
        _socket.connect();
      } else {
        // Cycle the connection to trigger a fresh handshake with new token.
        _socket.disconnect().connect();
      }
    });
  }

  return _socket;
}

/**
 * Tear down the singleton.  Call only if you know no other component needs
 * the socket (e.g. during testing or intentional cleanup).
 */
export function disconnectStoreEventsSocket(): void {
  if (!_socket) return;
  _socket.disconnect();
  _socket = null;
}
