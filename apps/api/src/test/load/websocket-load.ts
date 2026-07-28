/**
 * WebSocket Load Test — 300 Concurrent Connections
 *
 * This is a load test script template for testing WebSocket capacity.
 * Can be run with k6 (xk6-websockets extension) or adapted for Artillery.
 *
 * Requirements:
 * - 300 simultaneous WebSocket connections to /exam namespace
 * - Each client sends heartbeat every 30s
 * - Validate server responds within 2s to each heartbeat
 * - Monitor connection stability over 5-minute window
 *
 * Usage (k6):
 *   k6 run --vus 300 --duration 5m websocket-load.ts
 *
 * Usage (Artillery - convert to YAML config):
 *   artillery run websocket-load.yml
 *
 * Usage (Node.js native - run directly):
 *   npx ts-node websocket-load.ts
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { io } = require("socket.io-client") as { io: any };
type Socket = any;

// ─── Configuration ─────────────────────────────────────────────────

const CONFIG = {
  baseUrl: process.env.WS_BASE_URL ?? "http://localhost:3000",
  namespace: "/exam",
  totalClients: 300,
  rampUpMs: 10000, // Ramp up over 10 seconds
  testDurationMs: 300000, // 5 minutes
  heartbeatIntervalMs: 30000, // 30 seconds
  maxResponseTimeMs: 2000, // SLA: 2s max response time
  jwtTokenPrefix: "test-siswa-token-", // Placeholder tokens for load test
};

// ─── Metrics ──────────────────────────────────────────────────────

interface Metrics {
  connectionsEstablished: number;
  connectionsFailed: number;
  heartbeatsSent: number;
  heartbeatAcksReceived: number;
  heartbeatTimeouts: number;
  avgResponseTimeMs: number;
  maxResponseTimeMs: number;
  disconnections: number;
}

const metrics: Metrics = {
  connectionsEstablished: 0,
  connectionsFailed: 0,
  heartbeatsSent: 0,
  heartbeatAcksReceived: 0,
  heartbeatTimeouts: 0,
  avgResponseTimeMs: 0,
  maxResponseTimeMs: 0,
  disconnections: 0,
};

const responseTimes: number[] = [];

// ─── Client Simulation ────────────────────────────────────────────

function createClient(clientId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = io(`${CONFIG.baseUrl}${CONFIG.namespace}`, {
      auth: {
        token: `${CONFIG.jwtTokenPrefix}${clientId}`,
      },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });

    socket.on("connect", () => {
      metrics.connectionsEstablished++;
      resolve(socket);
    });

    socket.on("connect_error", (err: Error) => {
      metrics.connectionsFailed++;
      reject(new Error(`Client ${clientId} failed to connect: ${err.message}`));
    });

    socket.on("disconnect", () => {
      metrics.disconnections++;
    });
  });
}

function startHeartbeat(socket: any, clientId: number): NodeJS.Timeout {
  return setInterval(() => {
    const sentAt = Date.now();
    metrics.heartbeatsSent++;

    socket.emit("heartbeat", { clientId, timestamp: sentAt });

    const timeout = setTimeout(() => {
      metrics.heartbeatTimeouts++;
    }, CONFIG.maxResponseTimeMs);

    socket.once("heartbeat_ack", () => {
      clearTimeout(timeout);
      const responseTime = Date.now() - sentAt;
      metrics.heartbeatAcksReceived++;
      responseTimes.push(responseTime);

      if (responseTime > metrics.maxResponseTimeMs) {
        metrics.maxResponseTimeMs = responseTime;
      }
    });
  }, CONFIG.heartbeatIntervalMs);
}

// ─── Main Test Runner ─────────────────────────────────────────────

async function runLoadTest(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log(" WebSocket Load Test — CBT Teman Sekolah");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Target: ${CONFIG.baseUrl}${CONFIG.namespace}`);
  console.log(`Clients: ${CONFIG.totalClients}`);
  console.log(`Duration: ${CONFIG.testDurationMs / 1000}s`);
  console.log(`Heartbeat interval: ${CONFIG.heartbeatIntervalMs / 1000}s`);
  console.log("");

  const clients: any[] = [];
  const heartbeatTimers: NodeJS.Timeout[] = [];
  const rampUpDelay = CONFIG.rampUpMs / CONFIG.totalClients;

  console.log("Ramping up connections...");

  // Ramp up clients
  for (let i = 0; i < CONFIG.totalClients; i++) {
    try {
      const socket = await createClient(i);
      clients.push(socket);
      heartbeatTimers.push(startHeartbeat(socket, i));

      if (i % 50 === 0 && i > 0) {
        console.log(`  Connected: ${i}/${CONFIG.totalClients}`);
      }
    } catch (err: any) {
      console.warn(`  Failed: client ${i} — ${err.message}`);
    }

    // Stagger connection creation
    await sleep(rampUpDelay);
  }

  console.log(
    `\nAll clients connected: ${metrics.connectionsEstablished}/${CONFIG.totalClients}`,
  );
  console.log(`Running for ${CONFIG.testDurationMs / 1000}s...\n`);

  // Run for test duration
  await sleep(CONFIG.testDurationMs);

  // Cleanup
  console.log("Shutting down...");
  heartbeatTimers.forEach((t) => clearInterval(t));
  clients.forEach((s) => s.disconnect());

  // Calculate avg response time
  if (responseTimes.length > 0) {
    metrics.avgResponseTimeMs =
      Math.round(
        (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100,
      ) / 100;
  }

  // Report
  printResults();
}

function printResults(): void {
  console.log("\n═══════════════════════════════════════════════════");
  console.log(" RESULTS");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Connections established:  ${metrics.connectionsEstablished}`);
  console.log(`Connections failed:       ${metrics.connectionsFailed}`);
  console.log(`Disconnections:           ${metrics.disconnections}`);
  console.log(`Heartbeats sent:          ${metrics.heartbeatsSent}`);
  console.log(`Heartbeat ACKs received:  ${metrics.heartbeatAcksReceived}`);
  console.log(`Heartbeat timeouts:       ${metrics.heartbeatTimeouts}`);
  console.log(`Avg response time:        ${metrics.avgResponseTimeMs}ms`);
  console.log(`Max response time:        ${metrics.maxResponseTimeMs}ms`);
  console.log("═══════════════════════════════════════════════════");

  // SLA check
  const slaPass =
    metrics.maxResponseTimeMs <= CONFIG.maxResponseTimeMs &&
    metrics.heartbeatTimeouts === 0 &&
    metrics.connectionsFailed === 0;

  console.log(
    `\nSLA (${CONFIG.maxResponseTimeMs}ms): ${slaPass ? "✅ PASS" : "❌ FAIL"}`,
  );

  if (!slaPass) {
    process.exitCode = 1;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run if executed directly
if (require.main === module) {
  runLoadTest().catch((err) => {
    console.error("Load test failed:", err);
    process.exitCode = 1;
  });
}

export { runLoadTest, CONFIG, metrics };
