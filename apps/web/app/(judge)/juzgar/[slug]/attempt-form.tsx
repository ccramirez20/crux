'use client';

import { useState, type FormEvent } from 'react';
import { parseHeight } from '@/lib/height';
import { fieldClass } from '@/lib/ui';
import type { JudgeRegistration } from './capture-app';

// Every control a judge taps mid-round is at least this tall. Thumb targets,
// not mouse targets — this screen is used one-handed while watching a wall.
const TAP_TARGET = 'min-h-14';

export interface AttemptValues {
  top: boolean;
  topAttempts: number | null;
  zone: boolean;
  zoneAttempts: number | null;
  height: number | null;
}

function AchievementToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
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
      <span className={`text-sm ${active ? 'text-sage' : 'text-muted'}`}>{active ? 'sí' : 'no'}</span>
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
        <span aria-live="polite" className="w-10 text-center font-display text-2xl font-bold tabular-nums">
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

export function AttemptForm({
  discipline,
  registration,
  initial,
  alreadyJudged,
  onSave,
  onClose,
}: {
  discipline: string;
  registration: JudgeRegistration;
  initial: AttemptValues | null;
  alreadyJudged: boolean;
  onSave: (values: AttemptValues) => Promise<void>;
  onClose: () => void;
}) {
  const [top, setTop] = useState(initial?.top ?? false);
  const [topAttempts, setTopAttempts] = useState(
    initial?.topAttempts != null ? String(initial.topAttempts) : '',
  );
  const [zone, setZone] = useState(initial?.zone ?? false);
  const [zoneAttempts, setZoneAttempts] = useState(
    initial?.zoneAttempts != null ? String(initial.zoneAttempts) : '',
  );
  const [height, setHeight] = useState(initial?.height != null ? String(initial.height) : '');
  const [error, setError] = useState<string | null>(null);

  const isBoulder = discipline === 'boulder';

  function validationError(): string | null {
    if (isBoulder) {
      if (top && !topAttempts) {
        return 'Falta en cuántos intentos logró el top.';
      }
      if (zone && !zoneAttempts) {
        return 'Falta en cuántos intentos logró la zona.';
      }
      return null;
    }
    // En dificultad el top es "llegó al final de la vía": vale por sí solo,
    // sin altura, porque no hay altura mayor que esa.
    if (top) {
      return null;
    }
    if (!height) {
      return 'Falta la altura alcanzada.';
    }
    return parseHeight(height) === null
      ? 'La altura no se entiende. Escríbela en metros, por ejemplo 18,5.'
      : null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validationError();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    await onSave({
      top,
      topAttempts: topAttempts ? Number(topAttempts) : null,
      zone,
      zoneAttempts: zoneAttempts ? Number(zoneAttempts) : null,
      height: height ? parseHeight(height) : null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border-2 border-gold bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-xs uppercase tracking-wide text-muted">
            {alreadyJudged ? 'Corrigiendo' : 'Registrando'}
          </span>
          <span className="font-display text-lg font-semibold">
            {registration.bibNumber ? `${registration.bibNumber} · ` : ''}
            {registration.athleteFullName}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm font-medium text-pine underline"
        >
          Cerrar
        </button>
      </div>

      {alreadyJudged && (
        <p className="rounded bg-stone px-3 py-2 text-xs text-bark">
          Ya tiene un resultado en este bloque. Si guardas, queda el nuevo — el anterior no se
          borra, se conserva para poder auditar el evento.
        </p>
      )}

      {isBoulder ? (
        <>
          <AchievementToggle
            label="Top"
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
            active={zone}
            onToggle={() => {
              setZone(!zone);
              if (zone) setZoneAttempts('');
            }}
          />
          {zone && (
            <AttemptStepper
              label="Intentos hasta la zona"
              value={zoneAttempts}
              onChange={setZoneAttempts}
            />
          )}

          {!top && !zone && (
            <p className="text-xs text-muted">Sin top ni zona: se registra como intento sin logro.</p>
          )}
        </>
      ) : (
        <>
          <AchievementToggle
            label="Llegó al top"
            active={top}
            onToggle={() => {
              setTop(!top);
              setError(null);
            }}
          />

          {top ? (
            <p className="text-xs text-muted">
              Terminó la vía. No hace falta altura: nadie llega más arriba que el final.
            </p>
          ) : (
            <>
              <label htmlFor="height" className="text-sm font-medium text-bark">
                Altura alcanzada, en metros
              </label>
              {/* Texto y no number: el teclado en español entrega coma, y un
                  campo numérico la descarta sin avisar — "18,5" se guardaba
                  como 185. parseHeight acepta las dos formas. */}
              <input
                id="height"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="18,5"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                className={`${fieldClass} text-center font-display text-3xl font-bold`}
              />
            </>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        className={`${TAP_TARGET} rounded-lg bg-gold px-6 font-display text-lg font-bold text-ink transition hover:brightness-95`}
      >
        {alreadyJudged ? 'Guardar corrección' : 'Guardar intento'}
      </button>
    </form>
  );
}
