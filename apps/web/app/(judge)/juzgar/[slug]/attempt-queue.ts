// The judge's write queue. Only writes live here: reference data
// (categories/rounds/problems/registrations) is loaded once per page load and
// kept in React state, because domain decision #3 requires the *write* path to
// survive a dropped connection, not the read path.
//
// ponytail: hand-rolled over the native IndexedDB API — three functions, no
// wrapper library. apps/web has no test runner yet, so this is verified in the
// browser against the real UI; if this file grows past put/getAll/delete,
// that's the signal to stand up Vitest for apps/web rather than keep guessing.

export interface PendingAttempt {
  clientAttemptId: string;
  registrationId: string;
  problemId: string;
  judgeLabel: string;
  top: boolean;
  topAttempts: number | null;
  zone: boolean;
  zoneAttempts: number | null;
  height: number | null;
  capturedAt: string;
}

const DB_NAME = 'crux-judge-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pendingAttempts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'clientAttemptId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addPending(attempt: PendingAttempt): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(attempt);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPending(): Promise<PendingAttempt[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request: IDBRequest<PendingAttempt[]> = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeSynced(clientAttemptId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(clientAttemptId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
