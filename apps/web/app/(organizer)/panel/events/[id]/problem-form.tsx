'use client';

import { useState, type FormEvent } from 'react';
import { createProblem } from './actions';
import { fieldClass, labelClass, secondaryButtonClass } from '@/lib/ui';
import { AddPanel } from './add-panel';

export function ProblemForm({
  eventId,
  roundId,
  nextNumber,
  scoringFormat,
  unit,
}: {
  eventId: string;
  roundId: string;
  nextNumber: number;
  scoringFormat: string;
  unit: { singular: string; plural: string };
}) {
  const [number, setNumber] = useState(String(nextNumber));
  const [name, setName] = useState('');
  const [topPoints, setTopPoints] = useState('');
  const [zonePoints, setZonePoints] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLeaguePoints = scoringFormat === 'league_points';

  async function submit(event: FormEvent<HTMLFormElement>, close: () => void) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const submittedNumber = Number(number);
    const result = await createProblem({
      eventId,
      roundId,
      number: submittedNumber,
      name: name || undefined,
      topPoints: isLeaguePoints && topPoints ? Number(topPoints) : undefined,
      zonePoints: isLeaguePoints && zonePoints ? Number(zonePoints) : undefined,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // El número siguiente queda listo: crear ocho bloques seguidos es un solo
    // gesto repetido, no ocho formularios.
    setNumber(String(submittedNumber + 1));
    setName('');
    setTopPoints('');
    setZonePoints('');
    close();
  }

  return (
    <AddPanel label={`Agregar ${unit.singular}`} tone="problem">
      {(close) => (
        <form onSubmit={(event) => void submit(event, close)} className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex w-24 shrink-0 flex-col gap-1.5">
              <label htmlFor={`problem-number-${roundId}`} className={labelClass}>
                Número
              </label>
              <input
                id={`problem-number-${roundId}`}
                type="number"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                required
                min={1}
                className={`${fieldClass} text-center font-display font-bold`}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor={`problem-name-${roundId}`} className={labelClass}>
                Nombre
              </label>
              <input
                id={`problem-name-${roundId}`}
                type="text"
                placeholder="Opcional"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          {isLeaguePoints && (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor={`problem-top-points-${roundId}`} className={labelClass}>
                  Puntos por top
                </label>
                <input
                  id={`problem-top-points-${roundId}`}
                  type="number"
                  value={topPoints}
                  onChange={(event) => setTopPoints(event.target.value)}
                  required
                  min={1}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor={`problem-zone-points-${roundId}`} className={labelClass}>
                  Puntos por zona
                </label>
                <input
                  id={`problem-zone-points-${roundId}`}
                  type="number"
                  placeholder="Opcional"
                  value={zonePoints}
                  onChange={(event) => setZonePoints(event.target.value)}
                  min={0}
                  className={fieldClass}
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
            {isSubmitting ? 'Creando…' : `Crear ${unit.singular}`}
          </button>
        </form>
      )}
    </AddPanel>
  );
}
