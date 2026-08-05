'use client';

import { useState, type FormEvent } from 'react';
import { createProblem } from './actions';
import { fieldClass, secondaryButtonClass } from '@/lib/ui';

export function ProblemForm({
  eventId,
  roundId,
  nextNumber,
}: {
  eventId: string;
  roundId: string;
  nextNumber: number;
}) {
  const [number, setNumber] = useState(String(nextNumber));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const submittedNumber = Number(number);
    const result = await createProblem({
      eventId,
      roundId,
      number: submittedNumber,
      name: name || undefined,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNumber(String(submittedNumber + 1));
    setName('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-cardborder bg-white p-2">
      <input
        type="number"
        value={number}
        onChange={(event) => setNumber(event.target.value)}
        required
        min={1}
        className={`w-20 ${fieldClass}`}
      />
      <input
        type="text"
        placeholder="Nombre (opcional)"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={fieldClass}
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
        Agregar bloque
      </button>
    </form>
  );
}
