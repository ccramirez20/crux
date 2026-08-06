'use client';

import { useState, type FormEvent } from 'react';
import { GENDERS, isEligible, parseDateOnly, type Gender } from '@crux/core';
import { registerAthlete } from './actions';
import { fieldClass, primaryButtonClass } from '@/lib/ui';

type Category = {
  id: string;
  name: string;
  gender: Gender | null;
  minAge: number | null;
  maxAge: number | null;
};

function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

export function RegistrationForm({
  eventId,
  categories,
}: {
  eventId: string;
  categories: Category[];
}) {
  const [fullName, setFullName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eligibleCategories =
    birthDate && gender
      ? categories.filter((category) => isEligible(category, parseDateOnly(birthDate), gender))
      : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gender) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await registerAthlete({
      eventId,
      categoryId,
      fullName,
      documentId,
      birthDate,
      gender,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const category = categories.find((c) => c.id === categoryId);
    setSuccess(`Quedaste inscrito en ${category?.name ?? 'la categoría seleccionada'}.`);
  }

  if (success) {
    return (
      <p className="text-center font-display text-lg font-semibold text-pine">{success}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <input
        type="text"
        placeholder="Nombre completo"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        required
        className={fieldClass}
      />
      <input
        type="text"
        placeholder="Documento de identidad"
        value={documentId}
        onChange={(event) => setDocumentId(event.target.value)}
        required
        className={fieldClass}
      />
      <input
        type="date"
        value={birthDate}
        onChange={(event) => {
          setBirthDate(event.target.value);
          setCategoryId('');
        }}
        required
        className={fieldClass}
      />
      <select
        value={gender}
        onChange={(event) => {
          const value = event.target.value;
          if (value === '' || isGender(value)) {
            setGender(value);
            setCategoryId('');
          }
        }}
        required
        className={fieldClass}
      >
        <option value="">Género</option>
        <option value="male">Masculino</option>
        <option value="female">Femenino</option>
        <option value="mixed">Otro</option>
      </select>

      {birthDate && gender && eligibleCategories.length > 0 && (
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          required
          className={fieldClass}
        >
          <option value="">Elige tu categoría</option>
          {eligibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      )}
      {birthDate && gender && eligibleCategories.length === 0 && (
        <p className="text-sm text-muted">
          No hay categorías disponibles para tu edad y género en este evento.
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={isSubmitting || !categoryId} className={primaryButtonClass}>
        Inscribirme
      </button>
    </form>
  );
}
