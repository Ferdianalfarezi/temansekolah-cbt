import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Inject, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Namespace, Socket } from "socket.io";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";

interface ProctorSocketData {
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string;
}

interface JoinSessionPayload {
  sessionId: string;
  token: string;
}

@WebSocketGateway({ namespace: "proctor", cors: { origin: "*" } })
export class ProctorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ProctorGateway.name);

  @WebSocketServer()
  server!: Namespace;

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Proctor client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const data = client.data as ProctorSocketData | undefined;
    if (data) {
      this.logger.log(
        `Proctor client disconnected: ${client.id} (user: ${data.userId}, session: ${data.sessionId})`,
      );
    }
  }

  /**
   * Proctor joins a session monitoring room.
   * Validates staff JWT and verifies proctor is assigned to the session.
   */
  @SubscribeMessage("join_session")
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSessionPayload,
  ) {
    const { sessionId, token } = payload;

    // Validate staff JWT
    let decoded: { userId: string; tenantId: string; role: string };
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      client.emit("error", { message: "Invalid or expired token" });
      client.disconnect();
      return;
    }

    const { userId, tenantId, role } = decoded;

    // Only allow staff roles that can proctor
    const allowedRoles = ["super_admin", "admin", "kepala_sekolah", "guru"];
    if (!allowedRoles.includes(role)) {
      client.emit("error", { message: "Insufficient permissions to proctor" });
      client.disconnect();
      return;
    }

    // Verify session exists and belongs to tenant
    const [session] = await this.db
      .select({
        id: cbtExamSession.id,
        proctorId: cbtExamSession.proctorId,
        tenantId: cbtExamSession.tenantId,
      })
      .from(cbtExamSession)
      .where(eq(cbtExamSession.id, sessionId))
      .limit(1);

    if (!session) {
      client.emit("error", { message: "Exam session not found" });
      client.disconnect();
      return;
    }

    if (session.tenantId !== tenantId) {
      client.emit("error", {
        message: "Session does not belong to your institution",
      });
      client.disconnect();
      return;
    }

    // Only the assigned proctor (or admin/super_admin) can monitor
    const isAssignedProctor = session.proctorId === userId;
    const isAdmin = ["super_admin", "admin", "kepala_sekolah"].includes(role);

    if (!isAssignedProctor && !isAdmin) {
      client.emit("error", {
        message: "Not authorized to proctor this session",
      });
      client.disconnect();
      return;
    }

    // Store socket data
    const socketData: ProctorSocketData = {
      userId,
      tenantId,
      role,
      sessionId,
    };
    client.data = socketData;

    // Join proctor room for this session
    await client.join(`proctor:${sessionId}`);

    this.logger.log(`Proctor ${userId} (${role}) joined session ${sessionId}`);

    return {
      event: "join_session",
      data: { success: true, sessionId },
    };
  }

  /**
   * Emit an event to all proctors monitoring a session.
   * Used by ExamGateway and other services to push updates.
   */
  emitToSession(sessionId: string, event: string, data: any) {
    this.server.to(`proctor:${sessionId}`).emit(event, data);
  }

  /**
   * Emit a participant update to proctors (status change, score, etc.).
   */
  emitParticipantUpdate(
    sessionId: string,
    participantId: string,
    update: Record<string, any>,
  ) {
    this.emitToSession(sessionId, "participant_update", {
      participantId,
      ...update,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify proctors of an early submission.
   */
  emitEarlySubmission(
    sessionId: string,
    participantId: string,
    siswaAccountId: string,
  ) {
    this.emitToSession(sessionId, "early_submission", {
      participantId,
      siswaAccountId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify proctors that the session is completed.
   */
  emitSessionCompleted(sessionId: string) {
    this.emitToSession(sessionId, "session_completed", {
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}
