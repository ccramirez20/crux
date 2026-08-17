'use client';

import { useState, type FormEvent } from 'react';
import { GENDERS, type Gender } from '@crux/core';
import { createCategory } from './actions';
import { fieldClass, labelClass, primaryButtonClass } from '@/lib/ui';
import { AddPanel } from './add-panel';

function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

export function CategoryForm({ eventId }: { eventId: string }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('mixed');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [level, setLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, close: () => void) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await createCategory({
      eventId,
      name,
      gender,
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
    setGender('mixed');
    setMinAge('');
    setMaxAge('');
    setLevel('');
    close();
  }

  return (
    <AddPanel label="Agregar categoría" tone="category">
      {(close) => (
        <form onSubmit={(event) => void submit(event, close)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-name" className={labelClass}>
              Nombre de la categoría
            </label>
            <input
              id="category-name"
              type="text"
              placeholder="Avanzado Masculino"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-gender" className={labelClass}>
              Género
            </label>
            <select
              id="category-gender"
              value={gender}
              onChange={(event) => {
                const value = event.target.value;
                if (isGender(value)) {
                  setGender(value);
                }
              }}
              className={fieldClass}
            >
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="mixed">Mixto</option>
            </select>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={labelClass}>Edad, en años</legend>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                aria-label="Edad mínima"
                placeholder="Desde"
                value={minAge}
                onChange={(event) => setMinAge(event.target.value)}
                className={`w-1/2 ${fieldClass}`}
              />
              <span className="text-sm text-muted">a</span>
              <input
                type="number"
                aria-label="Edad máxima"
                placeholder="Hasta"
                value={maxAge}
                onChange={(event) => setMaxAge(event.target.value)}
                className={`w-1/2 ${fieldClass}`}
              />
            </div>
            <p className="text-xs text-muted">Déjalas en blanco si la categoría no tiene tope.</p>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-level" className={labelClass}>
              Nivel
            </label>
            <input
              id="category-level"
              type="text"
              placeholder="Principiante, intermedio, élite…"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className={fieldClass}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? 'Creando…' : 'Crear categoría'}
          </button>
        </form>
      )}
    </AddPanel>
  );
}
