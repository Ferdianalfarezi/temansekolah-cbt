import { Test, TestingModule } from "@nestjs/testing";
import { GradingService } from "./grading.service";
import { DRIZZLE } from "../../drizzle/drizzle.module";

describe("GradingService", () => {
  let service: GradingService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GradingService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<GradingService>(GradingService);
  });

  describe("gradeParticipant", () => {
    it("should correctly grade all-correct answers", async () => {
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [
          { questionId: "q1" },
          { questionId: "q2" },
          { questionId: "q3" },
        ],
        questions: [
          { id: "q1", jawabanBenar: "A" },
          { id: "q2", jawabanBenar: "C" },
          { id: "q3", jawabanBenar: "B" },
        ],
        answers: [
          { id: "a1", questionId: "q1", selectedOption: "A" },
          { id: "a2", questionId: "q2", selectedOption: "C" },
          { id: "a3", questionId: "q3", selectedOption: "B" },
        ],
      });

      const result = await service.gradeParticipant("p1");

      expect(result).toEqual({
        participantId: "p1",
        scoreCorrect: 3,
        scoreTotal: 3,
        scorePercentage: 100,
      });
    });

    it("should correctly grade mixed answers", async () => {
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [
          { questionId: "q1" },
          { questionId: "q2" },
          { questionId: "q3" },
          { questionId: "q4" },
        ],
        questions: [
          { id: "q1", jawabanBenar: "A" },
          { id: "q2", jawabanBenar: "C" },
          { id: "q3", jawabanBenar: "B" },
          { id: "q4", jawabanBenar: "D" },
        ],
        answers: [
          { id: "a1", questionId: "q1", selectedOption: "A" }, // correct
          { id: "a2", questionId: "q2", selectedOption: "B" }, // incorrect
          { id: "a3", questionId: "q3", selectedOption: "B" }, // correct
          { id: "a4", questionId: "q4", selectedOption: "A" }, // incorrect
        ],
      });

      const result = await service.gradeParticipant("p1");

      expect(result).toEqual({
        participantId: "p1",
        scoreCorrect: 2,
        scoreTotal: 4,
        scorePercentage: 50,
      });
    });

    it("should count unanswered questions as incorrect", async () => {
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [
          { questionId: "q1" },
          { questionId: "q2" },
          { questionId: "q3" },
        ],
        questions: [
          { id: "q1", jawabanBenar: "A" },
          { id: "q2", jawabanBenar: "C" },
          { id: "q3", jawabanBenar: "B" },
        ],
        // Only 1 answer submitted (2 unanswered)
        answers: [{ id: "a1", questionId: "q1", selectedOption: "A" }],
      });

      const result = await service.gradeParticipant("p1");

      expect(result).toEqual({
        participantId: "p1",
        scoreCorrect: 1,
        scoreTotal: 3,
        scorePercentage: 33.33,
      });
    });

    it("should handle null selected_option as incorrect", async () => {
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [{ questionId: "q1" }],
        questions: [{ id: "q1", jawabanBenar: "A" }],
        answers: [{ id: "a1", questionId: "q1", selectedOption: null }],
      });

      const result = await service.gradeParticipant("p1");

      expect(result).toEqual({
        participantId: "p1",
        scoreCorrect: 0,
        scoreTotal: 1,
        scorePercentage: 0,
      });
    });

    it("should handle zero questions gracefully", async () => {
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [],
        questions: [],
        answers: [],
      });

      const result = await service.gradeParticipant("p1");

      expect(result).toEqual({
        participantId: "p1",
        scoreCorrect: 0,
        scoreTotal: 0,
        scorePercentage: 0,
      });
    });

    it("should throw if participant not found", async () => {
      setupMockData(mockDb, {
        participant: null,
        sessionQuestions: [],
        questions: [],
        answers: [],
      });

      await expect(service.gradeParticipant("nonexistent")).rejects.toThrow(
        "Participant not found: nonexistent",
      );
    });

    it("should be deterministic — same data produces same result", async () => {
      const data = {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [{ questionId: "q1" }, { questionId: "q2" }],
        questions: [
          { id: "q1", jawabanBenar: "B" },
          { id: "q2", jawabanBenar: "D" },
        ],
        answers: [
          { id: "a1", questionId: "q1", selectedOption: "B" },
          { id: "a2", questionId: "q2", selectedOption: "C" },
        ],
      };

      setupMockData(mockDb, data);
      const result1 = await service.gradeParticipant("p1");

      setupMockData(mockDb, data);
      const result2 = await service.gradeParticipant("p1");

      expect(result1).toEqual(result2);
    });

    it("should update is_correct on answer records", async () => {
      const updateCalls: any[] = [];
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [{ questionId: "q1" }, { questionId: "q2" }],
        questions: [
          { id: "q1", jawabanBenar: "A" },
          { id: "q2", jawabanBenar: "C" },
        ],
        answers: [
          { id: "a1", questionId: "q1", selectedOption: "A" },
          { id: "a2", questionId: "q2", selectedOption: "B" },
        ],
        onAnswerUpdate: (set: any) => updateCalls.push(set),
      });

      await service.gradeParticipant("p1");

      // Verify is_correct was set on answer updates
      expect(updateCalls).toHaveLength(2);
      expect(updateCalls[0]).toEqual({ isCorrect: true });
      expect(updateCalls[1]).toEqual({ isCorrect: false });
    });

    it("should update participant score fields", async () => {
      let participantUpdate: any = null;
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [{ questionId: "q1" }, { questionId: "q2" }],
        questions: [
          { id: "q1", jawabanBenar: "A" },
          { id: "q2", jawabanBenar: "C" },
        ],
        answers: [
          { id: "a1", questionId: "q1", selectedOption: "A" },
          { id: "a2", questionId: "q2", selectedOption: "C" },
        ],
        onParticipantUpdate: (set: any) => {
          participantUpdate = set;
        },
      });

      await service.gradeParticipant("p1");

      expect(participantUpdate).toEqual({
        scoreCorrect: 2,
        scoreTotal: 2,
        scorePercentage: "100.00",
      });
    });

    it("should handle 300 answers without error (performance edge case)", async () => {
      const sessionQuestions = Array.from({ length: 300 }, (_, i) => ({
        questionId: `q${i}`,
      }));
      const questions = Array.from({ length: 300 }, (_, i) => ({
        id: `q${i}`,
        jawabanBenar: "A",
      }));
      const answers = Array.from({ length: 300 }, (_, i) => ({
        id: `a${i}`,
        questionId: `q${i}`,
        selectedOption: i % 2 === 0 ? "A" : "B", // 150 correct, 150 incorrect
      }));

      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions,
        questions,
        answers,
      });

      const result = await service.gradeParticipant("p1");

      expect(result.scoreTotal).toBe(300);
      expect(result.scoreCorrect).toBe(150);
      expect(result.scorePercentage).toBe(50);
    });

    it("should handle session with no submitted answers (empty session)", async () => {
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [
          { questionId: "q1" },
          { questionId: "q2" },
          { questionId: "q3" },
        ],
        questions: [
          { id: "q1", jawabanBenar: "A" },
          { id: "q2", jawabanBenar: "B" },
          { id: "q3", jawabanBenar: "C" },
        ],
        answers: [], // no answers submitted at all
      });

      const result = await service.gradeParticipant("p1");

      expect(result).toEqual({
        participantId: "p1",
        scoreCorrect: 0,
        scoreTotal: 3,
        scorePercentage: 0,
      });
    });

    it("should treat all-null selected options as zero score", async () => {
      setupMockData(mockDb, {
        participant: { id: "p1", examSessionId: "s1" },
        sessionQuestions: [{ questionId: "q1" }, { questionId: "q2" }],
        questions: [
          { id: "q1", jawabanBenar: "A" },
          { id: "q2", jawabanBenar: "B" },
        ],
        answers: [
          { id: "a1", questionId: "q1", selectedOption: null },
          { id: "a2", questionId: "q2", selectedOption: null },
        ],
      });

      const result = await service.gradeParticipant("p1");

      expect(result).toEqual({
        participantId: "p1",
        scoreCorrect: 0,
        scoreTotal: 2,
        scorePercentage: 0,
      });
    });
  });
});

// ─── Mock Helpers ──────────────────────────────────────────────────

interface MockData {
  participant: { id: string; examSessionId: string } | null;
  sessionQuestions: { questionId: string }[];
  questions: { id: string; jawabanBenar: string }[];
  answers: { id: string; questionId: string; selectedOption: string | null }[];
  onAnswerUpdate?: (set: any) => void;
  onParticipantUpdate?: (set: any) => void;
}

function createMockDb() {
  return {
    _mockData: null as MockData | null,
    _callIndex: 0,
    select: jest.fn(),
    update: jest.fn(),
  };
}

function setupMockData(mockDb: any, data: MockData) {
  mockDb._mockData = data;
  mockDb._callIndex = 0;

  // Track which select call we're on
  let selectCallIndex = 0;

  mockDb.select.mockImplementation(() => {
    const callIdx = selectCallIndex++;
    const chain = createSelectChain(mockDb, data, callIdx);
    return chain;
  });

  let updateCallIndex = 0;
  mockDb.update.mockImplementation(() => {
    const callIdx = updateCallIndex++;
    return createUpdateChain(mockDb, data, callIdx);
  });
}

function createSelectChain(mockDb: any, data: MockData, callIndex: number) {
  // The order of select calls in gradeParticipant:
  // 0: participant lookup
  // 1: session questions
  // 2: questions (jawaban_benar)
  // 3: answers

  const chain: any = {};

  chain.from = jest.fn().mockReturnValue(chain);
  chain.where = jest.fn().mockImplementation(() => {
    switch (callIndex) {
      case 0: // participant
        chain._result = data.participant ? [data.participant] : [];
        break;
      case 1: // session questions
        chain._result = data.sessionQuestions;
        break;
      case 2: // questions
        chain._result = data.questions;
        break;
      case 3: // answers
        chain._result = data.answers;
        break;
      default:
        chain._result = [];
    }
    return chain;
  });

  chain.limit = jest.fn().mockImplementation(() => {
    return chain._result ?? [];
  });

  // If .where() is the terminal (no .limit()), make chain thenable
  chain.then = (resolve: any) => resolve(chain._result ?? []);
  // Also make it awaitable by implementing Symbol.iterator-like behavior
  chain[Symbol.iterator] = undefined;

  return chain;
}

function createUpdateChain(mockDb: any, data: MockData, callIndex: number) {
  const chain: any = {};
  let setCalled: any = null;

  chain.set = jest.fn().mockImplementation((setData: any) => {
    setCalled = setData;
    return chain;
  });

  chain.where = jest.fn().mockImplementation(() => {
    // Determine if this is an answer update or participant update
    if (setCalled && "isCorrect" in setCalled) {
      data.onAnswerUpdate?.(setCalled);
    } else if (setCalled && "scoreCorrect" in setCalled) {
      data.onParticipantUpdate?.(setCalled);
    }
    return Promise.resolve();
  });

  return chain;
}
