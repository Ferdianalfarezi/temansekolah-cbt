import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

export interface HeartbeatEntry {
  lastHeartbeat: number;
  participantId: string;
  sessionId: string;
  siswaAccountId: string;
}

/**
 * In-memory heartbeat tracker for siswa WebSocket clients.
 * Detects disconnections when heartbeat exceeds threshold.
 * TODO: Replace with Redis adapter for multi-instance deployments.
 */
@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  /** clientId (socket.id) → heartbeat data */
  private readonly heartbeats = new Map<string, HeartbeatEntry>();

  /** Threshold in ms — client is considered disconnected after this */
  private readonly DISCONNECT_THRESHOLD_MS = 15_000;

  /** Callback for when a disconnection is detected */
  private onDisconnectCallback:
    ((entry: HeartbeatEntry, clientId: string) => void) | null = null;

  /**
   * Register a callback to be invoked when heartbeat timeout is detected.
   */
  setDisconnectHandler(
    handler: (entry: HeartbeatEntry, clientId: string) => void,
  ) {
    this.onDisconnectCallback = handler;
  }

  /**
   * Register or update heartbeat for a client.
   */
  updateHeartbeat(
    clientId: string,
    participantId: string,
    sessionId: string,
    siswaAccountId: string,
  ) {
    this.heartbeats.set(clientId, {
      lastHeartbeat: Date.now(),
      participantId,
      sessionId,
      siswaAccountId,
    });
  }

  /**
   * Remove a client from heartbeat tracking (on explicit disconnect).
   */
  removeClient(clientId: string): HeartbeatEntry | undefined {
    const entry = this.heartbeats.get(clientId);
    this.heartbeats.delete(clientId);
    return entry;
  }

  /**
   * Get heartbeat entry for a client.
   */
  getEntry(clientId: string): HeartbeatEntry | undefined {
    return this.heartbeats.get(clientId);
  }

  /**
   * Get all active clients for a given session.
   */
  getSessionClients(sessionId: string): Map<string, HeartbeatEntry> {
    const result = new Map<string, HeartbeatEntry>();
    for (const [clientId, entry] of this.heartbeats) {
      if (entry.sessionId === sessionId) {
        result.set(clientId, entry);
      }
    }
    return result;
  }

  /**
   * Check if a siswaAccountId already has an active connection.
   * Returns the clientId if found, undefined otherwise.
   */
  findClientBySiswaAccount(siswaAccountId: string): string | undefined {
    for (const [clientId, entry] of this.heartbeats) {
      if (entry.siswaAccountId === siswaAccountId) {
        return clientId;
      }
    }
    return undefined;
  }

  /**
   * Periodic check for stale heartbeats.
   * Runs every 5 seconds. If a client's last heartbeat exceeds the threshold,
   * it is considered disconnected and the handler is invoked.
   */
  @Interval(5000)
  checkDisconnections() {
    const now = Date.now();
    const staleClients: Array<{ clientId: string; entry: HeartbeatEntry }> = [];

    for (const [clientId, entry] of this.heartbeats) {
      if (now - entry.lastHeartbeat > this.DISCONNECT_THRESHOLD_MS) {
        staleClients.push({ clientId, entry });
      }
    }

    for (const { clientId, entry } of staleClients) {
      this.heartbeats.delete(clientId);
      this.logger.warn(
        `Heartbeat timeout for participant ${entry.participantId} in session ${entry.sessionId} (client: ${clientId})`,
      );

      if (this.onDisconnectCallback) {
        this.onDisconnectCallback(entry, clientId);
      }
    }
  }

  /**
   * Get the total number of tracked clients. Useful for monitoring.
   */
  getActiveClientCount(): number {
    return this.heartbeats.size;
  }
}
