/**
 * socket-live-games.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time Socket.IO connection manager for live games, scores, odds, and status.
 *
 * Targets:
 * - liveGamesBaseUrl: wss://socket.smbet.net
 *
 * Listens for:
 * - 'buffers': Base64 protobuf-encoded live game updates (bet720_protocol_buffers.Event).
 * - 'expired-key': IDs of live games to remove.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { io, Socket } from "socket.io-client";
import protobuf from "protobufjs";
import { API_CONFIG } from "./api-config";
import { adaptLiveGame, type LiveSocketGameRaw } from "./matches-adapter";
import type { Match } from "./betting-data";

export type LiveSocketStatus = "connecting" | "connected" | "disconnected" | "error";

type LiveGamesListener = (matches: Match[]) => void;
type StatusListener = (status: LiveSocketStatus) => void;

const PROTO_SCHEMA = `
syntax = "proto3";
package bet720_protocol_buffers;

message Odd {
    int32 b             = 1;
    double v            = 2;
    double lv           = 3;
    string n            = 4;
}

message Market {
    int32 b              = 1;
    int32 r              = 2;
    string n             = 3;
    optional double h    = 4;
    repeated Odd o      = 101;
}

message Scores {
    repeated int32 corner           = 101 [packed = true];
    repeated int32 freeKick         = 102 [packed = true];
    repeated int32 goal             = 103 [packed = true];
    repeated int32 goalKick         = 104 [packed = true];
    repeated int32 h1               = 105 [packed = true];
    repeated int32 offside          = 106 [packed = true];
    repeated int32 penalty          = 107 [packed = true];
    repeated int32 redCard          = 108 [packed = true];
    repeated int32 substitution     = 109 [packed = true];
    repeated int32 throwIn          = 110 [packed = true];
    repeated int32 yellowCard       = 111 [packed = true];
}

message Team {
    string n                = 1;
}

message Game {
    int32 b                                       = 1;
    int32 flg                                     = 2;
    int32 bm                                      = 3;
    int32 std                                     = 4;
    int32 tm                                      = 5;
    int32 p                                       = 6;
    int32 cd                                      = 7;
    string st                                     = 8;
    string stn                                    = 9;
    string inf                                    = 10;
    string tss                                    = 11;
    Scores sc                                     = 51;
    Team t1                                       = 52;
    Team t2                                       = 53;
    repeated Market bt                            = 101;
}

message Event {
    optional int32 bmId              = 1;
    optional int32 flg               = 2;
    optional string C                = 3;
    optional string cmd              = 4;
    optional string eId              = 5;
    optional string p                = 6;
    string dt                        = 7;
    repeated Game obj                = 101;
}
`;

function decodeBase64ToUint8Array(input: unknown): Uint8Array | null {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof input === "string") {
    try {
      if (typeof window !== "undefined" && typeof window.atob === "function") {
        const binaryStr = window.atob(input);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes;
      }
      if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(input, "base64"));
      }
    } catch {
      return null;
    }
  }
  return null;
}

class LiveGamesSocketManager {
  private socket: Socket | null = null;
  private status: LiveSocketStatus = "disconnected";
  private liveMatchesMap = new Map<string, Match>();
  private matchListeners = new Set<LiveGamesListener>();
  private statusListeners = new Set<StatusListener>();
  private eventType: protobuf.Type | null = null;

  private clockInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    try {
      const root = protobuf.parse(PROTO_SCHEMA).root;
      this.eventType = root.lookupType("bet720_protocol_buffers.Event");
    } catch (err) {
      console.warn("[Live Socket] Protobuf schema initialization warning:", err);
    }
    this.startClockTicker();
    this.startAutoSyncTicker();
  }

  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;

  private startAutoSyncTicker() {
    if (typeof window === "undefined" || this.autoSyncInterval) return;
    this.autoSyncInterval = setInterval(() => {
      if (this.socket && this.matchListeners.size > 0) {
        // Continuous live background sync so odds are always fresh
        this.requestRefresh();
      }
    }, 15000);
  }

  private startClockTicker() {
    if (typeof window === "undefined" || this.clockInterval) return;
    this.clockInterval = setInterval(() => {
      let updated = false;
      for (const [id, m] of this.liveMatchesMap.entries()) {
        if (m.live && m.live.minute < 95) {
          this.liveMatchesMap.set(id, {
            ...m,
            live: {
              ...m.live,
              minute: m.live.minute + 1,
            },
          });
          updated = true;
        }
      }
      if (updated) {
        this.broadcastMatches();
      }
    }, 60000);
  }

  public init() {
    if (this.socket || typeof window === "undefined") return;

    this.updateStatus("connecting");

    try {
      // Connect to liveGamesBaseUrl using websocket transport
      const socketUrl = API_CONFIG.liveGamesBaseUrl
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");

      this.socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 2000,
        timeout: 15000,
      });

      this.socket.on("connect", () => {
        this.updateStatus("connected");
      });

      this.socket.on("disconnect", () => {
        this.updateStatus("disconnected");
      });

      this.socket.on("connect_error", (err) => {
        console.warn("[Live Socket] Connection error:", err.message);
        this.updateStatus("error");
      });

      // Handle 'buffers' live games feed
      this.socket.on("buffers", (payload: unknown) => {
        this.handleBuffers(payload);
      });

      // Handle 'expired-key' live games removal
      this.socket.on("expired-key", (expiredId: unknown) => {
        this.handleExpiredKey(expiredId);
      });
    } catch (err) {
      console.warn("[Live Socket] Initialization error:", err);
      this.updateStatus("error");
    }
  }

  private updateStatus(newStatus: LiveSocketStatus) {
    this.status = newStatus;
    for (const listener of this.statusListeners) {
      try {
        listener(newStatus);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private handleBuffers(payload: unknown) {
    try {
      if (!payload) return;

      // 1. Try Protobuf decoding first
      const bytes = decodeBase64ToUint8Array(payload);
      if (bytes && this.eventType) {
        try {
          const decoded = this.eventType.decode(bytes);
          const eventObj = this.eventType.toObject(decoded, {
            arrays: true,
            objects: true,
            defaults: true,
          }) as { obj?: LiveSocketGameRaw[] };

          const games = eventObj.obj || [];
          for (const raw of games) {
            if (!raw || !raw.std) continue;
            // Ignore Esoccer if desired
            if (raw.inf && raw.inf.toLowerCase().includes("esoccer")) continue;
            const existingMatch = this.liveMatchesMap.get(String(raw.std));
            const adapted = adaptLiveGame(raw, existingMatch);
            this.liveMatchesMap.set(adapted.id, adapted);
          }

          this.broadcastMatches();
          return;
        } catch (protoErr) {
          console.warn("[Live Socket] Protobuf decode fallback:", protoErr);
        }
      }

      // 2. Direct JSON fallback if already decoded
      let games: LiveSocketGameRaw[] = [];
      if (Array.isArray(payload)) {
        games = payload as LiveSocketGameRaw[];
      } else if (typeof payload === "object" && payload !== null) {
        const obj = payload as Record<string, unknown>;
        if (Array.isArray(obj["obj"])) {
          games = obj["obj"] as LiveSocketGameRaw[];
        } else if (Array.isArray(obj["data"])) {
          games = obj["data"] as LiveSocketGameRaw[];
        } else if (Array.isArray(obj["games"])) {
          games = obj["games"] as LiveSocketGameRaw[];
        }
      }

      for (const raw of games) {
        if (!raw) continue;
        const existingMatch = raw.std ? this.liveMatchesMap.get(String(raw.std)) : undefined;
        const adapted = adaptLiveGame(raw, existingMatch);
        this.liveMatchesMap.set(adapted.id, adapted);
      }

      this.broadcastMatches();
    } catch (err) {
      console.warn("[Live Socket] Error parsing buffer payload:", err);
    }
  }

  private handleExpiredKey(expiredId: unknown) {
    if (typeof expiredId === "string" || typeof expiredId === "number") {
      const cleanId = String(expiredId)
        .replace(/^live_game_/, "")
        .replace(/^buffer_/, "");
      this.liveMatchesMap.delete(cleanId);
      this.broadcastMatches();
    } else if (Array.isArray(expiredId)) {
      for (const id of expiredId) {
        const cleanId = String(id)
          .replace(/^live_game_/, "")
          .replace(/^buffer_/, "");
        this.liveMatchesMap.delete(cleanId);
      }
      this.broadcastMatches();
    }
  }

  private broadcastMatches() {
    const list = Array.from(this.liveMatchesMap.values());
    for (const listener of this.matchListeners) {
      try {
        listener(list);
      } catch (e) {
        console.error(e);
      }
    }
  }

  public subscribe(listener: LiveGamesListener): () => void {
    this.matchListeners.add(listener);
    // Immediately emit current cached live matches
    listener(Array.from(this.liveMatchesMap.values()));

    if (!this.socket) {
      this.init();
    }

    return () => {
      this.matchListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public async requestRefresh(): Promise<Match[]> {
    if (!this.socket) {
      this.init();
    } else {
      try {
        // Disconnecting and reconnecting forces the bookmaker socket server to dump fresh buffers with latest odds immediately
        this.socket.disconnect();
        this.socket.connect();
      } catch (err) {
        console.warn("[Live Socket] Refresh connection error:", err);
      }
      this.broadcastMatches();
    }
    return Array.from(this.liveMatchesMap.values());
  }

  public getMatches(): Match[] {
    return Array.from(this.liveMatchesMap.values());
  }

  public getStatus(): LiveSocketStatus {
    return this.status;
  }
}

export const liveGamesSocket = new LiveGamesSocketManager();
