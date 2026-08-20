'use client';

import { useState, type FormEvent } from 'react';
import { GENDERS, isEligible, isMinor, parseDateOnly, type Gender } from '@crux/core';
import { registerAthlete } from './actions';
import { fieldClass, primaryButtonClass } from '@/lib/ui';
import { PrivacyNotice } from '@/components/privacy-notice';
import { DateField } from '@/components/date-field';

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
  eventDate,
  categories,
}: {
  eventId: string;
  eventDate: string | null;
  categories: Category[];
}) {
  const [fullName, setFullName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [minorAuthorizedBy, setMinorAuthorizedBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edad legal real, hoy — no la del evento: es sobre si alguien puede
  // autorizar sus propios datos ahora mismo, no en qué categoría compite.
  const minor = birthDate ? isMinor(birthDate) : false;

  const referenceDate = eventDate ? parseDateOnly(eventDate) : undefined;
  const eligibleCategories =
    birthDate && gender
      ? categories.filter((category) =>
          isEligible(category, parseDateOnly(birthDate), gender, referenceDate),
        )
      : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gender) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await registerAthlete({
        eventId,
        categoryId,
        fullName,
        documentId,
        birthDate,
        gender,
        minorAuthorizedBy: minor ? minorAuthorizedBy : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const category = categories.find((c) => c.id === categoryId);
      setSuccess(`Quedaste inscrito en ${category?.name ?? 'la categoría seleccionada'}.`);
    } catch {
      setError('No se pudo completar la inscripción, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border-2 border-pine bg-card p-5 text-center">
        <p className="font-display text-xl font-semibold text-pine">{success}</p>
        <p className="text-sm text-muted">
          El día del evento te asignan un dorsal y los jueces registran tus intentos con ese
          número. No necesitas crear una cuenta ni instalar nada.
        </p>
        {/* Se dice aquí y no solo cuando alguien falla al reintentar: quien se
            equivocó de categoría lo nota justo al leer en cuál quedó, y sin
            este aviso vuelve al enlace a intentar corregirlo por su cuenta —
            cosa que no puede hacer, porque no hay cuenta de atleta. */}
        <p className="text-sm text-bark">
          ¿Te equivocaste de categoría? Avísale a quien organiza: solo ellos pueden cambiarte.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="full-name" className="text-sm font-medium text-bark">
          Nombre completo
        </label>
        <input
          id="full-name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="document-id" className="text-sm font-medium text-bark">
          Documento de identidad
        </label>
        <input
          id="document-id"
          type="text"
          inputMode="numeric"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
          required
          className={fieldClass}
        />
        <p className="text-xs text-muted">
          Con él reconocemos que eres tú si vuelves a competir, y así se conserva tu historial.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="birth-date" className="text-sm font-medium text-bark">
          Fecha de nacimiento
        </label>
        <DateField
          id="birth-date"
          value={birthDate}
          onChange={(value) => {
            setBirthDate(value);
            setCategoryId('');
          }}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="gender" className="text-sm font-medium text-bark">
          Género
        </label>
        <select
          id="gender"
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
          <option value="">Elige una opción</option>
          <option value="male">Masculino</option>
          <option value="female">Femenino</option>
          <option value="mixed">Otro</option>
        </select>
      </div>

      {!birthDate || !gender ? (
        <p className="rounded-lg bg-card px-4 py-3 text-sm text-muted">
          Completa tu fecha de nacimiento y género para ver en qué categorías puedes competir.
        </p>
      ) : eligibleCategories.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-sm font-medium text-bark">
            Tu categoría
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Elige una opción</option>
            {eligibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">
            Solo aparecen las categorías que corresponden a tu edad y género.
          </p>
        </div>
      ) : (
        <p className="rounded-lg border-2 border-bark bg-card px-4 py-3 text-sm text-bark">
          Este evento no tiene ninguna categoría para tu edad y género. Si crees que es un error,
          escríbele a quien organiza.
        </p>
      )}

      {minor && (
        <div className="flex flex-col gap-1">
          <label htmlFor="minor-authorized-by" className="text-sm font-medium text-bark">
            Nombre de quien autoriza (padre, madre o acudiente)
          </label>
          <input
            id="minor-authorized-by"
            type="text"
            autoComplete="name"
            value={minorAuthorizedBy}
            onChange={(event) => setMinorAuthorizedBy(event.target.value)}
            required
            className={fieldClass}
          />
          <p className="text-xs text-muted">
            El competidor es menor de edad. Su padre, madre o acudiente debe hacer la inscripción
            y autorizar el tratamiento de sus datos escribiendo su nombre aquí.
          </p>
        </div>
      )}

      <PrivacyNotice variant="inscripcion" />

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting || !categoryId || (minor && !minorAuthorizedBy.trim())}
        className={primaryButtonClass}
      >
        {isSubmitting ? 'Inscribiendo…' : 'Inscribirme'}
      </button>
    </form>
  );
}
