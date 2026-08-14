'use client';

import { useState, type FormEvent } from 'react';
import { fieldClass, labelClass, secondaryButtonClass } from '@/lib/ui';
import { updateEvent } from './actions';
import { generateCode } from '@/lib/codes';

const COMMON_TIMEZONES = [
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'Europe/Madrid', label: 'España (Madrid)' },
];

export function EventForm({
  eventId,
  name: initialName,
  date: initialDate,
  registrationDeadline: initialDeadline,
  timezone: initialTimezone,
  judgeCode: initialJudgeCode,
}: {
  eventId: string;
  name: string;
  date: string | null;
  registrationDeadline: string | null;
  timezone: string;
  judgeCode: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate ?? '');
  const [deadline, setDeadline] = useState(initialDeadline ?? '');
  const [timezone, setTimezone] = useState(initialTimezone);
  const [judgeCode, setJudgeCode] = useState(initialJudgeCode ?? generateCode());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Una zona horaria que no está entre las comunes (un evento fuera de la
  // región) no puede desaparecer del select solo por no estar en la lista.
  const timezones = COMMON_TIMEZONES.some((tz) => tz.value === initialTimezone)
    ? COMMON_TIMEZONES
    : [...COMMON_TIMEZONES, { value: initialTimezone, label: initialTimezone }];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await updateEvent({
      eventId,
      name,
      date: date === '' ? null : date,
      registrationDeadline: deadline === '' ? null : deadline,
      timezone,
      judgeCode,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-fit rounded border-[1.5px] border-pine px-3 py-1.5 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
      >
        Editar el evento
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3 rounded-lg border border-pine bg-card p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-name" className={labelClass}>
          Nombre del evento
        </label>
        <input
          id="event-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-date" className={labelClass}>
          Fecha del evento
        </label>
        <input
          id="event-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={fieldClass}
        />
        <p className="text-xs text-muted">
          Con esta fecha se calcula la edad de cada competidor. Cambiarla ahora no vuelve a
          revisar a quien ya se inscribió: su categoría se decidió con la fecha que había ese día.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-deadline" className={labelClass}>
          Inscripciones hasta
        </label>
        <input
          id="event-deadline"
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className={fieldClass}
        />
        <p className="text-xs text-muted">
          Último día que el enlace acepta inscripciones, contando el día entero en la zona
          horaria del evento. Déjalo vacío y no se cierra nunca. Si alguien llega tarde y quieres
          dejarlo entrar, corre la fecha y el enlace vuelve a abrir.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-timezone" className={labelClass}>
          Zona horaria
        </label>
        <select
          id="event-timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className={fieldClass}
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-judge-code" className={labelClass}>
          Código para los jueces
        </label>
        <div className="flex gap-2">
          <input
            id="event-judge-code"
            value={judgeCode}
            onChange={(event) => setJudgeCode(event.target.value.toUpperCase())}
            required
            minLength={4}
            maxLength={32}
            className={`${fieldClass} font-display font-bold tracking-widest`}
          />
          <button
            type="button"
            onClick={() => setJudgeCode(generateCode())}
            className="shrink-0 rounded border-[1.5px] border-pine px-3 text-xs font-semibold text-pine transition hover:bg-pine hover:text-white"
          >
            Otro
          </button>
        </div>
        <p className="text-xs text-muted">
          Cámbialo si se filtró. Los teléfonos que ya estaban juzgando van a pedirlo otra vez, y
          los intentos que tengan sin enviar esperan en el teléfono hasta que lo escriban: no se
          pierde ninguno.
        </p>
      </div>

      {/* Lo que no se puede editar, dicho donde se busca. Callar esto manda al
          organizador a buscar un campo que no existe. */}
      <p className="rounded border-l-4 border-bark bg-stone/60 px-3 py-2 text-xs text-muted">
        El enlace público, la modalidad y la forma de puntuar no se cambian. El enlace vive dentro
        de cada QR impreso y de lo que ya compartiste; los otros dos reinterpretarían intentos ya
        capturados. Si alguno quedó mal y todavía no has capturado nada, borra el evento y créalo
        de nuevo.
      </p>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className={secondaryButtonClass}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded px-3 py-1.5 text-sm font-medium text-muted underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
