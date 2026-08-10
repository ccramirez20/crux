'use client';

import { useState, type FormEvent } from 'react';
import { ROUND_TYPES, type RoundType } from '@crux/core';
import { createRound } from './actions';
import { fieldClass, labelClass, secondaryButtonClass } from '@/lib/ui';
import { AddPanel } from './add-panel';

function isRoundType(value: string): value is RoundType {
  return (ROUND_TYPES as readonly string[]).includes(value);
}

const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  qualification: 'Clasificatoria',
  semifinal: 'Semifinal',
  final: 'Final',
};

export function RoundForm({ eventId, categoryId }: { eventId: string; categoryId: string }) {
  const [type, setType] = useState<RoundType>('qualification');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, close: () => void) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await createRound({ eventId, categoryId, type });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    close();
  }

  return (
    <AddPanel label="Agregar ronda" tone="round">
      {(close) => (
        <form onSubmit={(event) => void submit(event, close)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`round-type-${categoryId}`} className={labelClass}>
              Tipo de ronda
            </label>
            <select
              id={`round-type-${categoryId}`}
              value={type}
              onChange={(event) => {
                if (isRoundType(event.target.value)) {
                  setType(event.target.value);
                }
              }}
              className={fieldClass}
            >
              {ROUND_TYPES.map((roundType) => (
                <option key={roundType} value={roundType}>
                  {ROUND_TYPE_LABELS[roundType]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              Las rondas se ordenan solas: clasificatoria, semifinal, final.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
            {isSubmitting ? 'Creando…' : 'Crear ronda'}
          </button>
        </form>
      )}
    </AddPanel>
  );
}
