'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentAttempt } from '@/app/api/attempts/route';
import {
  addPending,
  listPending,
  newClientAttemptId,
  removeSynced,
  syncOutcome,
  type PendingAttempt,
} from './attempt-queue';
import { AthleteRoster, type RosterEntry } from './athlete-roster';
import { AttemptForm, type AttemptValues } from './attempt-form';
import type { JudgeRegistration } from './capture-app';

const SYNC_INTERVAL_MS = 5000;

function describe(values: AttemptValues): string {
  // El top va primero: en dificultad llega sin contador de intentos y sin
  // altura, y es el mejor resultado posible en la vía.
  if (values.top) {
    return values.topAttempts != null ? `Top en ${values.topAttempts}` : 'Top';
  }
  if (values.zone) {
    return `Zona en ${values.zoneAttempts ?? '?'}`;
  }
  if (values.height != null) {
    return `${values.height.toLocaleString('es-CO')} m`;
  }
  // "Sin logro" calificaba el intento; esto solo lo nombra. Es además la
  // palabra que ya usa el resto del producto para lo mismo — la tabla pinta ese
  // bloque como intentado y la pantalla de proyección dice "intentó el B3".
  return 'Intentado';
}

export function AttemptCapture({
  discipline,
  problemId,
  judgeName,
  judgeCode,
  registrations,
  onCodeRejected,
}: {
  discipline: string;
  problemId: string;
  judgeName: string;
  judgeCode: string | null;
  registrations: JudgeRegistration[];
  onCodeRejected: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // What this device captured but hasn't handed over yet.
  const [queued, setQueued] = useState<PendingAttempt[]>([]);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  // What the server says, including attempts other judges made on other phones.
  const [serverAttempts, setServerAttempts] = useState<CurrentAttempt[]>([]);
  const [isOnline, setIsOnline] = useState(true);

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

  const sync = useCallback(async () => {
    if (drainingRef.current) {
      return;
    }
    drainingRef.current = true;
    try {
      const pending = await listPending();
      setQueued(pending);

      const ordered = [...pending].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      for (const attempt of ordered) {
        let status: number | 'offline';
        try {
          // judgeCode is overridden with the live prop, not attempt.judgeCode:
          // a code rotated after this attempt was queued would otherwise keep
          // resending the stale one forever, stuck asking for a code that
          // re-entering it can never fix (it only affects new captures).
          const response = await fetch('/api/attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...attempt, judgeCode }),
          });
          status = response.status;
        } catch {
          status = 'offline';
        }

        // What each answer means for a captured attempt lives in syncOutcome,
        // which is pure and tested. Here we only carry it out.
        const outcome = syncOutcome(status);
        if (outcome === 'ask-for-code') {
          onCodeRejected();
          break;
        }
        if (outcome === 'stop') {
          break;
        }
        if (outcome === 'rejected') {
          setRejectedIds((prev) => new Set(prev).add(attempt.clientAttemptId));
        }
        await removeSynced(attempt.clientAttemptId);
        setQueued((prev) => prev.filter((a) => a.clientAttemptId !== attempt.clientAttemptId));
      }

      // Refresh the roster afterwards so it reflects both what just synced and
      // whatever another judge recorded meanwhile.
      try {
        const response = await fetch(`/api/attempts?problemId=${problemId}`);
        const body: unknown = await response.json();
        if (
          typeof body === 'object' &&
          body !== null &&
          'ok' in body &&
          body.ok === true &&
          'attempts' in body &&
          Array.isArray(body.attempts)
        ) {
          setServerAttempts(body.attempts);
        }
      } catch {
        // Still offline; the roster keeps showing what we already know.
      }
    } finally {
      drainingRef.current = false;
    }
  }, [problemId, judgeCode, onCodeRejected]);

  useEffect(() => {
    void sync();
    const interval = setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sync]);

  // Syncing on the `online` event makes catch-up feel immediate instead of
  // waiting out up to a full interval after the wifi comes back.
  useEffect(() => {
    function update() {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        void sync();
      }
    }
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [sync]);

  const queuedForBlock = queued.filter((attempt) => attempt.problemId === problemId);

  function latestFor(registrationId: string): { values: AttemptValues; pending: boolean; judge: string | null } | null {
    // Anything still in this device's queue is newer than anything the server
    // could report, because it hasn't reached the server yet.
    const mine = queuedForBlock
      .filter((attempt) => attempt.registrationId === registrationId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
    if (mine) {
      return { values: mine, pending: true, judge: mine.judgeLabel };
    }
    const theirs = serverAttempts.find((attempt) => attempt.registrationId === registrationId);
    return theirs ? { values: theirs, pending: false, judge: theirs.judgeLabel } : null;
  }

  const entries: RosterEntry[] = registrations.map((registration) => {
    const latest = latestFor(registration.id);
    return {
      registration,
      result: latest ? describe(latest.values) : null,
      isPending: latest?.pending ?? false,
      judgedBy: latest?.judge ?? null,
    };
  });

  const selected = registrations.find((registration) => registration.id === selectedId) ?? null;
  const selectedLatest = selectedId ? latestFor(selectedId) : null;

  async function save(values: AttemptValues) {
    if (!selected) {
      return;
    }
    const attempt: PendingAttempt = {
      clientAttemptId: newClientAttemptId(),
      registrationId: selected.id,
      problemId,
      judgeLabel: judgeName,
      judgeCode,
      capturedAt: new Date().toISOString(),
      ...values,
    };
    await addPending(attempt);
    setQueued((prev) => [...prev, attempt]);
    setSavedMessage(`${describe(values)} · ${selected.athleteFullName}`);
    setSelectedId(null);
    void sync();
  }

  const unsyncedCount = queued.length;
  const rejectedCount = rejectedIds.size;

  return (
    <div className="flex flex-col gap-3">
      {!isOnline && (
        <p className="rounded-lg border-2 border-bark bg-bark px-4 py-3 text-sm font-medium text-stone">
          Sin conexión. Lo que registres se guarda en el teléfono y se envía solo cuando vuelva la
          señal.
        </p>
      )}

      {savedMessage && !selected && (
        <p role="status" className="rounded-lg bg-pine px-4 py-3 text-sm font-medium text-stone">
          Guardado · {savedMessage}
        </p>
      )}

      {selected ? (
        <AttemptForm
          key={selected.id}
          discipline={discipline}
          problemId={problemId}
          registration={selected}
          initial={selectedLatest?.values ?? null}
          alreadyJudged={selectedLatest !== null}
          onSave={save}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <AthleteRoster
          entries={entries}
          selectedId={selectedId}
          onSelect={(registrationId) => {
            setSavedMessage(null);
            setSelectedId(registrationId);
          }}
        />
      )}

      <p className="text-center text-xs text-muted">
        {unsyncedCount > 0
          ? `${unsyncedCount} ${unsyncedCount === 1 ? 'intento' : 'intentos'} por enviar`
          : 'Todo enviado'}
        {rejectedCount > 0 && ` · ${rejectedCount} no se pudo enviar`}
      </p>
    </div>
  );
}
