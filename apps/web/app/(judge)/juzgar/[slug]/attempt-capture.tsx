'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { fieldClass } from '@/lib/ui';
import { addPending, listPending, newClientAttemptId, removeSynced, type PendingAttempt } from './attempt-queue';
import type { JudgeRegistration } from './capture-app';
import { RecentAttempts, type AttemptStatus } from './recent-attempts';

const SYNC_INTERVAL_MS = 5000;

// Every control a judge taps mid-round is at least this tall. Thumb targets,
// not mouse targets — this screen is used one-handed while watching a wall.
const TAP_TARGET = 'min-h-14';

function AchievementToggle({
  label,
  hint,
  active,
  onToggle,
}: {
  label: string;
  hint: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`${TAP_TARGET} flex w-full items-center justify-between rounded-lg border-2 px-4 text-left transition ${
        active ? 'border-pine bg-pine text-stone' : 'border-cardborder bg-white text-ink'
      }`}
    >
      <span className="font-display text-lg font-semibold">{label}</span>
      <span className={`text-xs ${active ? 'text-sage' : 'text-muted'}`}>{active ? 'sí' : hint}</span>
    </button>
  );
}

// A number pad covers the field and takes three taps to dismiss. Stepping is
// one tap per attempt, which is also the order the judge counts them in.
// It starts unset on purpose: the scoring strategies read a missing count as
// 1, so an untouched stepper must not look like a flash.
function AttemptStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const current = value ? Number(value) : 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-cardborder bg-white px-4 py-2">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(current > 1 ? String(current - 1) : '')}
          disabled={current === 0}
          aria-label={`Quitar un intento de ${label}`}
          className="h-11 w-11 rounded-lg border-2 border-cardborder font-display text-xl font-bold text-pine disabled:opacity-30"
        >
          −
        </button>
        <span
          aria-live="polite"
          className="w-10 text-center font-display text-2xl font-bold tabular-nums"
        >
          {value || '—'}
        </span>
        <button
          type="button"
          onClick={() => onChange(String(current + 1))}
          aria-label={`Sumar un intento a ${label}`}
          className="h-11 w-11 rounded-lg border-2 border-pine font-display text-xl font-bold text-pine"
        >
          +
        </button>
      </div>
    </div>
  );
}

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
  const [isOnline, setIsOnline] = useState(true);

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

  // Draining on the `online` event makes catch-up feel immediate instead of
  // waiting out up to a full interval after the wifi comes back.
  useEffect(() => {
    function update() {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        void drain();
      }
    }
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
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

  function validationError(): string | null {
    if (!matchedRegistration) {
      return 'Escribe el dorsal de alguien inscrito en esta categoría.';
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
      clientAttemptId: newClientAttemptId(),
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
    setSavedMessage(`Intento guardado: ${matchedRegistration.athleteFullName}, dorsal ${bib}.`);
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
  const isBoulder = discipline === 'boulder';
  const nothingMarked = isBoulder && !top && !zone;

  return (
    <div className="flex flex-col gap-3">
      {!isOnline && (
        <p className="rounded-lg border-2 border-bark bg-bark px-4 py-3 text-sm font-medium text-stone">
          Sin conexión. Lo que registres se guarda en el teléfono y se envía solo cuando vuelva
          la señal.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="bib" className="text-sm font-medium text-bark">
          Dorsal del competidor
        </label>
        <input
          id="bib"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000"
          value={bib}
          onChange={(event) => setBib(event.target.value)}
          required
          className={`${fieldClass} text-center font-display text-3xl font-bold tracking-widest`}
        />

        {/* The name alone reads as a question ("¿Beto Prueba qué?"), so the
            state says out loud whether this dorsal can be judged or not. */}
        {bib && !matchedRegistration && (
          <p className="rounded-lg border-2 border-red-700 bg-white px-4 py-3 text-sm text-red-700">
            Dorsal {bib}: no hay nadie con ese número en esta categoría. Revisa el número o el
            bloque.
          </p>
        )}
        {matchedRegistration && (
          <p className="rounded-lg border-2 border-pine bg-white px-4 py-3">
            <span className="block font-display text-lg font-semibold text-ink">
              {matchedRegistration.athleteFullName}
            </span>
            <span className="block text-sm text-pine">Inscrito en esta categoría, listo para juzgar</span>
          </p>
        )}

        {isBoulder ? (
          <>
            <AchievementToggle
              label="Top"
              hint="no"
              active={top}
              onToggle={() => {
                setTop(!top);
                if (top) setTopAttempts('');
              }}
            />
            {top && (
              <AttemptStepper label="Intentos hasta el top" value={topAttempts} onChange={setTopAttempts} />
            )}

            <AchievementToggle
              label="Zona"
              hint="no"
              active={zone}
              onToggle={() => {
                setZone(!zone);
                if (zone) setZoneAttempts('');
              }}
            />
            {zone && (
              <AttemptStepper label="Intentos hasta la zona" value={zoneAttempts} onChange={setZoneAttempts} />
            )}

            {nothingMarked && (
              <p className="text-xs text-muted">
                Sin top ni zona: se registra como intento sin logro.
              </p>
            )}
          </>
        ) : (
          <>
            <label htmlFor="height" className="text-sm font-medium text-bark">
              Altura alcanzada, en metros
            </label>
            <input
              id="height"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              placeholder="0.0"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              className={`${fieldClass} text-center font-display text-3xl font-bold`}
            />
          </>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {savedMessage && (
          <p role="status" className="text-sm font-medium text-pine">
            {savedMessage}
          </p>
        )}

        <button
          type="submit"
          className={`${TAP_TARGET} rounded-lg bg-gold px-6 font-display text-lg font-bold text-ink transition hover:brightness-95`}
        >
          Guardar intento
        </button>
      </form>

      <p className="text-center text-xs text-muted">
        {unsyncedCount > 0
          ? `${unsyncedCount} ${unsyncedCount === 1 ? 'intento' : 'intentos'} por enviar`
          : 'Todo enviado'}
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
