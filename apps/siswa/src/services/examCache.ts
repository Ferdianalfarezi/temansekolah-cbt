import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "cbt-siswa-cache";
const DB_VERSION = 1;
const ANSWERS_STORE = "answers";
const QUESTIONS_STORE = "questions";

interface CachedAnswer {
  id: string; // `${sessionId}:${questionId}`
  sessionId: string;
  questionId: string;
  answer: string;
  savedAt: string;
  synced: boolean;
}

interface CachedQuestion {
  id: string; // `${sessionId}:${questionId}`
  sessionId: string;
  questionId: string;
  questionText: string;
  options: string[];
  orderIndex: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Answers store
        if (!db.objectStoreNames.contains(ANSWERS_STORE)) {
          const answerStore = db.createObjectStore(ANSWERS_STORE, {
            keyPath: "id",
          });
          answerStore.createIndex("bySession", "sessionId");
          answerStore.createIndex("bySynced", "synced");
        }
        // Questions store (for offline access)
        if (!db.objectStoreNames.contains(QUESTIONS_STORE)) {
          const questionStore = db.createObjectStore(QUESTIONS_STORE, {
            keyPath: "id",
          });
          questionStore.createIndex("bySession", "sessionId");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Save an answer locally in IndexedDB
 */
export async function saveAnswerLocally(
  sessionId: string,
  questionId: string,
  answer: string,
): Promise<void> {
  const db = await getDB();
  const record: CachedAnswer = {
    id: `${sessionId}:${questionId}`,
    sessionId,
    questionId,
    answer,
    savedAt: new Date().toISOString(),
    synced: false,
  };
  await db.put(ANSWERS_STORE, record);
}

/**
 * Mark an answer as synced after successful server save
 */
export async function markAnswerSynced(
  sessionId: string,
  questionId: string,
): Promise<void> {
  const db = await getDB();
  const key = `${sessionId}:${questionId}`;
  const record = await db.get(ANSWERS_STORE, key);
  if (record) {
    record.synced = true;
    await db.put(ANSWERS_STORE, record);
  }
}

/**
 * Get all unsynced answers for a session (used on reconnect)
 */
export async function getUnsyncedAnswers(
  sessionId: string,
): Promise<CachedAnswer[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(ANSWERS_STORE, "bySession", sessionId);
  return all.filter((a) => !a.synced);
}

/**
 * Get all cached answers for a session (regardless of sync status)
 */
export async function getSessionAnswers(
  sessionId: string,
): Promise<Map<string, string>> {
  const db = await getDB();
  const all = await db.getAllFromIndex(ANSWERS_STORE, "bySession", sessionId);
  const map = new Map<string, string>();
  for (const record of all) {
    map.set(record.questionId, record.answer);
  }
  return map;
}

/**
 * Cache questions for offline access
 */
export async function cacheQuestions(
  sessionId: string,
  questions: Array<{
    id: string;
    questionText: string;
    options: string[];
    orderIndex: number;
  }>,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(QUESTIONS_STORE, "readwrite");
  for (const q of questions) {
    const record: CachedQuestion = {
      id: `${sessionId}:${q.id}`,
      sessionId,
      questionId: q.id,
      questionText: q.questionText,
      options: q.options,
      orderIndex: q.orderIndex,
    };
    tx.store.put(record);
  }
  await tx.done;
}

/**
 * Get cached questions for offline display
 */
export async function getCachedQuestions(
  sessionId: string,
): Promise<CachedQuestion[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(QUESTIONS_STORE, "bySession", sessionId);
  return all.sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * Clear all cached data for a session (after submission)
 */
export async function clearSessionCache(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx1 = db.transaction(ANSWERS_STORE, "readwrite");
  const answers = await tx1.store.index("bySession").getAllKeys(sessionId);
  for (const key of answers) {
    await tx1.store.delete(key);
  }
  await tx1.done;

  const tx2 = db.transaction(QUESTIONS_STORE, "readwrite");
  const questions = await tx2.store.index("bySession").getAllKeys(sessionId);
  for (const key of questions) {
    await tx2.store.delete(key);
  }
  await tx2.done;
}
