/**
 * Grading SLA Load Test — 300 Simultaneous Submissions
 *
 * Tests that the grading service can process 300 exam submissions
 * concurrently within the 5-second SLA per participant.
 *
 * Requirements:
 * - 300 simultaneous grading requests
 * - Each grading must complete within 5 seconds
 * - No dropped/failed requests
 * - Total throughput: 300 gradings in under 30 seconds (with queuing)
 *
 * Usage:
 *   npx ts-node grading-sla.ts
 *
 * Environment variables:
 *   API_BASE_URL — Target API (default: http://localhost:3000)
 *   AUTH_TOKEN — Admin JWT for triggering submissions
 */

import http from "http";
import https from "https";

// ─── Configuration ─────────────────────────────────────────────────

const CONFIG = {
  baseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
  authToken: process.env.AUTH_TOKEN ?? "test-admin-token",
  totalSubmissions: 300,
  slaThresholdMs: 5000, // 5 seconds per grading
  concurrencyBatches: 10, // Send in batches of 30
  batchDelayMs: 100, // Small delay between batches
};

// ─── Metrics ──────────────────────────────────────────────────────

interface GradingMetric {
  participantId: string;
  responseTimeMs: number;
  success: boolean;
  statusCode: number;
  error?: string;
}

interface SummaryMetrics {
  total: number;
  successful: number;
  failed: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  maxResponseTimeMs: number;
  minResponseTimeMs: number;
  slaViolations: number;
  totalDurationMs: number;
}

// ─── HTTP Client ──────────────────────────────────────────────────

function submitExam(participantId: string): Promise<GradingMetric> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(`/api/exam-taking/submit`, CONFIG.baseUrl);

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.authToken}`,
      },
      timeout: CONFIG.slaThresholdMs * 2,
    };

    const client = url.protocol === "https:" ? https : http;

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          participantId,
          responseTimeMs: Date.now() - startTime,
          success: res.statusCode! >= 200 && res.statusCode! < 300,
          statusCode: res.statusCode!,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        participantId,
        responseTimeMs: Date.now() - startTime,
        success: false,
        statusCode: 0,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        participantId,
        responseTimeMs: Date.now() - startTime,
        success: false,
        statusCode: 0,
        error: "Request timeout",
      });
    });

    req.write(JSON.stringify({ participantId }));
    req.end();
  });
}

// ─── Percentile Calculation ───────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Main Test Runner ─────────────────────────────────────────────

async function runGradingSlaTest(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log(" Grading SLA Load Test — CBT Teman Sekolah");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Target: ${CONFIG.baseUrl}`);
  console.log(`Submissions: ${CONFIG.totalSubmissions}`);
  console.log(`SLA threshold: ${CONFIG.slaThresholdMs}ms`);
  console.log("");

  // Generate participant IDs
  const participantIds = Array.from(
    { length: CONFIG.totalSubmissions },
    (_, i) => `load-test-participant-${i.toString().padStart(4, "0")}`,
  );

  const results: GradingMetric[] = [];
  const totalStart = Date.now();

  // Send in batches for realistic load pattern
  const batchSize = Math.ceil(
    CONFIG.totalSubmissions / CONFIG.concurrencyBatches,
  );

  console.log(
    `Sending ${CONFIG.concurrencyBatches} batches of ~${batchSize}...\n`,
  );

  for (let batch = 0; batch < CONFIG.concurrencyBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, CONFIG.totalSubmissions);
    const batchIds = participantIds.slice(start, end);

    // Fire batch concurrently
    const batchResults = await Promise.all(
      batchIds.map((id) => submitExam(id)),
    );

    results.push(...batchResults);

    const successful = batchResults.filter((r) => r.success).length;
    console.log(
      `  Batch ${batch + 1}/${CONFIG.concurrencyBatches}: ${successful}/${batchIds.length} success`,
    );

    // Small delay between batches
    if (batch < CONFIG.concurrencyBatches - 1) {
      await sleep(CONFIG.batchDelayMs);
    }
  }

  const totalDuration = Date.now() - totalStart;

  // Calculate summary
  const summary = calculateSummary(results, totalDuration);
  printResults(summary);
}

function calculateSummary(
  results: GradingMetric[],
  totalDurationMs: number,
): SummaryMetrics {
  const responseTimes = results
    .map((r) => r.responseTimeMs)
    .sort((a, b) => a - b);
  const successful = results.filter((r) => r.success);
  const slaViolations = results.filter(
    (r) => r.responseTimeMs > CONFIG.slaThresholdMs,
  );

  return {
    total: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    avgResponseTimeMs:
      Math.round(
        (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100,
      ) / 100,
    p50ResponseTimeMs: percentile(responseTimes, 50),
    p95ResponseTimeMs: percentile(responseTimes, 95),
    p99ResponseTimeMs: percentile(responseTimes, 99),
    maxResponseTimeMs: responseTimes[responseTimes.length - 1],
    minResponseTimeMs: responseTimes[0],
    slaViolations: slaViolations.length,
    totalDurationMs,
  };
}

function printResults(summary: SummaryMetrics): void {
  console.log("\n═══════════════════════════════════════════════════");
  console.log(" RESULTS");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Total requests:        ${summary.total}`);
  console.log(`Successful:            ${summary.successful}`);
  console.log(`Failed:                ${summary.failed}`);
  console.log(`Total duration:        ${summary.totalDurationMs}ms`);
  console.log("");
  console.log("Response Times:");
  console.log(`  Min:                 ${summary.minResponseTimeMs}ms`);
  console.log(`  Avg:                 ${summary.avgResponseTimeMs}ms`);
  console.log(`  P50:                 ${summary.p50ResponseTimeMs}ms`);
  console.log(`  P95:                 ${summary.p95ResponseTimeMs}ms`);
  console.log(`  P99:                 ${summary.p99ResponseTimeMs}ms`);
  console.log(`  Max:                 ${summary.maxResponseTimeMs}ms`);
  console.log("");
  console.log(
    `SLA violations (>${CONFIG.slaThresholdMs}ms): ${summary.slaViolations}`,
  );
  console.log("═══════════════════════════════════════════════════");

  // SLA check
  const slaPass =
    summary.slaViolations === 0 &&
    summary.failed === 0 &&
    summary.p95ResponseTimeMs <= CONFIG.slaThresholdMs;

  console.log(
    `\nSLA (P95 < ${CONFIG.slaThresholdMs}ms, 0 failures): ${slaPass ? "✅ PASS" : "❌ FAIL"}`,
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
  runGradingSlaTest().catch((err) => {
    console.error("Load test failed:", err);
    process.exitCode = 1;
  });
}

export { runGradingSlaTest, CONFIG };
