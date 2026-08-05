'use client';

import { useState, type FormEvent } from 'react';
import { GENDERS, type Gender } from '@crux/core';
import { createCategory } from './actions';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

export function CategoryForm({ eventId }: { eventId: string }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [level, setLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await createCategory({
      eventId,
      name,
      gender: gender || undefined,
      minAge: minAge ? Number(minAge) : undefined,
      maxAge: maxAge ? Number(maxAge) : undefined,
      level: level || undefined,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName('');
    setGender('');
    setMinAge('');
    setMaxAge('');
    setLevel('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-cardborder bg-white p-4">
      <h2 className="font-display font-semibold">Agregar categoría</h2>
      <input
        type="text"
        placeholder="Nombre"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        className={fieldClass}
      />
      <select
        value={gender}
        onChange={(event) => {
          const value = event.target.value;
          if (value === '' || isGender(value)) {
            setGender(value);
          }
        }}
        className={fieldClass}
      >
        <option value="">Cualquier género</option>
        <option value="male">Masculino</option>
        <option value="female">Femenino</option>
        <option value="mixed">Mixto</option>
      </select>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Edad mín."
          value={minAge}
          onChange={(event) => setMinAge(event.target.value)}
          className={`w-1/2 ${fieldClass}`}
        />
        <input
          type="number"
          placeholder="Edad máx."
          value={maxAge}
          onChange={(event) => setMaxAge(event.target.value)}
          className={`w-1/2 ${fieldClass}`}
        />
      </div>
      <input
        type="text"
        placeholder="Nivel"
        value={level}
        onChange={(event) => setLevel(event.target.value)}
        className={fieldClass}
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        Agregar categoría
      </button>
    </form>
  );
}
