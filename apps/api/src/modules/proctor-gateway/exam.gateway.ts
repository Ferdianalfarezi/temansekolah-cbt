import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Inject, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Namespace, Socket } from "socket.io";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtAnswer } from "../../drizzle/schema/cbt-answer";
import { cbtAnswerSnapshot } from "../../drizzle/schema/cbt-answer-snapshot";
import { cbtViolationEvent } from "../../drizzle/schema/cbt-violation-event";
import { HeartbeatService } from "./heartbeat.service";
import { ProctorGateway } from "./proctor.gateway";

interface SiswaSocketData {
  siswaAccountId: string;
  tenantId: string;
  participantId: string;
  sessionId: string;
}

interface JoinSessionPayload {
  sessionId: string;
  token: string;
}

interface HeartbeatPayload {
  timestamp: number;
}

interface AnswerSavePayload {
  questionId: string;
  option: string;
  timestamp: string;
}

interface AnswerSnapshotPayload {
  answers: Record<string, { option: string; timestamp: string }>;
  questionIndex: number;
  remainingSeconds: number;
}

interface ViolationReportPayload {
  type: "tab_switch" | "focus_loss" | "fullscreen_exit" | "multiple_login";
  timestamp: string;
  durationMs?: number;
}

@WebSocketGateway({ namespace: "exam", cors: { origin: "*" } })
export class ExamGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ExamGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly jwtService: JwtService,
    private readonly heartbeatService: HeartbeatService,
    private readonly proctorGateway: ProctorGateway,
  ) {}

  afterInit() {
    this.logger.log("ExamGateway initialized (/exam namespace)");

    // Register heartbeat disconnect handler
    this.heartbeatService.setDisconnectHandler((entry, _clientId) => {
      this.handleHeartbeatTimeout(entry.participantId, entry.sessionId);
    });
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Siswa client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const entry = this.heartbeatService.removeClient(client.id);
    if (entry) {
      this.logger.log(
        `Siswa client disconnected: ${client.id} (participant: ${entry.participantId})`,
      );
      // Notify proctor of disconnection
      this.proctorGateway.emitToSession(
        entry.sessionId,
        "participant_disconnected",
        {
          participantId: entry.participantId,
          siswaAccountId: entry.siswaAccountId,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  /**
   * Siswa joins an exam session room.
   * Validates JWT, checks participant assignment, enforces single-session.
   */
  @SubscribeMessage("join_session")
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSessionPayload,
  ) {
    const { sessionId, token } = payload;

    // Validate JWT
    let decoded: { siswaAccountId: string; tenantId: string };
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      client.emit("error", { message: "Invalid or expired token" });
      client.disconnect();
      return;
    }

    const { siswaAccountId, tenantId } = decoded;

    // Find participant record
    const [participant] = await this.db
      .select({ id: cbtExamParticipant.id, status: cbtExamParticipant.status })
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
        ),
      )
      .limit(1);

    if (!participant) {
      client.emit("error", { message: "Not assigned to this exam session" });
      client.disconnect();
      return;
    }

    if (!["in_progress", "assigned"].includes(participant.status)) {
      client.emit("error", {
        message: `Cannot join session with status: ${participant.status}`,
      });
      client.disconnect();
      return;
    }

    // Single-session enforcement: disconnect older connection for same siswaAccountId
    const existingClientId =
      this.heartbeatService.findClientBySiswaAccount(siswaAccountId);
    if (existingClientId && existingClientId !== client.id) {
      const existingSocket = this.server.sockets.get(existingClientId);
      if (existingSocket) {
        existingSocket.emit("session_terminated", {
          reason: "multiple_login",
          message: "Another device connected to this exam session",
        });
        existingSocket.disconnect(true);
      }
      this.heartbeatService.removeClient(existingClientId);
      this.logger.warn(
        `Single-session enforcement: disconnected ${existingClientId} for siswa ${siswaAccountId}`,
      );
    }

    // Store socket data
    const socketData: SiswaSocketData = {
      siswaAccountId,
      tenantId,
      participantId: participant.id,
      sessionId,
    };
    client.data = socketData;

    // Join session room
    await client.join(`session:${sessionId}`);

    // Register heartbeat
    this.heartbeatService.updateHeartbeat(
      client.id,
      participant.id,
      sessionId,
      siswaAccountId,
    );

    // Notify proctor of connection/reconnection
    this.proctorGateway.emitToSession(sessionId, "participant_reconnected", {
      participantId: participant.id,
      siswaAccountId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Siswa ${siswaAccountId} joined session ${sessionId} (participant: ${participant.id})`,
    );

    return {
      event: "join_session",
      data: { success: true, participantId: participant.id },
    };
  }

  /**
   * Heartbeat from siswa client — updates last heartbeat timestamp.
   */
  @SubscribeMessage("heartbeat")
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HeartbeatPayload,
  ) {
    const data = client.data as SiswaSocketData | undefined;
    if (!data?.participantId) return;

    this.heartbeatService.updateHeartbeat(
      client.id,
      data.participantId,
      data.sessionId,
      data.siswaAccountId,
    );

    return { event: "heartbeat", data: { ack: true, serverTime: Date.now() } };
  }

  /**
   * Save a single answer from siswa.
   */
  @SubscribeMessage("answer_save")
  async handleAnswerSave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AnswerSavePayload,
  ) {
    const data = client.data as SiswaSocketData | undefined;
    if (!data?.participantId) {
      return { event: "error", data: { message: "Not authenticated" } };
    }

    const { questionId, option, timestamp } = payload;

    try {
      // Upsert answer (insert or update on conflict)
      await this.db
        .insert(cbtAnswer)
        .values({
          participantId: data.participantId,
          questionId,
          selectedOption: option,
          answeredAt: new Date(timestamp),
        })
        .onConflictDoUpdate({
          target: [cbtAnswer.participantId, cbtAnswer.questionId],
          set: {
            selectedOption: option,
            answeredAt: new Date(timestamp),
          },
        });

      client.emit("save_confirmed", { questionId, timestamp });
      return { event: "answer_save", data: { success: true, questionId } };
    } catch (error) {
      this.logger.error(
        `Failed to save answer for participant ${data.participantId}: ${error}`,
      );
      return {
        event: "answer_save",
        data: { success: false, error: "Save failed" },
      };
    }
  }

  /**
   * Save a full answer snapshot (periodic auto-save from client).
   */
  @SubscribeMessage("answer_snapshot")
  async handleAnswerSnapshot(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AnswerSnapshotPayload,
  ) {
    const data = client.data as SiswaSocketData | undefined;
    if (!data?.participantId) {
      return { event: "error", data: { message: "Not authenticated" } };
    }

    const { answers, questionIndex, remainingSeconds } = payload;

    try {
      await this.db.insert(cbtAnswerSnapshot).values({
        participantId: data.participantId,
        answers,
        currentQuestionIndex: questionIndex,
        remainingSeconds,
      });

      return { event: "answer_snapshot", data: { success: true } };
    } catch (error) {
      this.logger.error(
        `Failed to save snapshot for participant ${data.participantId}: ${error}`,
      );
      return { event: "answer_snapshot", data: { success: false } };
    }
  }

  /**
   * Siswa reports a violation event.
   * Persists to DB, increments violation count, and alerts proctor.
   */
  @SubscribeMessage("violation_report")
  async handleViolationReport(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ViolationReportPayload,
  ) {
    const data = client.data as SiswaSocketData | undefined;
    if (!data?.participantId) {
      return { event: "error", data: { message: "Not authenticated" } };
    }

    const { type, timestamp, durationMs } = payload;

    try {
      // Insert violation event
      await this.db.insert(cbtViolationEvent).values({
        participantId: data.participantId,
        violationType: type,
        durationMs: durationMs ?? null,
        detectedAt: new Date(timestamp),
      });

      // Increment violation count on participant
      await this.db
        .update(cbtExamParticipant)
        .set({
          violationCount: sql`${cbtExamParticipant.violationCount} + 1`,
        })
        .where(eq(cbtExamParticipant.id, data.participantId));

      // Notify proctor
      this.proctorGateway.emitToSession(data.sessionId, "violation_alert", {
        participantId: data.participantId,
        siswaAccountId: data.siswaAccountId,
        type,
        timestamp,
        durationMs,
      });

      this.logger.log(
        `Violation reported: ${type} by participant ${data.participantId} in session ${data.sessionId}`,
      );

      return { event: "violation_report", data: { success: true } };
    } catch (error) {
      this.logger.error(
        `Failed to save violation for participant ${data.participantId}: ${error}`,
      );
      return { event: "violation_report", data: { success: false } };
    }
  }

  /**
   * Emit an event to all siswa clients in a session room.
   * Used by other services (scheduler, proctor actions) to push events.
   */
  emitToSession(sessionId: string, event: string, data: any) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }

  /**
   * Emit an event to a specific participant socket.
   */
  emitToParticipant(participantId: string, event: string, data: any) {
    // Find the client socket by participantId
    for (const [, socket] of this.server.sockets) {
      const socketData = socket.data as SiswaSocketData | undefined;
      if (socketData?.participantId === participantId) {
        socket.emit(event, data);
        break;
      }
    }
  }

  /**
   * Handle heartbeat timeout — notify proctor of participant disconnection.
   */
  private handleHeartbeatTimeout(participantId: string, sessionId: string) {
    this.proctorGateway.emitToSession(sessionId, "participant_disconnected", {
      participantId,
      reason: "heartbeat_timeout",
      timestamp: new Date().toISOString(),
    });
  }
}
