'use client';

import { useState, useTransition } from 'react';
import { fieldClass } from '@/lib/ui';
import { setRoundAdvances } from './actions';

/**
 * Cuántos pasan de una ronda a la siguiente.
 *
 * Vive en la ronda que recorta, no en la que recibe: el organizador piensa
 * «de la clasificatoria pasan 8», no «la semifinal la corren 8».
 *
 * No se muestra en la última ronda — de una final no pasa nadie a ningún lado.
 */
export function RoundAdvances({
  eventId,
  roundId,
  advances,
}: {
  eventId: string;
  roundId: string;
  advances: number | null;
}) {
  const [value, setValue] = useState(advances === null ? '' : String(advances));
  const [saved, setSaved] = useState(advances === null ? '' : String(advances));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function commit() {
    const next = value.trim();
    if (next === saved) {
      return;
    }
    startTransition(async () => {
      const result = await setRoundAdvances({
        eventId,
        roundId,
        advances: next === '' ? null : Number(next),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSaved(next);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`advances-${roundId}`} className="text-sm font-medium text-bark">
        Cuántos pasan a la siguiente ronda
      </label>
      <div className="flex items-center gap-3">
        <input
          id={`advances-${roundId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          placeholder="todos"
          inputMode="numeric"
          className={`${fieldClass} w-24 py-2 text-center font-display font-bold`}
        />
        {isPending && <span className="text-xs text-muted">Guardando…</span>}
      </div>
      <p className="text-xs text-muted">
        Define cuántos competidores pasan a la siguiente ronda. Déjalo vacío para que pasen todos.
        Si el corte cae en mitad de un empate, pasan todos los empatados.
      </p>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
