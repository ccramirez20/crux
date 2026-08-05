'use client';

import { useState, type FormEvent } from 'react';
import { ROUND_TYPES, type RoundType } from '@crux/core';
import { createRound } from './actions';
import { fieldClass, secondaryButtonClass } from '@/lib/ui';

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await createRound({ eventId, categoryId, type });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-cardborder bg-white p-2">
      <select
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
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
        Agregar ronda
      </button>
    </form>
  );
}
