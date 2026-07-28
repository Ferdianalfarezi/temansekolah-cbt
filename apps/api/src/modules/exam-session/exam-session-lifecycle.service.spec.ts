import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, BadRequestException } from "@nestjs/common";
import { ExamSessionLifecycleService } from "./exam-session-lifecycle.service";
import { ExamSessionService } from "./exam-session.service";
import { DRIZZLE } from "../../drizzle/drizzle.module";

describe("ExamSessionLifecycleService", () => {
  let service: ExamSessionLifecycleService;
  let mockDb: any;
  let mockExamSessionService: any;

  beforeEach(async () => {
    mockDb = createMockDb();
    mockExamSessionService = {
      getSessionOrFail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamSessionLifecycleService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ExamSessionService, useValue: mockExamSessionService },
      ],
    }).compile();

    service = module.get<ExamSessionLifecycleService>(
      ExamSessionLifecycleService,
    );
  });

  describe("State Transitions", () => {
    describe("package (Draft → Packaged)", () => {
      it("should reject packaging a non-draft session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "packaged",
          kelasId: "k1",
          pelaksanaanUjianId: "pu1",
          mataPelajaranId: "mp1",
        });

        await expect(service.package("t1", "s1")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should reject packaging an active session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "active",
          kelasId: "k1",
          pelaksanaanUjianId: "pu1",
          mataPelajaranId: "mp1",
        });

        await expect(service.package("t1", "s1")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should reject packaging when no questions are available", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "draft",
          kelasId: "k1",
          pelaksanaanUjianId: "pu1",
          mataPelajaranId: "mp1",
        });

        // kelas lookup succeeds
        setupSelectChain(mockDb, [
          [{ tingkat: "10" }], // kelas
          [], // kelas questions (empty)
          [], // tingkat questions (empty)
        ]);

        await expect(service.package("t1", "s1")).rejects.toThrow(
          BadRequestException,
        );
      });

      it("should reject packaging when no active siswa in kelas", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "draft",
          kelasId: "k1",
          pelaksanaanUjianId: "pu1",
          mataPelajaranId: "mp1",
        });

        setupSelectChain(mockDb, [
          [{ tingkat: "10" }], // kelas
          [{ id: "q1" }], // kelas questions (1 question)
          [], // (not reached)
          [], // active accounts (empty)
        ]);

        await expect(service.package("t1", "s1")).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe("unpackage (Packaged → Draft)", () => {
      it("should reject unpackaging a non-packaged session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "draft",
          scheduledAt: new Date(Date.now() + 86400000),
        });

        await expect(service.unpackage("t1", "s1")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should reject unpackaging an active session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "active",
          scheduledAt: new Date(Date.now() + 86400000),
        });

        await expect(service.unpackage("t1", "s1")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should reject unpackaging when scheduled time has passed", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "packaged",
          scheduledAt: new Date(Date.now() - 86400000), // past
        });

        await expect(service.unpackage("t1", "s1")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should allow unpackaging a packaged session with future schedule", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "packaged",
          scheduledAt: new Date(Date.now() + 86400000),
        });

        // Mock delete and update chain
        mockDb.delete.mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        });
        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest
                .fn()
                .mockResolvedValue([{ id: "s1", status: "draft" }]),
            }),
          }),
        });

        const result = await service.unpackage("t1", "s1");
        expect(result.status).toBe("draft");
      });
    });

    describe("cancel (Packaged → Cancelled)", () => {
      it("should reject cancelling a non-packaged session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "draft",
        });

        await expect(service.cancel("t1", "s1", "test reason")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should reject cancelling an active session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "active",
        });

        await expect(service.cancel("t1", "s1", "test reason")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should reject cancelling a completed session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "completed",
        });

        await expect(service.cancel("t1", "s1", "test reason")).rejects.toThrow(
          ConflictException,
        );
      });

      it("should successfully cancel a packaged session", async () => {
        mockExamSessionService.getSessionOrFail.mockResolvedValue({
          id: "s1",
          status: "packaged",
        });

        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([
                {
                  id: "s1",
                  status: "cancelled",
                  cancellationReason: "Ujian dibatalkan oleh admin",
                },
              ]),
            }),
          }),
        });

        const result = await service.cancel(
          "t1",
          "s1",
          "Ujian dibatalkan oleh admin",
        );

        expect(result.status).toBe("cancelled");
        expect(result.cancellationReason).toBe("Ujian dibatalkan oleh admin");
      });
    });

    describe("Invalid transition matrix", () => {
      const invalidTransitions = [
        { from: "active", action: "package" },
        { from: "completed", action: "package" },
        { from: "cancelled", action: "package" },
        { from: "draft", action: "unpackage" },
        { from: "active", action: "unpackage" },
        { from: "completed", action: "unpackage" },
        { from: "draft", action: "cancel" },
        { from: "active", action: "cancel" },
        { from: "completed", action: "cancel" },
      ];

      invalidTransitions.forEach(({ from, action }) => {
        it(`should reject ${action} from ${from} status`, async () => {
          mockExamSessionService.getSessionOrFail.mockResolvedValue({
            id: "s1",
            status: from,
            scheduledAt: new Date(Date.now() + 86400000),
            kelasId: "k1",
            pelaksanaanUjianId: "pu1",
            mataPelajaranId: "mp1",
          });

          const fn =
            action === "package"
              ? () => service.package("t1", "s1")
              : action === "unpackage"
                ? () => service.unpackage("t1", "s1")
                : () => service.cancel("t1", "s1", "reason");

          await expect(fn()).rejects.toThrow(ConflictException);
        });
      });
    });
  });
});

// ─── Mock Helpers ──────────────────────────────────────────────────

function createMockDb() {
  return {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  };
}

function setupSelectChain(mockDb: any, results: any[][]) {
  let callIndex = 0;

  mockDb.select.mockImplementation(() => {
    const idx = callIndex++;
    const data = results[idx] ?? [];

    const chain: any = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.where = jest.fn().mockReturnValue(chain);
    chain.innerJoin = jest.fn().mockReturnValue(chain);
    chain.orderBy = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockReturnValue(data);
    chain.then = (resolve: any) => resolve(data);
    chain[Symbol.iterator] = function* () {
      yield* data;
    };

    return chain;
  });
}
