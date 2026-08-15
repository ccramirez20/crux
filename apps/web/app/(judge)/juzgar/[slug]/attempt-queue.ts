// The judge's write queue, and the two rules the drain hangs on. Only writes
// live here: reference data (categories/rounds/problems/registrations) is
// loaded once per page load and kept in React state, because domain decision #3
// requires the *write* path to survive a dropped connection, not the read path.
//
// ponytail: hand-rolled over the native IndexedDB API — three functions, no
// wrapper library. put/getAll/delete are still verified in the browser against
// the real UI; covering them would take fake-indexeddb and a DOM environment.
// What has tests is what can break without anyone noticing: the id the whole
// idempotency scheme rests on, and the table that decides whether a captured
// attempt is kept or thrown away.

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
  /** The event's judge code, carried per attempt so a queued capture still authenticates on sync. */
  judgeCode: string | null;
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

export type SyncOutcome = 'delivered' | 'rejected' | 'ask-for-code' | 'stop';

/**
 * What the drain does with one queued attempt, given how its POST went. Every
 * branch here is somebody's captured work, so getting one wrong loses results
 * on the wall rather than throwing an error anyone can see.
 *
 * - `ask-for-code`: a wrong event code is fixable and the captures are real
 *   work, so they stay queued while the judge is sent back to the code screen.
 * - `rejected`: a 400 is the server refusing this payload permanently (bad
 *   shape, or a registration and a block from different categories). Retrying
 *   forever would pin a zombie row in the queue, so it comes out marked.
 * - `stop`: end the batch instead of skipping ahead, so whatever did get
 *   through stays in capture order, and retry on the next tick. 429 belongs
 *   here on purpose — app/api/attempts/route.ts answers a throttled judge with
 *   429 rather than 403 precisely so the brake reads as temporary. Moving it
 *   to the terminal side would empty a judge's backlog into nothing.
 */
export function syncOutcome(status: number | 'offline'): SyncOutcome {
  if (status === 'offline') {
    return 'stop';
  }
  if (status === 403) {
    return 'ask-for-code';
  }
  if (status >= 200 && status < 300) {
    return 'delivered';
  }
  if (status === 400) {
    return 'rejected';
  }
  return 'stop';
}

const DB_NAME = 'crux-judge-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pendingAttempts';

// Una conexión para toda la sesión, no una por operación. Antes cada
// addPending/listPending/removeSynced abría la suya y ninguna se cerraba: el
// drenaje corre cada 5 s, así que seis horas de evento dejaban miles de
// conexiones vivas en el teléfono del juez. En un portátil eso se aguanta; en
// un iPhone con poca memoria es justo lo que hace que Safari descarte la
// pestaña a media ronda. De paso arregla algo que todavía no ha mordido: una
// conexión abierta bloquea el `onupgradeneeded` de la próxima versión del
// esquema, así que subir DB_VERSION con el modelo viejo se habría colgado.
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'clientAttemptId' });
    };
    request.onsuccess = () => {
      // Safari cierra conexiones por su cuenta cuando reclama memoria. Una
      // conexión muerta guardada aquí dejaría al juez sin cola por el resto
      // del evento y sin nada en pantalla que lo diga; soltarla hace que la
      // siguiente operación abra una nueva.
      request.result.onclose = () => {
        dbPromise = null;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      // Un fallo tampoco se queda cacheado: reintentar tiene que poder abrir.
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
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
