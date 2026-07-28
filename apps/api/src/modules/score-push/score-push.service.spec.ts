import { Test, TestingModule } from "@nestjs/testing";
import { ScorePushService } from "./score-push.service";
import { DRIZZLE } from "../../drizzle/drizzle.module";
import { AuditLogService } from "../audit-log/audit-log.service";

describe("ScorePushService", () => {
  let service: ScorePushService;
  let mockDb: any;
  let mockAuditLogService: any;

  beforeEach(async () => {
    mockDb = createMockDb();
    mockAuditLogService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScorePushService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<ScorePushService>(ScorePushService);
  });

  describe("JSONB merge strategy", () => {
    it("should merge new komponen entry into existing array", () => {
      const existing = [
        { komponen_penilaian_id: "kp-1", nilai: 80 },
        { komponen_penilaian_id: "kp-2", nilai: 75 },
      ];

      const result = (service as any).mergeKomponenNilai(existing, "kp-3", 90);

      expect(result).toHaveLength(3);
      expect(result[2]).toEqual({
        komponen_penilaian_id: "kp-3",
        nilai: 90,
      });
    });

    it("should update existing komponen entry when ID matches", () => {
      const existing = [
        { komponen_penilaian_id: "kp-1", nilai: 80 },
        { komponen_penilaian_id: "kp-2", nilai: 75 },
      ];

      const result = (service as any).mergeKomponenNilai(existing, "kp-1", 95);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        komponen_penilaian_id: "kp-1",
        nilai: 95,
      });
      // Other entry unchanged
      expect(result[1]).toEqual({
        komponen_penilaian_id: "kp-2",
        nilai: 75,
      });
    });

    it("should handle empty existing array", () => {
      const result = (service as any).mergeKomponenNilai([], "kp-1", 85);

      expect(result).toEqual([{ komponen_penilaian_id: "kp-1", nilai: 85 }]);
    });

    it("should not mutate original array", () => {
      const existing = [{ komponen_penilaian_id: "kp-1", nilai: 80 }];
      const original = [...existing];

      (service as any).mergeKomponenNilai(existing, "kp-1", 95);

      expect(existing).toEqual(original);
    });
  });

  describe("parseKomponenNilai", () => {
    it("should parse JSON string into array", () => {
      const raw = JSON.stringify([
        { komponen_penilaian_id: "kp-1", nilai: 80 },
      ]);

      const result = (service as any).parseKomponenNilai(raw);

      expect(result).toEqual([{ komponen_penilaian_id: "kp-1", nilai: 80 }]);
    });

    it("should return array as-is if already parsed", () => {
      const raw = [{ komponen_penilaian_id: "kp-1", nilai: 80 }];

      const result = (service as any).parseKomponenNilai(raw);

      expect(result).toEqual(raw);
    });

    it("should return empty array for null/undefined", () => {
      expect((service as any).parseKomponenNilai(null)).toEqual([]);
      expect((service as any).parseKomponenNilai(undefined)).toEqual([]);
    });

    it("should return empty array for malformed JSON string", () => {
      expect((service as any).parseKomponenNilai("{invalid")).toEqual([]);
    });
  });

  describe("scaleScore", () => {
    it("should scale 100% to skala_max", () => {
      const result = (service as any).scaleScore(100, 0, 100);
      expect(result).toBe(100);
    });

    it("should scale 0% to skala_min", () => {
      const result = (service as any).scaleScore(0, 0, 100);
      expect(result).toBe(0);
    });

    it("should scale 50% to midpoint of range", () => {
      const result = (service as any).scaleScore(50, 0, 100);
      expect(result).toBe(50);
    });

    it("should handle non-zero skala_min (e.g., 40-100 range)", () => {
      // 75% on a 40-100 scale: 40 + (75/100) * 60 = 40 + 45 = 85
      const result = (service as any).scaleScore(75, 40, 100);
      expect(result).toBe(85);
    });

    it("should round to 2 decimal places", () => {
      // 33.33% on 0-100: 33.33
      const result = (service as any).scaleScore(33.33, 0, 100);
      expect(result).toBe(33.33);
    });
  });

  describe("pushScores", () => {
    it("should return error if session not found", async () => {
      setupPushScoresMock(mockDb, { session: null });

      const result = await service.pushScores("s1", "t1", "actor1");

      expect(result.errors).toContain("Exam session s1 not found");
      expect(result.pushed).toBe(0);
    });

    it("should return error when rapor is locked (final status)", async () => {
      setupPushScoresMock(mockDb, {
        session: {
          id: "s1",
          pelaksanaanUjianId: "pu1",
          kelasId: "k1",
          mataPelajaranId: "mp1",
          tenantId: "t1",
        },
        pelaksanaan: {
          id: "pu1",
          komponenPenilaianId: "kp1",
          tahunAjaranId: "ta1",
          periodeRapor: "uts",
        },
        komponen: { id: "kp1", skalaMin: 0, skalaMax: 100 },
        rapor: { id: "r1", status: "final" },
        participants: [],
      });

      const result = await service.pushScores("s1", "t1", "actor1");

      expect(result.errors).toContain(
        "Rapor dengan status 'final' — tidak dapat push nilai",
      );
    });
  });
});

// ─── Mock Helpers ──────────────────────────────────────────────────

function createMockDb() {
  return {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    execute: jest.fn(),
  };
}

interface PushScoresMockData {
  session?: any;
  pelaksanaan?: any;
  komponen?: any;
  rapor?: any;
  participants?: any[];
}

function setupPushScoresMock(mockDb: any, data: PushScoresMockData) {
  let selectCallIndex = 0;

  mockDb.select.mockImplementation(() => {
    const callIdx = selectCallIndex++;
    const chain: any = {};

    chain.from = jest.fn().mockReturnValue(chain);
    chain.where = jest.fn().mockImplementation(() => {
      switch (callIdx) {
        case 0: // session
          chain._result = data.session ? [data.session] : [];
          break;
        case 1: // pelaksanaan
          chain._result = data.pelaksanaan ? [data.pelaksanaan] : [];
          break;
        case 2: // komponen
          chain._result = data.komponen ? [data.komponen] : [];
          break;
        case 3: // rapor check (getOrCreateRapor)
          if (data.rapor?.status === "final") {
            chain._result = [data.rapor];
          } else if (data.rapor) {
            chain._result = [data.rapor];
          } else {
            chain._result = [];
          }
          break;
        default:
          chain._result = data.participants ?? [];
      }
      return chain;
    });
    chain.limit = jest.fn().mockImplementation(() => chain._result ?? []);
    chain.then = (resolve: any) => resolve(chain._result ?? []);

    return chain;
  });

  mockDb.insert.mockImplementation(() => ({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: "new-rapor-id" }]),
    }),
  }));

  mockDb.update.mockImplementation(() => ({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  }));
}
