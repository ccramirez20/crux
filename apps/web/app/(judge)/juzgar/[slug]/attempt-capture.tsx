'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { fieldClass, primaryButtonClass } from '@/lib/ui';
import { addPending, listPending, removeSynced, type PendingAttempt } from './attempt-queue';
import type { JudgeRegistration } from './capture-app';
import { RecentAttempts, type AttemptStatus } from './recent-attempts';

const SYNC_INTERVAL_MS = 5000;

export function AttemptCapture({
  discipline,
  problemId,
  judgeName,
  registrations,
}: {
  discipline: string;
  problemId: string;
  judgeName: string;
  registrations: JudgeRegistration[];
}) {
  const [bib, setBib] = useState('');
  const [top, setTop] = useState(false);
  const [topAttempts, setTopAttempts] = useState('');
  const [zone, setZone] = useState(false);
  const [zoneAttempts, setZoneAttempts] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [sessionAttempts, setSessionAttempts] = useState<PendingAttempt[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  const matchedRegistration = registrations.find((r) => r.bibNumber === bib);

  // Serial drain: one in-flight request at a time, so the server-assigned
  // `sequence` matches real capture order — that ordering is the only trusted
  // tiebreak between an attempt and the correction that supersedes it.
  //
  // Three things this has to get right:
  //  - Drain the WHOLE queue, not just the active block. A judge who captures
  //    offline on block A and then walks to block B would otherwise leave A's
  //    attempts stranded in IndexedDB forever.
  //  - Send oldest-first. IndexedDB getAll() returns rows in key order, and
  //    the key is a random UUID, so without this sort a batch that syncs
  //    together lands in arbitrary order and `sequence` becomes meaningless.
  //  - Never overlap. A drain slower than the interval would otherwise race
  //    the next tick over the same rows and invert their order.
  const drainingRef = useRef(false);

  const drain = useCallback(async () => {
    if (drainingRef.current) {
      return;
    }
    drainingRef.current = true;
    try {
      const pending = await listPending();
      setPendingIds(new Set(pending.map((a) => a.clientAttemptId)));

      const ordered = [...pending].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      for (const attempt of ordered) {
        let response: Response;
        try {
          response = await fetch('/api/attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attempt),
          });
        } catch {
          // Offline. Stop here rather than skipping ahead, so what does get
          // through stays in capture order. The next tick retries.
          break;
        }

        // A 400 is the server refusing this payload permanently (bad shape, or
        // a registration and block from different categories). Retrying it
        // forever would pin a zombie row in the queue, so drop it and let the
        // judge see it was rejected instead of silently pending.
        const terminal = response.ok || response.status === 400;
        if (!terminal) {
          break;
        }
        if (!response.ok) {
          setRejectedIds((prev) => new Set(prev).add(attempt.clientAttemptId));
        }
        await removeSynced(attempt.clientAttemptId);
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(attempt.clientAttemptId);
          return next;
        });
      }
    } finally {
      drainingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void drain();
    const interval = setInterval(() => void drain(), SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [drain]);

  function resetForm() {
    setBib('');
    setTop(false);
    setTopAttempts('');
    setZone(false);
    setZoneAttempts('');
    setHeight('');
  }

  function loadForCorrection(attempt: PendingAttempt) {
    const registration = registrations.find((r) => r.id === attempt.registrationId);
    setBib(registration?.bibNumber ?? '');
    setTop(attempt.top);
    setTopAttempts(attempt.topAttempts != null ? String(attempt.topAttempts) : '');
    setZone(attempt.zone);
    setZoneAttempts(attempt.zoneAttempts != null ? String(attempt.zoneAttempts) : '');
    setHeight(attempt.height != null ? String(attempt.height) : '');
    setError(null);
    setSavedMessage(null);
  }

  // `topAttempts ?? 1` in the scoring strategies means a missing count scores
  // as a flash — the most generous possible reading. Ask for the number here
  // rather than let the tiebreak be invented downstream.
  function validationError(): string | null {
    if (!matchedRegistration) {
      return 'Ese dorsal no corresponde a nadie inscrito en esta categoría.';
    }
    if (discipline === 'boulder') {
      if (top && !topAttempts) {
        return 'Falta en cuántos intentos logró el top.';
      }
      if (zone && !zoneAttempts) {
        return 'Falta en cuántos intentos logró la zona.';
      }
      return null;
    }
    if (!height) {
      return 'Falta la altura alcanzada.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedMessage(null);

    const problem = validationError();
    if (problem || !matchedRegistration) {
      setError(problem);
      return;
    }
    setError(null);

    const attempt: PendingAttempt = {
      clientAttemptId: crypto.randomUUID(),
      registrationId: matchedRegistration.id,
      problemId,
      judgeLabel: judgeName,
      top,
      topAttempts: topAttempts ? Number(topAttempts) : null,
      zone,
      zoneAttempts: zoneAttempts ? Number(zoneAttempts) : null,
      height: height ? Number(height) : null,
      capturedAt: new Date().toISOString(),
    };

    await addPending(attempt);
    setSessionAttempts((prev) => [...prev, attempt]);
    setPendingIds((prev) => new Set(prev).add(attempt.clientAttemptId));
    setSavedMessage(`Guardado para ${matchedRegistration.athleteFullName} (dorsal ${bib}).`);
    resetForm();
    void drain();
  }

  function statusFor(clientAttemptId: string): AttemptStatus {
    if (rejectedIds.has(clientAttemptId)) {
      return 'rejected';
    }
    return pendingIds.has(clientAttemptId) ? 'pending' : 'synced';
  }

  function bibFor(registrationId: string): string {
    const registration = registrations.find((r) => r.id === registrationId);
    return registration?.bibNumber ? `#${registration.bibNumber}` : '—';
  }

  const attemptsForThisBlock = sessionAttempts.filter((a) => a.problemId === problemId);
  const unsyncedCount = pendingIds.size;

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-cardborder bg-white p-3"
      >
        <input
          type="text"
          inputMode="numeric"
          placeholder="Dorsal"
          value={bib}
          onChange={(event) => setBib(event.target.value)}
          required
          className={fieldClass}
        />
        {bib && !matchedRegistration && (
          <p className="text-sm text-red-700">Dorsal no encontrado en esta categoría.</p>
        )}
        {matchedRegistration && (
          <p className="text-sm text-muted">{matchedRegistration.athleteFullName}</p>
        )}

        {discipline === 'boulder' ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={top} onChange={(event) => setTop(event.target.checked)} />
              Top
            </label>
            {top && (
              <input
                type="number"
                min={1}
                placeholder="Intentos hasta el top"
                value={topAttempts}
                onChange={(event) => setTopAttempts(event.target.value)}
                className={fieldClass}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={zone} onChange={(event) => setZone(event.target.checked)} />
              Zona
            </label>
            {zone && (
              <input
                type="number"
                min={1}
                placeholder="Intentos hasta la zona"
                value={zoneAttempts}
                onChange={(event) => setZoneAttempts(event.target.value)}
                className={fieldClass}
              />
            )}
          </>
        ) : (
          <input
            type="number"
            min={0}
            step="0.1"
            placeholder="Altura alcanzada (m)"
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            className={fieldClass}
          />
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}
        {savedMessage && <p className="text-sm text-pine">{savedMessage}</p>}
        <button type="submit" className={primaryButtonClass}>
          Guardar intento
        </button>
      </form>

      <p className="text-xs text-muted">
        {unsyncedCount > 0 ? `${unsyncedCount} sin sincronizar` : 'Todo sincronizado'}
      </p>

      <RecentAttempts
        attempts={attemptsForThisBlock}
        bibFor={bibFor}
        statusFor={statusFor}
        onSelect={loadForCorrection}
      />
    </div>
  );
}
