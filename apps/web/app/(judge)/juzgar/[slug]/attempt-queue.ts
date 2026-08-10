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

// crypto.randomUUID() only exists in a secure context, and a judge reaches the
// dev/gym server over plain http on a LAN IP — so on the actual target device
// it is undefined. crypto.getRandomValues() carries no such restriction.
// The server validates the version and variant nibbles, so the fallback has to
// produce a real v4, not just random hex.
export function newClientAttemptId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
